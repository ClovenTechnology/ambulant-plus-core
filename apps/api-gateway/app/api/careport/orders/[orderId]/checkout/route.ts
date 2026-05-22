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
  withIdempotency,
} from "@/src/lib/careport";
import { buildCarePortBillableEventsFromOrder } from "@ambulant/client-core/src/careport";
import { runCoveragePreflight } from "@ambulant/client-core/src/preflight";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COMMERCIAL_POLICY_KEY = "careport.commercial_policy";

type CommercialPolicy = {
  currency: string;
  platformCommissionBps: number;
  passPaymentProviderFeeToPharmacy: boolean;
  paymentProviderFeeBps: number;
  paymentProviderFixedFeeCents: number;
  riderDeliveryShareBps: number;
};

const DEFAULT_COMMERCIAL_POLICY: CommercialPolicy = {
  currency: "ZAR",
  platformCommissionBps: 0,
  passPaymentProviderFeeToPharmacy: false,
  paymentProviderFeeBps: 0,
  paymentProviderFixedFeeCents: 0,
  riderDeliveryShareBps: 10000,
};

function asBool(v: unknown, fallback = false) {
  return typeof v === "boolean" ? v : fallback;
}

function asInt(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function boundedInt(v: unknown, fallback: number, min = 0, max = 100_000_000) {
  const n = asInt(v, fallback);
  return Math.min(max, Math.max(min, n));
}

function cleanString(v: unknown) {
  return String(v ?? "").trim();
}

function normalizePayMethod(v: unknown): "MEDICAL_AID" | "CARD" | "COD" | "" {
  const x = cleanString(v).toUpperCase();
  if (x === "MEDICAL_AID" || x === "CARD" || x === "COD") return x;
  return "";
}

function settingsDelegate() {
  const db: any = prisma;
  return db.carePortOperationalSetting || db.carePortSetting || db.careportSetting || null;
}

function normalizeCommercialPolicy(raw: any): CommercialPolicy {
  return {
    currency: cleanString(raw?.currency).toUpperCase().slice(0, 3) || DEFAULT_COMMERCIAL_POLICY.currency,
    platformCommissionBps: boundedInt(raw?.platformCommissionBps, DEFAULT_COMMERCIAL_POLICY.platformCommissionBps, 0, 5000),
    passPaymentProviderFeeToPharmacy: typeof raw?.passPaymentProviderFeeToPharmacy === "boolean" ? raw.passPaymentProviderFeeToPharmacy : DEFAULT_COMMERCIAL_POLICY.passPaymentProviderFeeToPharmacy,
    paymentProviderFeeBps: boundedInt(raw?.paymentProviderFeeBps, DEFAULT_COMMERCIAL_POLICY.paymentProviderFeeBps, 0, 2000),
    paymentProviderFixedFeeCents: boundedInt(raw?.paymentProviderFixedFeeCents, DEFAULT_COMMERCIAL_POLICY.paymentProviderFixedFeeCents),
    riderDeliveryShareBps: boundedInt(raw?.riderDeliveryShareBps, DEFAULT_COMMERCIAL_POLICY.riderDeliveryShareBps, 0, 10000),
  };
}

async function loadCommercialPolicy(orgId: string) {
  const delegate = settingsDelegate();
  if (!delegate?.findUnique && !delegate?.findFirst) {
    return { policy: DEFAULT_COMMERCIAL_POLICY, source: "defaults" as const };
  }

  const row = delegate.findUnique
    ? await delegate.findUnique({ where: { orgId_key: { orgId, key: COMMERCIAL_POLICY_KEY } } }).catch(() => null)
    : await delegate.findFirst({ where: { orgId, key: COMMERCIAL_POLICY_KEY }, orderBy: { updatedAt: "desc" } }).catch(() => null);

  const value = row?.value ?? row?.json ?? row?.payload ?? row?.metadata ?? null;
  return {
    policy: normalizeCommercialPolicy(value || DEFAULT_COMMERCIAL_POLICY),
    source: value ? ("database" as const) : ("defaults" as const),
  };
}

function percentageFee(amountCents: number, bps: number) {
  return Math.max(0, Math.round((Math.max(0, amountCents) * bps) / 10000));
}

function providerFee(amountCents: number, policy: CommercialPolicy) {
  if (amountCents <= 0) return 0;
  return percentageFee(amountCents, policy.paymentProviderFeeBps) + Math.max(0, policy.paymentProviderFixedFeeCents);
}

function getPaymentProvider(body: any, method: string) {
  const explicit = cleanString(body?.provider || body?.paymentProvider).toLowerCase();
  if (explicit) return explicit;
  if (method === "CARD") return cleanString(process.env.CARD_PAYMENT_PROVIDER || "paystack").toLowerCase() || "paystack";
  if (method === "MEDICAL_AID") return "medical_aid";
  if (method === "COD") return "cash_on_delivery";
  return "manual";
}

type CarePortCoverageLine = {
  serviceType: "PHARMACY_ITEM" | "PHARMACY_DISPENSING" | "RIDER_DELIVERY";
  requestedAmountMinor: number;
  preflight: any;
};

type CarePortCoverageAssessment = {
  required: boolean;
  lines: CarePortCoverageLine[];
  sponsorAmountMinor: number;
  patientCopayMinor: number;
  uncoveredGapMinor: number;
  clientId: string | null;
  clientMemberId: string | null;
  coveragePlanId: string | null;
  coverageAuthorizationId: string | null;
  authorizationRequired: boolean;
  currency: string;
  summary: Record<string, any>;
};

function isCoveredDecision(value: unknown) {
  const decision = cleanString(value).toUpperCase();
  return decision === "COVERED" || decision === "COVERED_WITH_COPAY";
}

function isAuthorizationRequired(preflight: any) {
  return Boolean(
    preflight?.authorizationRequired === true ||
      preflight?.requiresAuthorization === true ||
      cleanString(preflight?.decision).toUpperCase() === "REQUIRES_AUTHORIZATION" ||
      preflight?.ruleSnapshot?.preauthRequired === true ||
      cleanString(preflight?.ruleSnapshot?.decision).toUpperCase() === "REQUIRES_AUTHORIZATION"
  );
}

async function requireApprovedCoverageAuthorization(args: {
  orgId: string;
  patientId: string;
  orderId: string;
  authorizationId: string;
}) {
  const db: any = prisma;
  if (!db.coverageAuthorization?.findFirst) {
    throw Object.assign(new Error("coverage_authorization_model_unavailable"), { status: 500 });
  }

  const auth = await db.coverageAuthorization.findFirst({
    where: {
      id: args.authorizationId,
      orgId: args.orgId,
      patientId: args.patientId,
    },
  });

  if (!auth) {
    throw Object.assign(new Error("coverage_authorization_not_found"), { status: 404 });
  }

  const status = cleanString(auth.status).toUpperCase();
  if (!["APPROVED", "AUTHORIZED", "ACTIVE", "CONSUMED"].includes(status)) {
    throw Object.assign(new Error(`coverage_authorization_not_approved:${status || "UNKNOWN"}`), {
      status: 409,
    });
  }

  return auth;
}

async function runCarePortCoverageAssessment(args: {
  orgId: string;
  patientId: string;
  clinicianId?: string | null;
  clientId?: string | null;
  orderId: string;
  erxOrderId?: string | null;
  subtotalCents: number;
  deliveryFeeCents: number;
  dispensingFeeMinor?: number;
  currency: string;
  authorizationId?: string | null;
}): Promise<CarePortCoverageAssessment> {
  const lineInputs = [
    {
      serviceType: "PHARMACY_ITEM" as const,
      requestedAmountMinor: Math.max(0, args.subtotalCents),
      scopeType: "CAREPORT_ORDER",
      scopeId: args.orderId,
    },
    {
      serviceType: "PHARMACY_DISPENSING" as const,
      requestedAmountMinor: Math.max(0, args.dispensingFeeMinor || 0),
      scopeType: "ERX_ORDER",
      scopeId: args.erxOrderId || args.orderId,
    },
    {
      serviceType: "RIDER_DELIVERY" as const,
      requestedAmountMinor: Math.max(0, args.deliveryFeeCents),
      scopeType: "DELIVERY",
      scopeId: args.orderId,
    },
  ].filter((line) => line.requestedAmountMinor > 0);

  if (!lineInputs.length) {
    return {
      required: true,
      lines: [],
      sponsorAmountMinor: 0,
      patientCopayMinor: 0,
      uncoveredGapMinor: 0,
      clientId: args.clientId || null,
      clientMemberId: null,
      coveragePlanId: null,
      coverageAuthorizationId: args.authorizationId || null,
      authorizationRequired: false,
      currency: args.currency || "ZAR",
      summary: { source: "careport.checkout", lineCount: 0 },
    };
  }

  const lines: CarePortCoverageLine[] = [];
  let sponsorAmountMinor = 0;
  let patientCopayMinor = 0;
  let uncoveredGapMinor = 0;
  let clientId: string | null = args.clientId || null;
  let clientMemberId: string | null = null;
  let coveragePlanId: string | null = null;
  let authorizationRequired = false;

  for (const line of lineInputs) {
    const preflight = await runCoveragePreflight({
      orgId: args.orgId,
      patientId: args.patientId,
      clinicianId: args.clinicianId || undefined,
      serviceType: line.serviceType,
      visitMode: "HYBRID",
      requestedAmountMinor: line.requestedAmountMinor,
      clientId: args.clientId || undefined,
    });

    lines.push({ serviceType: line.serviceType, requestedAmountMinor: line.requestedAmountMinor, preflight });

    if (isAuthorizationRequired(preflight)) {
      authorizationRequired = true;
    }

    if (!isCoveredDecision(preflight?.decision)) {
      throw Object.assign(
        new Error(`medical_aid_${line.serviceType.toLowerCase()}_${cleanString(preflight?.decision || "not_covered").toLowerCase()}`),
        {
          status: 409,
          details: {
            serviceType: line.serviceType,
            requestedAmountMinor: line.requestedAmountMinor,
            preflight,
          },
        }
      );
    }

    sponsorAmountMinor += asInt(preflight?.sponsorAmountMinor, 0);
    patientCopayMinor += asInt(preflight?.patientCopayMinor, 0);
    uncoveredGapMinor += asInt(preflight?.uncoveredGapMinor, 0);

    clientId = clientId || cleanString(preflight?.clientId) || null;
    clientMemberId = clientMemberId || cleanString(preflight?.clientMemberId) || null;
    coveragePlanId = coveragePlanId || cleanString(preflight?.coveragePlanId) || null;
  }

  let coverageAuthorizationId = cleanString(args.authorizationId) || null;
  if (authorizationRequired) {
    if (!coverageAuthorizationId) {
      throw Object.assign(new Error("coverage_authorization_required"), {
        status: 409,
        details: { lines },
      });
    }

    await requireApprovedCoverageAuthorization({
      orgId: args.orgId,
      patientId: args.patientId,
      orderId: args.orderId,
      authorizationId: coverageAuthorizationId,
    });
  }

  return {
    required: true,
    lines,
    sponsorAmountMinor: Math.max(0, sponsorAmountMinor),
    patientCopayMinor: Math.max(0, patientCopayMinor),
    uncoveredGapMinor: Math.max(0, uncoveredGapMinor),
    clientId,
    clientMemberId,
    coveragePlanId,
    coverageAuthorizationId,
    authorizationRequired,
    currency: args.currency || "ZAR",
    summary: {
      source: "careport.checkout",
      lineCount: lines.length,
      services: lines.map((line) => ({
        serviceType: line.serviceType,
        requestedAmountMinor: line.requestedAmountMinor,
        decision: line.preflight?.decision,
        sponsorAmountMinor: line.preflight?.sponsorAmountMinor ?? 0,
        patientCopayMinor: line.preflight?.patientCopayMinor ?? 0,
        uncoveredGapMinor: line.preflight?.uncoveredGapMinor ?? 0,
        authorizationRequired: isAuthorizationRequired(line.preflight),
        clientId: line.preflight?.clientId ?? null,
        clientMemberId: line.preflight?.clientMemberId ?? null,
        coveragePlanId: line.preflight?.coveragePlanId ?? null,
        reason: line.preflight?.reason ?? null,
      })),
    },
  };
}


async function emitCarePortRuntimeEvent(args: {
  orgId: string;
  kind: string;
  orderId: string;
  patientId?: string | null;
  clinicianId?: string | null;
  encounterId?: string | null;
  payload?: Record<string, unknown>;
  targetAdmin?: boolean;
}) {
  try {
    await (prisma as any).runtimeEvent?.create?.({
      data: {
        ts: BigInt(Date.now()),
        kind: args.kind,
        encounterId: args.encounterId ?? null,
        patientId: args.patientId ?? null,
        clinicianId: args.clinicianId ?? null,
        payload: JSON.parse(JSON.stringify(args.payload ?? {})),
        targetPatientId: args.patientId ?? null,
        targetClinicianId: args.clinicianId ?? null,
        targetAdmin: Boolean(args.targetAdmin),
        orgId: args.orgId,
      },
    });
  } catch {
    // Runtime notifications are best-effort and must never block checkout.
  }
}

async function notifyClinicianCarePortPurchased(args: {
  orgId: string;
  orderId: string;
  paymentIntentId?: string | null;
  actorUserId?: string | null;
  correlationId?: string | null;
}) {
  try {
    const order = await prisma.carePortOrder.findUnique({
      where: { id: args.orderId },
      include: {
        chosenPharmacy: true,
        items: true,
      },
    });

    if (!order) return;

    const orderAny = order as any;
    let clinicianId: string | null = cleanString(orderAny.clinicianId) || null;

    if (!clinicianId && orderAny.erxOrderId) {
      const erx = await (prisma as any).erxOrder?.findUnique?.({
        where: { id: String(orderAny.erxOrderId) },
        select: { clinicianId: true, encounterId: true },
      });
      clinicianId = cleanString(erx?.clinicianId) || null;
    }

    if (!clinicianId && order.encounterId) {
      const encounter = await (prisma as any).encounter?.findUnique?.({
        where: { id: order.encounterId },
        select: { clinicianId: true },
      });
      clinicianId = cleanString(encounter?.clinicianId) || null;
    }

    if (!clinicianId) return;

    await emitCarePortRuntimeEvent({
      orgId: args.orgId,
      kind: "careport_erx_purchased",
      orderId: order.id,
      patientId: order.patientId ?? null,
      clinicianId,
      encounterId: order.encounterId ?? null,
      targetAdmin: true,
      payload: {
        orderId: order.id,
        erxOrderId: orderAny.erxOrderId ?? null,
        paymentIntentId: args.paymentIntentId ?? null,
        status: order.status,
        fulfillment: order.fulfillment,
        pharmacyId: order.chosenPharmacyId ?? null,
        pharmacyName: order.chosenPharmacy?.name ?? null,
        itemCount: order.items?.length ?? 0,
        subtotalCents: order.subtotalCents ?? 0,
        deliveryFeeCents: order.deliveryFeeCents ?? 0,
        totalCents: order.totalCents ?? 0,
        currency: order.currency ?? "ZAR",
        sponsorAmountMinor: orderAny.sponsorAmountMinor ?? 0,
        patientCopayMinor: orderAny.patientCopayMinor ?? 0,
        purchasedAt: new Date().toISOString(),
        actorUserId: args.actorUserId ?? null,
        correlationId: args.correlationId ?? null,
        message: "The patient has completed checkout for a CarePort eRx order.",
      },
    });
  } catch {
    // Best-effort only.
  }
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
      gapPaymentMethod,
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
          include: { chosenPharmacy: true, assignment: true },
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
          currency: pharmacy.currency,
        });

        const { policy, source: commercialPolicySource } = await loadCommercialPolicy(orgId);
        const orderAny = order as any;
        const totalCents = asInt(order.totalCents, 0);
        const subtotalCents = asInt(order.subtotalCents, 0);
        const deliveryFeeCents = asInt(order.deliveryFeeCents, 0);
        const dispensingFeeMinor = asInt(orderAny.dispensingFeeMinor ?? orderAny.pharmacyDispensingFeeMinor, 0);
        const existingAuthorizationId = cleanString(body?.coverageAuthorizationId || orderAny.coverageAuthorizationId) || null;

        let coverageAssessment: CarePortCoverageAssessment | null = null;
        let sponsorAmountMinor = useSponsor ? asInt(orderAny.sponsorAmountMinor, 0) : 0;
        let patientPayableNow = useSponsor ? Math.max(0, asInt(orderAny.patientCopayMinor, 0)) : totalCents;

        if (useSponsor || paymentMethod === "MEDICAL_AID") {
          coverageAssessment = await runCarePortCoverageAssessment({
            orgId,
            patientId: cleanString(order.patientId),
            clinicianId: cleanString(orderAny.clinicianId) || null,
            clientId: cleanString(body?.clientId || orderAny.clientId) || null,
            orderId,
            erxOrderId: cleanString(orderAny.erxOrderId) || null,
            subtotalCents,
            deliveryFeeCents,
            dispensingFeeMinor,
            currency: pharmacy.currency,
            authorizationId: existingAuthorizationId,
          });

          sponsorAmountMinor = Math.min(totalCents, Math.max(0, coverageAssessment.sponsorAmountMinor));
          patientPayableNow = Math.max(0, totalCents - sponsorAmountMinor);
        }

        const sponsorAvailable =
          Boolean(coverageAssessment?.clientId || orderAny.clientId) ||
          sponsorAmountMinor > 0;

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
          throw Object.assign(new Error("paymentMethod_must_be_MEDICAL_AID_for_zero_gap_sponsor_checkout"), { status: 409 });
        }

        if (!useSponsor && paymentMethod === "MEDICAL_AID") {
          throw Object.assign(new Error("medical_aid_requires_useSponsor_true"), { status: 409 });
        }

        const effectivePatientMethod = useSponsor && patientPayableNow > 0 ? gapPaymentMethod : paymentMethod;

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

        if (paymentMethod === "MEDICAL_AID" && !sponsorAvailable) {
          throw Object.assign(new Error("medical_aid_cover_not_available_for_order"), { status: 409 });
        }

        const provider = getPaymentProvider(body, effectivePatientMethod);
        const paymentProviderFeeMinor = providerFee(patientPayableNow, policy);
        const platformFeeMinor = percentageFee(subtotalCents, policy.platformCommissionBps);
        const pharmacyProviderDeduction = policy.passPaymentProviderFeeToPharmacy ? paymentProviderFeeMinor : 0;
        const pharmacyGrossMinor = subtotalCents;
        const pharmacyNetMinor = Math.max(0, pharmacyGrossMinor - platformFeeMinor - pharmacyProviderDeduction);
        const riderFeeMinor = Math.max(0, percentageFee(deliveryFeeCents, policy.riderDeliveryShareBps));
        const riderNetMinor = riderFeeMinor;

        const checkoutSnapshot = {
          useSponsor,
          headlinePaymentMethod: paymentMethod,
          effectivePatientMethod,
          gapPaymentMethod: gapPaymentMethod || null,
          provider,
          sponsorAmountMinor,
          patientPayableNow,
          totalCents,
          subtotalCents,
          deliveryFeeCents,
          platformFeeMinor,
          paymentProviderFeeMinor,
          pharmacyGrossMinor,
          pharmacyNetMinor,
          riderFeeMinor,
          riderNetMinor,
          currency: pharmacy.currency,
          commercialPolicySource,
          commercialPolicy: policy,
          coverage: coverageAssessment?.summary ?? null,
          coverageAuthorizationRequired: coverageAssessment?.authorizationRequired ?? false,
          coverageAuthorizationId: coverageAssessment?.coverageAuthorizationId ?? existingAuthorizationId ?? null,
          checkedOutAt: new Date().toISOString(),
        };

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
              provider,
              providerStatus: "SUCCEEDED",
              providerRef: cleanString(body?.providerRef || body?.reference || idemKey) || null,
              providerPayload: body?.providerPayload ?? null,
              metadata: {
                useSponsor,
                headlinePaymentMethod: paymentMethod,
                effectivePatientMethod,
                gapPaymentMethod: gapPaymentMethod || null,
                sponsorAmountMinor,
                patientPayableNow,
                totalCents,
                commercial: checkoutSnapshot,
                coverage: coverageAssessment?.summary ?? null,
              },
              paidAt: new Date(),
            } as any,
          });

          const updated = await tx.carePortOrder.update({
            where: { id: orderId },
            data: {
              status: "PAID",
              sponsorAmountMinor,
              patientCopayMinor: patientPayableNow,
              clientId: coverageAssessment?.clientId ?? orderAny.clientId ?? null,
              clientMemberId: coverageAssessment?.clientMemberId ?? orderAny.clientMemberId ?? null,
              coveragePlanId: coverageAssessment?.coveragePlanId ?? orderAny.coveragePlanId ?? null,
              coverageAuthorizationId: coverageAssessment?.coverageAuthorizationId ?? existingAuthorizationId ?? orderAny.coverageAuthorizationId ?? null,
              platformFeeMinor,
              paymentProviderFeeMinor,
              pharmacyGrossMinor,
              pharmacyNetMinor,
              riderFeeMinor,
              riderNetMinor,
              refundMinor: 0,
              settlementStatus: "UNSETTLED",
              settlementSnapshot: checkoutSnapshot as any,
              sponsorPricingSnapshot: {
                ...(orderAny.sponsorPricingSnapshot && typeof orderAny.sponsorPricingSnapshot === "object" ? orderAny.sponsorPricingSnapshot : {}),
                checkoutSnapshot,
              } as any,
            } as any,
          });

          await (tx as any).carePortProviderFeeLedger?.create?.({
            data: {
              orgId,
              orderId,
              paymentIntentId: created.id,
              provider,
              providerRef: created.providerRef ?? null,
              category: "PAYMENT_PROCESSING",
              amountMinor: paymentProviderFeeMinor,
              currency: pharmacy.currency,
              status: "RECORDED",
              metadata: { checkoutSnapshot },
            },
          });

          return { paymentIntent: created, order: updated };
        }, { maxWait: 15_000, timeout: 30_000 });

        await prisma.auditEvent.create({
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
              currency: pharmacy.currency,
              commercial: checkoutSnapshot,
              coverage: coverageAssessment?.summary ?? null,
            },
          },
        }).catch(() => null);

        const billableEvents = await buildCarePortBillableEventsFromOrder(orderId).catch(() => []);

        await notifyClinicianCarePortPurchased({
          orgId,
          orderId,
          paymentIntentId: intent.paymentIntent?.id ?? null,
          actorUserId: who.uid ?? null,
          correlationId,
        });

        return {
          ok: true,
          paymentIntent: intent.paymentIntent,
          order: intent.order,
          billableEvents,
          coverage: coverageAssessment?.summary ?? null,
          settlementPreview: {
            sponsorAmountMinor,
            patientPayableNow,
            totalCents,
            subtotalCents,
            deliveryFeeCents,
            platformFeeMinor,
            paymentProviderFeeMinor,
            pharmacyGrossMinor,
            pharmacyNetMinor,
            riderFeeMinor,
            riderNetMinor,
            currency: pharmacy.currency,
          },
        };
      },
    });

    return NextResponse.json(value, {
      status: 200,
      headers: { "access-control-allow-origin": "*" },
    });
  } catch (e: any) {
    const status = e?.status || 500;
    return NextResponse.json({ ok: false, error: e?.message || "error", correlationId }, { status });
  }
}
