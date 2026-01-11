// apps/api-gateway/src/lib/credentialing/policies.ts

export type ClinicianTier = 'A' | 'B' | 'C';
export type ClinicianTrack = 'CLINICAL' | 'WELLNESS';

export type RegulatorBody = 'HPCSA' | 'SANC' | 'SAPC' | 'SACSSP' | 'AHPCSA' | 'OTHER';

export type ComplianceCheckKind =
  | 'REGULATOR_PRIMARY'
  | 'REGULATOR_SECONDARY'
  | 'KYC_IDENTITY'
  | 'KYC_BANK'
  | 'DUE_DILIGENCE'
  | 'PI_INSURANCE'
  | 'PRESCRIBING_AUTHORITY'
  | 'SCOPE_ACKNOWLEDGEMENT'
  | 'TRAINING_COMPLETION';

export type ClinicianDocKind =
  | 'governmentId'
  | 'proofOfAddress'
  | 'selfieLiveness'
  | 'registrationProof'
  | 'annualPracticeCertificate'
  | 'specialistRegistrationProof'
  | 'goodStandingLetter'
  | 'designationLetterOrProof'
  | 'protocolsOrStandingOrdersRef'
  | 'pcdtCertificate'
  | 'doh22A15Permit'
  | 'indemnityInsurance'
  | 'bankDetailsKYC'
  | 'coachingCertification'
  | 'fitnessQualification'
  | 'cprFirstAidCert'
  | 'cv'
  | 'scopeAcknowledgement'
  | 'nonClinicalDisclaimerAcceptance';

export type RxAuthority = {
  canPrescribe: 'no' | 'conditional' | 'yes';
  maxSchedule: number | null; // null = permit/protocol list based
  notes?: string;
  requiredDocs?: ClinicianDocKind[];
};

export type RequiredCheck = {
  kind: ComplianceCheckKind;
  regulator?: RegulatorBody;
  requiredDocs?: ClinicianDocKind[];
  // “soft” = can be waived by admin (e.g., bank kyc for non-payout stage)
  waivable?: boolean;
};

export type ProfessionPolicy = {
  professionKey: string;

  tier: ClinicianTier;
  track: ClinicianTrack;

  primaryRegulator: RegulatorBody;
  // optional: for cases where you want to enforce a second body
  secondaryRegulator?: RegulatorBody;

  requiredChecks: RequiredCheck[];
  prohibitedClaims: string[];

  rx: RxAuthority;

  // Ops hints (dispatch / kit expectations)
  requiresIoMTDefault: boolean;

  // UI categorisation (patient app tabs)
  patientCategory: 'clinical' | 'wellness';
};

/**
 * Base platform-wide checks:
 * - For CLINICAL track: KYC + DD + PI + Scope
 * - For WELLNESS track: KYC + DD + Scope + Non-clinical disclaimer
 */
function baseChecks(track: ClinicianTrack): RequiredCheck[] {
  if (track === 'CLINICAL') {
    return [
      { kind: 'KYC_IDENTITY', requiredDocs: ['governmentId'] },
      { kind: 'KYC_BANK', requiredDocs: ['bankDetailsKYC'], waivable: true },
      { kind: 'DUE_DILIGENCE' },
      { kind: 'PI_INSURANCE', requiredDocs: ['indemnityInsurance'] },
      { kind: 'SCOPE_ACKNOWLEDGEMENT', requiredDocs: ['scopeAcknowledgement'] },
      { kind: 'TRAINING_COMPLETION' },
    ];
  }
  return [
    { kind: 'KYC_IDENTITY', requiredDocs: ['governmentId'] },
    { kind: 'KYC_BANK', requiredDocs: ['bankDetailsKYC'], waivable: true },
    { kind: 'DUE_DILIGENCE' },
    {
      kind: 'SCOPE_ACKNOWLEDGEMENT',
      requiredDocs: ['scopeAcknowledgement', 'nonClinicalDisclaimerAcceptance'],
    },
    { kind: 'TRAINING_COMPLETION', waivable: true }, // you can choose to require or waive for wellness
  ];
}

function regulatorPrimary(reg: RegulatorBody, docs: ClinicianDocKind[]): RequiredCheck {
  return { kind: 'REGULATOR_PRIMARY', regulator: reg, requiredDocs: docs };
}

function prescribingConditional(docs: ClinicianDocKind[], notes?: string): RequiredCheck {
  return { kind: 'PRESCRIBING_AUTHORITY', requiredDocs: docs, waivable: false };
}

/**
 * IMPORTANT: “nutritionist” title is not safely clinical unless regulated.
 * We keep:
 * - dietitian = B/CLINICAL (HPCSA)
 * - nutritionist_regulated = B/CLINICAL (HPCSA required)
 * - nutrition_coach = C/WELLNESS (non-regulated)
 */
export const PROFESSION_POLICIES: Record<string, ProfessionPolicy> = {
  gp: {
    professionKey: 'gp',
    tier: 'A',
    track: 'CLINICAL',
    primaryRegulator: 'HPCSA',
    requiredChecks: [
      regulatorPrimary('HPCSA', ['registrationProof', 'annualPracticeCertificate']),
      ...baseChecks('CLINICAL'),
    ],
    prohibitedClaims: ['nonHPCSARegisteredDoctorTitles', 'specialistTitleWithoutSpecialistRegistration'],
    rx: { canPrescribe: 'yes', maxSchedule: null, notes: 'Authorised prescriber; confirm HPCSA category + APC.' },
    requiresIoMTDefault: true,
    patientCategory: 'clinical',
  },

  specialist: {
    professionKey: 'specialist',
    tier: 'A',
    track: 'CLINICAL',
    primaryRegulator: 'HPCSA',
    requiredChecks: [
      regulatorPrimary('HPCSA', ['registrationProof', 'annualPracticeCertificate', 'specialistRegistrationProof']),
      ...baseChecks('CLINICAL'),
    ],
    prohibitedClaims: ['specialistTitleWithoutSpecialistRegistration'],
    rx: { canPrescribe: 'yes', maxSchedule: null, notes: 'Authorised prescriber; verify specialist category.' },
    requiresIoMTDefault: true,
    patientCategory: 'clinical',
  },

  dentist: {
    professionKey: 'dentist',
    tier: 'A',
    track: 'CLINICAL',
    primaryRegulator: 'HPCSA',
    requiredChecks: [
      regulatorPrimary('HPCSA', ['registrationProof', 'annualPracticeCertificate']),
      ...baseChecks('CLINICAL'),
    ],
    prohibitedClaims: ['doctorTitleWithoutMedicalRegistration'],
    rx: { canPrescribe: 'yes', maxSchedule: null, notes: 'Prescribing within dental scope.' },
    requiresIoMTDefault: true,
    patientCategory: 'clinical',
  },

  professional_nurse: {
    professionKey: 'professional_nurse',
    tier: 'B',
    track: 'CLINICAL',
    primaryRegulator: 'SANC',
    requiredChecks: [
      regulatorPrimary('SANC', ['registrationProof']),
      ...baseChecks('CLINICAL'),
      // do NOT add prescribing unless they claim it
    ],
    prohibitedClaims: ['medicalDoctorTitle', 'specialistPhysicianTitle', 'unverifiedPrescriberClaims'],
    rx: {
      canPrescribe: 'conditional',
      maxSchedule: 4,
      notes: 'Only if designated/authorised + within approved protocols. Require proof if enabled.',
      requiredDocs: ['designationLetterOrProof', 'protocolsOrStandingOrdersRef'],
    },
    requiresIoMTDefault: true,
    patientCategory: 'clinical',
  },

  phc_nurse_prescriber: {
    professionKey: 'phc_nurse_prescriber',
    tier: 'B',
    track: 'CLINICAL',
    primaryRegulator: 'SANC',
    requiredChecks: [
      regulatorPrimary('SANC', ['registrationProof']),
      ...baseChecks('CLINICAL'),
      prescribingConditional(['designationLetterOrProof', 'protocolsOrStandingOrdersRef']),
    ],
    prohibitedClaims: ['prescribeOutsideProtocol', 'privatePracticePrescribingWithoutAuthorisation'],
    rx: {
      canPrescribe: 'conditional',
      maxSchedule: 4,
      notes: 'Prescribing tied to designation + PHC protocols.',
      requiredDocs: ['designationLetterOrProof', 'protocolsOrStandingOrdersRef'],
    },
    requiresIoMTDefault: true,
    patientCategory: 'clinical',
  },

  pharmacist: {
    professionKey: 'pharmacist',
    tier: 'B',
    track: 'CLINICAL',
    primaryRegulator: 'SAPC',
    requiredChecks: [
      regulatorPrimary('SAPC', ['registrationProof', 'goodStandingLetter']),
      ...baseChecks('CLINICAL'),
    ],
    prohibitedClaims: ['claimIndependentPCDTPrescribingWithoutPermit'],
    rx: { canPrescribe: 'no', maxSchedule: null, notes: 'Default: no independent prescribing.' },
    requiresIoMTDefault: true,
    patientCategory: 'clinical',
  },

  pharmacist_pcdt: {
    professionKey: 'pharmacist_pcdt',
    tier: 'B',
    track: 'CLINICAL',
    primaryRegulator: 'SAPC',
    requiredChecks: [
      regulatorPrimary('SAPC', ['registrationProof', 'goodStandingLetter']),
      ...baseChecks('CLINICAL'),
      prescribingConditional(['pcdtCertificate', 'doh22A15Permit']),
    ],
    prohibitedClaims: ['prescribeOutsidePermitOrProtocol'],
    rx: {
      canPrescribe: 'conditional',
      maxSchedule: null, // permit list based
      notes: 'Permit/conditions based (record medicines/conditions permitted).',
      requiredDocs: ['pcdtCertificate', 'doh22A15Permit'],
    },
    requiresIoMTDefault: true,
    patientCategory: 'clinical',
  },

  psychologist: {
    professionKey: 'psychologist',
    tier: 'B',
    track: 'CLINICAL',
    primaryRegulator: 'HPCSA',
    requiredChecks: [
      regulatorPrimary('HPCSA', ['registrationProof', 'annualPracticeCertificate']),
      ...baseChecks('CLINICAL'),
    ],
    prohibitedClaims: ['medicalDoctorTitle', 'prescribeMedication'],
    rx: { canPrescribe: 'no', maxSchedule: null, notes: 'No prescribing.' },
    requiresIoMTDefault: true,
    patientCategory: 'clinical',
  },

  social_worker: {
    professionKey: 'social_worker',
    tier: 'B',
    track: 'CLINICAL',
    primaryRegulator: 'SACSSP',
    requiredChecks: [
      regulatorPrimary('SACSSP', ['registrationProof', 'goodStandingLetter']),
      ...baseChecks('CLINICAL'),
    ],
    prohibitedClaims: ['psychologistTitle', 'medicalDiagnosis', 'prescribeMedication'],
    rx: { canPrescribe: 'no', maxSchedule: null, notes: 'No prescribing.' },
    requiresIoMTDefault: false,
    patientCategory: 'clinical',
  },

  speech_therapist: {
    professionKey: 'speech_therapist',
    tier: 'B',
    track: 'CLINICAL',
    primaryRegulator: 'HPCSA',
    requiredChecks: [
      regulatorPrimary('HPCSA', ['registrationProof', 'annualPracticeCertificate']),
      ...baseChecks('CLINICAL'),
    ],
    prohibitedClaims: ['medicalDoctorTitle', 'prescribeMedication'],
    rx: { canPrescribe: 'no', maxSchedule: null, notes: 'No prescribing.' },
    requiresIoMTDefault: false,
    patientCategory: 'clinical',
  },

  audiologist: {
    professionKey: 'audiologist',
    tier: 'B',
    track: 'CLINICAL',
    primaryRegulator: 'HPCSA',
    requiredChecks: [
      regulatorPrimary('HPCSA', ['registrationProof', 'annualPracticeCertificate']),
      ...baseChecks('CLINICAL'),
    ],
    prohibitedClaims: ['medicalDoctorTitle', 'prescribeMedication'],
    rx: { canPrescribe: 'no', maxSchedule: null, notes: 'No prescribing.' },
    requiresIoMTDefault: true,
    patientCategory: 'clinical',
  },

  physiotherapist: {
    professionKey: 'physiotherapist',
    tier: 'B',
    track: 'CLINICAL',
    primaryRegulator: 'HPCSA',
    requiredChecks: [
      regulatorPrimary('HPCSA', ['registrationProof', 'annualPracticeCertificate']),
      ...baseChecks('CLINICAL'),
    ],
    prohibitedClaims: ['medicalDoctorTitle', 'prescribeMedication'],
    rx: { canPrescribe: 'no', maxSchedule: null, notes: 'No prescribing.' },
    requiresIoMTDefault: false,
    patientCategory: 'clinical',
  },

  occupational_therapist: {
    professionKey: 'occupational_therapist',
    tier: 'B',
    track: 'CLINICAL',
    primaryRegulator: 'HPCSA',
    requiredChecks: [
      regulatorPrimary('HPCSA', ['registrationProof', 'annualPracticeCertificate']),
      ...baseChecks('CLINICAL'),
    ],
    prohibitedClaims: ['medicalDoctorTitle', 'prescribeMedication'],
    rx: { canPrescribe: 'no', maxSchedule: null, notes: 'No prescribing.' },
    requiresIoMTDefault: false,
    patientCategory: 'clinical',
  },

  biokineticist: {
    professionKey: 'biokineticist',
    tier: 'B',
    track: 'CLINICAL',
    primaryRegulator: 'HPCSA',
    requiredChecks: [
      regulatorPrimary('HPCSA', ['registrationProof', 'annualPracticeCertificate']),
      ...baseChecks('CLINICAL'),
    ],
    prohibitedClaims: ['diagnoseDisease', 'prescribeMedication'],
    rx: { canPrescribe: 'no', maxSchedule: null, notes: 'No prescribing.' },
    requiresIoMTDefault: false,
    patientCategory: 'clinical',
  },

  // ✅ Dietitian = B clinical (HPCSA)
  dietitian: {
    professionKey: 'dietitian',
    tier: 'B',
    track: 'CLINICAL',
    primaryRegulator: 'HPCSA',
    requiredChecks: [
      regulatorPrimary('HPCSA', ['registrationProof', 'annualPracticeCertificate']),
      ...baseChecks('CLINICAL'),
    ],
    prohibitedClaims: ['prescribeMedication', 'medicalDoctorTitle'],
    rx: { canPrescribe: 'no', maxSchedule: null, notes: 'No prescribing.' },
    requiresIoMTDefault: false,
    patientCategory: 'clinical',
  },

  // ✅ “Nutritionist” accepted ONLY if regulated (else title-normalise to nutrition_coach)
  nutritionist_regulated: {
    professionKey: 'nutritionist_regulated',
    tier: 'B',
    track: 'CLINICAL',
    primaryRegulator: 'HPCSA',
    requiredChecks: [
      regulatorPrimary('HPCSA', ['registrationProof', 'annualPracticeCertificate']),
      ...baseChecks('CLINICAL'),
    ],
    prohibitedClaims: ['prescribeMedication', 'medicalDoctorTitle'],
    rx: { canPrescribe: 'no', maxSchedule: null },
    requiresIoMTDefault: false,
    patientCategory: 'clinical',
  },

  // AHPCSA complementary (you can decide tier B or C — leaving as C is safer operationally)
  chiropractor: {
    professionKey: 'chiropractor',
    tier: 'C',
    track: 'CLINICAL',
    primaryRegulator: 'AHPCSA',
    requiredChecks: [
      regulatorPrimary('AHPCSA', ['registrationProof', 'annualPracticeCertificate']),
      ...baseChecks('CLINICAL'),
    ],
    prohibitedClaims: ['medicalDoctorTitle', 'prescribeMedication'],
    rx: { canPrescribe: 'no', maxSchedule: null },
    requiresIoMTDefault: false,
    patientCategory: 'clinical',
  },

  // Wellness / non-clinical
  life_coach: {
    professionKey: 'life_coach',
    tier: 'C',
    track: 'WELLNESS',
    primaryRegulator: 'OTHER',
    requiredChecks: [
      // No statutory regulator
      ...baseChecks('WELLNESS'),
    ],
    prohibitedClaims: ['therapist', 'psychologist', 'counsellor', 'treatTrauma', 'diagnose', 'prescribeMedication'],
    rx: { canPrescribe: 'no', maxSchedule: null },
    requiresIoMTDefault: false,
    patientCategory: 'wellness',
  },

  personal_trainer: {
    professionKey: 'personal_trainer',
    tier: 'C',
    track: 'WELLNESS',
    primaryRegulator: 'OTHER',
    requiredChecks: [
      ...baseChecks('WELLNESS'),
    ],
    prohibitedClaims: ['physiotherapist', 'biokineticist', 'rehabilitationClaims', 'diagnose', 'prescribeMedication'],
    rx: { canPrescribe: 'no', maxSchedule: null },
    requiresIoMTDefault: false,
    patientCategory: 'wellness',
  },

  // Non-regulated nutrition coach (what most “nutritionists” actually are)
  nutrition_coach: {
    professionKey: 'nutrition_coach',
    tier: 'C',
    track: 'WELLNESS',
    primaryRegulator: 'OTHER',
    requiredChecks: [
      ...baseChecks('WELLNESS'),
    ],
    prohibitedClaims: ['dietitian', 'treatMedicalConditions', 'diagnose', 'prescribeMedication'],
    rx: { canPrescribe: 'no', maxSchedule: null },
    requiresIoMTDefault: false,
    patientCategory: 'wellness',
  },
};

export function getPolicy(professionKey?: string | null): ProfessionPolicy | null {
  if (!professionKey) return null;
  return PROFESSION_POLICIES[professionKey] ?? null;
}

/**
 * Your backend seed mapping shape, derived from policy.
 * roleKey → class/tier → regulator → requiredDocs[] → prohibitedClaims[]
 */
export function policyToSeedJson() {
  const out: any = {};
  for (const [k, p] of Object.entries(PROFESSION_POLICIES)) {
    const requiredDocs = new Set<string>();
    for (const c of p.requiredChecks) (c.requiredDocs || []).forEach((d) => requiredDocs.add(d));
    if (p.rx.requiredDocs) p.rx.requiredDocs.forEach((d) => requiredDocs.add(d));

    out[k] = {
      class: p.tier,
      track: p.track,
      regulator: p.primaryRegulator,
      requiredDocs: Array.from(requiredDocs),
      prohibitedClaims: p.prohibitedClaims,
      rxAuthority: {
        canPrescribe: p.rx.canPrescribe === 'yes' ? true : p.rx.canPrescribe === 'conditional' ? 'conditional' : false,
        maxSchedule: p.rx.maxSchedule,
        notes: p.rx.notes ?? null,
      },
    };
  }
  return out;
}
