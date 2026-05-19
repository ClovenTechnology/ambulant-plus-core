// apps/api-gateway/app/api/careport/orders/push/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { readIdentity } from "@/src/lib/identity";
import {
  auditEvent,
  correlationIdFromHeaders,
  normalizeErxMeds,
  orgIdFromHeaders,
  requireRole,
} from "@/src/lib/careport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function asInt(v: any, def = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : def;
}

function asBool(v: any, def = false) {
  return typeof v === "boolean" ? v : def;
}

function cleanString(v: any) {
  return String(v ?? "").trim();
}

function parseDestination(dest: any) {
  const addr = cleanString(dest?.addr);
  const lat = Number(dest?.lat);
  const lng = Number(dest?.lng);
  return { addr, lat, lng };
}

async function resolvePatientProfileIdFromUserId(userId: string) {
  if (!userId) return null;
  try {
    const p = await prisma.patientProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    return p?.id ?? null;
  } catch {
    return null;
  }
}

function normalizePaymentMethod(v: any): "CARD" | "COD" | "MEDICAL_AID" | "" {
  const x = cleanString(v).toUpperCase();
  if (x === "CARD" || x === "COD" || x === "MEDICAL_AID") return x;
  return "";
}

function parseErxNotes(notes: unknown) {
  if (!notes) return null;
  if (typeof notes === "object") return notes as any;

  if (typeof notes === "string") {
    try {
      return JSON.parse(notes) as any;
    } catch {
      return null;
    }
  }

  return null;
}

function erxHasBlockedAllergyConflict(erx: any) {
  const notes = parseErxNotes(erx?.notes);
  const safety = notes?.allergySafety;

  if (!safety) return false;
  if (safety.blocked === true) return true;

  const conflicts = Array.isArray(safety.conflicts) ? safety.conflicts : [];
  return conflicts.length > 0;
}

export async function POST(req: NextRequest) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);
  const correlationId = correlationIdFromHeaders(req.headers);

  try {
    requireRole(who, ["patient", "clinician", "admin"]);

    const b = await req.json().catch(() => ({}));

    const encId = cleanString(b?.encId);
    const erxOrderIdIn = cleanString(b?.erxOrderId);

    const refillNo = Math.max(0, asInt(b?.refillNo, 0));

    const fulfillment =
      cleanString(b?.fulfillment).toUpperCase() === "PICKUP"
        ? "PICKUP"
        : "DELIVERY";

    const destinationRaw = b?.destination ?? null;
    const destination = destinationRaw ? parseDestination(destinationRaw) : null;

    const initiatedByRole = cleanString(b?.initiatedByRole || who.role || "") || null;
    const initiatedByUserId = cleanString(b?.initiatedByUserId || (who as any)?.uid || "") || null;

    const sponsorRequested = asBool(b?.sponsorRequested, false);
    const allowPartialFulfillment = asBool(b?.allowPartialFulfillment, false);
    const allowGenericSubstitution = asBool(b?.allowGenericSubstitution, true);

    const preferredPaymentMethod = normalizePaymentMethod(b?.preferredPaymentMethod);
    const gapPaymentMethod = normalizePaymentMethod(b?.gapPaymentMethod);

    const clientId = cleanString(b?.clientId) || null;
    const clientMemberId = cleanString(b?.clientMemberId) || null;
    const coveragePlanId = cleanString(b?.coveragePlanId) || null;
    const coverageAuthorizationId = cleanString(b?.coverageAuthorizationId) || null;

    const sponsorAmountMinor =
      b?.sponsorAmountMinor == null ? null : asInt(b?.sponsorAmountMinor, 0);
    const patientCopayMinor =
      b?.patientCopayMinor == null ? null : asInt(b?.patientCopayMinor, 0);

    const sponsorPricingSnapshot = b?.sponsorPricingSnapshot ?? null;
    const requestMetadata = b?.metadata ?? null;

    if (!["PICKUP", "DELIVERY"].includes(fulfillment)) {
      return NextResponse.json(
        { ok: false, error: "fulfillment_must_be_PICKUP_or_DELIVERY" },
        { status: 400 }
      );
    }

    if (fulfillment === "DELIVERY") {
      if (
        !destination ||
        !destination.addr ||
        !Number.isFinite(destination.lat) ||
        !Number.isFinite(destination.lng)
      ) {
        return NextResponse.json(
          { ok: false, error: "destination_required_for_delivery" },
          { status: 400 }
        );
      }
    }

    if (!erxOrderIdIn && !encId) {
      return NextResponse.json(
        { ok: false, error: "encId_or_erxOrderId_required" },
        { status: 400 }
      );
    }

    const whoUid = cleanString((who as any)?.uid || "");
    const patientProfileId =
      who.role === "patient" && whoUid ? await resolvePatientProfileIdFromUserId(whoUid) : null;

    const allowedPatientIds = new Set(
      [whoUid, patientProfileId].filter(Boolean).map(String)
    );

    let erx =
      erxOrderIdIn
        ? await prisma.erxOrder.findUnique({ where: { id: erxOrderIdIn } })
        : null;

    if (!erx && encId) {
      erx = await prisma.erxOrder.findFirst({
        where: {
          encounterId: encId,
          kind: "pharmacy",
          ...(who.role === "patient" && allowedPatientIds.size
            ? { patientId: { in: Array.from(allowedPatientIds) } }
            : {}),
        },
        orderBy: { createdAt: "desc" },
      });
    }

    if (!erx) {
      return NextResponse.json(
        { ok: false, error: "erx_not_found" },
        { status: 404 }
      );
    }

    if (erxHasBlockedAllergyConflict(erx)) {
      await auditEvent({
        kind: "careport_order_blocked_allergy_conflict",
        actorId: whoUid || null,
        actorRole: who.role ?? null,
        subjectId: erx.id,
        meta: {
          correlationId,
          orgId,
          erxOrderId: erx.id,
          encounterId: erx.encounterId,
          patientId: erx.patientId,
        },
      });

      return NextResponse.json(
        {
          ok: false,
          error: "ALLERGY_CONFLICT",
          message:
            "CarePort order blocked because the eRx has an allergy safety conflict.",
          correlationId,
        },
        { status: 409 }
      );
    }

    if (who.role === "patient" && allowedPatientIds.size) {
      if (!allowedPatientIds.has(String(erx.patientId))) {
        return NextResponse.json(
          { ok: false, error: "forbidden" },
          { status: 403 }
        );
      }
    }

    if (who.role === "clinician" && whoUid) {
      if (cleanString(erx.clinicianId) && cleanString(erx.clinicianId) !== whoUid) {
        return NextResponse.json(
          { ok: false, error: "forbidden" },
          { status: 403 }
        );
      }
    }

    const meds = normalizeErxMeds(erx);
    if (!meds.length) {
      return NextResponse.json(
        { ok: false, error: "erx_has_no_pharmacy_items" },
        { status: 400 }
      );
    }

    const order = await prisma.$transaction(async (tx) => {
      const existing = await tx.carePortOrder.findUnique({
        where: { erxOrderId_refillNo: { erxOrderId: erx!.id, refillNo } },
      });

      if (existing) {
        if (
          fulfillment === "DELIVERY" &&
          destination &&
          existing.status === "CREATED"
        ) {
          const addrChanged =
            cleanString(existing.destinationAddr || "") !== destination.addr ||
            Number(existing.destinationLat || 0) !== destination.lat ||
            Number(existing.destinationLng || 0) !== destination.lng;

          if (addrChanged) {
            return await tx.carePortOrder.update({
              where: { id: existing.id },
              data: {
                destinationAddr: destination.addr,
                destinationLat: destination.lat,
                destinationLng: destination.lng,
                clientId: clientId ?? existing.clientId ?? null,
                clientMemberId: clientMemberId ?? (existing as any).clientMemberId ?? null,
                coveragePlanId: coveragePlanId ?? (existing as any).coveragePlanId ?? null,
                coverageAuthorizationId:
                  coverageAuthorizationId ?? (existing as any).coverageAuthorizationId ?? null,
                sponsorAmountMinor:
                  sponsorAmountMinor ?? (existing as any).sponsorAmountMinor ?? null,
                patientCopayMinor:
                  patientCopayMinor ?? (existing as any).patientCopayMinor ?? null,
                sponsorPricingSnapshot:
                  sponsorPricingSnapshot ?? (existing as any).sponsorPricingSnapshot ?? null,
              },
            });
          }
        }

        if (existing.fulfillment !== fulfillment) {
          throw Object.assign(
            new Error("order_already_exists_with_different_fulfillment"),
            { status: 409 }
          );
        }

        return existing;
      }

      const created = await tx.carePortOrder.create({
        data: {
          orgId,
          erxOrderId: erx!.id,
          refillNo,
          encounterId: erx!.encounterId,
          patientId: erx!.patientId,

          clientId,
          clientMemberId,
          coveragePlanId,
          coverageAuthorizationId,

          status: "CREATED",
          fulfillment,
          destinationAddr: fulfillment === "DELIVERY" ? destination!.addr : null,
          destinationLat: fulfillment === "DELIVERY" ? destination!.lat : null,
          destinationLng: fulfillment === "DELIVERY" ? destination!.lng : null,
          currency: "ZAR",

          sponsorAmountMinor,
          patientCopayMinor,
          sponsorPricingSnapshot: sponsorPricingSnapshot ?? {
            carePortPush: {
              initiatedByRole,
              initiatedByUserId,
              sponsorRequested,
              allowPartialFulfillment,
              allowGenericSubstitution,
              preferredPaymentMethod: preferredPaymentMethod || null,
              gapPaymentMethod: gapPaymentMethod || null,
              requestMetadata,
            },
          },
        } as any,
      });

      await tx.carePortOrderItem.createMany({
        data: meds.map((m) => ({
          orderId: created.id,
          erxMedKey: m.erxMedKey,
          drugCode: m.drugCode,
          name: m.name,
          quantity: m.quantity,
          directions: m.directions,
        })),
        skipDuplicates: true,
      });

      await tx.auditEvent.create({
        data: {
          kind: "careport_order_pushed",
          actorId: whoUid || null,
          actorRole: who.role ?? null,
          subjectId: created.id,
          meta: {
            correlationId,
            orgId,
            encId: encId || null,
            erxOrderId: erx!.id,
            refillNo,
            encounterId: erx!.encounterId,
            patientId: erx!.patientId,
            fulfillment,
            initiatedByRole,
            initiatedByUserId,
            sponsorRequested,
            preferredPaymentMethod: preferredPaymentMethod || null,
            gapPaymentMethod: gapPaymentMethod || null,
            clientId,
            clientMemberId,
            coveragePlanId,
            coverageAuthorizationId,
          },
        },
      });

      return created;
    });

    await auditEvent({
      kind: "careport_order_pushed_ok",
      actorId: whoUid || null,
      actorRole: who.role ?? null,
      subjectId: order.id,
      meta: {
        correlationId,
        orgId,
        erxOrderId: order.erxOrderId,
        refillNo,
        initiatedByRole,
        initiatedByUserId,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        orderId: order.id,
        redirectUrl: `/careport/marketplace/${encodeURIComponent(order.id)}`,
        order,
      },
      { status: 200, headers: { "access-control-allow-origin": "*" } }
    );
  } catch (e: any) {
    const status = e?.status || 500;
    return NextResponse.json(
      { ok: false, error: e?.message || "error", correlationId },
      { status }
    );
  }
}