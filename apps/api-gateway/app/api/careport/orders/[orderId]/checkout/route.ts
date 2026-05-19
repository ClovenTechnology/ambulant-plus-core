//apps/api-gateway/app/api/careport/orders/[orderId]/checkout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { readIdentity } from "@/src/lib/identity";
import {
  correlationIdFromHeaders,
  getActivePricingRule,
  hashRequestBody,
  normalizeIdempotencyKey,
  orgIdFromHeaders,
  requireRole,
  withIdempotency
} from "@/src/lib/careport";
import { buildCarePortBillableEventsFromOrder } from "@ambulant/client-core/src/careport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function asBool(v: unknown, fallback = false) {
  return typeof v === "boolean" ? v : fallback;
}

function asInt(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function cleanString(v: unknown) {
  return String(v ?? "").trim();
}

function normalizePayMethod(v: unknown): "MEDICAL_AID" | "CARD" | "COD" | "" {
  const x = cleanString(v).toUpperCase();
  if (x === "MEDICAL_AID" || x === "CARD" || x === "COD") return x;
  return "";
}

export async function POST(req: NextRequest, { params }: { params: { orderId: string } }) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);
  const correlationId = correlationIdFromHeaders(req.headers);

  try {
    requireRole(who, ["patient", "admin"]);

    const orderId = cleanString(params.orderId);
    if (!orderId) {
      return NextResponse.json({ error: "orderId_required" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));

    const useSponsor = asBool(body?.useSponsor, false);
    const paymentMethod = normalizePayMethod(body?.paymentMethod);
    const gapPaymentMethod = normalizePayMethod(body?.gapPaymentMethod);

    if (!paymentMethod) {
      return NextResponse.json({ error: "invalid_paymentMethod" }, { status: 400 });
    }

    const idemKey =
      normalizeIdempotencyKey(req.headers, body?.idempotencyKey) ||
      `checkout:${orderId}:${useSponsor ? "sponsor" : "self"}:${paymentMethod}:${gapPaymentMethod || "nogap"}`;

    const requestHash = hashRequestBody({
      orderId,
      useSponsor,
      paymentMethod,
      gapPaymentMethod
    });

    const { value } = await withIdempotency({
      orgId,
      scope: "careport.checkout",
      key: idemKey,
      actorUserId: who.uid ?? null,
      requestHash,
      run: async () => {
        const order = await prisma.carePortOrder.findUnique({
          where: { id: orderId },
          include: { chosenPharmacy: true }
        });

        if (!order) {
          throw Object.assign(new Error("order_not_found"), { status: 404 });
        }

        if (order.status !== "PAYMENT_PENDING" && order.status !== "PAID") {
          throw Object.assign(new Error(`order_not_ready_for_checkout:${order.status}`), { status: 409 });
        }

        const pharmacy = order.chosenPharmacy;
        if (!pharmacy) {
          throw Object.assign(new Error("missing_chosen_pharmacy"), { status: 409 });
        }

        if (!pharmacy.country || !pharmacy.currency) {
          throw Object.assign(new Error("pharmacy_missing_country_or_currency"), { status: 409 });
        }

        const rule = await getActivePricingRule({
          orgId,
          country: pharmacy.country,
          currency: pharmacy.currency
        });

        const orderAny = order as any;
        const totalCents = asInt(order.totalCents, 0);
        const sponsorAmountMinor = useSponsor ? asInt(orderAny.sponsorAmountMinor, 0) : 0;
        const storedPatientCopayMinor = useSponsor ? asInt(orderAny.patientCopayMinor, 0) : totalCents;

        const patientPayableNow = useSponsor
          ? Math.max(0, storedPatientCopayMinor)
          : totalCents;

        const sponsorAvailable = Boolean(orderAny.clientId) || sponsorAmountMinor > 0;

        if (useSponsor && !sponsorAvailable) {
          throw Object.assign(new Error("sponsor_not_available_for_order"), { status: 409 });
        }

        if (useSponsor && sponsorAmountMinor > totalCents) {
          throw Object.assign(new Error("invalid_sponsor_amount_exceeds_total"), { status: 409 });
        }

        if (useSponsor && patientPayableNow > 0 && !gapPaymentMethod) {
          throw Object.assign(new Error("gap_payment_method_required"), { status: 400 });
        }

        if (useSponsor && patientPayableNow === 0 && paymentMethod !== "MEDICAL_AID") {
          throw Object.assign(new Error("paymentMethod_must_be_MEDICAL_AID_for_zero_gap_sponsor_checkout"), {
            status: 409
          });
        }

        if (!useSponsor && paymentMethod === "MEDICAL_AID") {
          throw Object.assign(new Error("medical_aid_requires_useSponsor_true"), { status: 409 });
        }

        const effectivePatientMethod =
          useSponsor && patientPayableNow > 0 ? gapPaymentMethod : paymentMethod;

        if (!effectivePatientMethod) {
          throw Object.assign(new Error("effective_payment_method_missing"), { status: 400 });
        }

        if (effectivePatientMethod === "COD") {
          if (!rule.codEnabled) {
            throw Object.assign(new Error("cod_disabled"), { status: 409 });
          }
          if (patientPayableNow > rule.codLimitCents) {
            throw Object.assign(new Error("cod_limit_exceeded"), { status: 409 });
          }
        }

        if (paymentMethod === "MEDICAL_AID") {
          if (!sponsorAvailable) {
            throw Object.assign(new Error("medical_aid_cover_not_available_for_order"), { status: 409 });
          }
        }

        const intent = await prisma.$transaction(async (tx) => {
          const created = await tx.carePortPaymentIntent.create({
            data: {
              orgId,
              orderId,
              method: effectivePatientMethod,
              status: "SUCCEEDED",
              amountCents: patientPayableNow,
              currency: pharmacy.currency,
              idempotencyKey: idemKey,
              metadata: {
                useSponsor,
                headlinePaymentMethod: paymentMethod,
                effectivePatientMethod,
                gapPaymentMethod: gapPaymentMethod || null,
                sponsorAmountMinor,
                patientPayableNow,
                totalCents
              }
            } as any
          });

          const updated = await tx.carePortOrder.update({
            where: { id: orderId },
            data: {
              status: "PAID",
              sponsorAmountMinor,
              patientCopayMinor: patientPayableNow,
              sponsorPricingSnapshot: {
                ...(orderAny.sponsorPricingSnapshot &&
                typeof orderAny.sponsorPricingSnapshot === "object"
                  ? orderAny.sponsorPricingSnapshot
                  : {}),
                checkoutSnapshot: {
                  useSponsor,
                  headlinePaymentMethod: paymentMethod,
                  effectivePatientMethod,
                  gapPaymentMethod: gapPaymentMethod || null,
                  sponsorAmountMinor,
                  patientPayableNow,
                  totalCents,
                  currency: pharmacy.currency,
                  checkedOutAt: new Date().toISOString(),
                },
              } as any,
            },
          });

          await tx.auditEvent.create({
            data: {
              kind: "careport_payment_succeeded",
              actorId: who.uid ?? null,
              actorRole: who.role ?? null,
              subjectId: orderId,
              meta: {
                correlationId,
                orgId,
                useSponsor,
                paymentMethod,
                effectivePatientMethod,
                gapPaymentMethod: gapPaymentMethod || null,
                sponsorAmountMinor,
                patientPayableNow,
                totalCents,
                currency: pharmacy.currency
              }
            }
          });

          return { paymentIntent: created, order: updated };
        });

        const billableEvents = await buildCarePortBillableEventsFromOrder(orderId).catch(() => []);

        return {
          ok: true,
          paymentIntent: intent.paymentIntent,
          order: intent.order,
          billableEvents,
          settlementPreview: {
            sponsorAmountMinor,
            patientPayableNow,
            totalCents,
            currency: pharmacy.currency
          }
        };
      }
    });

    return NextResponse.json(value, {
      status: 200,
      headers: { "access-control-allow-origin": "*" }
    });
  } catch (e: any) {
    const status = e?.status || 500;
    return NextResponse.json(
      { ok: false, error: e?.message || "error", correlationId },
      { status }
    );
  }
}