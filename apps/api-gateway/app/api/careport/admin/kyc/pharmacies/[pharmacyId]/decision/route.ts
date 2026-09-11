// FILE: apps/api-gateway/app/api/careport/admin/kyc/pharmacies/[pharmacyId]/decision/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/src/lib/db";
import { readIdentity } from "@/src/lib/identity";
import { orgIdFromHeaders, requireRole } from "@/src/lib/careport";
import {
  mergeCarePortPharmacyComplianceProfile,
  normalizeCarePortPharmacyCompliance,
  summarizeCarePortPharmacyCompliance,
  syncCarePortPharmacyComplianceCredentials,
} from "@/src/lib/careport-pharmacy-compliance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

export async function POST(req: NextRequest, { params }: { params: { pharmacyId: string } }) {
  const who = readIdentity(req.headers);
  requireRole(who, ["admin"]);

  const pharmacyId = String(params.pharmacyId || "").trim();
  if (!pharmacyId) {
    return NextResponse.json({ ok: false, error: "pharmacyId_required" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const decision = String(body?.decision || "").toLowerCase();
  const reason = String(body?.reason || "").trim();

  const allowed = ["approve", "limited", "needs_more_info", "reject"];
  if (!allowed.includes(decision)) {
    return NextResponse.json(
      { ok: false, error: "decision_must_be_approve_limited_needs_more_info_or_reject" },
      { status: 400 },
    );
  }

  if (decision !== "approve" && !reason) {
    return NextResponse.json(
      { ok: false, error: "reason_required_for_non_approval_decision" },
      { status: 400 },
    );
  }

  const pharmacy = await (prisma as any).pharmacyPartner.findUnique({
    where: { id: pharmacyId },
  });

  if (!pharmacy) {
    return NextResponse.json({ ok: false, error: "pharmacy_not_found" }, { status: 404 });
  }

  const orgId = orgIdFromHeaders(req.headers);
  const existingProfile = normalizeCarePortPharmacyCompliance(pharmacy);
  const complianceProfile =
    body?.complianceProfile && typeof body.complianceProfile === "object"
      ? mergeCarePortPharmacyComplianceProfile(existingProfile, body.complianceProfile)
      : existingProfile;

  const complianceSummary = summarizeCarePortPharmacyCompliance(complianceProfile);

  if (decision === "approve" && !complianceSummary.readyForRegulatedFulfilment) {
    return NextResponse.json(
      {
        ok: false,
        error: "regulated_fulfilment_compliance_incomplete",
        message:
          "The pharmacy can remain in workspace/limited review, but regulated CarePort fulfilment cannot be approved until the required pharmacy-premises and responsible-pharmacist evidence is complete.",
        missing: complianceSummary.missingForRegulatedFulfilment,
        complianceProfile,
        complianceSummary,
        recommendedDecision: "needs_more_info",
      },
      { status: 409 },
    );
  }

  const existingPayload = asRecord(pharmacy.kycPayload);
  const kycPayload = {
    ...existingPayload,
    complianceProfile: {
      ...complianceProfile,
      review: {
        ...complianceProfile.review,
        notes: reason || complianceProfile.review.notes || null,
        updatedAt: new Date().toISOString(),
      },
    },
  };

  const next =
    decision === "approve"
      ? {
          kycStatus: "APPROVED",
          kycVerifiedAt: new Date(),
          kycRejectedReason: null,
          active: true,
          // Medical-scheme claiming is a narrower capability than general
          // CarePort fulfilment. Missing/expired PCNS assurance must disable
          // that capability without blocking otherwise-compliant fulfilment.
          acceptsMedicalAid:
            Boolean(complianceProfile.medicalScheme.claimsEnabled) &&
            complianceSummary.capabilities.medicalSchemeClaims.ready,
          kycPayload,
        }
      : decision === "limited"
        ? {
            kycStatus: "LIMITED",
            kycVerifiedAt: null,
            kycRejectedReason: reason,
            active: false,
            kycPayload,
          }
        : decision === "needs_more_info"
          ? {
              kycStatus: "NEEDS_MORE_INFO",
              kycVerifiedAt: null,
              kycRejectedReason: reason,
              active: false,
              kycPayload,
            }
          : {
              kycStatus: "REJECTED",
              kycVerifiedAt: null,
              kycRejectedReason: reason,
              active: false,
              kycPayload,
            };

  const updated = await (prisma as any).$transaction(async (tx: any) => {
    const row = await tx.pharmacyPartner.update({
      where: { id: pharmacyId },
      data: next as any,
    });

    if (decision === "approve") {
      await syncCarePortPharmacyComplianceCredentials({
        orgId,
        pharmacy: row,
        profile: complianceProfile,
        actorUserId: who.uid || null,
        db: tx,
      });
    }

    return row;
  });

  await (prisma as any).auditEvent?.create?.({
    data: {
      kind: "careport_pharmacy_compliance_decision",
      actorId: who.uid || null,
      actorRole: who.role || "admin",
      subjectId: pharmacyId,
      meta: {
        orgId,
        decision,
        reason: reason || null,
        complianceVersion: complianceProfile.version,
        missingForRegulatedFulfilment: complianceSummary.missingForRegulatedFulfilment,
      },
    },
  }).catch(() => null);

  return NextResponse.json(
    {
      ok: true,
      decision,
      pharmacy: updated,
      complianceProfile,
      complianceSummary,
      regulatedFulfilmentEnabled: decision === "approve",
    },
    { status: 200 },
  );
}
