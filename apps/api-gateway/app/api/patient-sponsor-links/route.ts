import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Actor = {
  uid: string;
  role: string;
  orgId: string;
};

function trim(v: unknown) {
  return String(v || "").trim();
}

function upper(v: unknown, fallback = "") {
  const s = trim(v).toUpperCase();
  return s || fallback;
}

function asRecord(v: unknown): Record<string, any> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, any>)
    : {};
}

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function readActor(req: NextRequest): Actor {
  const uid =
    trim(req.headers.get("x-ambulant-user-id")) ||
    trim(req.headers.get("x-user-id")) ||
    trim(req.headers.get("x-uid")) ||
    trim(req.headers.get("x-user")) ||
    "anonymous";

  const role =
    trim(req.headers.get("x-ambulant-role")) ||
    trim(req.headers.get("x-role")) ||
    "patient";

  const orgId =
    trim(req.headers.get("x-ambulant-org-id")) ||
    trim(req.headers.get("x-org-id")) ||
    "org-default";

  return { uid, role, orgId };
}

function isPrivileged(actor: Actor) {
  return [
    "ORG_OWNER",
    "ORG_ADMIN",
    "ADMIN",
    "admin",
    "admin_staff",
    "client_admin",
    "payer_ops",
  ].includes(actor.role);
}

async function resolvePatientIdForRead(req: NextRequest, actor: Actor) {
  const url = new URL(req.url);
  const requestedPatientId = trim(url.searchParams.get("patientId"));
  const requestedUserId = trim(url.searchParams.get("userId"));

  if (isPrivileged(actor)) {
    return requestedPatientId || requestedUserId || "";
  }

  if (!actor.uid || actor.uid === "anonymous") {
    throw Object.assign(new Error("unauthorized"), { status: 401 });
  }

  const profile = await prisma.patientProfile.findFirst({
    where: {
      OR: [{ id: actor.uid }, { userId: actor.uid }],
    },
    select: { id: true, userId: true },
  }).catch(() => null);

  const ownPatientId = profile?.id || actor.uid;
  const ownUserId = profile?.userId || actor.uid;
  const requested = requestedPatientId || requestedUserId || ownPatientId;

  if (
    requested === ownPatientId ||
    requested === ownUserId ||
    requested === actor.uid
  ) {
    return ownPatientId;
  }

  throw Object.assign(new Error("forbidden"), { status: 403 });
}

function activeDecision(args: {
  member: any;
  plan: any | null;
  snapshot: any | null;
}) {
  const { member, plan, snapshot } = args;

  const meta = asRecord(member?.metadata);
  const memberStatus = upper(member?.memberStatus);
  const verificationState = upper(
    (member as any)?.verificationState ?? meta.verificationState ?? "VERIFIED",
    "VERIFIED",
  );

  const planStatus = upper(plan?.status);
  const now = Date.now();

  const effectiveFrom = member?.effectiveFrom
    ? new Date(member.effectiveFrom).getTime()
    : null;
  const effectiveTo = member?.effectiveTo
    ? new Date(member.effectiveTo).getTime()
    : null;

  const inDateRange =
    (!effectiveFrom || effectiveFrom <= now) &&
    (!effectiveTo || effectiveTo >= now);

  const premiumStatus = upper(snapshot?.premiumStatus, "UNKNOWN");
  const eligibilityStatus = upper(snapshot?.eligibilityStatus, "PENDING");
  const snapshotStatus = upper(snapshot?.status, "PENDING");

  if (!["ACTIVE", "APPROVED", "ENROLLED"].includes(memberStatus)) {
    return {
      active: false,
      reasonCode: "POLICY_INACTIVE",
      reasonText: `Membership status is ${memberStatus || "UNKNOWN"}.`,
    };
  }

  if (!["VERIFIED", "APPROVED", "CONFIRMED"].includes(verificationState)) {
    return {
      active: false,
      reasonCode: "PENDING_VERIFICATION",
      reasonText: "Membership link still requires payer verification.",
    };
  }

  if (!inDateRange) {
    return {
      active: false,
      reasonCode: "POLICY_OUT_OF_DATE",
      reasonText: "Membership is not within its effective coverage dates.",
    };
  }

  if (!plan || planStatus !== "ACTIVE") {
    return {
      active: false,
      reasonCode: "PLAN_INACTIVE",
      reasonText: "Coverage plan is not active.",
    };
  }

  if (!snapshot) {
    return {
      active: false,
      reasonCode: "ELIGIBILITY_NOT_VERIFIED",
      reasonText: "No current monthly eligibility verification has been recorded.",
    };
  }

  if (["UNPAID", "FAILED", "ARREARS"].includes(premiumStatus)) {
    return {
      active: false,
      reasonCode: "PREMIUM_UNPAID",
      reasonText: "Latest eligibility snapshot shows unpaid premium or arrears.",
    };
  }

  if (["SUSPENDED", "CANCELLED", "EXPIRED", "NOT_FOUND"].includes(snapshotStatus)) {
    return {
      active: false,
      reasonCode: `SNAPSHOT_${snapshotStatus}`,
      reasonText: `Latest eligibility snapshot status is ${snapshotStatus}.`,
    };
  }

  if (!["ELIGIBLE", "ACTIVE", "PAID"].includes(eligibilityStatus)) {
    return {
      active: false,
      reasonCode: "NOT_ELIGIBLE",
      reasonText: `Latest eligibility status is ${eligibilityStatus}.`,
    };
  }

  return {
    active: true,
    reasonCode: "ACTIVE",
    reasonText: "Membership is active, verified, in-date, paid, and eligible.",
  };
}

function normalizeLink(args: {
  member: any;
  client: any | null;
  plan: any | null;
  snapshot: any | null;
}) {
  const { member, client, plan, snapshot } = args;
  const meta = asRecord(member?.metadata);
  const decision = activeDecision({ member, plan, snapshot });

  const payerName =
    client?.tradingName ||
    client?.legalName ||
    meta.medicalAidName ||
    meta.schemeName ||
    member.clientId;

  const planName =
    plan?.name ||
    meta.benefitOption ||
    meta.hospitalCoverName ||
    member.coveragePlanId ||
    "";

  return {
    id: member.id,
    patientId: member.patientId,
    userId: member.userId ?? null,

    clientId: member.clientId,
    coveragePlanId: member.coveragePlanId ?? null,
    clientProgramId: member.clientProgramId ?? null,

    payerName,
    planName,

    membershipNumber: member.memberNumber ?? meta.membershipNumber ?? "",
    memberNumber: member.memberNumber ?? "",
    dependentCode: member.dependentCode ?? meta.dependantSequence ?? "",
    principalMemberNumber: member.principalMemberNumber ?? "",
    principalName: meta.principalName ?? "",

    memberStatus: member.memberStatus ?? null,
    verificationStatus:
      (member as any).verificationState ?? meta.verificationState ?? "VERIFIED",

    premiumStatus: snapshot?.premiumStatus ?? "UNKNOWN",
    eligibilityStatus: snapshot?.eligibilityStatus ?? "PENDING",
    latestEligibility: snapshot ?? null,

    effectiveFrom: member.effectiveFrom ?? null,
    effectiveTo: member.effectiveTo ?? null,

    active: decision.active,
    reasonCode: decision.reasonCode,
    reasonText: decision.reasonText,

    telemedCover: decision.active ? "partial" : "none",
    telemedCopayType: "fixed",
    telemedCopayValue: null,

    metadata: {
      ...meta,
      patientSponsorLink: true,
      source: "clientMember",
      reasonCode: decision.reasonCode,
      reasonText: decision.reasonText,
    },
  };
}

async function latestSnapshotsFor(memberIds: string[]) {
  const db = prisma as any;
  const model = db.clientMemberEligibilitySnapshot;

  if (!model?.findMany || memberIds.length === 0) {
    return new Map<string, any>();
  }

  const rows = await model.findMany({
    where: { clientMemberId: { in: memberIds } },
    orderBy: [{ periodKey: "desc" }, { createdAt: "desc" }],
  });

  const out = new Map<string, any>();
  for (const row of rows) {
    if (!out.has(row.clientMemberId)) out.set(row.clientMemberId, row);
  }
  return out;
}

export async function GET(req: NextRequest) {
  try {
    const actor = readActor(req);
    const url = new URL(req.url);

    const orgId = trim(url.searchParams.get("orgId")) || actor.orgId || "org-default";
    const clientId = trim(url.searchParams.get("clientId"));
    const includeInactive = ["1", "true", "yes"].includes(
      trim(url.searchParams.get("includeInactive")).toLowerCase(),
    );

    const patientId = await resolvePatientIdForRead(req, actor);

    const rawMembers = await prisma.clientMember.findMany({
      where: {
        orgId,
        ...(patientId ? { patientId } : {}),
        ...(clientId ? { clientId } : {}),
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 500,
    });

    const members = includeInactive
      ? rawMembers
      : rawMembers.filter((member: any) => {
          const status = upper(member?.memberStatus);
          const meta = asRecord(member?.metadata);
          const removedAt = trim(meta.patientSponsorLinkInactiveAt);

          if (removedAt) return false;

          return ![
            "INACTIVE",
            "CANCELLED",
            "CANCELED",
            "SUSPENDED",
            "EXPIRED",
            "REMOVED",
          ].includes(status);
        });

    const clientIds = Array.from(new Set(members.map((m) => m.clientId).filter(Boolean)));
    const planIds = Array.from(new Set(members.map((m) => m.coveragePlanId).filter(Boolean))) as string[];

    const [clients, plans, snapshots] = await Promise.all([
      clientIds.length
        ? prisma.client.findMany({ where: { id: { in: clientIds } } }).catch(() => [])
        : Promise.resolve([]),
      planIds.length
        ? prisma.coveragePlan.findMany({ where: { id: { in: planIds } } }).catch(() => [])
        : Promise.resolve([]),
      latestSnapshotsFor(members.map((m) => m.id)),
    ]);

    const clientsById = new Map(clients.map((x: any) => [x.id, x]));
    const plansById = new Map(plans.map((x: any) => [x.id, x]));

    const items = members.map((member) =>
      normalizeLink({
        member,
        client: clientsById.get(member.clientId) ?? null,
        plan: member.coveragePlanId ? plansById.get(member.coveragePlanId) ?? null : null,
        snapshot: snapshots.get(member.id) ?? null,
      }),
    );

    return json({ ok: true, items });
  } catch (e: any) {
    return json(
      { ok: false, error: e?.message || "patient_sponsor_links_failed" },
      e?.status || 500,
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = readActor(req);
    const body = await req.json().catch(() => ({} as any));

    if (!actor.uid || actor.uid === "anonymous") {
      return json({ ok: false, error: "unauthorized" }, 401);
    }

    const orgId = trim(body.orgId) || actor.orgId || "org-default";
    const patientId = trim(body.patientId) || trim(body.subjectPatientId) || actor.uid;

    if (!isPrivileged(actor)) {
      const profile = await prisma.patientProfile.findFirst({
        where: { OR: [{ id: actor.uid }, { userId: actor.uid }] },
        select: { id: true, userId: true },
      }).catch(() => null);

      const ownPatientId = profile?.id || actor.uid;
      if (patientId !== ownPatientId && patientId !== actor.uid) {
        return json({ ok: false, error: "forbidden" }, 403);
      }
    }

    const clientIdRaw = trim(body.clientId || body.sponsorId);
    const payerName = trim(body.payerName || body.sponsorName);
    const membershipNumber = trim(body.membershipNumber || body.memberNumber);

    if (!membershipNumber) {
      return json({ ok: false, error: "membershipNumber_required" }, 400);
    }

    let client: any = null;

    if (clientIdRaw) {
      client = await prisma.client.findFirst({
        where: { orgId, id: clientIdRaw },
      });
    }

    if (!client && payerName) {
      client = await prisma.client.findFirst({
        where: {
          orgId,
          OR: [
            { tradingName: { equals: payerName, mode: "insensitive" } },
            { legalName: { equals: payerName, mode: "insensitive" } },
          ],
        } as any,
      });
    }

    if (!client) {
      return json(
        {
          ok: false,
          error: "known_client_required",
          message:
            "Select an onboarded Medical Aid / HMO / sponsor. Unknown payers must come through Join a Scheme/application review.",
        },
        400,
      );
    }

    const coveragePlanId = trim(body.coveragePlanId || body.planId);
    let plan: any = null;

    if (coveragePlanId) {
      plan = await prisma.coveragePlan.findFirst({
        where: { orgId, clientId: client.id, id: coveragePlanId },
      });
    }

    if (!plan) {
      const planName = trim(body.planName);
      plan = await prisma.coveragePlan.findFirst({
        where: {
          orgId,
          clientId: client.id,
          ...(planName ? { name: { equals: planName, mode: "insensitive" } as any } : {}),
          status: "ACTIVE",
        },
        orderBy: [{ updatedAt: "desc" }],
      });
    }

    if (!plan) {
      return json({ ok: false, error: "active_coverage_plan_required" }, 400);
    }

    const program = await prisma.clientProgram.findFirst({
      where: { orgId, clientId: client.id, status: "ACTIVE" },
      orderBy: [{ updatedAt: "desc" }],
    }).catch(() => null);

    const dependentCode = trim(body.dependentCode) || "00";
    const now = new Date();

    const created = await prisma.clientMember.create({
      data: {
        id: trim(body.id) || `member-link-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        orgId,
        clientId: client.id,
        clientProgramId: program?.id ?? null,
        coveragePlanId: plan.id,
        userId: trim(body.userId) || actor.uid,
        patientId,
        memberKind: dependentCode === "00" ? "PRINCIPAL" : "DEPENDANT",
        memberStatus: "ACTIVE",
        memberNumber: membershipNumber,
        employeeNumber: trim(body.employeeNumber) || null,
        dependentCode,
        principalMemberNumber: trim(body.principalMemberNumber) || membershipNumber,
        joinedAt: now,
        effectiveFrom: now,
        effectiveTo: null,
        metadata: {
          patientSponsorLink: true,
          source: "patient_self_link",
          verificationState: "PENDING",
          payerName,
          planName: plan.name,
          dependentCode,
          principalName: trim(body.principalName),
          consent: body.consent ?? null,
          rawInput: body,
        },
      } as any,
    });

    return json({ ok: true, item: created }, 201);
  } catch (e: any) {
    return json(
      { ok: false, error: e?.message || "patient_sponsor_link_create_failed" },
      e?.status || 500,
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const actor = readActor(req);
    const body = await req.json().catch(() => ({} as any));
    const id = trim(body.id);

    if (!id) return json({ ok: false, error: "id_required" }, 400);

    const current = await prisma.clientMember.findUnique({ where: { id } });
    if (!current) return json({ ok: false, error: "not_found" }, 404);

    if (!isPrivileged(actor)) {
      const profile = await prisma.patientProfile.findFirst({
        where: { OR: [{ id: actor.uid }, { userId: actor.uid }] },
        select: { id: true, userId: true },
      }).catch(() => null);

      const ownPatientId = profile?.id || actor.uid;
      if (current.patientId !== ownPatientId && current.userId !== actor.uid) {
        return json({ ok: false, error: "forbidden" }, 403);
      }
    }

    const meta = asRecord(current.metadata);
    const nextMeta = {
      ...meta,
      ...(body.metadata && typeof body.metadata === "object" ? body.metadata : {}),
      updatedFromPatientSponsorLink: true,
      ...(typeof body.active === "boolean"
        ? {
            verificationState: body.active ? "VERIFIED" : "INACTIVE",
            patientSponsorLinkInactiveAt: body.active
              ? undefined
              : new Date().toISOString(),
          }
        : {}),
    };

    const updated = await prisma.clientMember.update({
      where: { id },
      data: {
        ...(typeof body.active === "boolean"
          ? {
              memberStatus: "ACTIVE",
              effectiveTo: body.active ? null : new Date(Date.now() - 1000),
            }
          : {}),
        ...(body.coveragePlanId ? { coveragePlanId: trim(body.coveragePlanId) } : {}),
        ...(body.membershipNumber ? { memberNumber: trim(body.membershipNumber) } : {}),
        ...(body.dependentCode ? { dependentCode: trim(body.dependentCode) } : {}),
        metadata: nextMeta,
      } as any,
    });

    return json({ ok: true, item: updated });
  } catch (e: any) {
    return json(
      { ok: false, error: e?.message || "patient_sponsor_link_update_failed" },
      e?.status || 500,
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const actor = readActor(req);
    const id = trim(new URL(req.url).searchParams.get("id"));

    if (!id) return json({ ok: false, error: "id_required" }, 400);

    const current = await prisma.clientMember.findUnique({ where: { id } });
    if (!current) return json({ ok: false, error: "not_found" }, 404);

    if (!isPrivileged(actor)) {
      const profile = await prisma.patientProfile.findFirst({
        where: { OR: [{ id: actor.uid }, { userId: actor.uid }] },
        select: { id: true, userId: true },
      }).catch(() => null);

      const ownPatientId = profile?.id || actor.uid;
      if (current.patientId !== ownPatientId && current.userId !== actor.uid) {
        return json({ ok: false, error: "forbidden" }, 403);
      }
    }

    const meta = asRecord(current.metadata);

    await prisma.clientMember.update({
      where: { id },
      data: {
        memberStatus: "ACTIVE",
        effectiveTo: new Date(Date.now() - 1000),
        metadata: {
          ...meta,
          verificationState: "REMOVED",
          patientSponsorLinkInactiveAt: new Date().toISOString(),
          patientSponsorLinkInactiveReason: "patient_removed_link",
        },
      } as any,
    });

    return json({ ok: true });
  } catch (e: any) {
    return json(
      { ok: false, error: e?.message || "patient_sponsor_link_delete_failed" },
      e?.status || 500,
    );
  }
}