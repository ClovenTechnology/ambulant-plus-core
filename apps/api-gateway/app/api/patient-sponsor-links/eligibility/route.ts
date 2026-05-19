import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

import { prisma } from "@/src/lib/db";
import { requireApiClientRole } from "@/src/lib/client-rbac";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PAYEROPS_ALLOWED_ROLES = [
  "ORG_OWNER",
  "ORG_ADMIN",
  "CLAIMS_MANAGER",
  "FINANCE_MANAGER",
] as const;

function trim(v: unknown) {
  return String(v ?? "").trim();
}

function upper(v: unknown) {
  return trim(v).toUpperCase();
}

function asObj(v: unknown): Record<string, any> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, any>)
    : {};
}

function currentPeriodKey(d = new Date()) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function hashPayload(value: unknown) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(value ?? null))
    .digest("hex");
}

function validFromPeriod(periodKey: string) {
  const [yearRaw, monthRaw] = periodKey.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);

  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;

  return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
}

function validToFromPeriod(periodKey: string) {
  const [yearRaw, monthRaw] = periodKey.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);

  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;

  return new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
}

function isEligibleStatus(status: string, premiumStatus: string) {
  const blocked = new Set([
    "UNPAID",
    "INACTIVE",
    "SUSPENDED",
    "CANCELLED",
    "CANCELED",
    "EXPIRED",
    "UNVERIFIED",
    "FAILED",
    "LAPSED",
    "PENDING",
    "NOT_ELIGIBLE",
    "NOT_FOUND",
  ]);

  if (blocked.has(status)) return false;
  if (premiumStatus && blocked.has(premiumStatus)) return false;

  return ["ACTIVE", "VERIFIED", "ELIGIBLE", "PAID"].includes(status);
}

async function writeAudit(data: {
  orgId: string;
  clientId?: string | null;
  actorUserId?: string | null;
  actorRole?: string | null;
  action: string;
  entityId?: string | null;
  status?: string | null;
  metadata?: Record<string, any>;
}) {
  const db: any = prisma;

  await db.clientAuditLog?.create?.({
    data: {
      orgId: data.orgId,
      clientId: data.clientId || null,
      actorUserId: data.actorUserId || null,
      actorRole: data.actorRole || null,
      action: data.action,
      entityType: "ClientMemberEligibilitySnapshot",
      entityId: data.entityId || null,
      status: data.status || "SUCCESS",
      metadata: data.metadata || {},
    },
  }).catch(() => null);

  await db.auditLog?.create?.({
    data: {
      orgId: data.orgId,
      clientId: data.clientId || null,
      actorUserId: data.actorUserId || null,
      actorRole: data.actorRole || null,
      action: data.action,
      entityType: "ClientMemberEligibilitySnapshot",
      entityId: data.entityId || null,
      status: data.status || "SUCCESS",
      metadata: data.metadata || {},
    },
  }).catch(() => null);
}

async function resolveClientMember(args: {
  orgId: string;
  clientId?: string;
  memberId?: string;
  clientMemberId?: string;
  patientId?: string;
  memberNumber?: string;
}) {
  const where: any = { orgId: args.orgId };

  const id = trim(args.memberId || args.clientMemberId);
  if (id) {
    return prisma.clientMember.findFirst({
      where: { orgId: args.orgId, id },
    });
  }

  if (args.clientId) where.clientId = args.clientId;
  if (args.patientId) where.patientId = args.patientId;
  if (args.memberNumber) where.memberNumber = args.memberNumber;

  return prisma.clientMember.findFirst({
    where,
    orderBy: [{ updatedAt: "desc" }],
  });
}

function normalizeSnapshot(row: any) {
  return {
    id: row.id,
    orgId: row.orgId,
    clientId: row.clientId,
    clientMemberId: row.clientMemberId,
    coveragePlanId: row.coveragePlanId,
    patientId: row.patientId,
    userId: row.userId,
    periodKey: row.periodKey,
    source: row.source,
    status: row.status,
    eligibilityStatus: row.eligibilityStatus,
    premiumStatus: row.premiumStatus,
    reasonCode: row.reasonCode,
    reasonText: row.reasonText,
    verifiedAt: row.verifiedAt,
    validFrom: row.validFrom,
    validTo: row.validTo,
    rawPayload: row.rawPayload,
    metadata: row.metadata,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const orgId = trim(url.searchParams.get("orgId")) || "org-default";
  const clientId = trim(url.searchParams.get("clientId"));
  const periodKey = trim(url.searchParams.get("periodKey")) || currentPeriodKey();
  const status = upper(url.searchParams.get("status"));
  const patientId = trim(url.searchParams.get("patientId"));
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 250), 1), 1000);

  const auth = requireApiClientRole(req, [...PAYEROPS_ALLOWED_ROLES], { orgId });
  if (auth.ok === false) return auth.response;

  const db: any = prisma;

  const where: any = { orgId };
  if (clientId) where.clientId = clientId;
  if (periodKey) where.periodKey = periodKey;
  if (patientId) where.patientId = patientId;
  if (status) {
    where.OR = [
      { status },
      { eligibilityStatus: status },
      { premiumStatus: status },
    ];
  }

  const rows = await db.clientMemberEligibilitySnapshot.findMany({
    where,
    orderBy: [{ verifiedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
  });

  await writeAudit({
    orgId,
    clientId: clientId || null,
    actorUserId: auth.actor.uid,
    actorRole: auth.actor.role,
    action: "client_member_eligibility_snapshot.read",
    metadata: { count: rows.length, periodKey, status: status || null },
  });

  const items = rows.map(normalizeSnapshot);

  return NextResponse.json({
    ok: true,
    periodKey,
    items,
    summary: {
      total: items.length,
      active: items.filter((x: any) => isEligibleStatus(upper(x.eligibilityStatus), upper(x.premiumStatus))).length,
      blocked: items.filter((x: any) => !isEligibleStatus(upper(x.eligibilityStatus), upper(x.premiumStatus))).length,
      unpaid: items.filter((x: any) => upper(x.premiumStatus) === "UNPAID").length,
      unverified: items.filter((x: any) => upper(x.eligibilityStatus) === "UNVERIFIED").length,
      suspended: items.filter((x: any) => upper(x.status) === "SUSPENDED").length,
      cancelled: items.filter((x: any) => ["CANCELLED", "CANCELED"].includes(upper(x.status))).length,
      expired: items.filter((x: any) => upper(x.status) === "EXPIRED").length,
    },
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));
  const orgId = trim(body.orgId) || "org-default";

  const auth = requireApiClientRole(req, [...PAYEROPS_ALLOWED_ROLES], { orgId });
  if (auth.ok === false) return auth.response;

  const db: any = prisma;

  const periodKey = trim(body.periodKey) || currentPeriodKey();
  const source = upper(body.source || "PAYEROPS_MANUAL");
  const adapterChannel = trim(body.adapterChannel || "PAYEROPS_MANUAL");

  const rawItems = Array.isArray(body.items) ? body.items : [body];
  const results: any[] = [];

  for (const raw of rawItems) {
    const item = asObj(raw);

    const patientSponsorLinkId = trim(item.patientSponsorLinkId || item.linkId || item.id);
    const clientMemberId = trim(item.clientMemberId || patientSponsorLinkId);
    const clientId = trim(item.clientId || body.clientId);
    const patientId = trim(item.patientId);
    const memberNumber = trim(item.memberNumber || item.membershipNumber);

    const member = await resolveClientMember({
      orgId,
      clientId,
      memberId: patientSponsorLinkId,
      clientMemberId,
      patientId,
      memberNumber,
    });

    if (!member) {
      results.push({
        ok: false,
        error: "client_member_not_found",
        patientSponsorLinkId: patientSponsorLinkId || null,
        clientMemberId: clientMemberId || null,
        clientId: clientId || null,
        patientId: patientId || null,
        memberNumber: memberNumber || null,
      });
      continue;
    }

    const status = upper(item.status || "ACTIVE");
    const premiumStatus = upper(item.premiumStatus || "PAID");
    const eligibilityStatus = upper(
      item.eligibilityStatus ||
        item.memberStatus ||
        status ||
        "ELIGIBLE",
    );

    const validFrom =
      item.validFrom || item.effectiveFrom
        ? new Date(String(item.validFrom || item.effectiveFrom))
        : validFromPeriod(periodKey);

    const validTo =
      item.validTo || item.effectiveTo
        ? new Date(String(item.validTo || item.effectiveTo))
        : validToFromPeriod(periodKey);

    const reasonCode = trim(item.reasonCode || item.code || "PAYEROPS_VERIFIED");
    const reasonText = trim(item.reasonText || item.reason || "Eligibility verified for period.");

    const payload = {
      ...item,
      orgId,
      clientId: member.clientId,
      clientMemberId: member.id,
      coveragePlanId: member.coveragePlanId || null,
      patientId: member.patientId || patientId || null,
      periodKey,
      source,
      adapterChannel,
      verifiedAt: new Date().toISOString(),
    };

    const payloadHash = hashPayload(payload);

    const snapshot = await db.clientMemberEligibilitySnapshot.upsert({
      where: {
        clientMemberId_periodKey_source: {
          clientMemberId: member.id,
          periodKey,
          source,
        },
      },
      create: {
        orgId,
        clientId: member.clientId,
        clientMemberId: member.id,
        coveragePlanId: member.coveragePlanId || null,
        patientId: member.patientId || patientId || null,
        userId: member.userId || null,
        periodKey,
        source,
        status,
        eligibilityStatus,
        premiumStatus,
        reasonCode,
        reasonText,
        verifiedAt: new Date(),
        validFrom: validFrom && Number.isFinite(validFrom.getTime()) ? validFrom : null,
        validTo: validTo && Number.isFinite(validTo.getTime()) ? validTo : null,
        rawPayload: payload,
        metadata: {
          source,
          adapterChannel,
          payloadHash,
          paymentEligible: isEligibleStatus(eligibilityStatus, premiumStatus),
          verifiedByUserId: auth.actor.uid,
        },
      },
      update: {
        clientId: member.clientId,
        coveragePlanId: member.coveragePlanId || null,
        patientId: member.patientId || patientId || null,
        userId: member.userId || null,
        status,
        eligibilityStatus,
        premiumStatus,
        reasonCode,
        reasonText,
        verifiedAt: new Date(),
        validFrom: validFrom && Number.isFinite(validFrom.getTime()) ? validFrom : null,
        validTo: validTo && Number.isFinite(validTo.getTime()) ? validTo : null,
        rawPayload: payload,
        metadata: {
          source,
          adapterChannel,
          payloadHash,
          paymentEligible: isEligibleStatus(eligibilityStatus, premiumStatus),
          verifiedByUserId: auth.actor.uid,
        },
      },
    });

    await writeAudit({
      orgId,
      clientId: member.clientId,
      actorUserId: auth.actor.uid,
      actorRole: auth.actor.role,
      action: "client_member_eligibility_snapshot.verify",
      entityId: snapshot.id,
      metadata: {
        clientMemberId: member.id,
        periodKey,
        source,
        adapterChannel,
        status,
        eligibilityStatus,
        premiumStatus,
        paymentEligible: isEligibleStatus(eligibilityStatus, premiumStatus),
        payloadHash,
      },
    });

    results.push({
      ok: true,
      paymentEligible: isEligibleStatus(eligibilityStatus, premiumStatus),
      snapshot: normalizeSnapshot(snapshot),
    });
  }

  return NextResponse.json({
    ok: true,
    periodKey,
    results,
    summary: {
      total: results.length,
      success: results.filter((x) => x.ok).length,
      failed: results.filter((x) => !x.ok).length,
    },
  });
}