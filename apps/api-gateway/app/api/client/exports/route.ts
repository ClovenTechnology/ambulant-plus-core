import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { requireApiClientRole } from "@/src/lib/client-rbac";
import { writeClientAuditLog } from "@/src/lib/audit-log";

const prisma = new PrismaClient();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCHEME_APPLICATIONS_STORE = path.resolve(
  process.cwd(),
  "../../scheme-applications.json"
);

type DatasetKey =
  | "all"
  | "members"
  | "eligibility"
  | "authorizations"
  | "claims"
  | "remittance"
  | "health-context"
  | "scheme-applications"
  | "member-reimbursements";

function asObj(value: unknown): Record<string, any> {
  return value && typeof value === "object" ? (value as Record<string, any>) : {};
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function minor(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function iso(value: unknown) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

function hashPayload(value: unknown) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(value ?? null))
    .digest("hex");
}

async function readSchemeApplications() {
  try {
    const text = await fs.readFile(SCHEME_APPLICATIONS_STORE, "utf8");
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function safeFindMany(modelName: string, args: any) {
  const model = (prisma as any)[modelName];
  if (!model?.findMany) return [];
  try {
    return await model.findMany(args);
  } catch {
    return [];
  }
}

function flattenRow(row: Record<string, any>) {
  const out: Record<string, string | number | boolean | null> = {};

  for (const [key, value] of Object.entries(row)) {
    if (
      value === null ||
      value === undefined ||
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      out[key] = value ?? "";
    } else if (value instanceof Date) {
      out[key] = value.toISOString();
    } else {
      out[key] = JSON.stringify(value);
    }
  }

  return out;
}

function csvEscape(value: unknown) {
  const s = String(value ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: Array<Record<string, any>>) {
  const flat = rows.map(flattenRow);
  const headers = Array.from(
    flat.reduce((set, row) => {
      Object.keys(row).forEach((k) => set.add(k));
      return set;
    }, new Set<string>())
  );

  if (headers.length === 0) return "";

  return [
    headers.map(csvEscape).join(","),
    ...flat.map((row) => headers.map((h) => csvEscape(row[h])).join(",")),
  ].join("\n");
}

function datasetName(value: string | null): DatasetKey {
  const raw = String(value || "all").trim().toLowerCase();

  if (
    [
      "all",
      "members",
      "eligibility",
      "authorizations",
      "claims",
      "remittance",
      "health-context",
      "scheme-applications",
      "member-reimbursements",
    ].includes(raw)
  ) {
    return raw as DatasetKey;
  }

  return "all";
}

function buildMemberRows(members: any[]) {
  return members.map((m) => {
    const metadata = asObj(m.metadata);
    const coveragePlan = asObj(m.coveragePlan);
    const clientProgram = asObj(m.clientProgram);

    return {
      exportType: "members",
      memberId: m.id,
      clientId: m.clientId,
      patientId: m.patientId,
      userId: m.userId,
      memberNumber: m.memberNumber,
      membershipNumber: metadata.membershipNumber || m.memberNumber,
      schemeCode: metadata.schemeCode || metadata.medicalAid?.schemeCode || "",
      schemeName: metadata.schemeName || metadata.medicalAidName || "",
      policyNumber: metadata.policyNumber || metadata.medicalAid?.policyNumber || "",
      optionCode: metadata.optionCode || metadata.medicalAid?.optionCode || "",
      benefitOption:
        metadata.benefitOption || coveragePlan.name || metadata.medicalAid?.benefitOption || "",
      administratorCode:
        metadata.administratorCode || metadata.medicalAid?.administratorCode || "",
      principalMemberIdNumberHash:
        metadata.principalMemberIdNumberHash ||
        metadata.medicalAid?.principalMemberIdNumberHash ||
        "",
      dependantSequence:
        metadata.dependantSequence || metadata.dependentSequence || m.dependentCode || "",
      dependentCode: m.dependentCode,
      principalMemberNumber: m.principalMemberNumber,
      employeeNumber: m.employeeNumber,
      memberKind: m.memberKind,
      memberStatus: m.memberStatus,
      coveragePlanId: m.coveragePlanId,
      coveragePlanName: coveragePlan.name || "",
      clientProgramId: m.clientProgramId,
      clientProgramName: clientProgram.name || "",
      effectiveFrom: iso(m.effectiveFrom),
      effectiveTo: iso(m.effectiveTo),
      joinedAt: iso(m.joinedAt),
      metadataHash: hashPayload(metadata),
    };
  });
}

function buildEligibilityRows(members: any[]) {
  return members.map((m) => {
    const metadata = asObj(m.metadata);
    const coveragePlan = asObj(m.coveragePlan);

    return {
      exportType: "eligibility",
      memberId: m.id,
      clientId: m.clientId,
      patientId: m.patientId,
      memberNumber: m.memberNumber,
      membershipNumber: metadata.membershipNumber || m.memberNumber,
      dependentCode: m.dependentCode,
      memberStatus: m.memberStatus,
      coveragePlanId: m.coveragePlanId,
      coveragePlanName: coveragePlan.name || "",
      coveragePlanStatus: coveragePlan.status || "",
      effectiveFrom: iso(m.effectiveFrom),
      effectiveTo: iso(m.effectiveTo),
      eligible:
        String(m.memberStatus || "").toUpperCase() === "ACTIVE" &&
        Boolean(m.coveragePlanId),
      eligibilityReason:
        String(m.memberStatus || "").toUpperCase() === "ACTIVE"
          ? "ACTIVE_MEMBER"
          : "MEMBER_NOT_ACTIVE",
      checkedAt: new Date().toISOString(),
    };
  });
}

function buildHealthContextRows(members: any[]) {
  return members.map((m) => {
    const metadata = asObj(m.metadata);
    const health =
      asObj(metadata.healthContext) ||
      asObj(metadata.health) ||
      asObj(metadata.healthProfile);

    const consent =
      asObj(health.consent) ||
      asObj(metadata.healthConsent) ||
      asObj(metadata.dataSharing?.health);

    const reproductive = asObj(health.reproductiveHealth);
    const antenatal = asObj(health.antenatal);
    const clinicalHistory = asObj(health.clinicalHistory);
    const vitals = asObj(health.vitals);
    const wearable = asObj(health.wearable);
    const rewards = asObj(metadata.rewardProfile || metadata.rewards);

    return {
      exportType: "health-context",
      memberId: m.id,
      clientId: m.clientId,
      patientId: m.patientId,
      memberNumber: m.memberNumber,
      consentVersion:
        consent.version ||
        metadata.consentVersion ||
        "POPIA-CONSENT-PAYER-SAFE-SUMMARY-V1",
      allowVitalsAccess: Boolean(
        consent.allowVitalsAccess ||
          consent.clinicalGradeVitals ||
          metadata.allowVitalsAccess
      ),
      allowWearableAccess: Boolean(
        consent.allowWearableAccess ||
          consent.wearableWellness ||
          metadata.allowWearableAccess
      ),
      allowClinicalHistoryAccess: Boolean(
        consent.allowClinicalHistoryAccess ||
          consent.clinicalHistory ||
          metadata.allowClinicalHistoryAccess
      ),
      allowReproductiveHealthAccess: Boolean(
        consent.allowReproductiveHealthAccess ||
          consent.reproductiveHealth ||
          metadata.allowReproductiveHealthAccess
      ),
      allowAntenatalAccess: Boolean(
        consent.allowAntenatalAccess ||
          consent.antenatalAndBirthRecord ||
          metadata.allowAntenatalAccess
      ),
      allergiesCount: Array.isArray(clinicalHistory.allergies)
        ? clinicalHistory.allergies.length
        : Number(clinicalHistory.allergiesCount || 0),
      conditionsCount: Array.isArray(clinicalHistory.conditions)
        ? clinicalHistory.conditions.length
        : Number(clinicalHistory.conditionsCount || 0),
      vaccinationsCount: Array.isArray(clinicalHistory.vaccinations)
        ? clinicalHistory.vaccinations.length
        : Number(clinicalHistory.vaccinationsCount || 0),
      operationsCount: Array.isArray(clinicalHistory.operations)
        ? clinicalHistory.operations.length
        : Number(clinicalHistory.operationsCount || 0),
      latestClinicalSpotCheck:
        vitals.latestClinicalSpotCheck || vitals.latest || null,
      wearableSummary:
        wearable.summary ||
        wearable.sleepSummary ||
        wearable.activitySummary ||
        null,
      pregnancySignalAvailable: Boolean(
        reproductive.pregnancySignalAvailable || reproductive.pregnancyDetected
      ),
      antenatalVisible: Boolean(antenatal.visible || antenatal.pregnancyActive),
      birthRecordAvailable: Boolean(antenatal.birthRecordAvailable),
      rewardEligible: Boolean(rewards.rewardEligible),
      rewardPointsEstimate: Number(rewards.rewardPointsEstimate || 0),
      healthContextHash: hashPayload(health),
      exportedAt: new Date().toISOString(),
    };
  });
}

function buildAuthorizationRows(items: any[]) {
  return items.map((a) => {
    const member = asObj(a.clientMember);
    const plan = asObj(a.coveragePlan);
    const snapshot = asObj(a.ruleSnapshot);

    return {
      exportType: "authorizations",
      authorizationId: a.id,
      orgId: a.orgId,
      clientId: a.clientId,
      patientId: a.patientId,
      memberId: a.clientMemberId,
      memberNumber: member.memberNumber || a.memberNumber || "",
      dependentCode: member.dependentCode || "",
      coveragePlanId: a.coveragePlanId,
      coveragePlanName: plan.name || "",
      serviceType: a.serviceType,
      scope: a.scope,
      status: a.status,
      requestedAmountMinor: minor(a.requestedAmountMinor),
      approvedAmountMinor: minor(a.approvedAmountMinor),
      memberResponsibilityMinor: minor(a.memberResponsibilityMinor),
      sponsorResponsibilityMinor: minor(a.sponsorResponsibilityMinor),
      requestedAt: iso(a.requestedAt),
      decidedAt: iso(a.decidedAt),
      expiresAt: iso(a.expiresAt),
      preauthReference: a.preauthReference || "",
      decisionReason: a.decisionReason || "",
      ruleDecision: snapshot.decision || "",
      ruleSnapshotHash: hashPayload(snapshot),
    };
  });
}

function buildClaimRows(items: any[]) {
  return items.map((c) => {
    const member = asObj(c.clientMember);
    const plan = asObj(c.coveragePlan);
    const authorization = asObj(c.authorization);

    return {
      exportType: "claims",
      claimId: c.id,
      claimNumber: c.claimNumber,
      claimType: c.claimType,
      status: c.status,
      orgId: c.orgId,
      clientId: c.clientId,
      memberId: c.clientMemberId,
      patientId: c.patientId,
      memberNumber: member.memberNumber || "",
      dependentCode: member.dependentCode || "",
      coveragePlanId: c.coveragePlanId,
      coveragePlanName: plan.name || "",
      authorizationId: c.authorizationId || "",
      authorizationStatus: authorization.status || "",
      preauthReference: authorization.preauthReference || "",
      currency: c.currency || "ZAR",
      submittedAmountMinor: minor(c.submittedAmountMinor),
      approvedAmountMinor: minor(c.approvedAmountMinor),
      paidAmountMinor: minor(c.paidAmountMinor),
      memberResponsibilityMinor: minor(c.memberResponsibilityMinor),
      submittedAt: iso(c.submittedAt),
      decidedAt: iso(c.decidedAt),
      paidAt: iso(c.paidAt),
      lineCount: Array.isArray(c.lines) ? c.lines.length : 0,
      submissionPayloadHash: hashPayload(c.submissionPayload),
      responsePayloadHash: hashPayload(c.responsePayload),
      notes: c.notes || "",
    };
  });
}

function buildRemittanceRows(settlements: any[], settlementLines: any[]) {
  const rows: any[] = [];

  for (const s of settlements) {
    rows.push({
      exportType: "remittance",
      recordType: "settlement",
      settlementId: s.id,
      orgId: s.orgId,
      clientId: s.clientId,
      status: s.status,
      currency: s.currency || "ZAR",
      grossAmountMinor: minor(s.grossAmountMinor),
      netProviderAmountMinor: minor(s.netProviderAmountMinor),
      platformAmountMinor: minor(s.platformAmountMinor),
      staffAmountMinor: minor(s.staffAmountMinor),
      remittanceReference: s.remittanceReference || "",
      settledAt: iso(s.settledAt),
      createdAt: iso(s.createdAt),
    });
  }

  for (const line of settlementLines) {
    rows.push({
      exportType: "remittance",
      recordType: "settlement-line",
      settlementId: line.settlementId,
      settlementLineId: line.id,
      providerLane: line.providerLane,
      providerId: line.providerId,
      billableEventId: line.billableEventId,
      claimId: line.clientClaimId || line.claimId || "",
      grossAmountMinor: minor(line.grossAmountMinor),
      netAmountMinor: minor(line.netAmountMinor),
      platformAmountMinor: minor(line.platformAmountMinor),
      staffAmountMinor: minor(line.staffAmountMinor),
      status: line.status,
      createdAt: iso(line.createdAt),
    });
  }

  return rows;
}

function buildMemberReimbursementRows(items: any[]) {
  return items.map((c) => {
    const policy = asObj(c.policySnapshot);
    const medicalAid = asObj(policy.medicalAid);
    const sponsor = asObj(policy.sponsor);
    const appointment = asObj(c.appointmentSnapshot);
    const evidence = asObj(c.evidenceJson);
    const review = asObj(c.reviewPayload);
    const lastDecision = asObj(review.lastDecision);

    return {
      exportType: "member-reimbursements",
      reimbursementClaimId: c.id,
      claimNumber: c.claimNumber,
      claimType: c.claimType || "MEMBER_REIMBURSEMENT",
      payeeType: c.payeeType || "PATIENT",

      orgId: c.orgId,
      clientId: c.clientId,
      clientMemberId: c.clientMemberId,
      patientSponsorLinkId: c.patientSponsorLinkId,
      patientId: c.patientId,
      userId: c.userId,

      appointmentId: c.appointmentId,
      encounterId: c.encounterId,
      clinicianId: appointment.clinicianId || "",
      originalPaymentMethod: c.originalPaymentMethod || appointment.paymentMethod || "CARD",
      providerAlreadyPaid: Boolean(c.providerAlreadyPaid),

      paymentRef: c.paymentRef || appointment.paymentRef || "",
      paymentProvider: appointment.paymentProvider || "",
      paymentStatus: appointment.paymentStatus || "",

      sponsorName:
        sponsor.name ||
        sponsor.sponsorName ||
        medicalAid.payerName ||
        medicalAid.schemeName ||
        "",
      planName:
        sponsor.planName ||
        medicalAid.planName ||
        medicalAid.benefitOption ||
        "",
      membershipNumber:
        medicalAid.membershipNumber ||
        medicalAid.memberNumber ||
        "",
      dependentCode:
        medicalAid.dependentCode ||
        medicalAid.dependantCode ||
        "",

      status: c.status,
      reason: c.reason || lastDecision.reason || "",
      currency: c.currency || "ZAR",

      requestedAmountMinor: minor(c.requestedAmountMinor),
      approvedAmountMinor: minor(c.approvedAmountMinor),
      paidAmountMinor: minor(c.paidAmountMinor),
      memberResponsibilityMinor: minor(c.memberResponsibilityMinor),

      submittedAt: iso(c.submittedAt),
      reviewedAt: iso(c.reviewedAt),
      reviewedByUserId: c.reviewedByUserId || "",
      paidAt: iso(c.paidAt),
      paidByUserId: c.paidByUserId || "",
      remittanceRef: c.remittanceRef || "",

      evidenceHash: hashPayload(evidence),
      policySnapshotHash: hashPayload(policy),
      appointmentSnapshotHash: hashPayload(appointment),
      reviewPayloadHash: hashPayload(review),

      createdAt: iso(c.createdAt),
      updatedAt: iso(c.updatedAt),
    };
  });
}

function buildApplicationRows(applications: any[], clientId: string | undefined) {
  return applications
    .filter((x) => !clientId || x.sponsorId === clientId || x.clientId === clientId)
    .map((x) => ({
      exportType: "scheme-applications",
      applicationId: x.id,
      reference: x.reference,
      status: x.status,
      patientId: x.patientId,
      sponsorType: x.sponsorType,
      sponsorId: x.sponsorId,
      sponsorName: x.sponsorName,
      planId: x.planId,
      planName: x.planName,
      applicantName: x.applicant?.fullName || "",
      applicantEmail: x.applicant?.email || "",
      applicantPhone: x.applicant?.phone || "",
      idNumberLast4: x.applicant?.idNumberLast4 || "",
      consentVersion: x.consent?.version || "",
      consentAccepted: Boolean(x.consent?.accepted),
      csvReady: Boolean(x.exportPosture?.csvReady),
      apiReady: Boolean(x.exportPosture?.apiReady),
      portalReady: Boolean(x.exportPosture?.portalReady),
      switchReady: Boolean(x.exportPosture?.switchReady),
      privateApiReady: Boolean(x.exportPosture?.privateApiReady),
      createdAt: x.createdAt,
      updatedAt: x.updatedAt,
      payloadHash: hashPayload(x),
    }));
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const requestedOrgId = searchParams.get("orgId") || "org-default";

    const auth = requireApiClientRole(
      req,
      ["ORG_OWNER", "ORG_ADMIN", "EXPORT_MANAGER"],
      { orgId: requestedOrgId }
    );

    if (auth.ok === false) {
      await writeClientAuditLog(req, null, {
        action: "client_exports.read",
        status: "blocked",
        orgId: requestedOrgId,
        entityType: "ClientExportBundle",
        description: "Client export blocked by RBAC.",
        metadata: {
          dataset: searchParams.get("dataset") || "all",
          format: searchParams.get("format") || "json",
        },
      });

      return auth.response;
    }

    const actor = auth.actor;

    const orgId = requestedOrgId;
    const clientId = searchParams.get("clientId") || undefined;
    const dataset = datasetName(searchParams.get("dataset"));
    const format = String(searchParams.get("format") || "json").toLowerCase();

    const whereClient = {
      orgId,
      ...(clientId ? { clientId } : {}),
    };

    const [
      members,
      authorizations,
      claims,
      settlements,
      settlementLines,
      memberReimbursements,
      schemeApplications,
    ] = await Promise.all([
        safeFindMany("clientMember", {
          where: whereClient,
          include: {
            coveragePlan: true,
            clientProgram: true,
          },
          orderBy: [{ updatedAt: "desc" }],
          take: 1000,
        }),
        safeFindMany("coverageAuthorization", {
          where: whereClient,
          include: {
            clientMember: true,
            coveragePlan: true,
          },
          orderBy: [{ requestedAt: "desc" }],
          take: 1000,
        }),
        safeFindMany("clientClaim", {
          where: whereClient,
          include: {
            clientMember: true,
            coveragePlan: true,
            authorization: true,
            lines: true,
          },
          orderBy: [{ createdAt: "desc" }],
          take: 1000,
        }),
        safeFindMany("settlement", {
          where: whereClient,
          orderBy: [{ createdAt: "desc" }],
          take: 1000,
        }),
        safeFindMany("settlementLine", {
          where: {
            settlement: whereClient,
          },
          orderBy: [{ createdAt: "desc" }],
          take: 2000,
        }),
        safeFindMany("memberReimbursementClaim", {
          where: whereClient,
          orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
          take: 1000,
        }),
        readSchemeApplications(),
      ]);

    const datasets = {
      members: buildMemberRows(members),
      eligibility: buildEligibilityRows(members),
      authorizations: buildAuthorizationRows(authorizations),
      claims: buildClaimRows(claims),
      remittance: buildRemittanceRows(settlements, settlementLines),
      "health-context": buildHealthContextRows(members),
      "scheme-applications": buildApplicationRows(schemeApplications, clientId),
      "member-reimbursements": buildMemberReimbursementRows(memberReimbursements),
    };

    const summary = Object.fromEntries(
      Object.entries(datasets).map(([key, value]) => [key, value.length])
    );

    const selectedRows =
      dataset === "all"
        ? Object.values(datasets).flat()
        : datasets[dataset as keyof typeof datasets] || [];

    const audit = {
      sourceVersion: "client-export-bundle.v1",
      generatedAt: new Date().toISOString(),
      orgId,
      clientId: clientId || null,
      dataset,
      format,
      rowCount: selectedRows.length,
      bundleHash: hashPayload({
        orgId,
        clientId,
        dataset,
        summary,
        rows: selectedRows,
      }),
    };

    if (format === "csv") {
      const csv = toCsv(selectedRows);
      const fileName = `ambulant-${dataset}-${clientId || orgId}.csv`;

      await writeClientAuditLog(req, actor, {
        action: "client_exports.download_csv",
        status: "success",
        orgId,
        clientId: clientId || null,
        entityType: "ClientExportBundle",
        entityId: audit.bundleHash,
        description: "Client export CSV downloaded.",
        metadata: {
          dataset,
          format,
          rowCount: selectedRows.length,
          fileName,
          bundleHash: audit.bundleHash,
        },
      });

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "cache-control": "no-store",
          "content-disposition": `attachment; filename="${fileName}"`,
          "x-ambulant-export-hash": audit.bundleHash,
        },
      });
    }

    await writeClientAuditLog(req, actor, {
      action: "client_exports.read_json",
      status: "success",
      orgId,
      clientId: clientId || null,
      entityType: "ClientExportBundle",
      entityId: audit.bundleHash,
      description: "Client export JSON viewed.",
      metadata: {
        dataset,
        format,
        rowCount: selectedRows.length,
        summary,
        bundleHash: audit.bundleHash,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        summary,
        datasets,
        audit,
        adapterPosture: {
          channels: ["CSV", "CANONICAL_API", "PORTAL_PACK", "SWITCH", "PRIVATE_API"],
          currentReadiness: {
            csv: true,
            canonicalApi: true,
            portalPack: true,
            switch: false,
            privateApi: false,
          },
          note:
            "Switch/private API production use requires each scheme or administrator private onboarding pack.",
        },
      },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to build client export.";

    await writeClientAuditLog(req, null, {
      action: "client_exports.read",
      status: "failed",
      entityType: "ClientExportBundle",
      description: "Client export failed.",
      metadata: { error: message },
    });

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}