import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Outcome =
  | "not_applicable"
  | "action_required"
  | "draft_created"
  | "ready_for_submission"
  | "submitted";

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function upper(value: unknown) {
  return clean(value).toUpperCase();
}

function asNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : fallback;
}

function safeJson(value: unknown): any {
  return JSON.parse(JSON.stringify(value ?? null));
}

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function isMedicalAidText(value: unknown) {
  const s = clean(value).toLowerCase().replaceAll("_", "-").replace(/\s+/g, "-");
  return (
    s === "medical-aid" ||
    s === "medicalaid" ||
    s === "med-aid" ||
    s.includes("medical-aid") ||
    s.includes("medicalaid") ||
    s.includes("scheme")
  );
}

function firstNonEmpty(...values: unknown[]) {
  for (const value of values) {
    const s = clean(value);
    if (s) return s;
  }
  return "";
}

function claimNumber() {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `AMB-MA-${stamp}-${rand}`;
}

function serviceTypeFromMode(mode: unknown) {
  const s = clean(mode).toLowerCase();
  if (s.includes("follow")) return "CONSULT_FOLLOWUP";
  if (s.includes("procedure")) return "CONSULT_PROCEDURE";
  return "CONSULT_STANDARD";
}

function outcomeFromMissing(missingFields: string[]): Outcome {
  return missingFields.length ? "action_required" : "ready_for_submission";
}

function missingPush(list: string[], key: string, ok: boolean) {
  if (!ok && !list.includes(key)) list.push(key);
}

function readMeta(value: unknown): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, any>;
}

async function readBody(req: NextRequest) {
  return (await req.json().catch(() => ({}))) as Record<string, any>;
}

async function findEncounter(encounterId: string) {
  return prisma.encounter.findUnique({
    where: { id: encounterId },
    include: {
      appointments: { orderBy: [{ createdAt: "desc" }], take: 1 },
      payments: { orderBy: [{ createdAt: "desc" }] },
      diagnoses: { orderBy: [{ createdAt: "desc" }] },
      erxOrders: { orderBy: [{ createdAt: "desc" }], take: 20 },
      labOrders: { orderBy: [{ createdAt: "desc" }], take: 20 },
    },
  });
}

async function findPatient(patientId: string) {
  if (!patientId) return null;

  return prisma.patientProfile.findFirst({
    where: {
      OR: [{ id: patientId }, { userId: patientId }],
    },
  });
}

async function findClinician(clinicianId: string) {
  if (!clinicianId) return null;

  return prisma.clinicianProfile.findFirst({
    where: {
      OR: [{ id: clinicianId }, { userId: clinicianId }],
    },
  });
}

async function findPracticeForClinician(clinician: any) {
  const userId = clean(clinician?.userId);
  const email = clean(clinician?.email).toLowerCase();

  if (!userId && !email) return null;

  const member = await prisma.practiceMember.findFirst({
    where: {
      OR: [
        ...(userId ? [{ userId }] : []),
        ...(email ? [{ email }] : []),
      ],
    },
    include: { practice: true },
  });

  return member?.practice ?? null;
}

async function findMedicalAidClientMember(args: {
  patientId: string;
  userId?: string | null;
  encounterClientMemberId?: string | null;
}) {
  const directId = clean(args.encounterClientMemberId);

  if (directId) {
    const direct = await prisma.clientMember.findFirst({
      where: { id: directId },
      include: { client: true, coveragePlan: true },
    });

    if (direct?.client?.type === "MEDICAL_AID") return direct;
  }

  return prisma.clientMember.findFirst({
    where: {
      OR: [
        ...(args.patientId ? [{ patientId: args.patientId }] : []),
        ...(args.userId ? [{ userId: args.userId }] : []),
      ],
      client: {
        type: "MEDICAL_AID",
        status: "ACTIVE",
        allowsClaims: true,
      },
      memberStatus: "ACTIVE",
    },
    include: { client: true, coveragePlan: true },
    orderBy: [{ updatedAt: "desc" }],
  });
}

async function findLegacyPolicy(patientId: string) {
  if (!patientId) return null;

  return prisma.medicalAidPolicy.findFirst({
    where: { patientId },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });
}

async function findAuthorization(args: {
  orgId: string;
  clientId: string;
  clientMemberId?: string | null;
  encounterId: string;
  appointmentId?: string | null;
  serviceType: string;
}) {
  return prisma.coverageAuthorization.findFirst({
    where: {
      orgId: args.orgId,
      clientId: args.clientId,
      ...(args.clientMemberId ? { clientMemberId: args.clientMemberId } : {}),
      OR: [
        { encounterId: args.encounterId },
        ...(args.appointmentId ? [{ appointmentId: args.appointmentId }] : []),
      ],
      serviceType: args.serviceType as any,
      status: { in: ["APPROVED", "PARTIALLY_APPROVED", "CONSUMED"] as any },
    },
    orderBy: [{ requestedAt: "desc" }],
  });
}

async function getOrCreateBillableEvent(args: {
  orgId: string;
  clientId: string;
  clientMemberId?: string | null;
  authorizationId?: string | null;
  encounterId: string;
  appointmentId?: string | null;
  patientId: string;
  userId?: string | null;
  serviceType: string;
  providerId?: string | null;
  amountMinor: number;
  currency: string;
  ready: boolean;
  metadata: Record<string, unknown>;
}) {
  const existing = await prisma.billableEvent.findFirst({
    where: {
      encounterId: args.encounterId,
      serviceType: args.serviceType as any,
      providerLane: "CLINICIAN" as any,
      fundingSourceType: "MEDICAL_AID" as any,
    },
    orderBy: [{ createdAt: "desc" }],
  });

  const data = {
    orgId: args.orgId,
    clientId: args.clientId,
    clientMemberId: args.clientMemberId || null,
    authorizationId: args.authorizationId || null,
    encounterId: args.encounterId,
    appointmentId: args.appointmentId || null,
    patientId: args.patientId,
    userId: args.userId || null,
    serviceType: args.serviceType as any,
    providerLane: "CLINICIAN" as any,
    providerId: args.providerId || null,
    responsibility: "CLIENT" as any,
    status: args.ready ? ("READY" as any) : ("DRAFT" as any),
    currency: args.currency,
    grossAmountMinor: args.amountMinor,
    sponsorAmountMinor: args.amountMinor,
    patientAmountMinor: 0,
    patientResponsibilityMinor: 0,
    sponsorOutstandingMinor: args.amountMinor,
    fundingSourceType: "MEDICAL_AID" as any,
    claimReady: args.ready,
    pricingSnapshot: safeJson({
      source: "claims_auto_submit",
      amountMinor: args.amountMinor,
      currency: args.currency,
    }),
    metadata: safeJson(args.metadata),
    serviceAt: new Date(),
  };

  if (existing) {
    return prisma.billableEvent.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.billableEvent.create({ data });
}

export async function POST(req: NextRequest) {
  try {
    const body = await readBody(req);
    const encounterId = firstNonEmpty(body.encounterId, body.id);

    if (!encounterId) {
      return json(400, { ok: false, outcome: "action_required", error: "encounterId_required" });
    }

    const encounter = await findEncounter(encounterId);
    if (!encounter) {
      return json(404, { ok: false, outcome: "action_required", error: "encounter_not_found" });
    }

    const appointment = encounter.appointments?.[0] ?? null;
    const paymentMeta = readMeta(encounter.payments?.[0]?.meta);
    const appointmentMeta = readMeta(appointment?.meta);

    const requestedMedicalAid =
      isMedicalAidText(body.paymentMethod) ||
      isMedicalAidText(body.fundingSource) ||
      isMedicalAidText(appointment?.paymentMethod) ||
      isMedicalAidText(paymentMeta.paymentMethod) ||
      isMedicalAidText(paymentMeta.fundingSource) ||
      isMedicalAidText(appointmentMeta.paymentMethod) ||
      Boolean(encounter.clientMemberId) ||
      Boolean(encounter.clientId);

    const patient = await findPatient(clean(encounter.patientId));
    const patientUserId = clean(patient?.userId);
    const clientMember = await findMedicalAidClientMember({
      patientId: clean(encounter.patientId),
      userId: patientUserId,
      encounterClientMemberId: encounter.clientMemberId,
    });

    const legacyPolicy = clientMember ? null : await findLegacyPolicy(clean(encounter.patientId));

    const isMedicalAid =
      Boolean(clientMember?.client?.type === "MEDICAL_AID") ||
      Boolean(legacyPolicy) ||
      requestedMedicalAid;

    if (!isMedicalAid) {
      return json(200, {
        ok: true,
        outcome: "not_applicable",
        reason: "payer_is_not_medical_aid",
        encounterId,
      });
    }

    if (!clientMember?.client) {
      return json(200, {
        ok: true,
        outcome: "action_required",
        reason: "medical_aid_client_member_link_required",
        encounterId,
        missingFields: ["client_member", "client", "coverage_plan"],
        legacyPolicy: legacyPolicy
          ? {
              schemeName: legacyPolicy.schemeName,
              planName: legacyPolicy.planName,
              membershipNumber: legacyPolicy.membershipNumber,
              dependentCode: legacyPolicy.dependentCode,
            }
          : null,
      });
    }

    const client = clientMember.client;
    const coveragePlan = clientMember.coveragePlan;
    const orgId = firstNonEmpty(body.orgId, encounter.orgId, clientMember.orgId, client.orgId);
    const currency = firstNonEmpty(body.currency, appointment?.currency, coveragePlan?.currency, client.defaultCurrency, "ZAR");

    if (!orgId) {
      return json(200, {
        ok: true,
        outcome: "action_required",
        reason: "org_context_required",
        encounterId,
        missingFields: ["orgId"],
      });
    }

    const serviceType = serviceTypeFromMode(firstNonEmpty(body.mode, appointment?.kind));
    const visitMode = upper(firstNonEmpty(body.visitMode, encounter.visitMode, appointment?.visitMode, "TELEVISIT"));

    const clinician = await findClinician(clean(encounter.clinicianId));
    const practice = await findPracticeForClinician(clinician);
    const practiceNumber = firstNonEmpty(practice?.practiceNumber, clinician?.practiceNumber);
    const clinicianName = firstNonEmpty(clinician?.displayName, body.clinicianName, encounter.clinicianId);
    const hpcsa = firstNonEmpty(
      clinician?.regulatorRegistration,
      clinician?.boardCertificateNumber,
      body.hpcsa,
      body.hpcsaNumber,
    );

    const diagnosis = encounter.diagnoses?.[0] ?? null;
    const icd10 = firstNonEmpty(body.diagnosisCode, body.icd10, diagnosis?.icd10);
    const diagnosisText = firstNonEmpty(body.diagnosisText, diagnosis?.description);

    const summaryPayload = readMeta(encounter.summaryPayload);
    const encounterSummary = firstNonEmpty(
      body.sessionSummary,
      body.summary,
      body.synopsis,
      summaryPayload.summary,
      summaryPayload.synopsis,
      summaryPayload.clinicalSummary,
      appointmentMeta.summary,
      appointment?.reason,
    );

    const paymentsTotal = (encounter.payments || []).reduce(
      (sum: number, p: any) => sum + asNumber(p.amountCents, 0),
      0,
    );

    const amountMinor = asNumber(
      body.amountMinor ??
        body.amountCents ??
        appointment?.totalMinor ??
        appointment?.amountMinor ??
        appointment?.priceCents ??
        paymentsTotal,
      0,
    );

    const authorization = await findAuthorization({
      orgId,
      clientId: client.id,
      clientMemberId: clientMember.id,
      encounterId,
      appointmentId: appointment?.id ?? null,
      serviceType,
    });

    const existingClaim = await prisma.clientClaim.findFirst({
      where: {
        encounterId,
        claimType: "MEDICAL_AID_CLAIM" as any,
        status: { not: "CANCELLED" as any },
      },
      include: {
        lines: true,
        evidence: true,
      },
      orderBy: [{ createdAt: "desc" }],
    });

    if (existingClaim) {
      const payload = readMeta(existingClaim.submissionPayload);
      const missingFields = Array.isArray(payload?.readiness?.missingFields)
        ? payload.readiness.missingFields
        : [];
      return json(200, {
        ok: true,
        outcome: outcomeFromMissing(missingFields),
        idempotent: true,
        encounterId,
        claimId: existingClaim.id,
        claimNumber: existingClaim.claimNumber,
        missingFields,
        claim: existingClaim,
      });
    }

    const missingFields: string[] = [];

    missingPush(missingFields, "client.legalName", Boolean(client.legalName));
    missingPush(missingFields, "clientMember.memberNumber", Boolean(clientMember.memberNumber));
    missingPush(missingFields, "coveragePlan", Boolean(coveragePlan?.id));
    missingPush(missingFields, "patient.name", Boolean(patient?.name || body.patientName));
    missingPush(missingFields, "patient.identifier_or_dob", Boolean(patient?.idNumber || patient?.dob));
    missingPush(missingFields, "encounter.summary", Boolean(encounterSummary));
    missingPush(missingFields, "diagnosis.icd10", Boolean(icd10));
    missingPush(missingFields, "claim.amount", amountMinor > 0);
    missingPush(missingFields, "clinician.name", Boolean(clinicianName));
    missingPush(missingFields, "clinician.hpcsa_or_registration", Boolean(hpcsa));
    missingPush(missingFields, "practice.bhf_pcns_number", Boolean(practiceNumber));

    const ready = missingFields.length === 0;

    const clinicalEvidence = {
      encounterSummary,
      diagnosis: {
        icd10,
        text: diagnosisText,
      },
      session: {
        encounterId,
        appointmentId: appointment?.id ?? null,
        startedAt: encounter.consultationStartedAt,
        endedAt: encounter.consultationEndedAt,
        visitMode,
        reason: appointment?.reason ?? null,
      },
      orders: {
        erxCount: encounter.erxOrders?.length ?? 0,
        labCount: encounter.labOrders?.length ?? 0,
        erxOrderIds: (encounter.erxOrders || []).map((x: any) => x.id),
        labOrderIds: (encounter.labOrders || []).map((x: any) => x.id),
      },
    };

    const claimPackage = {
      version: "ambulant-sa-medical-aid-claim.v1",
      generatedAt: new Date().toISOString(),
      generatedBy: "api-gateway.claims.auto-submit",
      outcome: outcomeFromMissing(missingFields),
      readiness: {
        ready,
        missingFields,
      },
      payer: {
        clientId: client.id,
        schemeName: client.legalName,
        tradingName: client.tradingName ?? null,
        planId: coveragePlan?.id ?? null,
        planName: coveragePlan?.name ?? null,
        claimsSubmissionMode: client.claimsSubmissionMode,
      },
      member: {
        clientMemberId: clientMember.id,
        memberNumber: clientMember.memberNumber ?? null,
        dependentCode: clientMember.dependentCode ?? null,
        principalMemberNumber: clientMember.principalMemberNumber ?? null,
        principalMemberName: clientMember.principalMemberName ?? null,
        verificationState: clientMember.verificationState,
        eligibilityStatus: clientMember.eligibilityStatus ?? null,
        verifiedUntil: clientMember.verifiedUntil ?? null,
      },
      patient: {
        patientId: encounter.patientId,
        name: patient?.name ?? body.patientName ?? null,
        dob: patient?.dob ?? null,
        idNumber: patient?.idNumber ?? null,
      },
      provider: {
        billingProviderType: "CLINICIAN",
        practiceName: practice?.name ?? clinician?.practiceName ?? null,
        practiceNumber: practiceNumber || null,
        clinicianId: encounter.clinicianId,
        clinicianName,
        hpcsa,
        regulatorBody: clinician?.regulatorBody ?? null,
      },
      authorization: authorization
        ? {
            id: authorization.id,
            status: authorization.status,
            preauthReference: authorization.preauthReference,
            approvedAmountMinor: authorization.approvedAmountMinor,
            memberResponsibilityMinor: authorization.memberResponsibilityMinor,
          }
        : null,
      financials: {
        currency,
        submittedAmountMinor: amountMinor,
        memberResponsibilityMinor: authorization?.memberResponsibilityMinor ?? 0,
      },
      clinicalEvidence,
      schemeAcceptanceChecklist: {
        memberAndDependentCaptured: Boolean(clientMember.memberNumber),
        patientIdentityCaptured: Boolean(patient?.idNumber || patient?.dob),
        providerPracticeNumberCaptured: Boolean(practiceNumber),
        clinicianRegistrationCaptured: Boolean(hpcsa),
        icd10Captured: Boolean(icd10),
        sessionSummaryCaptured: Boolean(encounterSummary),
        amountCaptured: amountMinor > 0,
        authorizationLinkedIfAvailable: Boolean(authorization?.id),
        telehealthModalityCaptured: Boolean(visitMode),
      },
      audit: {
        truthfulSubmissionState:
          "No external scheme or clearinghouse submission is performed by this route.",
        source: "encounter_completion_auto_claim",
      },
    };

    const billableEvent = await getOrCreateBillableEvent({
      orgId,
      clientId: client.id,
      clientMemberId: clientMember.id,
      authorizationId: authorization?.id ?? null,
      encounterId,
      appointmentId: appointment?.id ?? null,
      patientId: encounter.patientId,
      userId: patientUserId,
      serviceType,
      providerId: encounter.clinicianId ?? null,
      amountMinor,
      currency,
      ready,
      metadata: {
        claimPackageSummary: {
          readiness: claimPackage.readiness,
          payer: claimPackage.payer,
          member: claimPackage.member,
          provider: claimPackage.provider,
        },
      },
    });

    const claim = await prisma.clientClaim.create({
      data: {
        orgId,
        clientId: client.id,
        clientMemberId: clientMember.id,
        coveragePlanId: coveragePlan?.id ?? null,
        authorizationId: authorization?.id ?? null,
        appointmentId: appointment?.id ?? null,
        encounterId,
        patientId: encounter.patientId,
        clinicianId: encounter.clinicianId ?? null,
        claimType: "MEDICAL_AID_CLAIM" as any,
        status: "DRAFT" as any,
        serviceType: serviceType as any,
        visitMode: visitMode as any,
        billingProviderType: "CLINICIAN" as any,
        billingProviderName: practice?.name ?? clinician?.practiceName ?? "Ambulant+ clinician",
        billingProviderPracticeNo: practiceNumber || null,
        renderingClinicianName: clinicianName || null,
        renderingClinicianHpcsa: hpcsa || null,
        renderingClinicianPracticeNo: practiceNumber || null,
        claimNumber: claimNumber(),
        currency,
        submittedAmountMinor: amountMinor,
        memberResponsibilityMinor: authorization?.memberResponsibilityMinor ?? 0,
        submissionPayload: safeJson(claimPackage),
        notes: ready
          ? "Auto-generated medical-aid claim package ready for submission review."
          : `Auto-generated medical-aid claim draft requires action: ${missingFields.join(", ")}`,
      },
    });

    await prisma.clientClaimLine.create({
      data: {
        claimId: claim.id,
        billableEventId: billableEvent.id,
        submittedAmountMinor: amountMinor,
        codeSystem: "SA_TARIFF",
        code: firstNonEmpty(body.tariffCode) || null,
        codeLabel: firstNonEmpty(body.tariffLabel, serviceType),
        icd10Codes: icd10 ? [icd10] : [],
        tariffCode: firstNonEmpty(body.tariffCode) || null,
        metadata: safeJson({
          serviceType,
          visitMode,
          source: "claims_auto_submit",
        }),
      },
    });

    const evidence = [
      ...(encounterSummary
        ? [{
            claimId: claim.id,
            kind: "ENCOUNTER_SUMMARY" as any,
            refType: "Encounter",
            refId: encounterId,
            metadata: safeJson({ summary: encounterSummary }),
          }]
        : []),
      ...(icd10
        ? [{
            claimId: claim.id,
            kind: "ICD10" as any,
            refType: "EncounterDiagnosis",
            refId: diagnosis?.id ?? encounterId,
            metadata: safeJson({ icd10, description: diagnosisText || null }),
          }]
        : []),
      ...((encounter.erxOrders || []).slice(0, 10).map((order: any) => ({
        claimId: claim.id,
        kind: "PRESCRIPTION" as any,
        refType: "ErxOrder",
        refId: order.id,
        metadata: safeJson({ status: order.status ?? null }),
      }))),
      ...((encounter.labOrders || []).slice(0, 10).map((order: any) => ({
        claimId: claim.id,
        kind: "LAB_ORDER" as any,
        refType: "LabOrder",
        refId: order.id,
        metadata: safeJson({ status: order.status ?? null }),
      }))),
      ...(authorization
        ? [{
            claimId: claim.id,
            kind: "PREAUTH" as any,
            refType: "CoverageAuthorization",
            refId: authorization.id,
            metadata: safeJson({ preauthReference: authorization.preauthReference ?? null }),
          }]
        : []),
    ];

    for (const item of evidence) {
      await prisma.clientClaimEvidence.create({
        data: {
          ...item,
          visibility: "CLAIMS_ONLY" as any,
        },
      });
    }

    const created = await prisma.clientClaim.findUnique({
      where: { id: claim.id },
      include: {
        client: true,
        clientMember: true,
        coveragePlan: true,
        authorization: true,
        lines: { include: { billableEvent: true } },
        evidence: true,
      },
    });

    const outcome = outcomeFromMissing(missingFields);

    return json(201, {
      ok: true,
      outcome,
      claimStatus: "DRAFT",
      encounterId,
      claimId: claim.id,
      claimNumber: claim.claimNumber,
      billableEventId: billableEvent.id,
      missingFields,
      claim: created,
      audit: {
        sourceVersion: "clinical-medical-aid-auto-claim.v1",
        generatedAt: new Date().toISOString(),
        externalSubmissionPerformed: false,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "claims_auto_submit_failed";
    console.error("[claims/auto-submit] error", error);
    return json(500, { ok: false, outcome: "action_required", error: message });
  }
}
