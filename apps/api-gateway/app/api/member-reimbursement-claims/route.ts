import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/src/lib/db";
import { readIdentity } from "@/src/lib/identity";
import { requireApiClientRole } from "@/src/lib/client-rbac";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ACTIVE_CLAIM_STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "REQUEST_INFO",
  "APPROVED",
  "PARTIALLY_APPROVED",
  "READY_FOR_PAYMENT",
  "PAID",
];

const PAYEROPS_ALLOWED_ROLES = [
  "ORG_OWNER",
  "ORG_ADMIN",
  "CLAIMS_MANAGER",
  "FINANCE_MANAGER",
] as const;

function trim(v: unknown) {
  return String(v ?? "").trim();
}

function asRecord(v: unknown): Record<string, any> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, any>)
    : {};
}

function upper(v: unknown) {
  return trim(v).toUpperCase();
}

function makeClaimNumber() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `MR-${y}${m}${day}-${suffix}`;
}

function looksLikePayerOps(req: NextRequest) {
  return Boolean(
    req.headers.get("x-ambulant-user-id") ||
      req.headers.get("x-ambulant-trusted") ||
      upper(req.headers.get("x-ambulant-role")).includes("ORG_") ||
      upper(req.headers.get("x-ambulant-role")).includes("CLAIMS") ||
      upper(req.headers.get("x-ambulant-role")).includes("FINANCE"),
  );
}

function getPatientIdentity(req: NextRequest) {
  try {
    const who = readIdentity(req.headers);
    const uid = trim((who as any)?.uid || req.headers.get("x-uid"));
    const orgId = trim((who as any)?.orgId || req.headers.get("x-org-id")) || "org-default";
    const role = trim((who as any)?.role || req.headers.get("x-role")).toLowerCase();

    if (!uid || role !== "patient") {
      return { ok: false as const, response: NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }) };
    }

    return { ok: true as const, uid, orgId, role };
  } catch {
    return { ok: false as const, response: NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }) };
  }
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
      entityType: "MemberReimbursementClaim",
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
      entityType: "MemberReimbursementClaim",
      entityId: data.entityId || null,
      status: data.status || "SUCCESS",
      metadata: data.metadata || {},
    },
  }).catch(() => null);
}

function normalizeClaim(row: any) {
  return {
    id: row.id,
    orgId: row.orgId,
    clientId: row.clientId,
    clientMemberId: row.clientMemberId,
    patientSponsorLinkId: row.patientSponsorLinkId,
    patientId: row.patientId,
    userId: row.userId,
    appointmentId: row.appointmentId,
    encounterId: row.encounterId,
    paymentRef: row.paymentRef,
    claimNumber: row.claimNumber,
    claimType: row.claimType,
    payeeType: row.payeeType,
    originalPaymentMethod: row.originalPaymentMethod,
    providerAlreadyPaid: row.providerAlreadyPaid,
    status: row.status,
    reason: row.reason,
    currency: row.currency,
    requestedAmountMinor: row.requestedAmountMinor,
    approvedAmountMinor: row.approvedAmountMinor,
    paidAmountMinor: row.paidAmountMinor,
    memberResponsibilityMinor: row.memberResponsibilityMinor,
    policySnapshot: row.policySnapshot,
    appointmentSnapshot: row.appointmentSnapshot,
    evidenceJson: row.evidenceJson,
    reviewPayload: row.reviewPayload,
    metadata: row.metadata,
    submittedAt: row.submittedAt,
    reviewedAt: row.reviewedAt,
    reviewedByUserId: row.reviewedByUserId,
    paidAt: row.paidAt,
    paidByUserId: row.paidByUserId,
    remittanceRef: row.remittanceRef,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const orgId = trim(url.searchParams.get("orgId")) || "org-default";
  const clientId = trim(url.searchParams.get("clientId"));
  const patientId = trim(url.searchParams.get("patientId"));
  const status = upper(url.searchParams.get("status"));
  const appointmentId = trim(url.searchParams.get("appointmentId"));
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 100), 1), 500);

  const db: any = prisma;

  if (looksLikePayerOps(req)) {
    const auth = requireApiClientRole(
      req,
      [...PAYEROPS_ALLOWED_ROLES],
      { orgId },
    );

    if (auth.ok === false) return auth.response;

    const where: any = { orgId };
    if (clientId) where.clientId = clientId;
    if (patientId) where.patientId = patientId;
    if (status) where.status = status;
    if (appointmentId) where.appointmentId = appointmentId;

    const items = await db.memberReimbursementClaim.findMany({
      where,
      orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
      take: limit,
    });

    await writeAudit({
      orgId,
      clientId: clientId || null,
      actorUserId: auth.actor.uid,
      actorRole: auth.actor.role,
      action: "member_reimbursement_claims.read",
      status: "SUCCESS",
      metadata: { count: items.length, status: status || null },
    });

    return NextResponse.json({
      ok: true,
      scope: "payerops",
      items: items.map(normalizeClaim),
      summary: {
        total: items.length,
        submitted: items.filter((x: any) => x.status === "SUBMITTED").length,
        underReview: items.filter((x: any) => x.status === "UNDER_REVIEW").length,
        requestInfo: items.filter((x: any) => x.status === "REQUEST_INFO").length,
        approved: items.filter((x: any) => x.status === "APPROVED" || x.status === "PARTIALLY_APPROVED").length,
        paid: items.filter((x: any) => x.status === "PAID").length,
      },
    });
  }

  const patientAuth = getPatientIdentity(req);
  if (!patientAuth.ok) return patientAuth.response;

  const where: any = {
    orgId: patientAuth.orgId,
    userId: patientAuth.uid,
  };

  if (patientId) where.patientId = patientId;
  if (status) where.status = status;
  if (appointmentId) where.appointmentId = appointmentId;

  const items = await db.memberReimbursementClaim.findMany({
    where,
    orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
  });

  return NextResponse.json({
    ok: true,
    scope: "patient",
    items: items.map(normalizeClaim),
  });
}

export async function POST(req: NextRequest) {
  const patientAuth = getPatientIdentity(req);
  if (!patientAuth.ok) return patientAuth.response;

  const body = await req.json().catch(() => ({} as any));
  const db: any = prisma;

  const appointmentId = trim(body.appointmentId || body.appointment_id);
  if (!appointmentId) {
    return NextResponse.json(
      { ok: false, error: "appointmentId_required" },
      { status: 400 },
    );
  }

  const appt = await db.appointment.findUnique({
    where: { id: appointmentId },
  });

  if (!appt) {
    return NextResponse.json(
      { ok: false, error: "appointment_not_found" },
      { status: 404 },
    );
  }

  const meta = asRecord(appt.meta);
  const reimbursementIntent = asRecord(meta.reimbursementIntent);
  const medicalAid = asRecord(meta.medicalAid);
  const sponsor = asRecord(meta.sponsor);
  const priceLock = asRecord(meta.priceLock);

  const appointmentPatientId =
    trim(appt.subjectPatientId) ||
    trim(appt.patientId) ||
    trim(body.patientId);

  const allowedForPatient =
    trim(appt.hostUserId) === patientAuth.uid ||
    trim(body.userId) === patientAuth.uid ||
    trim(body.patientId) === appointmentPatientId;

  if (!allowedForPatient && trim(appt.hostUserId)) {
    return NextResponse.json(
      { ok: false, error: "appointment_access_denied" },
      { status: 403 },
    );
  }

  const paymentMethod = upper(appt.paymentMethod);
  if (paymentMethod !== "CARD") {
    return NextResponse.json(
      {
        ok: false,
        error: "not_card_paid_appointment",
        message: "Only card/self-pay appointments can be submitted for member reimbursement.",
      },
      { status: 409 },
    );
  }

  const paymentStatus = upper(appt.paymentStatus);
  const paymentVerified =
    Boolean(appt.paymentRef) ||
    ["PAID", "CAPTURED", "COMPLETED", "SUCCESS", "SETTLED"].includes(paymentStatus);

  if (!paymentVerified) {
    return NextResponse.json(
      {
        ok: false,
        error: "card_payment_not_verified",
        message: "The card payment must be verified before a reimbursement claim can be submitted.",
      },
      { status: 409 },
    );
  }

  const clientId =
    trim(body.clientId || body.client_id) ||
    trim(reimbursementIntent.selectedClientId) ||
    trim(sponsor.clientId) ||
    trim(appt.clientId);

  const patientSponsorLinkId =
    trim(body.patientSponsorLinkId || body.patient_sponsor_link_id) ||
    trim(body.policyId || body.policy_id) ||
    trim(reimbursementIntent.selectedPolicyId) ||
    trim(medicalAid.policy_id || medicalAid.policyId);

  if (!clientId && !patientSponsorLinkId) {
    return NextResponse.json(
      {
        ok: false,
        error: "claim_policy_required",
        message: "Select a Medical Aid / sponsor policy before submitting reimbursement.",
      },
      { status: 400 },
    );
  }

  const requestedAmountMinor =
    Number(body.requestedAmountMinor ?? body.requested_amount_minor) ||
    Number(reimbursementIntent.patientPayableMinor) ||
    Number(appt.patientCopayMinor) ||
    Number(appt.priceCents) ||
    Number(appt.totalMinor) ||
    0;

  if (!Number.isFinite(requestedAmountMinor) || requestedAmountMinor <= 0) {
    return NextResponse.json(
      { ok: false, error: "invalid_requested_amount" },
      { status: 400 },
    );
  }

  const existing = await db.memberReimbursementClaim.findFirst({
    where: {
      orgId: patientAuth.orgId,
      appointmentId,
      patientId: appointmentPatientId,
      status: { in: ACTIVE_CLAIM_STATUSES },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    return NextResponse.json(
      {
        ok: true,
        duplicate: true,
        claim: normalizeClaim(existing),
      },
      { status: 200 },
    );
  }

  const claim = await db.memberReimbursementClaim.create({
    data: {
      orgId: patientAuth.orgId,
      clientId: clientId || null,
      clientMemberId:
        trim(body.clientMemberId || body.client_member_id) ||
        trim(sponsor.clientMemberId) ||
        null,
      patientSponsorLinkId: patientSponsorLinkId || null,
      patientId: appointmentPatientId,
      userId: patientAuth.uid,
      appointmentId,
      encounterId: trim(appt.encounterId || body.encounterId || body.encounter_id) || null,
      paymentRef: trim(appt.paymentRef || body.paymentRef || body.payment_ref) || null,
      claimNumber: makeClaimNumber(),
      claimType: "MEMBER_REIMBURSEMENT",
      payeeType: "PATIENT",
      originalPaymentMethod: "CARD",
      providerAlreadyPaid: true,
      status: "SUBMITTED",
      reason:
        trim(body.reason) ||
        trim(reimbursementIntent.reason) ||
        "SELF_PAY_CARD",
      currency:
        trim(body.currency) ||
        trim(reimbursementIntent.currency) ||
        trim(appt.currency) ||
        "ZAR",
      requestedAmountMinor: Math.round(requestedAmountMinor),
      approvedAmountMinor: 0,
      paidAmountMinor: 0,
      memberResponsibilityMinor: 0,
      policySnapshot: {
        clientId: clientId || null,
        patientSponsorLinkId: patientSponsorLinkId || null,
        medicalAid,
        sponsor,
      },
      appointmentSnapshot: {
        appointmentId: appt.id,
        encounterId: appt.encounterId,
        clinicianId: appt.clinicianId,
        startsAt: appt.startsAt,
        endsAt: appt.endsAt,
        paymentMethod: appt.paymentMethod,
        paymentStatus: appt.paymentStatus,
        paymentProvider: appt.paymentProvider,
        paymentRef: appt.paymentRef,
        priceCents: appt.priceCents,
        currency: appt.currency,
        priceLock,
      },
      evidenceJson: {
        source: "patient-submitted",
        documents: Array.isArray(body.documents) ? body.documents : [],
        notes: trim(body.notes) || null,
      },
      metadata: {
        source: "patient-app",
        reimbursementIntent,
        submittedVia: "member-reimbursement-claims",
      },
    },
  });

  await writeAudit({
    orgId: patientAuth.orgId,
    clientId: clientId || null,
    actorUserId: patientAuth.uid,
    actorRole: "patient",
    action: "member_reimbursement_claim.submitted",
    entityId: claim.id,
    status: "SUCCESS",
    metadata: {
      appointmentId,
      claimNumber: claim.claimNumber,
      requestedAmountMinor: claim.requestedAmountMinor,
    },
  });

  return NextResponse.json({
    ok: true,
    claim: normalizeClaim(claim),
  });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({} as any));
  const orgId = trim(body.orgId || body.org_id || req.headers.get("x-ambulant-org-id")) || "org-default";

  const auth = requireApiClientRole(
    req,
    [...PAYEROPS_ALLOWED_ROLES],
    { orgId },
  );

  if (auth.ok === false) return auth.response;

  const id = trim(body.id || body.claimId || body.claim_id);
  if (!id) {
    return NextResponse.json(
      { ok: false, error: "claim_id_required" },
      { status: 400 },
    );
  }

  const db: any = prisma;

  const existing = await db.memberReimbursementClaim.findFirst({
    where: { id, orgId },
  });

  if (!existing) {
    return NextResponse.json(
      { ok: false, error: "claim_not_found" },
      { status: 404 },
    );
  }

  const status = upper(body.status || existing.status);
  const allowedStatuses = [
    "SUBMITTED",
    "UNDER_REVIEW",
    "REQUEST_INFO",
    "APPROVED",
    "PARTIALLY_APPROVED",
    "DENIED",
    "READY_FOR_PAYMENT",
    "PAID",
    "CANCELLED",
  ];

  if (!allowedStatuses.includes(status)) {
    return NextResponse.json(
      { ok: false, error: "invalid_status" },
      { status: 400 },
    );
  }

  const approvedAmountMinor =
    body.approvedAmountMinor === undefined && body.approved_amount_minor === undefined
      ? existing.approvedAmountMinor
      : Math.max(0, Math.round(Number(body.approvedAmountMinor ?? body.approved_amount_minor ?? 0)));

  const paidAmountMinor =
    body.paidAmountMinor === undefined && body.paid_amount_minor === undefined
      ? existing.paidAmountMinor
      : Math.max(0, Math.round(Number(body.paidAmountMinor ?? body.paid_amount_minor ?? 0)));

  const now = new Date();

  const updated = await db.memberReimbursementClaim.update({
    where: { id },
    data: {
      status,
      approvedAmountMinor,
      paidAmountMinor,
      memberResponsibilityMinor:
        status === "DENIED"
          ? existing.requestedAmountMinor
          : Math.max(0, existing.requestedAmountMinor - approvedAmountMinor),
      reviewedAt:
        ["UNDER_REVIEW", "REQUEST_INFO", "APPROVED", "PARTIALLY_APPROVED", "DENIED", "READY_FOR_PAYMENT", "PAID"].includes(status)
          ? now
          : existing.reviewedAt,
      reviewedByUserId:
        ["UNDER_REVIEW", "REQUEST_INFO", "APPROVED", "PARTIALLY_APPROVED", "DENIED", "READY_FOR_PAYMENT", "PAID"].includes(status)
          ? auth.actor.uid
          : existing.reviewedByUserId,
      paidAt: status === "PAID" ? now : existing.paidAt,
      paidByUserId: status === "PAID" ? auth.actor.uid : existing.paidByUserId,
      remittanceRef: trim(body.remittanceRef || body.remittance_ref) || existing.remittanceRef,
      reviewPayload: {
        ...(asRecord(existing.reviewPayload)),
        lastDecision: {
          status,
          reason: trim(body.reason || body.decisionReason || body.decision_reason) || null,
          approvedAmountMinor,
          paidAmountMinor,
          actorUserId: auth.actor.uid,
          actorRole: auth.actor.role,
          decidedAt: now.toISOString(),
        },
      },
    },
  });

  await writeAudit({
    orgId,
    clientId: updated.clientId || null,
    actorUserId: auth.actor.uid,
    actorRole: auth.actor.role,
    action: "member_reimbursement_claim.updated",
    entityId: updated.id,
    status: "SUCCESS",
    metadata: {
      claimNumber: updated.claimNumber,
      beforeStatus: existing.status,
      afterStatus: updated.status,
      approvedAmountMinor,
      paidAmountMinor,
    },
  });

  return NextResponse.json({
    ok: true,
    claim: normalizeClaim(updated),
  });
}