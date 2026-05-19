import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ORG_ID = "org-default";
const CLIENT_ID = "client-demo-medical-aid";
const PROGRAM_ID = "program-demo-medical-aid";
const PLAN_ID = "plan-demo-comprehensive-plus";

const OWNER_EMAIL = "admin@medicalaid.demo";
const OWNER_USER_ID = "user-demo-medical-aid-owner";

const now = new Date();

function daysAgo(days: number) {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  return d;
}

function daysFromNow(days: number) {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  return d;
}

function atHour(date: Date, hour: number) {
  const d = new Date(date);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

async function upsertIfModel(modelName: string, args: any) {
  const model = (prisma as any)[modelName];
  if (!model?.upsert) {
    console.log(`[skip] ${modelName} not available`);
    return null;
  }
  return model.upsert(args);
}

async function deleteManyIfModel(modelName: string, args: any) {
  const model = (prisma as any)[modelName];
  if (!model?.deleteMany) {
    console.log(`[skip] ${modelName}.deleteMany not available`);
    return null;
  }
  return model.deleteMany(args);
}

async function createManyIfModel(modelName: string, args: any) {
  const model = (prisma as any)[modelName];
  if (!model?.createMany) {
    console.log(`[skip] ${modelName}.createMany not available`);
    return null;
  }
  return model.createMany(args);
}

function periodKey(date = now) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

async function seedEligibilitySnapshots() {
  const model = (prisma as any).clientMemberEligibilitySnapshot;

  if (!model?.upsert) {
    console.log("[skip] clientMemberEligibilitySnapshot not available");
    return;
  }

  const key = periodKey(now);

  for (const m of members) {
    await model.upsert({
      where: {
        clientMemberId_periodKey_source: {
          clientMemberId: m.id,
          periodKey: key,
          source: "DEMO_SEED",
        },
      },
      update: {
        orgId: ORG_ID,
        clientId: CLIENT_ID,
        coveragePlanId: PLAN_ID,
        patientId: m.patientId,
        userId: `user-${m.patientId}`,
        status: "ACTIVE",
        eligibilityStatus: "ELIGIBLE",
        premiumStatus: "PAID",
        reasonCode: "DEMO_VERIFIED",
        reasonText: "Demo member is active, paid and eligible for the current period.",
        verifiedAt: now,
        validFrom: new Date(now.getFullYear(), now.getMonth(), 1),
        validTo: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
        rawPayload: {
          source: "seed-medical-aid-demo",
          memberNumber: m.memberNumber,
          dependentCode: m.dependentCode,
          status: "ACTIVE",
          premiumStatus: "PAID",
        },
        metadata: {
          demo: true,
          seeded: true,
          monthlyEligibility: true,
        },
      },
      create: {
        orgId: ORG_ID,
        clientId: CLIENT_ID,
        clientMemberId: m.id,
        coveragePlanId: PLAN_ID,
        patientId: m.patientId,
        userId: `user-${m.patientId}`,
        periodKey: key,
        source: "DEMO_SEED",
        status: "ACTIVE",
        eligibilityStatus: "ELIGIBLE",
        premiumStatus: "PAID",
        reasonCode: "DEMO_VERIFIED",
        reasonText: "Demo member is active, paid and eligible for the current period.",
        verifiedAt: now,
        validFrom: new Date(now.getFullYear(), now.getMonth(), 1),
        validTo: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
        rawPayload: {
          source: "seed-medical-aid-demo",
          memberNumber: m.memberNumber,
          dependentCode: m.dependentCode,
          status: "ACTIVE",
          premiumStatus: "PAID",
        },
        metadata: {
          demo: true,
          seeded: true,
          monthlyEligibility: true,
        },
      },
    });
  }
}

function patientDisplayName(patientId: string) {
  switch (patientId) {
    case "patient-demo-001":
      return "Demo Principal Member One";
    case "patient-demo-002":
      return "Demo Dependant Pregnancy Member";
    case "patient-demo-003":
      return "Demo High Risk Chronic Member";
    case "patient-demo-004":
      return "Demo Wellness Reward Member";
    default:
      return patientId;
  }
}

function patientEmail(patientId: string) {
  return `${patientId}@ambulant.demo`;
}

function medicalAidIdentifiersFor(m: any) {
  const suffix = String(m.memberNumber || m.id || "0000")
    .replace(/[^0-9]/g, "")
    .slice(-4)
    .padStart(4, "0");

  return {
    schemeCode: "ADM",
    schemeName: "Ambulant Demo Medical Aid",
    membershipNumber: m.memberNumber,
    policyNumber: `POL-ADM-${suffix}`,
    optionCode:
      m.metadata?.healthContext?.consent?.antenatal ? "COMP-MAT" : "COMP-PLUS",
    benefitOption:
      m.metadata?.healthContext?.consent?.antenatal
        ? "Comprehensive Maternity Plus"
        : "Comprehensive Plus Option",
    administratorCode: "AMB-ADMIN",
    principalMemberIdNumberHash:
      m.memberKind === "DEPENDANT"
        ? "sha256-demo-principal-redacted"
        : `sha256-demo-${suffix}-redacted`,
    dependantSequence: m.dependentCode || "00",
  };
}

function withMedicalAidIdentifiers(m: any) {
  const ids = medicalAidIdentifiersFor(m);

  return {
    ...m.metadata,
    medicalAidIdentifiers: ids,

    schemeCode: ids.schemeCode,
    schemeName: ids.schemeName,
    membershipNumber: ids.membershipNumber,
    medicalAidNumber: ids.membershipNumber,
    policyNumber: ids.policyNumber,
    optionCode: ids.optionCode,
    planOptionCode: ids.optionCode,
    benefitOption: ids.benefitOption,
    administratorCode: ids.administratorCode,
    principalMemberIdNumberHash: ids.principalMemberIdNumberHash,
    dependantSequence: ids.dependantSequence,
  };
}

async function seedPatientProfiles() {
  for (const m of members) {
    await upsertIfModel("patientProfile", {
      where: { id: m.patientId },
      update: {
        userId: `user-${m.patientId}`,
        name: patientDisplayName(m.patientId),
        contactEmail: patientEmail(m.patientId),
      },
      create: {
        id: m.patientId,
        userId: `user-${m.patientId}`,
        name: patientDisplayName(m.patientId),
        contactEmail: patientEmail(m.patientId),
      },
    });
  }
}

const members = [
  {
    id: "member-demo-001",
    patientId: "patient-demo-001",
    memberNumber: "BON-DEMO-1001",
    employeeNumber: "EMP-1001",
    dependentCode: "00",
    principalMemberNumber: "BON-DEMO-1001",
    memberKind: "PRINCIPAL",
    risk: "low",
    weightedProfile: "excellent",
    metadata: {
      medicalAidName: "Ambulant Demo Medical Aid",
      hospitalCoverName: "Comprehensive Plus Hospital Cover",
      inHospitalBenefit: true,
      onboardingSource: "CLIENT_ADMIN_CREATED",
      iomtSharing: {
        mode: "full",
        allowEvidenceImages: true,
        devices: ["Health Monitor", "NexRing"],
        metrics: ["vitals", "blood_pressure", "heart_rate", "spo2", "temperature", "sleep", "steps", "hrv"],
      },
      gymMembership: {
        active: true,
        name: "Vitality Partner Gym",
        membershipType: "Premium",
        status: "Active",
        checkInCount: 9,
        lastCheckIn: daysAgo(2).toISOString(),
        lastSessionMinutes: 48,
        sessionCalories: 420,
        sessionDistanceKm: 4.8,
        sessionAvgHr: 118,
        sessionAvgSpo2: 98,
        notes: "Consistent cardio and strength participation.",
      },
      healthContext: {
        consent: {
          vitals: true,
          wearableInsights: true,
          clinicalHistory: true,
          reproductiveHealth: false,
          antenatal: false,
        },
        vitals: {
          latestClinicalSpotCheck: {
            bp: "118/76",
            hr: 72,
            spo2: 98,
            temp: "36.6°C",
            respiratoryRate: 16,
            recordedAt: daysAgo(1).toISOString(),
            source: "Health Monitor clinical spot-check",
          },
          trendSummary: { count: 12, window: "30 days", posture: "stable" },
          abnormalFlags: [],
          sourceCoverage: { clinicalSpotChecks: 12, source: "Health Monitor" },
        },
        wearable: {
          sleepSummary: { value: "7h 28m avg", score: 84 },
          activitySummary: { steps: 9200, activeMinutes: 54 },
          rhrHrvSummary: { rhr: 61, hrv: 54 },
          rewardSignals: ["Steps goal met", "Sleep score > 80", "Medication adherence reward-ready"],
        },
        clinicalHistory: {
          allergies: [{ substance: "Penicillin", reaction: "Rash", severity: "moderate" }],
          conditions: [{ name: "Hypertension", status: "controlled", icd10: "I10" }],
          vaccinations: [{ vaccine: "Influenza", date: daysAgo(80).toISOString() }],
          operations: [],
        },
      },
      rewardProfile: {
        pointsEstimate: 124,
        walletDestination: "consultation_credits",
        tier: "Gold",
        monthlyCap: 500,
        reversalPolicy: "Reverse if evidence is later invalidated.",
        allowedUses: ["Consultation credits", "Partner redemption", "Premium offset"],
        wearableSignals: ["Steps goal met", "Sleep score > 80"],
      },
    },
  },
  {
    id: "member-demo-002",
    patientId: "patient-demo-002",
    memberNumber: "BON-DEMO-1002",
    employeeNumber: "EMP-1002",
    dependentCode: "01",
    principalMemberNumber: "BON-DEMO-1001",
    memberKind: "DEPENDANT",
    risk: "moderate",
    weightedProfile: "moderate",
    metadata: {
      medicalAidName: "Ambulant Demo Medical Aid",
      hospitalCoverName: "Comprehensive Plus Hospital Cover",
      onboardingSource: "CLIENT_ADMIN_CREATED",
      iomtSharing: {
        mode: "partial",
        allowEvidenceImages: false,
        devices: ["Health Monitor"],
        metrics: ["vitals", "blood_pressure", "heart_rate", "spo2"],
      },
      healthContext: {
        consent: {
          vitals: true,
          wearableInsights: false,
          clinicalHistory: true,
          reproductiveHealth: true,
          antenatal: true,
        },
        vitals: {
          latestClinicalSpotCheck: {
            bp: "132/84",
            hr: 88,
            spo2: 97,
            temp: "36.8°C",
            recordedAt: daysAgo(2).toISOString(),
            source: "Health Monitor clinical spot-check",
          },
          trendSummary: { count: 6, window: "30 days", posture: "watch" },
          abnormalFlags: ["BP_ELEVATED"],
          sourceCoverage: { clinicalSpotChecks: 6, source: "Health Monitor" },
        },
        clinicalHistory: {
          allergies: [],
          conditions: [{ name: "Pregnancy", status: "active", icd10: "Z34" }],
          vaccinations: [{ vaccine: "Tdap", date: daysAgo(20).toISOString() }],
          operations: [],
        },
        reproductiveHealth: {
          visible: true,
          pregnancySignalAvailable: true,
          pregnancyDetected: true,
          confidence: 0.91,
          lastUpdated: daysAgo(3).toISOString(),
        },
        antenatal: {
          visible: true,
          pregnancyActive: true,
          edd: daysFromNow(96).toISOString(),
          gestationalAge: "26 weeks",
          trimester: "2",
          riskFlags: ["FOLLOW_UP_DUE"],
          birthRecordAvailable: false,
        },
      },
      rewardProfile: {
        pointsEstimate: 42,
        walletDestination: "premium_offset",
        tier: "Silver",
        monthlyCap: 300,
        allowedUses: ["Premium offset", "Consultation credits"],
      },
    },
  },
  {
    id: "member-demo-003",
    patientId: "patient-demo-003",
    memberNumber: "BON-DEMO-1003",
    employeeNumber: "EMP-1003",
    dependentCode: "00",
    principalMemberNumber: "BON-DEMO-1003",
    memberKind: "PRINCIPAL",
    risk: "high",
    weightedProfile: "poor",
    metadata: {
      medicalAidName: "Ambulant Demo Medical Aid",
      hospitalCoverName: "Core Hospital Plan",
      onboardingSource: "API_SYNC",
      iomtSharing: {
        mode: "partial",
        allowEvidenceImages: true,
        devices: ["Health Monitor", "NexRing"],
        metrics: ["vitals", "blood_pressure", "heart_rate", "sleep", "steps"],
      },
      gymMembership: {
        active: true,
        name: "Vitality Partner Gym",
        membershipType: "Standard",
        status: "At risk",
        checkInCount: 1,
        lastCheckIn: daysAgo(19).toISOString(),
        lastSessionMinutes: 22,
        sessionCalories: 140,
        sessionDistanceKm: 1.1,
        sessionAvgHr: 104,
        sessionAvgSpo2: 96,
        notes: "Low recent wellness participation.",
      },
      healthContext: {
        consent: {
          vitals: true,
          wearableInsights: true,
          clinicalHistory: true,
          reproductiveHealth: false,
          antenatal: false,
        },
        vitals: {
          latestClinicalSpotCheck: {
            bp: "146/92",
            hr: 96,
            spo2: 95,
            temp: "37.0°C",
            recordedAt: daysAgo(1).toISOString(),
            source: "Health Monitor clinical spot-check",
          },
          trendSummary: { count: 10, window: "30 days", posture: "deteriorating" },
          abnormalFlags: ["BP_HIGH", "RESTING_HR_ELEVATED"],
          sourceCoverage: { clinicalSpotChecks: 10, source: "Health Monitor" },
        },
        wearable: {
          sleepSummary: { value: "5h 42m avg", score: 58 },
          activitySummary: { steps: 3100, activeMinutes: 12 },
          rhrHrvSummary: { rhr: 82, hrv: 24 },
          rewardSignals: [],
        },
        clinicalHistory: {
          allergies: [{ substance: "Ibuprofen", reaction: "Gastric irritation", severity: "mild" }],
          conditions: [
            { name: "Type 2 diabetes mellitus", status: "active", icd10: "E11" },
            { name: "Hypertension", status: "uncontrolled", icd10: "I10" },
          ],
          vaccinations: [],
          operations: [{ title: "Appendectomy", date: "2019-08-14" }],
        },
      },
      rewardProfile: {
        pointsEstimate: 0,
        walletDestination: "consultation_credits",
        tier: "Standard",
        monthlyCap: 200,
        reversalPolicy: "No reward until verified adherence stabilizes.",
        allowedUses: ["Consultation credits"],
        signals: [],
      },
    },
  },
  {
    id: "member-demo-004",
    patientId: "patient-demo-004",
    memberNumber: "BON-DEMO-1004",
    employeeNumber: "EMP-1004",
    dependentCode: "00",
    principalMemberNumber: "BON-DEMO-1004",
    memberKind: "PRINCIPAL",
    risk: "low",
    weightedProfile: "excellent",
    metadata: {
      medicalAidName: "Ambulant Demo Medical Aid",
      hospitalCoverName: "Comprehensive Plus Hospital Cover",
      onboardingSource: "PATIENT_SELF_LINKED",
      iomtSharing: {
        mode: "full",
        allowEvidenceImages: true,
        devices: ["Health Monitor", "NexRing"],
        metrics: ["vitals", "sleep", "activity", "steps", "hrv", "spo2"],
      },
      healthContext: {
        consent: {
          vitals: true,
          wearableInsights: true,
          clinicalHistory: true,
          reproductiveHealth: false,
          antenatal: false,
        },
        vitals: {
          latestClinicalSpotCheck: {
            bp: "112/72",
            hr: 64,
            spo2: 99,
            temp: "36.5°C",
            recordedAt: daysAgo(1).toISOString(),
            source: "Health Monitor clinical spot-check",
          },
          trendSummary: { count: 15, window: "30 days", posture: "excellent" },
          abnormalFlags: [],
          sourceCoverage: { clinicalSpotChecks: 15, source: "Health Monitor" },
        },
        wearable: {
          sleepSummary: { value: "8h 02m avg", score: 91 },
          activitySummary: { steps: 11800, activeMinutes: 71 },
          rhrHrvSummary: { rhr: 57, hrv: 62 },
          rewardSignals: ["Activity target exceeded", "Sleep target exceeded"],
        },
        clinicalHistory: {
          allergies: [],
          conditions: [],
          vaccinations: [{ vaccine: "COVID booster", date: daysAgo(120).toISOString() }],
          operations: [],
        },
      },
      rewardProfile: {
        pointsEstimate: 186,
        walletDestination: "partner_redemption",
        tier: "Platinum",
        monthlyCap: 600,
        allowedUses: ["Partner redemption", "Premium offset", "Consultation credits"],
        wearableSignals: ["Activity target exceeded", "Sleep target exceeded"],
      },
    },
  },
];

const serviceRules = [
  {
    id: "rule-demo-consult-standard",
    serviceType: "CONSULT_STANDARD",
    decision: "COVERED",
    sponsorCapMinor: 45000,
    memberCopayMinor: 5000,
    preauthRequired: false,
    limitCount: 6,
    limitPeriod: "ANNUAL",
    allowedVisitModes: ["TELEVISIT", "HYBRID"],
    metadata: { benefitBucket: "OUT_OF_HOSPITAL", pmbEligible: true },
  },
  {
    id: "rule-demo-lab-test",
    serviceType: "LAB_TEST",
    decision: "REQUIRES_AUTHORIZATION",
    sponsorCapMinor: 120000,
    memberCopayMinor: 0,
    preauthRequired: true,
    limitCount: 4,
    limitPeriod: "ANNUAL",
    allowedVisitModes: ["IN_PERSON", "HYBRID"],
    metadata: { benefitBucket: "PATHOLOGY", networkRequired: true },
  },
  {
    id: "rule-demo-pharmacy",
    serviceType: "PHARMACY_ITEM",
    decision: "COVERED_WITH_COPAY",
    sponsorCapMinor: 85000,
    memberCopayMinor: 10000,
    preauthRequired: false,
    limitCount: 12,
    limitPeriod: "ANNUAL",
    allowedVisitModes: ["TELEVISIT", "IN_PERSON", "HYBRID"],
    metadata: { benefitBucket: "CHRONIC_MEDICATION", nappiRequired: true },
  },
  {
    id: "rule-demo-pregnancy",
    serviceType: "PHYSICAL_VISIT",
    decision: "REQUIRES_AUTHORIZATION",
    sponsorCapMinor: 150000,
    memberCopayMinor: 0,
    preauthRequired: true,
    limitCount: 8,
    limitPeriod: "ANNUAL",
    allowedVisitModes: ["IN_PERSON", "HYBRID"],
    metadata: { benefitBucket: "PREGNANCY", maternity: true, pmbEligible: true },
  },
];

async function seedIdentity() {
  await upsertIfModel("clientOrg", {
    where: { id: ORG_ID },
    update: {
      name: "Ambulant Demo Medical Aid",
      legalName: "Ambulant Demo Medical Aid Scheme",
      orgType: "MEDICAL_AID",
      status: "ACTIVE",
      country: "ZA",
      currency: "ZAR",
      timezone: "Africa/Johannesburg",
      complianceProfile: "ZA_MEDICAL_SCHEME_DEMO",
      metadata: {
        demo: true,
        cmsContext: true,
        region: "ZA",
        note: "Medical Aid live testing demo organization",
      },
    },
    create: {
      id: ORG_ID,
      name: "Ambulant Demo Medical Aid",
      legalName: "Ambulant Demo Medical Aid Scheme",
      orgType: "MEDICAL_AID",
      status: "ACTIVE",
      country: "ZA",
      currency: "ZAR",
      timezone: "Africa/Johannesburg",
      complianceProfile: "ZA_MEDICAL_SCHEME_DEMO",
      metadata: {
        demo: true,
        cmsContext: true,
        region: "ZA",
        note: "Medical Aid live testing demo organization",
      },
    },
  });

  await upsertIfModel("clientOrgWorkspace", {
    where: { orgId_workspace: { orgId: ORG_ID, workspace: "PAYER_OPS" } },
    update: { active: true },
    create: {
      orgId: ORG_ID,
      workspace: "PAYER_OPS",
      active: true,
      metadata: { demo: true },
    },
  });

  await upsertIfModel("clientOrgUser", {
    where: { orgId_email: { orgId: ORG_ID, email: OWNER_EMAIL } },
    update: {
      userId: OWNER_USER_ID,
      name: "Medical Aid Demo Admin",
      status: "ACTIVE",
      defaultWorkspace: "PAYER_OPS",
      role: "ORG_OWNER",
      scopes: [
        "org.users.manage",
        "org.roles.manage",
        "members.read",
        "coverage.read",
        "coverage.write",
        "authorizations.read",
        "authorizations.approve",
        "authorizations.deny",
        "claims.read",
        "rewards.read",
        "wellness.read",
      ],
      acceptedAt: now,
    },
    create: {
      orgId: ORG_ID,
      userId: OWNER_USER_ID,
      email: OWNER_EMAIL,
      name: "Medical Aid Demo Admin",
      status: "ACTIVE",
      defaultWorkspace: "PAYER_OPS",
      role: "ORG_OWNER",
      scopes: [
        "org.users.manage",
        "org.roles.manage",
        "members.read",
        "coverage.read",
        "coverage.write",
        "authorizations.read",
        "authorizations.approve",
        "authorizations.deny",
        "claims.read",
        "rewards.read",
        "wellness.read",
      ],
      invitedAt: now,
      acceptedAt: now,
    },
  });
}

async function seedPayerProduct() {
  await upsertIfModel("client", {
    where: { id: CLIENT_ID },
    update: {
      orgId: ORG_ID,
      legalName: "Ambulant Demo Medical Aid Scheme",
      tradingName: "Ambulant Demo Medical Aid",
      type: "PROGRAM_SPONSOR",
      status: "ACTIVE",
      billingMode: "HYBRID",
      defaultCurrency: "ZAR",
      country: "ZA",
      allowsClaims: true,
      allowsWalletFunding: true,
      allowsHybridFunding: true,
      metadata: { demo: true, schemeCode: "ADM", administrator: "Ambulant+" },
    },
    create: {
      id: CLIENT_ID,
      orgId: ORG_ID,
      legalName: "Ambulant Demo Medical Aid Scheme",
      tradingName: "Ambulant Demo Medical Aid",
      type: "PROGRAM_SPONSOR",
      status: "ACTIVE",
      billingMode: "HYBRID",
      defaultCurrency: "ZAR",
      country: "ZA",
      allowsClaims: true,
      allowsWalletFunding: true,
      allowsHybridFunding: true,
      metadata: { demo: true, schemeCode: "ADM", administrator: "Ambulant+" },
    },
  });

  await upsertIfModel("clientProgram", {
    where: { id: PROGRAM_ID },
    update: {
      orgId: ORG_ID,
      clientId: CLIENT_ID,
      name: "Comprehensive Wellness & Chronic Care",
      status: "ACTIVE",
      metadata: { demo: true, pmb: true, chronic: true, rewards: true },
    },
    create: {
      id: PROGRAM_ID,
      orgId: ORG_ID,
      clientId: CLIENT_ID,
      name: "Comprehensive Wellness & Chronic Care",
      status: "ACTIVE",
      metadata: { demo: true, pmb: true, chronic: true, rewards: true },
    },
  });

  await upsertIfModel("coveragePlan", {
    where: { id: PLAN_ID },
    update: {
      orgId: ORG_ID,
      clientId: CLIENT_ID,
      name: "Comprehensive Plus Option",
      description: "Demo medical aid option covering virtual consults, chronic medication, labs, pregnancy and wellness rewards.",
      status: "ACTIVE",
      currency: "ZAR",
      annualLimitMinor: 2_500_000,
      monthlyLimitMinor: 250_000,
      lifetimeLimitMinor: null,
      requiresEligibility: true,
      requiresConsent: true,
      metadata: {
        demo: true,
        optionCode: "COMP-PLUS",
        pmb: true,
        chronic: true,
        network: "Preferred DSP network",
        waitingPeriodDays: 0,
      },
    },
    create: {
      id: PLAN_ID,
      orgId: ORG_ID,
      clientId: CLIENT_ID,
      name: "Comprehensive Plus Option",
      description: "Demo medical aid option covering virtual consults, chronic medication, labs, pregnancy and wellness rewards.",
      status: "ACTIVE",
      currency: "ZAR",
      annualLimitMinor: 2_500_000,
      monthlyLimitMinor: 250_000,
      lifetimeLimitMinor: null,
      requiresEligibility: true,
      requiresConsent: true,
      metadata: {
        demo: true,
        optionCode: "COMP-PLUS",
        pmb: true,
        chronic: true,
        network: "Preferred DSP network",
        waitingPeriodDays: 0,
      },
    },
  });

  for (const rule of serviceRules) {
    await upsertIfModel("coverageServiceRule", {
      where: { id: rule.id },
      update: {
        orgId: ORG_ID,
        coveragePlanId: PLAN_ID,
        serviceType: rule.serviceType,
        enabled: true,
        decision: rule.decision,
        sponsorCapMinor: rule.sponsorCapMinor,
        memberCopayMinor: rule.memberCopayMinor,
        preauthRequired: rule.preauthRequired,
        limitCount: rule.limitCount,
        limitPeriod: rule.limitPeriod,
        allowedVisitModes: rule.allowedVisitModes,
        metadata: rule.metadata,
      },
      create: {
        id: rule.id,
        orgId: ORG_ID,
        coveragePlanId: PLAN_ID,
        serviceType: rule.serviceType,
        enabled: true,
        decision: rule.decision,
        sponsorCapMinor: rule.sponsorCapMinor,
        memberCopayMinor: rule.memberCopayMinor,
        preauthRequired: rule.preauthRequired,
        limitCount: rule.limitCount,
        limitPeriod: rule.limitPeriod,
        allowedVisitModes: rule.allowedVisitModes,
        metadata: rule.metadata,
      },
    });
  }
}

async function seedMembers() {
  for (const m of members) {
    await upsertIfModel("clientMember", {
      where: { id: m.id },
      update: {
        orgId: ORG_ID,
        clientId: CLIENT_ID,
        clientProgramId: PROGRAM_ID,
        coveragePlanId: PLAN_ID,
        userId: `user-${m.patientId}`,
        patientId: m.patientId,
        memberKind: m.memberKind,
        memberStatus: "ACTIVE",
        memberNumber: m.memberNumber,
        employeeNumber: m.employeeNumber,
        dependentCode: m.dependentCode,
        principalMemberNumber: m.principalMemberNumber,
        joinedAt: daysAgo(180),
        effectiveFrom: daysAgo(120),
        effectiveTo: daysFromNow(365),
        metadata: withMedicalAidIdentifiers(m),
      },
      create: {
        id: m.id,
        orgId: ORG_ID,
        clientId: CLIENT_ID,
        clientProgramId: PROGRAM_ID,
        coveragePlanId: PLAN_ID,
        userId: `user-${m.patientId}`,
        patientId: m.patientId,
        memberKind: m.memberKind,
        memberStatus: "ACTIVE",
        memberNumber: m.memberNumber,
        employeeNumber: m.employeeNumber,
        dependentCode: m.dependentCode,
        principalMemberNumber: m.principalMemberNumber,
        joinedAt: daysAgo(180),
        effectiveFrom: daysAgo(120),
        effectiveTo: daysFromNow(365),
        metadata: withMedicalAidIdentifiers(m),
      },
    });

    await upsertIfModel("patientDataSharingPreference", {
      where: { patientId: m.patientId },
      update: {
        allowClinicianAccess: true,
        allowMedicalAidAdherenceAccess: true,
        allowCorporateSponsorAdherenceAccess: false,
        allowRewardProgramAccess: true,
        allowEvidenceImages: Boolean(m.metadata.iomtSharing?.allowEvidenceImages),
      },
      create: {
        patientId: m.patientId,
        allowClinicianAccess: true,
        allowMedicalAidAdherenceAccess: true,
        allowCorporateSponsorAdherenceAccess: false,
        allowRewardProgramAccess: true,
        allowEvidenceImages: Boolean(m.metadata.iomtSharing?.allowEvidenceImages),
      },
    });
  }
}

function medicationRows(patientId: string) {
  return [
    {
      id: `med-${patientId}-metformin`,
      patientId,
      name: "Metformin 500mg",
      status: "Active",
      meta: { demo: true, chronic: true, nappi: "720123001" },
    },
    {
      id: `med-${patientId}-amlodipine`,
      patientId,
      name: "Amlodipine 5mg",
      status: "Active",
      meta: { demo: true, chronic: true, nappi: "721456002" },
    },
  ];
}

function reminderRows(patientId: string, profile: string) {
  const rows: any[] = [];

  for (let day = 13; day >= 0; day--) {
    const morning = atHour(daysAgo(day), 8);
    const evening = atHour(daysAgo(day), 20);

    const good = profile === "excellent";
    const moderate = profile === "moderate";

    const morningMissed = !good && day % (moderate ? 5 : 3) === 0;
    const eveningMissed = !good && day % (moderate ? 6 : 2) === 0;

    rows.push({
      id: `rem-${patientId}-${day}-am`,
      patientId,
      medicationId: `med-${patientId}-metformin`,
      name: "Metformin 500mg",
      dose: "500mg",
      time: "08:00",
      source: "medication",
      status: morningMissed ? "Missed" : "Taken",
      scheduledFor: morning,
      takenAt: morningMissed ? null : addMinutes(morning, good ? 7 : moderate ? 45 : 180),
      verificationStatus: morningMissed ? "FAILED" : good ? "VERIFIED" : moderate ? "SELF_REPORTED" : "SELF_REPORTED",
      takenSource: morningMissed ? "SELF_REPORTED" : good ? "CAMERA_VERIFIED" : "SELF_REPORTED",
      meta: { demo: true, scheduledFor: morning.toISOString() },
      createdAt: morning,
    });

    rows.push({
      id: `rem-${patientId}-${day}-pm`,
      patientId,
      medicationId: `med-${patientId}-amlodipine`,
      name: "Amlodipine 5mg",
      dose: "5mg",
      time: "20:00",
      source: "medication",
      status: eveningMissed ? "Missed" : "Taken",
      scheduledFor: evening,
      takenAt: eveningMissed ? null : addMinutes(evening, good ? 10 : moderate ? 60 : 240),
      verificationStatus: eveningMissed ? "FAILED" : good ? "VERIFIED" : "SELF_REPORTED",
      takenSource: eveningMissed ? "SELF_REPORTED" : good ? "CAMERA_VERIFIED" : "SELF_REPORTED",
      meta: { demo: true, scheduledFor: evening.toISOString() },
      createdAt: evening,
    });
  }

  return rows;
}

async function seedAdherence() {
  const patientIds = members.map((m) => m.patientId);

  await deleteManyIfModel("reminder", { where: { patientId: { in: patientIds }, meta: { path: ["demo"], equals: true } } })
    .catch(() => deleteManyIfModel("reminder", { where: { patientId: { in: patientIds } } }));

  await deleteManyIfModel("medication", { where: { patientId: { in: patientIds }, meta: { path: ["demo"], equals: true } } })
    .catch(() => deleteManyIfModel("medication", { where: { patientId: { in: patientIds } } }));

  const meds = members.flatMap((m) => medicationRows(m.patientId));
  await createManyIfModel("medication", { data: meds, skipDuplicates: true });

  const reminders = members.flatMap((m) => reminderRows(m.patientId, m.weightedProfile));
  await createManyIfModel("reminder", { data: reminders, skipDuplicates: true });
}

async function seedAuthorizations() {
  await deleteManyIfModel("coverageAuthorization", {
    where: {
      orgId: ORG_ID,
      metadata: { path: ["demo"], equals: true },
    },
  }).catch(() => null);

  const auths = [
    {
      id: "auth-demo-001",
      memberId: "member-demo-002",
      patientId: "patient-demo-002",
      serviceType: "PHYSICAL_VISIT",
      scopeType: "APPOINTMENT",
      scopeId: "appt-demo-pregnancy-001",
      requestedAmountMinor: 95000,
      metadata: { demo: true, lane: "pregnancy", urgency: "routine" },
      ruleSnapshot: {
        decision: "REQUIRES_AUTHORIZATION",
        preauthRequired: true,
        benefitBucket: "PREGNANCY",
        sponsorCapMinor: 150000,
        patientCopayMinor: 0,
      },
    },
    {
      id: "auth-demo-002",
      memberId: "member-demo-003",
      patientId: "patient-demo-003",
      serviceType: "LAB_TEST",
      scopeType: "LAB_ORDER",
      scopeId: "lab-demo-hba1c-001",
      requestedAmountMinor: 185000,
      metadata: { demo: true, lane: "chronic", urgency: "high" },
      ruleSnapshot: {
        decision: "REQUIRES_AUTHORIZATION",
        preauthRequired: true,
        benefitBucket: "PATHOLOGY",
        sponsorCapMinor: 120000,
        patientCopayMinor: 0,
        uncoveredGapMinor: 65000,
      },
    },
    {
      id: "auth-demo-003",
      memberId: "member-demo-001",
      patientId: "patient-demo-001",
      serviceType: "PHARMACY_ITEM",
      scopeType: "ERX_ORDER",
      scopeId: "erx-demo-chronic-001",
      requestedAmountMinor: 74000,
      metadata: { demo: true, lane: "pharmacy", urgency: "normal" },
      ruleSnapshot: {
        decision: "COVERED_WITH_COPAY",
        preauthRequired: false,
        benefitBucket: "CHRONIC_MEDICATION",
        sponsorCapMinor: 85000,
        patientCopayMinor: 10000,
      },
    },
  ];

  for (const a of auths) {
    await upsertIfModel("coverageAuthorization", {
      where: { id: a.id },
      update: {
        orgId: ORG_ID,
        clientId: CLIENT_ID,
        coveragePlanId: PLAN_ID,
        clientMemberId: a.memberId,
        userId: `user-${a.patientId}`,
        patientId: a.patientId,
        scopeType: a.scopeType,
        scopeId: a.scopeId,
        serviceType: a.serviceType,
        status: "PENDING",
        requestedAmountMinor: a.requestedAmountMinor,
        currency: "ZAR",
        ruleSnapshot: a.ruleSnapshot,
        metadata: a.metadata,
        requestedAt: daysAgo(1),
      },
      create: {
        id: a.id,
        orgId: ORG_ID,
        clientId: CLIENT_ID,
        coveragePlanId: PLAN_ID,
        clientMemberId: a.memberId,
        userId: `user-${a.patientId}`,
        patientId: a.patientId,
        scopeType: a.scopeType,
        scopeId: a.scopeId,
        serviceType: a.serviceType,
        status: "PENDING",
        requestedAmountMinor: a.requestedAmountMinor,
        currency: "ZAR",
        ruleSnapshot: a.ruleSnapshot,
        metadata: a.metadata,
        requestedAt: daysAgo(1),
      },
    });
  }
}


async function seedClaims() {
  const claimIds = [
    "claim-demo-consult-001",
    "claim-demo-lab-001",
    "claim-demo-pharmacy-001",
  ];

  const billableIds = [
    "bill-demo-consult-001",
    "bill-demo-lab-001",
    "bill-demo-pharmacy-001",
    "bill-demo-medreach-phleb-001",
    "bill-demo-medreach-logistics-001",
  ];

  await deleteManyIfModel("clientClaim", {
    where: {
      id: { in: claimIds },
    },
  }).catch(() => null);

  await deleteManyIfModel("billableEvent", {
    where: {
      id: { in: billableIds },
    },
  }).catch(() => null);

  const billables = [
    {
      id: "bill-demo-consult-001",
      orgId: ORG_ID,
      clientId: CLIENT_ID,
      clientMemberId: "member-demo-001",
      authorizationId: null,
      patientId: "patient-demo-001",
      userId: "user-patient-demo-001",
      serviceType: "CONSULT_STANDARD",
      providerLane: "CLINICIAN",
      providerId: "clinician-demo-001",
      responsibility: "SPLIT",
      status: "CLAIMED",
      currency: "ZAR",
      grossAmountMinor: 45000,
      sponsorAmountMinor: 40000,
      patientAmountMinor: 5000,
      platformAmountMinor: 9000,
      providerAmountMinor: 36000,
      patientResponsibilityMinor: 5000,
      sponsorOutstandingMinor: 0,
      claimReady: true,
      claimFiledAt: daysAgo(1),
      serviceAt: daysAgo(2),
      pricingSnapshot: {
        tariffCode: "0190",
        codeSystem: "ZA_TARIFF",
        icd10Codes: ["I10"],
        serviceLabel: "Standard virtual consultation",
      },
      metadata: {
        demo: true,
        claimLane: "consultation",
        providerName: "Dr Demo Clinician",
        memberNumber: "BON-DEMO-1001",
        planName: "Comprehensive Plus Option",
      },
    },
    {
      id: "bill-demo-lab-001",
      orgId: ORG_ID,
      clientId: CLIENT_ID,
      clientMemberId: "member-demo-003",
      authorizationId: "auth-demo-002",
      drawId: "draw-demo-hba1c-001",
      labOrderId: "lab-demo-hba1c-001",
      patientId: "patient-demo-003",
      userId: "user-patient-demo-003",
      serviceType: "LAB_TEST",
      providerLane: "LAB",
      providerId: "lab-demo-001",
      responsibility: "SPLIT",
      status: "CLAIMED",
      currency: "ZAR",
      grossAmountMinor: 185000,
      sponsorAmountMinor: 120000,
      patientAmountMinor: 65000,
      platformAmountMinor: 15000,
      providerAmountMinor: 170000,
      patientResponsibilityMinor: 65000,
      sponsorOutstandingMinor: 120000,
      claimReady: true,
      claimFiledAt: daysAgo(1),
      serviceAt: daysAgo(2),
      pricingSnapshot: {
        tariffCode: "4057",
        codeSystem: "ZA_PATHOLOGY",
        icd10Codes: ["E11", "I10"],
        serviceLabel: "HbA1c and chronic pathology panel",
      },
      metadata: {
        demo: true,
        claimLane: "lab",
        diagnosticLane: "Pathology",
        drawId: "draw-demo-hba1c-001",
        labOrderId: "lab-demo-hba1c-001",
        providerName: "Demo Pathology Network",
        memberNumber: "BON-DEMO-1003",
        planName: "Comprehensive Plus Option",
        authorizationId: "auth-demo-002",
      },
    },
    {
      id: "bill-demo-medreach-phleb-001",
      orgId: ORG_ID,
      clientId: CLIENT_ID,
      clientMemberId: "member-demo-003",
      authorizationId: "auth-demo-002",
      drawId: "draw-demo-hba1c-001",
      labOrderId: "lab-demo-hba1c-001",
      patientId: "patient-demo-003",
      userId: "user-patient-demo-003",
      serviceType: "PHLEB_DRAW",
      providerLane: "PHLEB",
      providerId: "phleb-demo-001",
      responsibility: "SPLIT",
      status: "CLAIMED",
      currency: "ZAR",
      grossAmountMinor: 45000,
      sponsorAmountMinor: 35000,
      patientAmountMinor: 10000,
      platformAmountMinor: 5000,
      providerAmountMinor: 40000,
      patientResponsibilityMinor: 10000,
      sponsorOutstandingMinor: 35000,
      claimReady: true,
      claimFiledAt: daysAgo(1),
      serviceAt: daysAgo(2),
      pricingSnapshot: {
        codeSystem: "ZA_PHLEBOTOMY",
        code: "PHLEB_HOME_DRAW",
        icd10Codes: ["E11", "I10"],
        serviceLabel: "Home phlebotomy draw for chronic pathology panel",
      },
      metadata: {
        demo: true,
        claimLane: "medreach",
        diagnosticLane: "Phlebotomy draw",
        drawId: "draw-demo-hba1c-001",
        labOrderId: "lab-demo-hba1c-001",
        providerName: "Demo Mobile Phlebotomy",
        memberNumber: "BON-DEMO-1003",
        planName: "Comprehensive Plus Option",
        authorizationId: "auth-demo-002",
      },
    },
    {
      id: "bill-demo-medreach-logistics-001",
      orgId: ORG_ID,
      clientId: CLIENT_ID,
      clientMemberId: "member-demo-003",
      authorizationId: "auth-demo-002",
      drawId: "draw-demo-hba1c-001",
      labOrderId: "lab-demo-hba1c-001",
      patientId: "patient-demo-003",
      userId: "user-patient-demo-003",
      serviceType: "LAB_LOGISTICS",
      providerLane: "PLATFORM",
      providerId: "medreach-logistics-demo-001",
      responsibility: "CLIENT",
      status: "CLAIMED",
      currency: "ZAR",
      grossAmountMinor: 25000,
      sponsorAmountMinor: 25000,
      patientAmountMinor: 0,
      platformAmountMinor: 25000,
      providerAmountMinor: 0,
      patientResponsibilityMinor: 0,
      sponsorOutstandingMinor: 25000,
      claimReady: true,
      claimFiledAt: daysAgo(1),
      serviceAt: daysAgo(2),
      pricingSnapshot: {
        codeSystem: "MEDREACH_LOGISTICS",
        code: "SPECIMEN_LOGISTICS",
        icd10Codes: ["E11", "I10"],
        serviceLabel: "Specimen logistics and cold-chain handling",
      },
      metadata: {
        demo: true,
        claimLane: "medreach",
        diagnosticLane: "Specimen logistics",
        drawId: "draw-demo-hba1c-001",
        labOrderId: "lab-demo-hba1c-001",
        providerName: "MedReach Logistics",
        memberNumber: "BON-DEMO-1003",
        planName: "Comprehensive Plus Option",
        authorizationId: "auth-demo-002",
      },
    },
    {
      id: "bill-demo-pharmacy-001",
      orgId: ORG_ID,
      clientId: CLIENT_ID,
      clientMemberId: "member-demo-001",
      authorizationId: "auth-demo-003",
      patientId: "patient-demo-001",
      userId: "user-patient-demo-001",
      serviceType: "PHARMACY_ITEM",
      providerLane: "PHARMACY",
      providerId: "pharmacy-demo-001",
      responsibility: "SPLIT",
      status: "CLAIMED",
      currency: "ZAR",
      grossAmountMinor: 74000,
      sponsorAmountMinor: 64000,
      patientAmountMinor: 10000,
      platformAmountMinor: 5000,
      providerAmountMinor: 69000,
      patientResponsibilityMinor: 10000,
      sponsorOutstandingMinor: 0,
      claimReady: true,
      claimFiledAt: daysAgo(1),
      serviceAt: daysAgo(1),
      pricingSnapshot: {
        nappiCode: "720123001",
        codeSystem: "NAPPI",
        icd10Codes: ["I10"],
        serviceLabel: "Chronic medication dispense",
      },
      metadata: {
        demo: true,
        claimLane: "pharmacy",
        providerName: "Demo DSP Pharmacy",
        memberNumber: "BON-DEMO-1001",
        planName: "Comprehensive Plus Option",
        authorizationId: "auth-demo-003",
      },
    },
  ];

  for (const billable of billables) {
    await upsertIfModel("billableEvent", {
      where: { id: billable.id },
      update: billable,
      create: billable,
    });
  }

  const claims = [
    {
      id: "claim-demo-consult-001",
      orgId: ORG_ID,
      clientId: CLIENT_ID,
      clientMemberId: "member-demo-001",
      coveragePlanId: PLAN_ID,
      authorizationId: null,
      appointmentId: "appt-demo-consult-001",
      encounterId: "enc-demo-consult-001",
      patientId: "patient-demo-001",
      clinicianId: "clinician-demo-001",
      claimType: "MEDICAL_AID_CLAIM",
      status: "PAID",
      serviceType: "CONSULT_STANDARD",
      visitMode: "TELEVISIT",
      claimNumber: "CLM-DEMO-0001",
      currency: "ZAR",
      externalClaimRef: "REM-DEMO-PAID-0001",
      submittedAmountMinor: 45000,
      approvedAmountMinor: 40000,
      paidAmountMinor: 40000,
      memberResponsibilityMinor: 5000,
      submissionPayload: {
        memberNumber: "BON-DEMO-1001",
        dependentCode: "00",
        tariffCode: "0190",
        icd10Codes: ["I10"],
        provider: "Dr Demo Clinician",
      },
      responsePayload: {
        remittanceRef: "REM-DEMO-PAID-0001",
        adjudication: "Paid",
        reason: "Covered consultation with member co-pay.",
      },
      notes: "Paid consultation claim. Member co-pay captured.",
      submittedAt: daysAgo(1),
      decidedAt: daysAgo(1),
      paidAt: daysAgo(0),
    },
    {
      id: "claim-demo-lab-001",
      orgId: ORG_ID,
      clientId: CLIENT_ID,
      clientMemberId: "member-demo-003",
      coveragePlanId: PLAN_ID,
      authorizationId: "auth-demo-002",
      appointmentId: null,
      encounterId: "enc-demo-lab-001",
      patientId: "patient-demo-003",
      clinicianId: "clinician-demo-001",
      claimType: "MEDICAL_AID_CLAIM",
      status: "PARTIALLY_APPROVED",
      serviceType: "LAB_TEST",
      visitMode: "IN_PERSON",
      claimNumber: "CLM-DEMO-0002",
      currency: "ZAR",
      externalClaimRef: "REM-DEMO-PARTIAL-0002",
      submittedAmountMinor: 185000,
      approvedAmountMinor: 120000,
      paidAmountMinor: 0,
      memberResponsibilityMinor: 65000,
      submissionPayload: {
        memberNumber: "BON-DEMO-1003",
        dependentCode: "00",
        tariffCode: "4057",
        icd10Codes: ["E11", "I10"],
        provider: "Demo Pathology Network",
        authorizationId: "auth-demo-002",
      },
      responsePayload: {
        remittanceRef: "REM-DEMO-PARTIAL-0002",
        adjudication: "Partial approval",
        reason: "Pathology benefit cap applied.",
      },
      notes: "Partial lab approval. Sponsor cap applied, member gap remains.",
      submittedAt: daysAgo(1),
      decidedAt: daysAgo(0),
      paidAt: null,
    },
    {
      id: "claim-demo-pharmacy-001",
      orgId: ORG_ID,
      clientId: CLIENT_ID,
      clientMemberId: "member-demo-001",
      coveragePlanId: PLAN_ID,
      authorizationId: "auth-demo-003",
      appointmentId: null,
      encounterId: "enc-demo-erx-001",
      patientId: "patient-demo-001",
      clinicianId: "clinician-demo-001",
      claimType: "MEDICAL_AID_CLAIM",
      status: "APPROVED",
      serviceType: "PHARMACY_ITEM",
      visitMode: null,
      claimNumber: "CLM-DEMO-0003",
      currency: "ZAR",
      externalClaimRef: "REM-DEMO-APPROVED-0003",
      submittedAmountMinor: 74000,
      approvedAmountMinor: 64000,
      paidAmountMinor: 0,
      memberResponsibilityMinor: 10000,
      submissionPayload: {
        memberNumber: "BON-DEMO-1001",
        dependentCode: "00",
        nappiCode: "720123001",
        icd10Codes: ["I10"],
        provider: "Demo DSP Pharmacy",
        authorizationId: "auth-demo-003",
      },
      responsePayload: {
        remittanceRef: "REM-DEMO-APPROVED-0003",
        adjudication: "Approved, pending settlement",
        reason: "Chronic medication with fixed co-pay.",
      },
      notes: "Approved chronic medication claim, awaiting settlement batch.",
      submittedAt: daysAgo(1),
      decidedAt: daysAgo(0),
      paidAt: null,
    },
  ];

  const lines = [
    {
      id: "claim-line-demo-consult-001",
      claimId: "claim-demo-consult-001",
      billableEventId: "bill-demo-consult-001",
      submittedAmountMinor: 45000,
      approvedAmountMinor: 40000,
      paidAmountMinor: 40000,
      rejectionReason: null,
      metadata: {
        codeSystem: "ZA_TARIFF",
        code: "0190",
        codeLabel: "Standard virtual consultation",
        icd10Codes: ["I10"],
        tariffCode: "0190",
        adjudication: "Paid",
      },
    },
    {
      id: "claim-line-demo-lab-001",
      claimId: "claim-demo-lab-001",
      billableEventId: "bill-demo-lab-001",
      submittedAmountMinor: 185000,
      approvedAmountMinor: 120000,
      paidAmountMinor: 0,
      rejectionReason: "Benefit cap applied; member responsibility remains.",
      metadata: {
        codeSystem: "ZA_PATHOLOGY",
        code: "4057",
        codeLabel: "HbA1c and chronic pathology panel",
        icd10Codes: ["E11", "I10"],
        tariffCode: "4057",
        adjudication: "Partial approval",
      },
    },
    {
      id: "claim-line-demo-pharmacy-001",
      claimId: "claim-demo-pharmacy-001",
      billableEventId: "bill-demo-pharmacy-001",
      submittedAmountMinor: 74000,
      approvedAmountMinor: 64000,
      paidAmountMinor: 0,
      rejectionReason: null,
      metadata: {
        codeSystem: "NAPPI",
        code: "720123001",
        codeLabel: "Chronic medication dispense",
        icd10Codes: ["I10"],
        nappiCode: "720123001",
        adjudication: "Approved pending settlement",
      },
    },
  ];

  for (const claim of claims) {
    await upsertIfModel("clientClaim", {
      where: { id: claim.id },
      update: claim,
      create: claim,
    });
  }

  for (const line of lines) {
    await upsertIfModel("clientClaimLine", {
      where: { id: line.id },
      update: line,
      create: line,
    });
  }
}


async function seedProviderNetwork() {
  await deleteManyIfModel("providerNetworkRecord", {
    where: {
      orgId: ORG_ID,
      clientId: CLIENT_ID,
      metadata: { path: ["demo"], equals: true },
    },
  }).catch(() => null);

  const rows = [
    {
      id: "provider-network-demo-clinician-001",
      orgId: ORG_ID,
      clientId: CLIENT_ID,
      providerLane: "CLINICIAN",
      providerType: "INDIVIDUAL",
      providerId: "clinician-demo-001",
      legalName: "Dr Demo Clinician",
      tradingName: "Ambulant+ Virtual Practice",
      displayName: "Dr Demo Clinician",
      practiceNumber: null,
      providerCode: "AMB-CLINICIAN-001",
      networkStatus: "PREFERRED",
      dspStatus: "NETWORK_ELIGIBLE",
      contractStatus: "ACTIVE",
      credentialingStatus: "AMBULANT_VERIFIED",
      bankVerificationStatus: "AMBULANT_PAYEE",
      riskStatus: "NORMAL",
      claimsEnabled: true,
      settlementEnabled: true,
      directSettlementEnabled: false,
      payoutRoute: "AMBULANT_PLUS",
      payeeEntityType: "AMBULANT_PLUS",
      payeeEntityId: "ambulant-plus-practice",
      settlementCycle: "MONTHLY",
      acceptedSchemes: ["Ambulant Demo Medical Aid"],
      schemeRuleCodes: ["CONSULT_STANDARD", "PHYSICAL_VISIT"],
      metadata: {
        demo: true,
        discipline: "General Practice",
        payoutPolicy:
          "Clinician does not have verified independent practice number. Claims route through Ambulant+ practice and settlement account.",
        blockers: ["Independent practice number not verified"],
        riskFlags: [],
        settlementGrossMinor: 45000,
        settlementNetMinor: 36000,
        settlementLineCount: 1,
        claimsCount: 1,
        submittedAmountMinor: 45000,
        approvedAmountMinor: 40000,
        paidAmountMinor: 40000,
      },
    },
    {
      id: "provider-network-demo-pharmacy-001",
      orgId: ORG_ID,
      clientId: CLIENT_ID,
      providerLane: "PHARMACY",
      providerType: "ORGANISATION",
      providerId: "pharmacy-demo-001",
      legalName: "Demo DSP Pharmacy (Pty) Ltd",
      tradingName: "Demo DSP Pharmacy",
      displayName: "Demo DSP Pharmacy",
      practiceNumber: "PHARM-DEMO-001",
      providerCode: "DSP-PHARM-001",
      networkStatus: "PREFERRED",
      dspStatus: "DSP",
      contractStatus: "ACTIVE",
      credentialingStatus: "VERIFIED",
      bankVerificationStatus: "VERIFIED",
      riskStatus: "LOW",
      claimsEnabled: true,
      settlementEnabled: true,
      directSettlementEnabled: true,
      payoutRoute: "DIRECT_PROVIDER_BANK",
      payeeEntityType: "PROVIDER",
      payeeEntityId: "pharmacy-demo-001",
      settlementCycle: "WEEKLY",
      acceptedSchemes: ["Ambulant Demo Medical Aid"],
      schemeRuleCodes: ["PHARMACY_ITEM", "CHRONIC_MEDICATION", "NAPPI"],
      metadata: {
        demo: true,
        discipline: "Chronic medicine dispensing",
        payoutPolicy:
          "DSP pharmacy has verified provider code and verified bank profile. Eligible for direct provider settlement.",
        blockers: [],
        riskFlags: [],
        settlementGrossMinor: 74000,
        settlementNetMinor: 69000,
        settlementLineCount: 1,
        claimsCount: 1,
        submittedAmountMinor: 74000,
        approvedAmountMinor: 64000,
        paidAmountMinor: 0,
      },
    },
    {
      id: "provider-network-demo-lab-001",
      orgId: ORG_ID,
      clientId: CLIENT_ID,
      providerLane: "LAB",
      providerType: "ORGANISATION",
      providerId: "lab-demo-001",
      legalName: "Demo Pathology Network (Pty) Ltd",
      tradingName: "Demo Pathology Network",
      displayName: "Demo Pathology Network",
      practiceNumber: "LAB-DEMO-001",
      providerCode: "PATH-DEMO-001",
      networkStatus: "PREFERRED",
      dspStatus: "DSP",
      contractStatus: "ACTIVE",
      credentialingStatus: "VERIFIED",
      bankVerificationStatus: "VERIFIED",
      riskStatus: "NORMAL",
      claimsEnabled: true,
      settlementEnabled: true,
      directSettlementEnabled: true,
      payoutRoute: "DIRECT_PROVIDER_BANK",
      payeeEntityType: "PROVIDER",
      payeeEntityId: "lab-demo-001",
      settlementCycle: "WEEKLY",
      acceptedSchemes: ["Ambulant Demo Medical Aid"],
      schemeRuleCodes: ["LAB_TEST", "PATHOLOGY", "PMB_CHRONIC"],
      metadata: {
        demo: true,
        discipline: "Pathology",
        payoutPolicy:
          "Pathology network is contracted and bank verified. Eligible for direct provider settlement.",
        blockers: [],
        riskFlags: [],
        settlementGrossMinor: 185000,
        settlementNetMinor: 170000,
        settlementLineCount: 1,
        claimsCount: 1,
        submittedAmountMinor: 185000,
        approvedAmountMinor: 120000,
        paidAmountMinor: 0,
      },
    },
    {
      id: "provider-network-demo-phleb-001",
      orgId: ORG_ID,
      clientId: CLIENT_ID,
      providerLane: "PHLEB",
      providerType: "ORGANISATION",
      providerId: "phleb-demo-001",
      legalName: "Demo Mobile Phlebotomy Services",
      tradingName: "Demo Mobile Phlebotomy",
      displayName: "Demo Mobile Phlebotomy",
      practiceNumber: "PHLEB-DEMO-001",
      providerCode: "PHLEB-DEMO-001",
      networkStatus: "CONTRACTED",
      dspStatus: "NETWORK_ELIGIBLE",
      contractStatus: "ACTIVE",
      credentialingStatus: "VERIFIED",
      bankVerificationStatus: "VERIFIED",
      riskStatus: "NORMAL",
      claimsEnabled: true,
      settlementEnabled: true,
      directSettlementEnabled: true,
      payoutRoute: "DIRECT_PROVIDER_BANK",
      payeeEntityType: "PROVIDER",
      payeeEntityId: "phleb-demo-001",
      settlementCycle: "WEEKLY",
      acceptedSchemes: ["Ambulant Demo Medical Aid"],
      schemeRuleCodes: ["PHLEB_DRAW", "HOME_DRAW"],
      metadata: {
        demo: true,
        discipline: "Home phlebotomy draw",
        payoutPolicy:
          "Mobile phlebotomy partner is contracted and bank verified. Eligible for direct provider settlement.",
        blockers: [],
        riskFlags: [],
        settlementGrossMinor: 45000,
        settlementNetMinor: 40000,
        settlementLineCount: 1,
        claimsCount: 0,
        submittedAmountMinor: 0,
        approvedAmountMinor: 0,
        paidAmountMinor: 0,
      },
    },
    {
      id: "provider-network-demo-medreach-logistics-001",
      orgId: ORG_ID,
      clientId: CLIENT_ID,
      providerLane: "PLATFORM",
      providerType: "PLATFORM",
      providerId: "medreach-logistics-demo-001",
      legalName: "Cloven Technology Impilo",
      tradingName: "MedReach Logistics",
      displayName: "MedReach Logistics",
      practiceNumber: null,
      providerCode: "MEDREACH-LOGISTICS-001",
      networkStatus: "PLATFORM_SERVICE",
      dspStatus: "NETWORK_ELIGIBLE",
      contractStatus: "ACTIVE",
      credentialingStatus: "INTERNAL",
      bankVerificationStatus: "AMBULANT_PAYEE",
      riskStatus: "LOW",
      claimsEnabled: true,
      settlementEnabled: true,
      directSettlementEnabled: false,
      payoutRoute: "AMBULANT_PLUS",
      payeeEntityType: "AMBULANT_PLUS",
      payeeEntityId: "ambulant-plus-platform",
      settlementCycle: "MONTHLY",
      acceptedSchemes: ["Ambulant Demo Medical Aid"],
      schemeRuleCodes: ["LAB_LOGISTICS", "SPECIMEN_LOGISTICS"],
      metadata: {
        demo: true,
        discipline: "Specimen logistics and cold-chain handling",
        payoutPolicy:
          "Platform logistics line settles to Ambulant+ because it is an Ambulant-operated service lane.",
        blockers: [],
        riskFlags: [],
        settlementGrossMinor: 25000,
        settlementNetMinor: 0,
        settlementLineCount: 1,
        claimsCount: 0,
        submittedAmountMinor: 0,
        approvedAmountMinor: 0,
        paidAmountMinor: 0,
      },
    },
    {
      id: "provider-network-demo-ambulant-plus",
      orgId: ORG_ID,
      clientId: CLIENT_ID,
      providerLane: "PLATFORM",
      providerType: "PLATFORM",
      providerId: "ambulant-plus-practice",
      legalName: "Cloven Technology Impilo",
      tradingName: "Ambulant+ Practice and Platform Payee",
      displayName: "Ambulant+ Practice and Platform Payee",
      practiceNumber: "AMB-PLUS-PRACTICE",
      providerCode: "AMBULANT-PLUS",
      networkStatus: "PLATFORM_SERVICE",
      dspStatus: "NETWORK_ELIGIBLE",
      contractStatus: "ACTIVE",
      credentialingStatus: "INTERNAL",
      bankVerificationStatus: "VERIFIED",
      riskStatus: "LOW",
      claimsEnabled: true,
      settlementEnabled: true,
      directSettlementEnabled: true,
      payoutRoute: "AMBULANT_PLUS",
      payeeEntityType: "AMBULANT_PLUS",
      payeeEntityId: "ambulant-plus-platform",
      settlementCycle: "MONTHLY",
      acceptedSchemes: ["Ambulant Demo Medical Aid"],
      schemeRuleCodes: ["CONSULT_STANDARD", "PLATFORM_FEE", "NON_PRACTICE_CLINICIAN_PAYEE"],
      metadata: {
        demo: true,
        discipline: "Ambulant+ routed claims and platform settlement",
        payoutPolicy:
          "Clinicians without verified own practice numbers route scripts, claims and payouts through Ambulant+.",
        blockers: [],
        riskFlags: [],
        settlementGrossMinor: 0,
        settlementNetMinor: 0,
        settlementLineCount: 0,
        claimsCount: 0,
        submittedAmountMinor: 0,
        approvedAmountMinor: 0,
        paidAmountMinor: 0,
      },
    },
  ];

  for (const row of rows) {
    await upsertIfModel("providerNetworkRecord", {
      where: { id: row.id },
      update: row,
      create: row,
    });
  }
}

async function main() {
  console.log("Seeding Medical Aid demo data...");
  await seedIdentity();
  await seedPayerProduct();
  await seedPatientProfiles();
  await seedMembers();
  await seedEligibilitySnapshots();
  await seedAdherence();
  await seedAuthorizations();
  await seedClaims();
  await seedProviderNetwork();

  console.log("");
  console.log("Medical Aid demo data ready.");
  console.log(`Login email: ${OWNER_EMAIL}`);
  console.log("Password: any non-empty password for current mock auth");
  console.log("Dashboard: http://localhost:3011/dashboard");
  console.log("Members: http://localhost:3011/members");
  console.log("Primary demo member detail: http://localhost:3011/members/member-demo-001");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });