import { PrismaTx, dbOrTx } from "./lib/prisma";

export type PreflightInput = {
  orgId?: string;
  patientId: string;
  clinicianId?: string;
  serviceType:
    | "CONSULT_STANDARD"
    | "CONSULT_FOLLOWUP"
    | "CONSULT_PROCEDURE"
    | "PHYSICAL_VISIT"
    | "LAB_TEST"
    | "PHLEB_DRAW"
    | "LAB_LOGISTICS"
    | "PHARMACY_ITEM"
    | "PHARMACY_DISPENSING"
    | "RIDER_DELIVERY"
    | "DEVICE_PURCHASE"
    | "DEVICE_RENTAL"
    | "DEVICE_ASSIGNMENT"
    | "DEVICE_MAINTENANCE"
    | "DEVICE_SWAP";
  visitMode?: "TELEVISIT" | "IN_PERSON" | "HYBRID";
  requestedAmountMinor?: number;
  clientId?: string;
  tx?: PrismaTx;
};

export type PreflightResult = {
  ok: boolean;
  decision:
    | "COVERED"
    | "COVERED_WITH_COPAY"
    | "REQUIRES_AUTHORIZATION"
    | "NOT_COVERED"
    | "NOT_ELIGIBLE"
    | "FALLBACK_TO_SELF_PAY";
  orgId: string;
  clientId?: string;
  clientMemberId?: string;
  coveragePlanId?: string;
  sponsorAmountMinor: number;
  patientCopayMinor: number;
  uncoveredGapMinor: number;
  currency: string;
  reason: string;
  authorizationRequired: boolean;
  sponsorContractFeeMinor?: number;
  sponsorCapMinor?: number;
  ruleSnapshot?: Record<string, unknown>;
};

function firstNonNullNumber(...values: Array<number | null | undefined>): number | undefined {
  for (const v of values) {
    if (typeof v === "number") return v;
  }
  return undefined;
}

function safeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === "string") : [];
}


function upper(value: unknown, fallback = "") {
  const s = String(value ?? "").trim().toUpperCase();
  return s || fallback;
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function isActiveMemberStatus(value: unknown) {
  return ["ACTIVE", "APPROVED", "ENROLLED"].includes(upper(value));
}

function isEligibleSnapshot(snapshot: any | null) {
  if (!snapshot) {
    return {
      ok: false,
      reasonCode: "ELIGIBILITY_NOT_VERIFIED",
      reason: "No current monthly eligibility verification snapshot found.",
    };
  }

  const status = upper(snapshot.status, "PENDING");
  const eligibilityStatus = upper(snapshot.eligibilityStatus, "PENDING");
  const premiumStatus = upper(snapshot.premiumStatus, "UNKNOWN");

  if (["UNPAID", "FAILED", "ARREARS"].includes(premiumStatus)) {
    return {
      ok: false,
      reasonCode: "PREMIUM_UNPAID",
      reason: "Latest monthly eligibility snapshot shows unpaid premium or arrears.",
    };
  }

  if (["SUSPENDED", "CANCELLED", "EXPIRED", "NOT_FOUND"].includes(status)) {
    return {
      ok: false,
      reasonCode: `SNAPSHOT_${status}`,
      reason: `Latest monthly eligibility snapshot status is ${status}.`,
    };
  }

  if (!["ELIGIBLE", "ACTIVE", "PAID"].includes(eligibilityStatus)) {
    return {
      ok: false,
      reasonCode: "NOT_ELIGIBLE",
      reason: `Latest monthly eligibility status is ${eligibilityStatus}.`,
    };
  }

  return {
    ok: true,
    reasonCode: "ELIGIBLE",
    reason: "Latest monthly eligibility snapshot is active and eligible.",
  };
}

async function readLatestEligibilitySnapshot(db: any, clientMemberId: string) {
  const model = db.clientMemberEligibilitySnapshot;
  if (!model?.findFirst) return null;

  return model.findFirst({
    where: { clientMemberId },
    orderBy: [{ periodKey: "desc" }, { createdAt: "desc" }],
  });
}

function memberDateWindowOk(member: any) {
  const now = Date.now();

  const from = member.effectiveFrom ? new Date(member.effectiveFrom).getTime() : null;
  const to = member.effectiveTo ? new Date(member.effectiveTo).getTime() : null;

  return (!from || from <= now) && (!to || to >= now);
}

function notEligibleResult(args: {
  orgId: string;
  member?: any;
  plan?: any;
  requestedAmountMinor?: number;
  reason: string;
  reasonCode?: string;
  snapshot?: any | null;
}): PreflightResult {
  return {
    ok: true,
    decision: "NOT_ELIGIBLE",
    orgId: args.orgId,
    clientId: args.member?.clientId,
    clientMemberId: args.member?.id,
    coveragePlanId: args.plan?.id ?? args.member?.coveragePlanId,
    sponsorAmountMinor: 0,
    patientCopayMinor: 0,
    uncoveredGapMinor: args.requestedAmountMinor ?? 0,
    currency: args.plan?.currency ?? "ZAR",
    reason: args.reason,
    authorizationRequired: false,
    ruleSnapshot: {
      reasonCode: args.reasonCode,
      clientId: args.member?.clientId,
      clientMemberId: args.member?.id,
      coveragePlanId: args.plan?.id ?? args.member?.coveragePlanId,
      eligibilitySnapshot: args.snapshot
        ? {
            id: args.snapshot.id,
            periodKey: args.snapshot.periodKey,
            status: args.snapshot.status,
            eligibilityStatus: args.snapshot.eligibilityStatus,
            premiumStatus: args.snapshot.premiumStatus,
            reasonCode: args.snapshot.reasonCode,
            reasonText: args.snapshot.reasonText,
            verifiedAt: args.snapshot.verifiedAt,
          }
        : null,
    },
  };
}

export async function runCoveragePreflight(input: PreflightInput): Promise<PreflightResult> {
  const orgId = input.orgId ?? "org-default";
  const db = dbOrTx(input.tx);

  const candidateMembers = await db.clientMember.findMany({
    where: {
      orgId,
      patientId: input.patientId,
      ...(input.clientId ? { clientId: input.clientId } : {})
    },
    orderBy: [{ updatedAt: "desc" }]
  });

  if (candidateMembers.length === 0) {
    return {
      ok: true,
      decision: "FALLBACK_TO_SELF_PAY",
      orgId,
      sponsorAmountMinor: 0,
      patientCopayMinor: 0,
      uncoveredGapMinor: input.requestedAmountMinor ?? 0,
      currency: "ZAR",
      reason: "No client membership link found for this patient.",
      authorizationRequired: false
    };
  }

  let lastEligibilityFailure: PreflightResult | null = null;

  for (const member of candidateMembers) {
    if (!member.coveragePlanId) continue;

    const plan = await db.coveragePlan.findUnique({
      where: { id: member.coveragePlanId },
      include: {
        serviceRules: true
      }
    });

    if (!plan || plan.status !== "ACTIVE") {
      continue;
    }

    if (!isActiveMemberStatus(member.memberStatus)) {
      const denied = notEligibleResult({
        orgId,
        member,
        plan,
        requestedAmountMinor: input.requestedAmountMinor,
        reason: `Membership status is ${upper(member.memberStatus, "UNKNOWN")}.`,
        reasonCode: "POLICY_INACTIVE",
      });

      if (input.clientId) return denied;
      lastEligibilityFailure = denied;
      continue;
    }

    const memberMeta = asRecord(member.metadata);
    const verificationState = upper(
      (member as any).verificationState ?? memberMeta.verificationState ?? "VERIFIED",
      "VERIFIED",
    );

    if (!["VERIFIED", "APPROVED", "CONFIRMED"].includes(verificationState)) {
      const denied = notEligibleResult({
        orgId,
        member,
        plan,
        requestedAmountMinor: input.requestedAmountMinor,
        reason: "Membership link is not yet verified by the payer.",
        reasonCode: "PENDING_VERIFICATION",
      });

      if (input.clientId) return denied;
      lastEligibilityFailure = denied;
      continue;
    }

    if (!memberDateWindowOk(member)) {
      const denied = notEligibleResult({
        orgId,
        member,
        plan,
        requestedAmountMinor: input.requestedAmountMinor,
        reason: "Membership is outside its effective coverage date window.",
        reasonCode: "POLICY_OUT_OF_DATE",
      });

      if (input.clientId) return denied;
      lastEligibilityFailure = denied;
      continue;
    }

    if (plan.requiresEligibility) {
      const eligibilitySnapshot = await readLatestEligibilitySnapshot(db as any, member.id);
      const eligibility = isEligibleSnapshot(eligibilitySnapshot);

      if (!eligibility.ok) {
        const denied = notEligibleResult({
          orgId,
          member,
          plan,
          requestedAmountMinor: input.requestedAmountMinor,
          reason: eligibility.reason,
          reasonCode: eligibility.reasonCode,
          snapshot: eligibilitySnapshot,
        });

        if (input.clientId) return denied;
        lastEligibilityFailure = denied;
        continue;
      }
    }

    const serviceRule = plan.serviceRules.find((r) => r.serviceType === input.serviceType);
    if (!serviceRule || !serviceRule.enabled) {
      continue;
    }

    if (input.visitMode) {
      const allowedVisitModes = safeStringArray(serviceRule.allowedVisitModes);
      if (allowedVisitModes.length > 0 && !allowedVisitModes.includes(input.visitMode)) {
        return {
          ok: true,
          decision: "NOT_COVERED",
          orgId,
          clientId: member.clientId,
          clientMemberId: member.id,
          coveragePlanId: plan.id,
          sponsorAmountMinor: 0,
          patientCopayMinor: 0,
          uncoveredGapMinor: input.requestedAmountMinor ?? 0,
          currency: plan.currency,
          reason: `Visit mode ${input.visitMode} is not covered by this plan rule.`,
          authorizationRequired: false,
          ruleSnapshot: {
            allowedVisitModes,
            serviceType: serviceRule.serviceType,
            decision: serviceRule.decision
          }
        };
      }
    }

    const requestedAmountMinor = input.requestedAmountMinor ?? 0;

    let sponsorContractFeeMinor: number | undefined;
    let sponsorCapMinor: number | undefined;

    if (input.clinicianId) {
      const contract = await db.clinicianClientContract.findFirst({
        where: {
          orgId,
          clientId: member.clientId,
          clinicianUserId: input.clinicianId,
          active: true
        },
        orderBy: [{ effectiveFrom: "desc" }]
      });

      if (contract) {
        if (input.serviceType === "CONSULT_STANDARD") {
          sponsorContractFeeMinor = contract.standardFeeMinor ?? undefined;
          sponsorCapMinor = contract.sponsorCapStandardMinor ?? undefined;
        } else if (input.serviceType === "CONSULT_FOLLOWUP") {
          sponsorContractFeeMinor = contract.followupFeeMinor ?? undefined;
          sponsorCapMinor = contract.sponsorCapFollowupMinor ?? undefined;
        } else if (input.serviceType === "CONSULT_PROCEDURE") {
          sponsorContractFeeMinor = contract.procedureFeeMinor ?? undefined;
          sponsorCapMinor = contract.sponsorCapProcedureMinor ?? undefined;
        }
      }
    }

    const coveredBase = Math.min(
      firstNonNullNumber(sponsorContractFeeMinor, requestedAmountMinor) ?? requestedAmountMinor,
      firstNonNullNumber(sponsorCapMinor, sponsorContractFeeMinor, requestedAmountMinor) ?? requestedAmountMinor
    );

    const fixedCopay = serviceRule.memberCopayMinor ?? 0;
    const percentCopay = serviceRule.memberCopayPercent ? Number(serviceRule.memberCopayPercent) : 0;

    let patientCopayMinor = 0;
    let sponsorAmountMinor = 0;

    if (fixedCopay > 0) {
      patientCopayMinor = fixedCopay;
      sponsorAmountMinor = Math.max(0, coveredBase - fixedCopay);
    } else if (percentCopay > 0) {
      patientCopayMinor = Math.round(coveredBase * (percentCopay / 100));
      sponsorAmountMinor = Math.max(0, coveredBase - patientCopayMinor);
    } else {
      sponsorAmountMinor = coveredBase;
      patientCopayMinor = 0;
    }

    const uncoveredGapMinor = Math.max(0, requestedAmountMinor - coveredBase);
    patientCopayMinor += uncoveredGapMinor;

        const ruleDecision = String(serviceRule.decision || "").toUpperCase();

    const ruleRequiresAuthorization =
      serviceRule.preauthRequired === true ||
      ruleDecision === "REQUIRES_AUTHORIZATION";

    const ruleSnapshot = {
      clientId: member.clientId,
      clientMemberId: member.id,
      coveragePlanId: plan.id,
      serviceType: input.serviceType,
      decision: serviceRule.decision,
      preauthRequired: serviceRule.preauthRequired,
      authorizationRequired: ruleRequiresAuthorization,
      sponsorContractFeeMinor,
      sponsorCapMinor,
      fixedCopay,
      percentCopay,
      requestedAmountMinor,
      coveredBase,
      uncoveredGapMinor
    };

    if (ruleRequiresAuthorization) {
      return {
        ok: true,
        decision: "REQUIRES_AUTHORIZATION",
        orgId,
        clientId: member.clientId,
        clientMemberId: member.id,
        coveragePlanId: plan.id,
        sponsorAmountMinor,
        patientCopayMinor,
        uncoveredGapMinor,
        currency: plan.currency,
        reason: "Coverage rule requires authorization before service can proceed.",
        authorizationRequired: true,
        sponsorContractFeeMinor,
        sponsorCapMinor,
        ruleSnapshot
      };
    }

    if (serviceRule.decision === "NOT_ELIGIBLE") {
      return {
        ok: true,
        decision: "NOT_ELIGIBLE",
        orgId,
        clientId: member.clientId,
        clientMemberId: member.id,
        coveragePlanId: plan.id,
        sponsorAmountMinor: 0,
        patientCopayMinor: 0,
        uncoveredGapMinor: requestedAmountMinor,
        currency: plan.currency,
        reason: "Member is not eligible for this service under the selected plan.",
        authorizationRequired: false,
        sponsorContractFeeMinor,
        sponsorCapMinor,
        ruleSnapshot
      };
    }

    if (serviceRule.decision === "NOT_COVERED") {
      return {
        ok: true,
        decision: "NOT_COVERED",
        orgId,
        clientId: member.clientId,
        clientMemberId: member.id,
        coveragePlanId: plan.id,
        sponsorAmountMinor: 0,
        patientCopayMinor: 0,
        uncoveredGapMinor: requestedAmountMinor,
        currency: plan.currency,
        reason: "Service is excluded from this client coverage plan.",
        authorizationRequired: false,
        sponsorContractFeeMinor,
        sponsorCapMinor,
        ruleSnapshot
      };
    }

    if (patientCopayMinor > 0) {
      return {
        ok: true,
        decision: "COVERED_WITH_COPAY",
        orgId,
        clientId: member.clientId,
        clientMemberId: member.id,
        coveragePlanId: plan.id,
        sponsorAmountMinor,
        patientCopayMinor,
        uncoveredGapMinor,
        currency: plan.currency,
        reason: "Service is covered with a patient co-pay and/or uncovered gap.",
        authorizationRequired: false,
        sponsorContractFeeMinor,
        sponsorCapMinor,
        ruleSnapshot
      };
    }

    return {
      ok: true,
      decision: "COVERED",
      orgId,
      clientId: member.clientId,
      clientMemberId: member.id,
      coveragePlanId: plan.id,
      sponsorAmountMinor,
      patientCopayMinor: 0,
      uncoveredGapMinor,
      currency: plan.currency,
      reason: "Service is fully covered by the selected client plan.",
      authorizationRequired: false,
      sponsorContractFeeMinor,
      sponsorCapMinor,
      ruleSnapshot
    };
  }

  if (lastEligibilityFailure) return lastEligibilityFailure;

  return {
    ok: true,
    decision: "FALLBACK_TO_SELF_PAY",
    orgId,
    sponsorAmountMinor: 0,
    patientCopayMinor: 0,
    uncoveredGapMinor: input.requestedAmountMinor ?? 0,
    currency: "ZAR",
    reason: "No active, verified, eligible coverage rule matched this request. Self-pay fallback is required.",
    authorizationRequired: false
  };
}