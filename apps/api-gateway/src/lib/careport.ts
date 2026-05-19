// apps/api-gateway/src/lib/careport.ts
import crypto from "node:crypto";
import { prisma } from "@/src/lib/db";
import { readIdentity } from "@/src/lib/identity";

type Who = ReturnType<typeof readIdentity>;

export const CAREPORT_ORG_FALLBACK = "org-default";
const IDEMPOTENCY_ANONYMOUS_ACTOR = "__anonymous__";

export function orgIdFromHeaders(headers: Headers): string {
  return (headers.get("x-org-id") || CAREPORT_ORG_FALLBACK).trim() || CAREPORT_ORG_FALLBACK;
}

export function correlationIdFromHeaders(headers: Headers): string {
  const raw =
    headers.get("x-correlation-id") ||
    headers.get("x-request-id") ||
    headers.get("cf-ray") ||
    "";

  const v = raw.trim();
  return v || `corr_${crypto.randomBytes(8).toString("hex")}`;
}

export function requireRole(who: Who, allowed: string[]) {
  if (!allowed.includes(String(who.role))) {
    const err = new Error("forbidden");
    (err as any).status = 403;
    throw err;
  }
}

export function normalizeIdempotencyKey(headers: Headers, bodyKey?: unknown): string | null {
  const h = (headers.get("idempotency-key") || "").trim();
  if (h) return h;

  const b = typeof bodyKey === "string" ? bodyKey.trim() : "";
  return b ? b : null;
}

export function hashRequestBody(body: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(body ?? null)).digest("hex");
}

function normalizeActorUserId(value: unknown): string {
  const s = typeof value === "string" ? value.trim() : "";
  return s || IDEMPOTENCY_ANONYMOUS_ACTOR;
}

export async function withIdempotency<T>(params: {
  orgId: string;
  scope: string;
  key: string;
  actorUserId?: string | null;
  requestHash: string;
  run: () => Promise<T>;
}): Promise<{ hit: boolean; value: T }> {
  const { orgId, scope, key, actorUserId, requestHash, run } = params;
  const normalizedActorUserId = normalizeActorUserId(actorUserId);

  const existing = await prisma.idempotencyKey.findUnique({
    where: {
      orgId_scope_key_actorUserId: {
        orgId,
        scope,
        key,
        actorUserId: normalizedActorUserId,
      },
    },
  });

  if (existing) {
    if (existing.requestHash !== requestHash) {
      const err = new Error("idempotency_key_reuse_with_different_payload");
      (err as any).status = 409;
      throw err;
    }

    return { hit: true, value: existing.response as T };
  }

  const value = await run();

  await prisma.idempotencyKey.create({
    data: {
      orgId,
      scope,
      key,
      actorUserId: normalizedActorUserId,
      requestHash,
      response: value as any,
    },
  });

  return { hit: false, value };
}

export async function auditEvent(params: {
  kind: string;
  actorId?: string | null;
  actorRole?: string | null;
  subjectId?: string | null;
  meta?: any;
}) {
  await prisma.auditEvent
    .create({
      data: {
        kind: params.kind,
        actorId: params.actorId ?? null,
        actorRole: params.actorRole ?? null,
        subjectId: params.subjectId ?? null,
        meta: params.meta ?? null,
      },
    })
    .catch(() => {});
}

export function stableKey(input: string): string {
  return crypto.createHash("sha1").update(input).digest("hex").slice(0, 12);
}

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;

  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function inferDrugCodeFromText(text: string): string | null {
  const t = (text || "").toLowerCase();

  if (t.includes("augmentin") || (t.includes("amox") && t.includes("clav"))) {
    return "amox_clav_625";
  }

  if (t.includes("panado") || t.includes("paracetamol")) return "paracetamol_500";
  if (t.includes("zyrtec") || t.includes("cetirizine")) return "cetirizine_10";
  if (t.includes("brufen") || t.includes("ibuprofen")) return "ibuprofen_400";
  if (t.includes("nexium") || t.includes("esomeprazole")) return "esomeprazole_20";
  if (t.includes("ventolin") || t.includes("salbutamol")) return "salbutamol_inhaler";

  return null;
}

function parseQty(qty: unknown): number {
  if (typeof qty === "number" && Number.isFinite(qty)) {
    return Math.max(1, Math.floor(qty));
  }

  if (typeof qty === "string") {
    const n = Number(qty.replace(/[^\d.]/g, ""));
    if (Number.isFinite(n)) return Math.max(1, Math.floor(n));
  }

  return 1;
}

function buildDirections(m: any): string | null {
  const parts = [m?.dose, m?.route, m?.freq, m?.duration]
    .map((x) => String(x ?? "").trim())
    .filter(Boolean);

  const s = parts.join(" ");
  return s ? s : null;
}

export type NormalizedErxMed = {
  erxMedKey: string;
  name: string;
  quantity: number;
  directions: string | null;
  drugCode: string | null;
};

export function normalizeErxMeds(erx: any): NormalizedErxMed[] {
  const medsRaw = erx?.meds ?? erx?.medications ?? null;

  const meds: any[] = Array.isArray(medsRaw) ? medsRaw : [];
  if (meds.length) {
    return meds.map((m, i) => {
      const name = String(m?.drug ?? m?.name ?? "").trim() || "Medication";
      const rxcui = String(m?.rxcui ?? "").trim();
      const keyBase = rxcui ? `rxcui:${rxcui}` : `${name}|${i}`;
      const erxMedKey = String(m?.id ?? "").trim() || stableKey(keyBase);

      const drugCode =
        String(m?.drugCode ?? "").trim() ||
        inferDrugCodeFromText(name) ||
        (rxcui ? `rxnorm:${rxcui}` : null);

      return {
        erxMedKey,
        name,
        quantity: parseQty(m?.qty ?? m?.quantity),
        directions: buildDirections(m),
        drugCode,
      };
    });
  }

  const legacyDrug = String(erx?.drug ?? "").trim();
  if (legacyDrug) {
    return [
      {
        erxMedKey: stableKey(`legacy:${legacyDrug}`),
        name: legacyDrug,
        quantity: 1,
        directions: String(erx?.sig ?? "").trim() || null,
        drugCode: inferDrugCodeFromText(legacyDrug),
      },
    ];
  }

  return [];
}

export async function pharmacyIdForStaff(
  orgId: string,
  userId: string,
): Promise<string | null> {
  const staff = await prisma.carePortPharmacyStaff.findUnique({
    where: { userId },
  });

  if (!staff) return null;
  if (staff.orgId !== orgId) return null;

  return staff.pharmacyId;
}

export async function getActivePricingRule(params: {
  orgId: string;
  country: string;
  currency: string;
}) {
  const rule = await prisma.carePortDeliveryPricingRule.findFirst({
    where: {
      orgId: params.orgId,
      isActive: true,
      country: params.country,
      currency: params.currency,
    },
    orderBy: { updatedAt: "desc" },
  });

  if (!rule) {
    const err = new Error("missing_delivery_pricing_rule");
    (err as any).status = 500;
    throw err;
  }

  return rule;
}

export function calcDeliveryFeeCents(
  rule: {
    baseFeeCents: number;
    includedKm: number;
    extraPerKmCents: number;
  },
  distanceKm: number,
) {
  const d = Number.isFinite(distanceKm) ? Math.max(0, distanceKm) : 0;
  const extraKm = Math.max(0, Math.ceil(d - rule.includedKm));

  return rule.baseFeeCents + extraKm * rule.extraPerKmCents;
}

export function ensureCurrency(expected: string, actual: string, context: string) {
  if (expected !== actual) {
    const err = new Error(`currency_mismatch:${context}:${expected}:${actual}`);
    (err as any).status = 409;
    throw err;
  }
}