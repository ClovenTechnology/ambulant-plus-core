import { prisma } from '@/src/lib/db';

const SOURCE_VERSION = 'A7-C2-v1';

type AnyRecord = Record<string, any>;

export type CarePortPharmacyComplianceItem = {
  code: string;
  label: string;
  authority: string;
  required: boolean;
  present: boolean;
  applicable: boolean;
  expiresAt: string | null;
  status: 'PRESENT' | 'MISSING' | 'NOT_APPLICABLE' | 'EXPIRY_UNKNOWN' | 'EXPIRED';
  enforcementPoint: string;
  enforcementScope: string;
};

export type CarePortPharmacyComplianceProfile = {
  version: string;
  institution: {
    registeredName: string | null;
    registrationNumber: string | null;
    legalForm: string | null;
  };
  premises: {
    pharmacyCategory: string | null;
    yNumber: string | null;
    premisesLicenceNumber: string | null;
    licenceIssuedAt: string | null;
    licenceExpiresAt: string | null;
  };
  responsiblePharmacist: {
    fullName: string | null;
    pNumber: string | null;
    registrationNumber: string | null;
    registrationExpiresAt: string | null;
  };
  medicalScheme: {
    claimsEnabled: boolean;
    pcnsPracticeNumber: string | null;
    pcnsExpiresAt: string | null;
  };
  sahpra: {
    required: boolean;
    operations: string[];
    licenceNumber: string | null;
    licenceExpiresAt: string | null;
  };
  coldChain: {
    required: boolean;
    capable: boolean;
    monitoringMethod: string | null;
    minTempC: number | null;
    maxTempC: number | null;
    validationExpiresAt: string | null;
  };
  review: {
    notes: string | null;
    updatedAt: string;
  };
};

export type CarePortPharmacyComplianceSummary = {
  version: string;
  readyForRegulatedFulfilment: boolean;
  missingForRegulatedFulfilment: string[];
  capabilities: {
    medicalSchemeClaims: {
      applicable: boolean;
      ready: boolean;
      missing: string[];
    };
    sahpraRegulatedOperations: {
      applicable: boolean;
      ready: boolean;
      missing: string[];
    };
    coldChainFulfilment: {
      applicable: boolean;
      ready: boolean;
      missing: string[];
    };
  };
  items: CarePortPharmacyComplianceItem[];
};

function record(value: unknown): AnyRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as AnyRecord) : {};
}

function text(value: unknown, max = 240): string | null {
  const result = String(value ?? '').trim().slice(0, max);
  return result || null;
}

function bool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  const raw = String(value ?? '').trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on', 'enabled', 'required'].includes(raw)) return true;
  if (['false', '0', 'no', 'n', 'off', 'disabled', 'not_required'].includes(raw)) return false;
  return fallback;
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function isoDateOrNull(value: unknown): string | null {
  const raw = text(value, 80);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toISOString();
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '').trim()).filter(Boolean);
  }
  return String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function first(...values: unknown[]) {
  for (const value of values) {
    const result = text(value);
    if (result) return result;
  }
  return null;
}

function nested(source: AnyRecord, ...path: string[]) {
  let current: any = source;
  for (const part of path) {
    if (!current || typeof current !== 'object') return undefined;
    current = current[part];
  }
  return current;
}

function categoryImpliesSahpra(category: string | null) {
  const value = String(category || '').toUpperCase();
  return value.includes('WHOLESALE') || value.includes('MANUFACTUR');
}

function operationsImplySahpra(operations: string[]) {
  return operations.some((operation) =>
    /WHOLESALE|DISTRIBUT|MANUFACTUR|IMPORT|EXPORT/.test(operation.toUpperCase()),
  );
}

export function normalizeCarePortPharmacyCompliance(input: unknown): CarePortPharmacyComplianceProfile {
  const root = record(input);
  const payload = record(root.kycPayload ?? root.payload ?? root);
  const profile = record(root.complianceProfile ?? payload.complianceProfile ?? payload.pharmacyCompliance);
  const institution = record(profile.institution);
  const premises = record(profile.premises);
  const rp = record(profile.responsiblePharmacist);
  const medicalScheme = record(profile.medicalScheme);
  const sahpra = record(profile.sahpra);
  const coldChain = record(profile.coldChain);
  const review = record(profile.review);

  const organisation = record(payload.organisationIdentity);
  const operatingModel = record(payload.operatingModel);

  const pharmacyCategory = first(
    premises.pharmacyCategory,
    profile.pharmacyCategory,
    payload.pharmacyCategory,
    payload.category,
  );

  const operations = stringList(
    sahpra.operations ??
      profile.sahpraOperations ??
      payload.sahpraOperations ??
      payload.regulatedOperations,
  );

  const medicalAidAccepted = bool(
    medicalScheme.claimsEnabled ??
      profile.pcnsClaimsEnabled ??
      payload.pcnsClaimsEnabled ??
      operatingModel.acceptsMedicalAid ??
      root.acceptsMedicalAid,
    false,
  );

  const sahpraRequired =
    bool(
      sahpra.required ??
        profile.sahpraRequired ??
        payload.sahpraRequired,
      false,
    ) ||
    categoryImpliesSahpra(pharmacyCategory) ||
    operationsImplySahpra(operations);

  const coldChainRequired = bool(
    coldChain.required ??
      profile.coldChainRequired ??
      payload.coldChainRequired ??
      payload.handlesColdChain,
    false,
  );

  const yNumber = first(
    premises.yNumber,
    profile.yNumber,
    profile.sapcYNumber,
    payload.yNumber,
    payload.sapcYNumber,
    payload.sapcRegistrationNumber,
    organisation.sapcNumber,
    root.yNumber,
    root.sapcNumber,
    root.pharmacyCouncilNumber,
  );

  return {
    version: SOURCE_VERSION,
    institution: {
      registeredName: first(
        institution.registeredName,
        profile.registeredName,
        organisation.registeredName,
        organisation.legalName,
        root.registeredName,
      ),
      registrationNumber: first(
        institution.registrationNumber,
        profile.businessRegistrationNumber,
        payload.businessRegistrationNumber,
        payload.companyRegistrationNumber,
        organisation.registrationNumber,
        root.registrationNumber,
        root.companyRegistrationNumber,
      ),
      legalForm: first(
        institution.legalForm,
        profile.legalForm,
        payload.legalForm,
        payload.entityType,
      ),
    },
    premises: {
      pharmacyCategory,
      yNumber,
      premisesLicenceNumber: first(
        premises.premisesLicenceNumber,
        profile.pharmacyPremisesLicenceNumber,
        profile.ndohPharmacyLicenceNumber,
        payload.pharmacyPremisesLicenceNumber,
        payload.ndohPharmacyLicenceNumber,
        payload.pharmacyLicenceNumber,
        root.pharmacyPremisesLicenceNumber,
        root.ndohPharmacyLicenceNumber,
        root.licenseNumber,
      ),
      licenceIssuedAt: isoDateOrNull(
        premises.licenceIssuedAt ??
          profile.pharmacyPremisesLicenceIssuedAt ??
          payload.pharmacyPremisesLicenceIssuedAt,
      ),
      licenceExpiresAt: isoDateOrNull(
        premises.licenceExpiresAt ??
          profile.pharmacyPremisesLicenceExpiresAt ??
          payload.pharmacyPremisesLicenceExpiresAt,
      ),
    },
    responsiblePharmacist: {
      fullName: first(
        rp.fullName,
        profile.responsiblePharmacistName,
        payload.responsiblePharmacistName,
        root.responsiblePharmacistName,
      ),
      pNumber: first(
        rp.pNumber,
        profile.responsiblePharmacistPNumber,
        payload.responsiblePharmacistPNumber,
        payload.responsiblePharmacistRegistrationNumber,
        root.responsiblePharmacistPNumber,
        root.responsiblePharmacistRegistrationNumber,
      ),
      registrationNumber: first(
        rp.registrationNumber,
        profile.responsiblePharmacistRegistrationNumber,
        payload.responsiblePharmacistRegistrationNumber,
        rp.pNumber,
      ),
      registrationExpiresAt: isoDateOrNull(
        rp.registrationExpiresAt ??
          profile.responsiblePharmacistRegistrationExpiresAt ??
          payload.responsiblePharmacistRegistrationExpiresAt,
      ),
    },
    medicalScheme: {
      claimsEnabled: medicalAidAccepted,
      pcnsPracticeNumber: first(
        medicalScheme.pcnsPracticeNumber,
        profile.pcnsPracticeNumber,
        payload.pcnsPracticeNumber,
        payload.practiceNumber,
        root.pcnsPracticeNumber,
        root.practiceNumber,
      ),
      pcnsExpiresAt: isoDateOrNull(
        medicalScheme.pcnsExpiresAt ??
          profile.pcnsExpiresAt ??
          payload.pcnsExpiresAt,
      ),
    },
    sahpra: {
      required: sahpraRequired,
      operations,
      licenceNumber: first(
        sahpra.licenceNumber,
        profile.sahpraLicenceNumber,
        payload.sahpraLicenceNumber,
        payload.section22CLicenceNumber,
        root.sahpraLicenceNumber,
        root.section22CLicenceNumber,
      ),
      licenceExpiresAt: isoDateOrNull(
        sahpra.licenceExpiresAt ??
          profile.sahpraLicenceExpiresAt ??
          payload.sahpraLicenceExpiresAt,
      ),
    },
    coldChain: {
      required: coldChainRequired,
      capable: bool(
        coldChain.capable ??
          profile.coldChainCapable ??
          payload.coldChainCapable,
        false,
      ),
      monitoringMethod: first(
        coldChain.monitoringMethod,
        profile.coldChainMonitoringMethod,
        payload.coldChainMonitoringMethod,
      ),
      minTempC: numberOrNull(
        coldChain.minTempC ??
          profile.coldChainMinTempC ??
          payload.coldChainMinTempC,
      ),
      maxTempC: numberOrNull(
        coldChain.maxTempC ??
          profile.coldChainMaxTempC ??
          payload.coldChainMaxTempC,
      ),
      validationExpiresAt: isoDateOrNull(
        coldChain.validationExpiresAt ??
          profile.coldChainValidationExpiresAt ??
          payload.coldChainValidationExpiresAt,
      ),
    },
    review: {
      notes: first(review.notes, profile.reviewNotes, payload.complianceReviewNotes),
      updatedAt: new Date().toISOString(),
    },
  };
}


export function mergeCarePortPharmacyComplianceProfile(
  current: unknown,
  patch: unknown,
): CarePortPharmacyComplianceProfile {
  const base = normalizeCarePortPharmacyCompliance(current);
  const incoming = record(patch);
  const incomingInstitution = record(incoming.institution);
  const incomingPremises = record(incoming.premises);
  const incomingRp = record(incoming.responsiblePharmacist);
  const incomingMedicalScheme = record(incoming.medicalScheme);
  const incomingSahpra = record(incoming.sahpra);
  const incomingColdChain = record(incoming.coldChain);
  const incomingReview = record(incoming.review);

  return normalizeCarePortPharmacyCompliance({
    complianceProfile: {
      version: SOURCE_VERSION,
      institution: { ...base.institution, ...incomingInstitution },
      premises: { ...base.premises, ...incomingPremises },
      responsiblePharmacist: { ...base.responsiblePharmacist, ...incomingRp },
      medicalScheme: { ...base.medicalScheme, ...incomingMedicalScheme },
      sahpra: { ...base.sahpra, ...incomingSahpra },
      coldChain: { ...base.coldChain, ...incomingColdChain },
      review: { ...base.review, ...incomingReview },
    },
  });
}

function itemStatus(required: boolean, applicable: boolean, value: string | null, expiresAt: string | null) {
  if (!applicable) return 'NOT_APPLICABLE' as const;
  if (!value) return required ? ('MISSING' as const) : ('MISSING' as const);
  if (expiresAt) {
    const date = new Date(expiresAt);
    if (!Number.isNaN(date.getTime()) && date.getTime() < Date.now()) {
      return 'EXPIRED' as const;
    }
  }
  return expiresAt ? ('PRESENT' as const) : ('EXPIRY_UNKNOWN' as const);
}

export function summarizeCarePortPharmacyCompliance(
  input: CarePortPharmacyComplianceProfile | unknown,
): CarePortPharmacyComplianceSummary {
  const profile =
    record(input).version === SOURCE_VERSION
      ? (input as CarePortPharmacyComplianceProfile)
      : normalizeCarePortPharmacyCompliance(input);

  const businessValue = profile.institution.registrationNumber;
  const yNumber = profile.premises.yNumber;
  const premisesLicence = profile.premises.premisesLicenceNumber;
  const rpNumber = profile.responsiblePharmacist.pNumber || profile.responsiblePharmacist.registrationNumber;
  const pcnsNumber = profile.medicalScheme.pcnsPracticeNumber;
  const sahpraNumber = profile.sahpra.licenceNumber;
  const coldChainValue = profile.coldChain.capable ? 'CAPABLE' : null;

  const items: CarePortPharmacyComplianceItem[] = [
    {
      code: 'CAREPORT_PHARMACY_BUSINESS_REGISTRATION',
      label: 'Institution / business registration',
      authority: 'CIPC / applicable business registry',
      required: false,
      present: Boolean(businessValue),
      applicable: true,
      expiresAt: null,
      status: businessValue ? 'PRESENT' : 'MISSING',
      enforcementPoint: 'SUBMISSION_GATE',
      enforcementScope: 'INSTITUTION_IDENTITY',
    },
    {
      code: 'CAREPORT_PHARMACY_SAPC_PREMISES_REGISTRATION',
      label: 'SAPC pharmacy registration / Y-number',
      authority: 'South African Pharmacy Council',
      required: true,
      present: Boolean(yNumber),
      applicable: true,
      expiresAt: null,
      status: yNumber ? 'PRESENT' : 'MISSING',
      enforcementPoint: 'PRIVILEGE_GATE',
      enforcementScope: 'CAREPORT_DISPENSING_FULFILMENT',
    },
    {
      code: 'CAREPORT_PHARMACY_NDOH_PREMISES_LICENCE',
      label: 'Pharmacy premises licence',
      authority: 'National Department of Health',
      required: true,
      present: Boolean(premisesLicence),
      applicable: true,
      expiresAt: profile.premises.licenceExpiresAt,
      status: itemStatus(true, true, premisesLicence, profile.premises.licenceExpiresAt),
      enforcementPoint: 'PRIVILEGE_GATE',
      enforcementScope: 'CAREPORT_DISPENSING_FULFILMENT',
    },
    {
      code: 'CAREPORT_PHARMACY_RESPONSIBLE_PHARMACIST',
      label: 'Responsible pharmacist registration',
      authority: 'South African Pharmacy Council',
      required: true,
      present: Boolean(rpNumber),
      applicable: true,
      expiresAt: profile.responsiblePharmacist.registrationExpiresAt,
      status: itemStatus(true, true, rpNumber, profile.responsiblePharmacist.registrationExpiresAt),
      enforcementPoint: 'PRIVILEGE_GATE',
      enforcementScope: 'CAREPORT_DISPENSING_FULFILMENT',
    },
    {
      code: 'CAREPORT_PHARMACY_PCNS',
      label: 'PCNS practice number',
      authority: 'Board of Healthcare Funders / PCNS',
      required: profile.medicalScheme.claimsEnabled,
      present: Boolean(pcnsNumber),
      applicable: profile.medicalScheme.claimsEnabled,
      expiresAt: profile.medicalScheme.pcnsExpiresAt,
      status: itemStatus(
        profile.medicalScheme.claimsEnabled,
        profile.medicalScheme.claimsEnabled,
        pcnsNumber,
        profile.medicalScheme.pcnsExpiresAt,
      ),
      enforcementPoint: 'PRIVILEGE_GATE',
      enforcementScope: 'MEDICAL_SCHEME_CLAIMS',
    },
    {
      code: 'CAREPORT_PHARMACY_SAHPRA_22C',
      label: 'SAHPRA section 22C establishment licence',
      authority: 'SAHPRA',
      required: profile.sahpra.required,
      present: Boolean(sahpraNumber),
      applicable: profile.sahpra.required,
      expiresAt: profile.sahpra.licenceExpiresAt,
      status: itemStatus(
        profile.sahpra.required,
        profile.sahpra.required,
        sahpraNumber,
        profile.sahpra.licenceExpiresAt,
      ),
      enforcementPoint: 'PRIVILEGE_GATE',
      enforcementScope: 'WHOLESALE_MANUFACTURE_IMPORT_EXPORT_DISTRIBUTION',
    },
    {
      code: 'CAREPORT_PHARMACY_COLD_CHAIN',
      label: 'Cold-chain capability assurance',
      authority: 'Ambulant+ operational policy',
      required: profile.coldChain.required,
      present: profile.coldChain.capable,
      applicable: profile.coldChain.required,
      expiresAt: profile.coldChain.validationExpiresAt,
      status: itemStatus(
        profile.coldChain.required,
        profile.coldChain.required,
        coldChainValue,
        profile.coldChain.validationExpiresAt,
      ),
      enforcementPoint: 'PRIVILEGE_GATE',
      enforcementScope: 'COLD_CHAIN_FULFILMENT',
    },
  ];

  const blocking = (scope: string) =>
    items
      .filter(
        (item) =>
          item.enforcementScope === scope &&
          item.required &&
          item.applicable &&
          ['MISSING', 'EXPIRED'].includes(item.status),
      )
      .map((item) => item.code);

  // Core CarePort dispensing/fulfilment is intentionally separate from optional
  // capabilities. Missing PCNS, section 22C or cold-chain assurance must disable
  // only those capabilities rather than blocking a pharmacy from the whole
  // CarePort workspace or otherwise-compliant retail fulfilment.
  const missingForRegulatedFulfilment = blocking('CAREPORT_DISPENSING_FULFILMENT');
  const medicalSchemeClaimsMissing = blocking('MEDICAL_SCHEME_CLAIMS');
  const sahpraOperationsMissing = blocking('WHOLESALE_MANUFACTURE_IMPORT_EXPORT_DISTRIBUTION');
  const coldChainMissing = blocking('COLD_CHAIN_FULFILMENT');

  return {
    version: SOURCE_VERSION,
    readyForRegulatedFulfilment: missingForRegulatedFulfilment.length === 0,
    missingForRegulatedFulfilment,
    capabilities: {
      medicalSchemeClaims: {
        applicable: profile.medicalScheme.claimsEnabled,
        ready: !profile.medicalScheme.claimsEnabled || medicalSchemeClaimsMissing.length === 0,
        missing: medicalSchemeClaimsMissing,
      },
      sahpraRegulatedOperations: {
        applicable: profile.sahpra.required,
        ready: !profile.sahpra.required || sahpraOperationsMissing.length === 0,
        missing: sahpraOperationsMissing,
      },
      coldChainFulfilment: {
        applicable: profile.coldChain.required,
        ready: !profile.coldChain.required || coldChainMissing.length === 0,
        missing: coldChainMissing,
      },
    },
    items,
  };
}

const CONTROL_RULES = [
  {
    code: 'CAREPORT_PHARMACY_BUSINESS_REGISTRATION',
    title: 'CarePort pharmacy institution identity',
    description: 'Capture legal entity or business-registration identity separately from pharmacy licensing.',
    authorityClass: 'CORPORATE_REGISTRY_CONDITIONAL',
    enforcementClass: 'MANUAL_REVIEW',
    enforcementPoint: 'SUBMISSION_GATE',
    enforcementScope: 'INSTITUTION_IDENTITY',
    sourceAuthority: 'CIPC / applicable business registry',
    primarySource: 'https://www.cipc.co.za/',
  },
  {
    code: 'CAREPORT_PHARMACY_SAPC_PREMISES_REGISTRATION',
    title: 'CarePort pharmacy SAPC registration / Y-number',
    description: 'Pharmacy premises registration identifier held separately from the pharmacy premises licence.',
    authorityClass: 'REGULATORY',
    enforcementClass: 'HARD_PRIVILEGE_GATE',
    enforcementPoint: 'PRIVILEGE_GATE',
    enforcementScope: 'CAREPORT_DISPENSING_FULFILMENT',
    sourceAuthority: 'South African Pharmacy Council',
    primarySource: 'https://www.sapc.za.org/',
  },
  {
    code: 'CAREPORT_PHARMACY_NDOH_PREMISES_LICENCE',
    title: 'CarePort pharmacy premises licence',
    description: 'Pharmacy premises licence issued through the National Department of Health licensing process.',
    authorityClass: 'STATUTORY',
    enforcementClass: 'HARD_PRIVILEGE_GATE',
    enforcementPoint: 'PRIVILEGE_GATE',
    enforcementScope: 'CAREPORT_DISPENSING_FULFILMENT',
    sourceAuthority: 'National Department of Health',
    primarySource: 'https://www.health.gov.za/licensing-forms/',
  },
  {
    code: 'CAREPORT_PHARMACY_RESPONSIBLE_PHARMACIST',
    title: 'CarePort responsible pharmacist registration',
    description: 'Registered responsible pharmacist linked to the pharmacy premises.',
    authorityClass: 'REGULATORY',
    enforcementClass: 'HARD_PRIVILEGE_GATE',
    enforcementPoint: 'PRIVILEGE_GATE',
    enforcementScope: 'CAREPORT_DISPENSING_FULFILMENT',
    sourceAuthority: 'South African Pharmacy Council',
    primarySource: 'https://www.sapc.za.org/Responsible_Overview-2',
  },
  {
    code: 'CAREPORT_PHARMACY_PCNS',
    title: 'CarePort pharmacy PCNS practice number',
    description: 'Conditional practice-code requirement for medical-scheme reimbursement workflows.',
    authorityClass: 'FUNDING_CONDITIONAL',
    enforcementClass: 'CAPABILITY_GATE',
    enforcementPoint: 'PRIVILEGE_GATE',
    enforcementScope: 'MEDICAL_SCHEME_CLAIMS',
    sourceAuthority: 'Board of Healthcare Funders / PCNS',
    primarySource: 'https://www.pcns.co.za/ApplicationForms/Pharmacy?class=elements',
  },
  {
    code: 'CAREPORT_PHARMACY_SAHPRA_22C',
    title: 'CarePort conditional SAHPRA section 22C licence',
    description: 'Conditional establishment licence for wholesale, distribution, manufacture, import or export activities.',
    authorityClass: 'STATUTORY_CONDITIONAL',
    enforcementClass: 'CAPABILITY_GATE',
    enforcementPoint: 'PRIVILEGE_GATE',
    enforcementScope: 'WHOLESALE_MANUFACTURE_IMPORT_EXPORT_DISTRIBUTION',
    sourceAuthority: 'SAHPRA',
    primarySource: 'https://www.sahpra.org.za/licences-and-permits/',
  },
  {
    code: 'CAREPORT_PHARMACY_COLD_CHAIN',
    title: 'CarePort cold-chain capability',
    description: 'Operational assurance for temperature-sensitive medicine fulfilment; not a universal pharmacy requirement.',
    authorityClass: 'AMBULANT_POLICY',
    enforcementClass: 'CAPABILITY_GATE',
    enforcementPoint: 'PRIVILEGE_GATE',
    enforcementScope: 'COLD_CHAIN_FULFILMENT',
    sourceAuthority: 'Ambulant+',
    primarySource: null,
  },
] as const;

export async function ensureCarePortPharmacyComplianceRules(
  orgId: string,
  actorUserId?: string | null,
  db: any = prisma,
) {
  for (const rule of CONTROL_RULES) {
    await db.complianceControlRule.upsert({
      where: {
        orgId_code: {
          orgId,
          code: rule.code,
        },
      },
      create: {
        orgId,
        code: rule.code,
        title: rule.title,
        description: rule.description,
        authorityClass: rule.authorityClass,
        enforcementClass: rule.enforcementClass,
        enforcementPoint: rule.enforcementPoint,
        enforcementScope: rule.enforcementScope,
        applicability: { holderType: 'CAREPORT_PHARMACY', jurisdiction: 'ZA' },
        jurisdiction: 'ZA',
        sourceAuthority: rule.sourceAuthority,
        sourceVersion: SOURCE_VERSION,
        primarySource: rule.primarySource,
        status: 'ACTIVE',
        createdByUserId: actorUserId || null,
        updatedByUserId: actorUserId || null,
      },
      update: {
        title: rule.title,
        description: rule.description,
        authorityClass: rule.authorityClass,
        enforcementClass: rule.enforcementClass,
        enforcementPoint: rule.enforcementPoint,
        enforcementScope: rule.enforcementScope,
        applicability: { holderType: 'CAREPORT_PHARMACY', jurisdiction: 'ZA' },
        jurisdiction: 'ZA',
        sourceAuthority: rule.sourceAuthority,
        sourceVersion: SOURCE_VERSION,
        primarySource: rule.primarySource,
        status: 'ACTIVE',
        updatedByUserId: actorUserId || null,
      },
    });
  }
}

function stateFor(expiresAt: string | null, expiryExpected: boolean) {
  if (!expiresAt) return expiryExpected ? 'EXPIRY_UNKNOWN' : 'VALID';
  const parsed = new Date(expiresAt);
  if (Number.isNaN(parsed.getTime())) return 'EXPIRY_UNKNOWN';
  return parsed.getTime() < Date.now() ? 'EXPIRED' : 'VALID';
}

async function upsertCredential(input: {
  orgId: string;
  pharmacy: AnyRecord;
  actorUserId?: string | null;
  credentialType: string;
  credentialLabel: string;
  credentialNumber: string | null;
  issuingAuthority: string;
  authorityClass: string;
  enforcementClass: string;
  enforcementPoint: string;
  enforcementScope: string;
  expiresAt: string | null;
  applicable: boolean;
  expiryExpected: boolean;
  metadata?: AnyRecord;
  db?: any;
}) {
  const {
    orgId,
    pharmacy,
    actorUserId,
    credentialType,
    credentialLabel,
    credentialNumber,
    issuingAuthority,
    authorityClass,
    enforcementClass,
    enforcementPoint,
    enforcementScope,
    expiresAt,
    applicable,
    expiryExpected,
    metadata,
    db = prisma,
  } = input;

  const existing = await db.complianceCredential.findFirst({
    where: {
      orgId,
      holderType: 'CAREPORT_PHARMACY',
      holderId: pharmacy.id,
      credentialType,
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (!applicable) {
    if (existing) {
      await db.complianceCredential.update({
        where: { id: existing.id },
        data: {
          state: 'NOT_APPLICABLE',
          applicability: { applicable: false },
          updatedByUserId: actorUserId || null,
          metadata: {
            ...(record(existing.metadata)),
            source: SOURCE_VERSION,
            ...(metadata || {}),
          },
        },
      });
    }
    return;
  }

  if (!credentialNumber) return;

  const expiresAtDate = expiresAt && !Number.isNaN(new Date(expiresAt).getTime()) ? new Date(expiresAt) : null;
  const data = {
    orgId,
    holderType: 'CAREPORT_PHARMACY',
    holderSubtype: text(pharmacy.kycSchemaKey, 120) || 'PHARMACY',
    holderId: pharmacy.id,
    holderName: text(pharmacy.name, 240) || pharmacy.id,
    holderEmail: text(nested(record(pharmacy.kycPayload), 'responsibleContact', 'email'), 320),
    credentialType,
    credentialLabel,
    credentialNumber,
    issuingAuthority,
    controlCode: credentialType,
    authorityClass,
    enforcementClass,
    enforcementPoint,
    enforcementScope,
    jurisdiction: text(pharmacy.country, 8) || 'ZA',
    applicability: { applicable: true },
    expiresAt: expiresAtDate,
    state: stateFor(expiresAt, expiryExpected),
    verificationMethod: 'ADMIN_REVIEW',
    verifiedAt: new Date(),
    verifiedByUserId: actorUserId || null,
    reminderDays: [30, 14, 7, 1],
    autoRemindersEnabled: Boolean(expiresAtDate),
    metadata: {
      source: SOURCE_VERSION,
      ...(metadata || {}),
    },
    updatedByUserId: actorUserId || null,
  };

  if (existing) {
    await db.complianceCredential.update({
      where: { id: existing.id },
      data,
    });
    return;
  }

  await db.complianceCredential.create({
    data: {
      ...data,
      createdByUserId: actorUserId || null,
    },
  });
}

export async function syncCarePortPharmacyComplianceCredentials(input: {
  orgId: string;
  pharmacy: AnyRecord;
  profile: CarePortPharmacyComplianceProfile;
  actorUserId?: string | null;
  db?: any;
}) {
  const { orgId, pharmacy, profile, actorUserId, db = prisma } = input;

  await ensureCarePortPharmacyComplianceRules(orgId, actorUserId, db);

  await upsertCredential({
    orgId,
    pharmacy,
    actorUserId,
    db,
    credentialType: 'CAREPORT_PHARMACY_BUSINESS_REGISTRATION',
    credentialLabel: 'Institution / business registration',
    credentialNumber: profile.institution.registrationNumber,
    issuingAuthority: 'CIPC / applicable business registry',
    authorityClass: 'CORPORATE_REGISTRY_CONDITIONAL',
    enforcementClass: 'MANUAL_REVIEW',
    enforcementPoint: 'SUBMISSION_GATE',
    enforcementScope: 'INSTITUTION_IDENTITY',
    expiresAt: null,
    applicable: Boolean(profile.institution.registrationNumber),
    expiryExpected: false,
  });

  await upsertCredential({
    orgId,
    pharmacy,
    actorUserId,
    db,
    credentialType: 'CAREPORT_PHARMACY_SAPC_PREMISES_REGISTRATION',
    credentialLabel: 'SAPC pharmacy registration / Y-number',
    credentialNumber: profile.premises.yNumber,
    issuingAuthority: 'South African Pharmacy Council',
    authorityClass: 'REGULATORY',
    enforcementClass: 'HARD_PRIVILEGE_GATE',
    enforcementPoint: 'PRIVILEGE_GATE',
    enforcementScope: 'CAREPORT_DISPENSING_FULFILMENT',
    expiresAt: null,
    applicable: true,
    expiryExpected: false,
  });

  await upsertCredential({
    orgId,
    pharmacy,
    actorUserId,
    db,
    credentialType: 'CAREPORT_PHARMACY_NDOH_PREMISES_LICENCE',
    credentialLabel: 'Pharmacy premises licence',
    credentialNumber: profile.premises.premisesLicenceNumber,
    issuingAuthority: 'National Department of Health',
    authorityClass: 'STATUTORY',
    enforcementClass: 'HARD_PRIVILEGE_GATE',
    enforcementPoint: 'PRIVILEGE_GATE',
    enforcementScope: 'CAREPORT_DISPENSING_FULFILMENT',
    expiresAt: profile.premises.licenceExpiresAt,
    applicable: true,
    expiryExpected: Boolean(profile.premises.licenceExpiresAt),
    metadata: { pharmacyCategory: profile.premises.pharmacyCategory },
  });

  await upsertCredential({
    orgId,
    pharmacy,
    actorUserId,
    db,
    credentialType: 'CAREPORT_PHARMACY_RESPONSIBLE_PHARMACIST',
    credentialLabel: 'Responsible pharmacist registration',
    credentialNumber:
      profile.responsiblePharmacist.pNumber ||
      profile.responsiblePharmacist.registrationNumber,
    issuingAuthority: 'South African Pharmacy Council',
    authorityClass: 'REGULATORY',
    enforcementClass: 'HARD_PRIVILEGE_GATE',
    enforcementPoint: 'PRIVILEGE_GATE',
    enforcementScope: 'CAREPORT_DISPENSING_FULFILMENT',
    expiresAt: profile.responsiblePharmacist.registrationExpiresAt,
    applicable: true,
    expiryExpected: Boolean(profile.responsiblePharmacist.registrationExpiresAt),
    metadata: { responsiblePharmacistName: profile.responsiblePharmacist.fullName },
  });

  await upsertCredential({
    orgId,
    pharmacy,
    actorUserId,
    db,
    credentialType: 'CAREPORT_PHARMACY_PCNS',
    credentialLabel: 'PCNS practice number',
    credentialNumber: profile.medicalScheme.pcnsPracticeNumber,
    issuingAuthority: 'Board of Healthcare Funders / PCNS',
    authorityClass: 'FUNDING_CONDITIONAL',
    enforcementClass: 'CAPABILITY_GATE',
    enforcementPoint: 'PRIVILEGE_GATE',
    enforcementScope: 'MEDICAL_SCHEME_CLAIMS',
    expiresAt: profile.medicalScheme.pcnsExpiresAt,
    applicable: profile.medicalScheme.claimsEnabled,
    expiryExpected: profile.medicalScheme.claimsEnabled,
  });

  await upsertCredential({
    orgId,
    pharmacy,
    actorUserId,
    db,
    credentialType: 'CAREPORT_PHARMACY_SAHPRA_22C',
    credentialLabel: 'SAHPRA section 22C establishment licence',
    credentialNumber: profile.sahpra.licenceNumber,
    issuingAuthority: 'SAHPRA',
    authorityClass: 'STATUTORY_CONDITIONAL',
    enforcementClass: 'CAPABILITY_GATE',
    enforcementPoint: 'PRIVILEGE_GATE',
    enforcementScope: 'WHOLESALE_MANUFACTURE_IMPORT_EXPORT_DISTRIBUTION',
    expiresAt: profile.sahpra.licenceExpiresAt,
    applicable: profile.sahpra.required,
    expiryExpected: profile.sahpra.required,
    metadata: { operations: profile.sahpra.operations },
  });

  await upsertCredential({
    orgId,
    pharmacy,
    actorUserId,
    db,
    credentialType: 'CAREPORT_PHARMACY_COLD_CHAIN',
    credentialLabel: 'Cold-chain capability assurance',
    credentialNumber: profile.coldChain.capable ? 'CAPABLE' : null,
    issuingAuthority: 'Ambulant+ operational policy',
    authorityClass: 'AMBULANT_POLICY',
    enforcementClass: 'CAPABILITY_GATE',
    enforcementPoint: 'PRIVILEGE_GATE',
    enforcementScope: 'COLD_CHAIN_FULFILMENT',
    expiresAt: profile.coldChain.validationExpiresAt,
    applicable: profile.coldChain.required,
    expiryExpected: profile.coldChain.required,
    metadata: {
      monitoringMethod: profile.coldChain.monitoringMethod,
      minTempC: profile.coldChain.minTempC,
      maxTempC: profile.coldChain.maxTempC,
    },
  });
}
