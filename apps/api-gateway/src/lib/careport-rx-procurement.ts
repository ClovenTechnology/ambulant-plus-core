import { prisma } from "@/src/lib/db";
import {
  auditEvent,
  carePortPatientIdentityIds,
  normalizeErxMeds,
  requireCarePortPatientResourceAccess,
} from "@/src/lib/careport";
import { readIdentity } from "@/src/lib/identity";

type Who = ReturnType<typeof readIdentity>;

const ACTIVE_SESSION_STATUSES = ["BASKET_DRAFT", "PHARMACY_DISCOVERY"] as const;
const NON_DISPENSABLE_ERX_STATUSES = new Set([
  "draft",
  "void",
  "voided",
  "cancelled",
  "canceled",
  "superseded",
  "rejected",
  "expired",
]);

function clean(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function asInt(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function parseErxNotes(notes: unknown): any {
  if (!notes) return null;
  if (typeof notes === "object") return notes;
  if (typeof notes === "string") {
    try {
      return JSON.parse(notes);
    } catch {
      return null;
    }
  }
  return null;
}

export function carePortProcurementErxBlockReason(erx: any): string | null {
  const kind = clean(erx?.kind).toLowerCase();
  const status = clean(erx?.status).toLowerCase();
  const notes = parseErxNotes(erx?.notes);
  const orderState = clean(notes?.orderState).toLowerCase();

  if (kind && kind !== "medication" && kind !== "pharmacy") return "unsupported_erx_kind";
  if (NON_DISPENSABLE_ERX_STATUSES.has(status)) return `status_${status}`;
  if (NON_DISPENSABLE_ERX_STATUSES.has(orderState)) return `order_state_${orderState}`;
  if (kind === "medication" && status !== "issued") return "modern_erx_not_issued";
  return null;
}

export function carePortProcurementHasAllergyConflict(erx: any): boolean {
  const notes = parseErxNotes(erx?.notes);
  const safety = notes?.allergySafety;
  if (!safety) return false;
  if (safety.blocked === true) return true;
  return Array.isArray(safety.conflicts) && safety.conflicts.length > 0;
}

function normalizeSearchLocation(input: any): {
  label: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  source: string | null;
} | null {
  if (input == null) return null;

  const label = clean(input?.label, 160) || null;
  const address = clean(input?.address ?? input?.addr, 1000) || null;
  const source = clean(input?.source, 40) || null;
  const latRaw = input?.lat;
  const lngRaw = input?.lng;
  const hasLat = latRaw !== undefined && latRaw !== null && latRaw !== "";
  const hasLng = lngRaw !== undefined && lngRaw !== null && lngRaw !== "";
  const lat = hasLat ? Number(latRaw) : null;
  const lng = hasLng ? Number(lngRaw) : null;

  if ((hasLat && !Number.isFinite(lat)) || (hasLng && !Number.isFinite(lng)) || hasLat !== hasLng) {
    const err = new Error("search_location_coordinates_invalid");
    (err as any).status = 400;
    throw err;
  }

  if (lat != null && (lat < -90 || lat > 90)) {
    const err = new Error("search_location_latitude_invalid");
    (err as any).status = 400;
    throw err;
  }
  if (lng != null && (lng < -180 || lng > 180)) {
    const err = new Error("search_location_longitude_invalid");
    (err as any).status = 400;
    throw err;
  }

  return { label, address, lat, lng, source };
}

function sessionInclude() {
  return { lines: { orderBy: { createdAt: "asc" as const } } };
}

export function serializeCarePortProcurementSession(session: any) {
  return {
    id: session.id,
    orgId: session.orgId,
    erxOrderId: session.erxOrderId,
    refillNo: session.refillNo,
    encounterId: session.encounterId,
    patientId: session.patientId,
    status: session.status,
    searchLocation: {
      label: session.searchLabel ?? null,
      address: session.searchAddress ?? null,
      lat: session.searchLat ?? null,
      lng: session.searchLng ?? null,
      source: session.searchSource ?? null,
    },
    sourceErxVersion: session.sourceErxVersion ?? null,
    sourceErxStatus: session.sourceErxStatus ?? null,
    expiresAt: session.expiresAt?.toISOString?.() ?? session.expiresAt ?? null,
    createdAt: session.createdAt?.toISOString?.() ?? session.createdAt ?? null,
    updatedAt: session.updatedAt?.toISOString?.() ?? session.updatedAt ?? null,
    lines: Array.isArray(session.lines)
      ? session.lines.map((line: any) => ({
          id: line.id,
          erxMedKey: line.erxMedKey,
          state: line.state,
          deferReason: line.deferReason ?? null,
          deferredAt: line.deferredAt?.toISOString?.() ?? line.deferredAt ?? null,
          drugCode: line.drugCode ?? null,
          primaryCoding:
            line.codingCode
              ? {
                  system: line.codingSystem ?? "",
                  code: line.codingCode,
                  display: line.codingDisplay ?? "",
                }
              : null,
          name: line.name,
          ingredientText: line.ingredientText ?? null,
          formText: line.formText ?? null,
          strengthText: line.strengthText ?? null,
          doseText: line.doseText ?? null,
          routeText: line.routeText ?? null,
          frequencyText: line.frequencyText ?? null,
          durationText: line.durationText ?? null,
          prescribedQuantity: {
            value: line.prescribedQuantityValue ?? null,
            unit: line.prescribedQuantityUnit ?? null,
            text: line.prescribedQuantityText ?? null,
          },
          legacyQuantity: line.legacyQuantity,
          directions: line.directions ?? null,
          repeats: line.repeats ?? null,
        }))
      : [],
  };
}

async function patientIdsForWho(who: Who): Promise<string[]> {
  if (String(who.role) !== "patient") return [];
  const uid = clean((who as any)?.uid, 240);
  return carePortPatientIdentityIds(uid);
}

async function findDispenseReadyErx(args: {
  who: Who;
  encId?: string | null;
  erxOrderId?: string | null;
}) {
  const encId = clean(args.encId, 240);
  const erxOrderId = clean(args.erxOrderId, 240);
  const patientIds = await patientIdsForWho(args.who);

  let erx = erxOrderId ? await prisma.erxOrder.findUnique({ where: { id: erxOrderId } }) : null;
  let candidates: any[] = [];

  if (!erx && encId) {
    candidates = await prisma.erxOrder.findMany({
      where: {
        encounterId: encId,
        kind: { in: ["medication", "pharmacy"] },
        ...(String(args.who.role) === "patient" && patientIds.length
          ? { patientId: { in: patientIds } }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    erx = candidates.find((candidate) => !carePortProcurementErxBlockReason(candidate)) ?? candidates[0] ?? null;
  }

  if (!erx) {
    const err = new Error("erx_not_found");
    (err as any).status = 404;
    throw err;
  }

  await requireCarePortPatientResourceAccess({ who: args.who, patientId: String(erx.patientId) });

  const blocked = carePortProcurementErxBlockReason(erx);
  if (blocked) {
    const err = new Error("erx_not_dispense_ready");
    (err as any).status = 409;
    (err as any).reason = blocked;
    throw err;
  }

  if (carePortProcurementHasAllergyConflict(erx)) {
    const err = new Error("ALLERGY_CONFLICT");
    (err as any).status = 409;
    (err as any).messageForPatient =
      "CarePort cannot start this medicine basket because the prescription has an allergy safety conflict.";
    throw err;
  }

  return erx;
}

export async function startCarePortProcurement(args: {
  who: Who;
  orgId: string;
  correlationId: string;
  body: any;
}) {
  const refillNo = Math.max(0, asInt(args.body?.refillNo, 0));
  const erx = await findDispenseReadyErx({
    who: args.who,
    encId: args.body?.encId ?? args.body?.encounterId,
    erxOrderId: args.body?.erxOrderId,
  });
  const meds = normalizeErxMeds(erx);
  if (!meds.length) {
    const err = new Error("erx_has_no_pharmacy_items");
    (err as any).status = 400;
    throw err;
  }

  const searchLocation = normalizeSearchLocation(args.body?.searchLocation ?? null);
  const now = new Date();

  const existing = await prisma.carePortRxProcurementSession.findFirst({
    where: {
      orgId: args.orgId,
      erxOrderId: erx.id,
      refillNo,
      patientId: erx.patientId,
      status: { in: [...ACTIVE_SESSION_STATUSES] as any },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    include: sessionInclude(),
    orderBy: { updatedAt: "desc" },
  });

  if (existing) {
    const reused = searchLocation
      ? await prisma.carePortRxProcurementSession.update({
          where: { id: existing.id },
          data: {
            searchLabel: searchLocation.label,
            searchAddress: searchLocation.address,
            searchLat: searchLocation.lat,
            searchLng: searchLocation.lng,
            searchSource: searchLocation.source,
          },
          include: sessionInclude(),
        })
      : existing;

    return { session: reused, reused: true };
  }

  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const created = await prisma.$transaction(async (tx) => {
    const session = await tx.carePortRxProcurementSession.create({
      data: {
        orgId: args.orgId,
        erxOrderId: erx.id,
        refillNo,
        encounterId: erx.encounterId,
        patientId: erx.patientId,
        status: "BASKET_DRAFT",
        searchLabel: searchLocation?.label ?? null,
        searchAddress: searchLocation?.address ?? null,
        searchLat: searchLocation?.lat ?? null,
        searchLng: searchLocation?.lng ?? null,
        searchSource: searchLocation?.source ?? null,
        sourceErxVersion: erx.version ?? null,
        sourceErxStatus: erx.status ?? null,
        sourceSnapshot: {
          id: erx.id,
          kind: erx.kind ?? null,
          status: erx.status ?? null,
          rxNumber: erx.rxNumber ?? null,
          version: erx.version ?? null,
          signedAt: erx.signedAt?.toISOString?.() ?? null,
          createdAt: erx.createdAt?.toISOString?.() ?? null,
          clinicianId: erx.clinicianId ?? null,
        },
        expiresAt,
      } as any,
    });

    await tx.carePortRxProcurementLine.createMany({
      data: meds.map((med) => ({
        orgId: args.orgId,
        sessionId: session.id,
        erxMedKey: med.erxMedKey,
        state: "INCLUDED",
        drugCode: med.drugCode,
        codingSystem: med.primaryCoding?.system || null,
        codingCode: med.primaryCoding?.code || null,
        codingDisplay: med.primaryCoding?.display || null,
        name: med.name,
        ingredientText: med.ingredientText,
        formText: med.formText,
        strengthText: med.strengthText,
        doseText: med.doseText,
        routeText: med.routeText,
        frequencyText: med.frequencyText,
        durationText: med.durationText,
        prescribedQuantityValue: med.quantityValue,
        prescribedQuantityUnit: med.quantityUnit,
        prescribedQuantityText: med.quantityText,
        legacyQuantity: med.quantity,
        directions: med.directions,
        repeats: med.repeats,
        sourceMedicationSnapshot: med.sourceSnapshot ?? null,
      })) as any,
      skipDuplicates: true,
    });

    return tx.carePortRxProcurementSession.findUniqueOrThrow({
      where: { id: session.id },
      include: sessionInclude(),
    });
  }, { maxWait: 15_000, timeout: 30_000 });

  await auditEvent({
    kind: "careport_rx_procurement_started",
    actorId: clean((args.who as any)?.uid, 240) || null,
    actorRole: args.who.role ?? null,
    subjectId: created.id,
    meta: {
      correlationId: args.correlationId,
      orgId: args.orgId,
      erxOrderId: erx.id,
      refillNo,
      encounterId: erx.encounterId,
      patientId: erx.patientId,
      lineCount: meds.length,
    },
  });

  return { session: created, reused: false };
}

export async function findLatestCarePortProcurement(args: {
  who: Who;
  orgId: string;
  encId?: string | null;
  erxOrderId?: string | null;
}) {
  const patientIds = await patientIdsForWho(args.who);
  const encId = clean(args.encId, 240);
  const erxOrderId = clean(args.erxOrderId, 240);

  const session = await prisma.carePortRxProcurementSession.findFirst({
    where: {
      orgId: args.orgId,
      ...(encId ? { encounterId: encId } : {}),
      ...(erxOrderId ? { erxOrderId } : {}),
      ...(String(args.who.role) === "patient" ? { patientId: { in: patientIds } } : {}),
    },
    include: sessionInclude(),
    orderBy: { updatedAt: "desc" },
  });

  if (session) {
    await requireCarePortPatientResourceAccess({ who: args.who, patientId: session.patientId });
  }

  return session;
}

export async function getCarePortProcurementById(args: {
  who: Who;
  orgId: string;
  sessionId: string;
}) {
  const session = await prisma.carePortRxProcurementSession.findFirst({
    where: { id: args.sessionId, orgId: args.orgId },
    include: sessionInclude(),
  });

  if (!session) {
    const err = new Error("procurement_session_not_found");
    (err as any).status = 404;
    throw err;
  }

  await requireCarePortPatientResourceAccess({ who: args.who, patientId: session.patientId });
  return session;
}

export async function updateCarePortProcurement(args: {
  who: Who;
  orgId: string;
  correlationId: string;
  sessionId: string;
  body: any;
}) {
  const current = await getCarePortProcurementById({ who: args.who, orgId: args.orgId, sessionId: args.sessionId });

  if (current.status !== "BASKET_DRAFT" && current.status !== "PHARMACY_DISCOVERY") {
    const err = new Error("procurement_session_not_editable");
    (err as any).status = 409;
    throw err;
  }

  const hasSearchLocation = Object.prototype.hasOwnProperty.call(args.body ?? {}, "searchLocation");
  const searchLocation = hasSearchLocation ? normalizeSearchLocation(args.body?.searchLocation) : undefined;
  const requested = Array.isArray(args.body?.lineStates) ? args.body.lineStates : [];

  if (requested.length > 100) {
    const err = new Error("too_many_line_updates");
    (err as any).status = 400;
    throw err;
  }

  const currentLineIds = new Set((current.lines || []).map((line: any) => String(line.id)));
  type ProcurementLineStatePatch = {
    lineId: string;
    state: "INCLUDED" | "DEFERRED_BY_PATIENT";
    deferReason: string | null;
  };

  const normalizedLineStates: ProcurementLineStatePatch[] = requested.map((row: any) => {
    const lineId = clean(row?.lineId, 240);
    const state = clean(row?.state, 80).toUpperCase();
    if (!lineId || !currentLineIds.has(lineId)) {
      const err = new Error("procurement_line_not_found");
      (err as any).status = 404;
      throw err;
    }
    if (state !== "INCLUDED" && state !== "DEFERRED_BY_PATIENT") {
      const err = new Error("procurement_line_state_invalid");
      (err as any).status = 400;
      throw err;
    }
    return {
      lineId,
      state: state as ProcurementLineStatePatch["state"],
      deferReason: state === "DEFERRED_BY_PATIENT" ? clean(row?.deferReason, 80) || null : null,
    };
  });

  const updated = await prisma.$transaction(async (tx) => {
    if (hasSearchLocation) {
      await tx.carePortRxProcurementSession.update({
        where: { id: current.id },
        data: searchLocation
          ? {
              searchLabel: searchLocation.label,
              searchAddress: searchLocation.address,
              searchLat: searchLocation.lat,
              searchLng: searchLocation.lng,
              searchSource: searchLocation.source,
            }
          : {
              searchLabel: null,
              searchAddress: null,
              searchLat: null,
              searchLng: null,
              searchSource: null,
            },
      });
    }

    for (const row of normalizedLineStates) {
      await tx.carePortRxProcurementLine.update({
        where: { id: row.lineId },
        data:
          row.state === "INCLUDED"
            ? { state: "INCLUDED", deferReason: null, deferredAt: null }
            : { state: "DEFERRED_BY_PATIENT", deferReason: row.deferReason, deferredAt: new Date() },
      });
    }

    return tx.carePortRxProcurementSession.findUniqueOrThrow({
      where: { id: current.id },
      include: sessionInclude(),
    });
  }, { maxWait: 15_000, timeout: 30_000 });

  await auditEvent({
    kind: "careport_rx_procurement_updated",
    actorId: clean((args.who as any)?.uid, 240) || null,
    actorRole: args.who.role ?? null,
    subjectId: current.id,
    meta: {
      correlationId: args.correlationId,
      orgId: args.orgId,
      searchLocationUpdated: hasSearchLocation,
      lineUpdates: normalizedLineStates.map((row) => ({ lineId: row.lineId, state: row.state })),
    },
  });

  return updated;
}
