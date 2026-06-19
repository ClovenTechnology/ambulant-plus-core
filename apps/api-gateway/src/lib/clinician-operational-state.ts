import {
  computeClinicianReadiness,
  type CheckRow,
} from '@/src/lib/credentialing/readiness';
import { getPolicy } from '@/src/lib/credentialing/policies';
import {
  computeClinicianActivationState,
  extractRawProfile,
} from '@/src/lib/clinician-activation';

type AnyObj = Record<string, any>;

function cleanStr(v: unknown, max = 240): string | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

/* ✅ NEW: robust normalization helper */
function normalizeProfessionKey(value: unknown): string | null {
  const raw = cleanStr(value, 120);
  if (!raw) return null;

  const s = raw
    .toLowerCase()
    .replace(/[^\w]+/g, '_')
    .replace(/^_+|_+$/g, '');

  const aliases: Record<string, string> = {
    medical_specialist: 'specialist',
    consultant: 'specialist',
    consultant_specialist: 'specialist',

    oncology: 'specialist',
    oncologist: 'specialist',
    cardiology: 'specialist',
    cardiologist: 'specialist',
    dermatology: 'specialist',
    dermatologist: 'specialist',
    paediatrics: 'specialist',
    paediatrician: 'specialist',
    pediatrics: 'specialist',
    pediatrician: 'specialist',
    obstetrics_gynaecology: 'specialist',
    obstetrics_and_gynaecology: 'specialist',
    obstetrics_gynecology: 'specialist',
    obstetrics_and_gynecology: 'specialist',
    gynaecology: 'specialist',
    gynecology: 'specialist',
    obstetrician_gynaecologist: 'specialist',
    psychiatrist: 'specialist',
    psychiatry: 'specialist',
    neurologist: 'specialist',
    neurology: 'specialist',
    orthopaedics: 'specialist',
    orthopedics: 'specialist',
    orthopaedic_surgeon: 'specialist',
    general_surgery: 'specialist',
    surgeon: 'specialist',
    ent: 'specialist',
    ophthalmology: 'specialist',
    ophthalmologist: 'specialist',
    urology: 'specialist',
    urologist: 'specialist',
    nephrology: 'specialist',
    nephrologist: 'specialist',
    endocrinology: 'specialist',
    endocrinologist: 'specialist',
    gastroenterology: 'specialist',
    gastroenterologist: 'specialist',
    pulmonology: 'specialist',
    pulmonologist: 'specialist',
    respiratory_medicine: 'specialist',
    rheumatology: 'specialist',
    rheumatologist: 'specialist',
    radiology: 'specialist',
    radiologist: 'specialist',
    pathology: 'specialist',
    pathologist: 'specialist',
    anaesthetics: 'specialist',
    anaesthetist: 'specialist',
    anesthesiology: 'specialist',
    anesthesiologist: 'specialist',
    emergency_medicine: 'specialist',
    emergency_physician: 'specialist',

    gp: 'gp',
    general_practice: 'gp',
    general_practitioner: 'gp',
    family_physician: 'gp',
    family_doctor: 'gp',
    doctor: 'gp',
    medical_doctor: 'gp',
    physician: 'gp',

    specialist: 'specialist',
    dentist: 'dentist',
    professional_nurse: 'professional_nurse',
    phc_nurse_prescriber: 'phc_nurse_prescriber',
    pharmacist: 'pharmacist',
    pharmacist_pcdt: 'pharmacist_pcdt',
    psychologist: 'psychologist',
    physiotherapist: 'physiotherapist',
    dietitian: 'dietitian',
  };

  return aliases[s] || s;
}

function safeParseObjectForOperational(value: unknown): AnyObj {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as AnyObj;

  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as AnyObj)
      : {};
  } catch {
    return {};
  }
}

function hasRealPatientApproval(clinician: AnyObj, rawProfile: AnyObj): boolean {
  const meta = safeParseObjectForOperational(clinician?.meta);
  const metadata = safeParseObjectForOperational(clinician?.metadata);
  const approval = safeParseObjectForOperational(
    meta.realPatientApproval ??
      metadata.realPatientApproval ??
      rawProfile?.realPatientApproval,
  );

  return Boolean(
    meta.adminFinalApproved === true ||
      metadata.adminFinalApproved === true ||
      rawProfile?.adminFinalApproved === true ||
      meta.patientVisible === true ||
      metadata.patientVisible === true ||
      rawProfile?.patientVisible === true ||
      meta.realPatientApprovedAt ||
      metadata.realPatientApprovedAt ||
      rawProfile?.realPatientApprovedAt ||
      approval.approved === true ||
      approval.approvedAt,
  );
}

function normalizeWorkspaceClaims(rawProfile: AnyObj): string[] {
  const arr = Array.isArray(rawProfile?.workspaceClaims)
    ? rawProfile.workspaceClaims
    : Array.isArray(rawProfile?.workspaces)
      ? rawProfile.workspaces
      : [];
  return Array.from(
    new Set(
      arr
        .map((x) => String(x || '').trim())
        .filter(Boolean),
    ),
  );
}

function defaultWorkspacesForPolicy(policy: ReturnType<typeof getPolicy>): string[] {
  if (!policy) return [];
  if (policy.track === 'WELLNESS') {
    return ['wellness'];
  }

  const base = ['televisit', 'encounters', 'referrals', 'certificates', 'collaboration'];

  if (policy.rx.canPrescribe === 'yes' || policy.rx.canPrescribe === 'conditional') {
    base.push('erx');
  }

  return base;
}

function intersectAllowedWorkspaces(
  requested: string[],
  policyDefaults: string[],
  canPrescribe: boolean,
) {
  const baseline = requested.length > 0 ? requested : policyDefaults;

  return baseline.filter((w) => {
    if (w === 'erx') return canPrescribe;
    return true;
  });
}

export type ClinicianOperationalState = {
  professionKey: string | null;
  policyFound: boolean;
  track: 'CLINICAL' | 'WELLNESS' | null;
  tier: 'A' | 'B' | 'C' | null;

  canPractice: boolean;
  canBeListed: boolean;
  canBeBooked: boolean;

  canPrescribe: boolean;
  prescribingMode: 'no' | 'conditional' | 'yes';
  maxRxSchedule: number | null;

  allowedWorkspaces: string[];
  patientCategory: 'clinical' | 'wellness' | null;

  activation: ReturnType<typeof computeClinicianActivationState>;
  readiness: ReturnType<typeof computeClinicianReadiness>;

  blockers: string[];
  riskFlags: string[];

  credentialing: {
    regulatorBody: string | null;
    regulatorRegistration: string | null;
    ambulantId: string | null;
  };
};

export function computeClinicianOperationalState(args: {
  clinician: AnyObj;
  onboarding?: AnyObj | null;
  trainingSlot?: AnyObj | null;
  dispatch?: AnyObj | null;
  checks?: CheckRow[];
}) {
  const clinician = args.clinician || {};
  const checks = Array.isArray(args.checks) ? args.checks : [];

  const rawProfile = extractRawProfile(clinician);

  /* ✅ REPLACED: normalized profession resolution */
  const professionKey =
    normalizeProfessionKey(rawProfile?.professionKey) ||
    normalizeProfessionKey(rawProfile?.roleKey) ||
    normalizeProfessionKey(rawProfile?.profession) ||
    normalizeProfessionKey(clinician?.professionKey) ||
    normalizeProfessionKey(clinician?.specialty) ||
    null;

  const policy = getPolicy(professionKey);

  const activation = computeClinicianActivationState({
    clinician,
    onboarding: args.onboarding || null,
    trainingSlot: args.trainingSlot || null,
    dispatch: args.dispatch || null,
  });

  const readiness = computeClinicianReadiness({
    clinician: {
      id: String(clinician?.id || ''),
      status: String(clinician?.status || ''),
      disabled: !!clinician?.disabled,
      archived: !!clinician?.archived,
      trainingCompleted: !!clinician?.trainingCompleted,
      professionKey,
      bookingEnabled:
        typeof clinician?.bookingEnabled === 'boolean'
          ? clinician.bookingEnabled
          : null,
    },
    checks,
  });

  const legacyApprovalAllowsBooking =
    !!policy &&
    activation.visibleToPatients &&
    String(clinician?.status || '').toLowerCase() === 'active' &&
    !!clinician?.trainingCompleted &&
    hasRealPatientApproval(clinician, rawProfile) &&
    readiness.bucket === 'missing_compliance' &&
    readiness.blockers.length === 0;

  const effectiveOkToBook = readiness.okToBook || legacyApprovalAllowsBooking;
  const outputReadinessBlockers = legacyApprovalAllowsBooking ? [] : readiness.blockers;
  const outputMissingChecks = legacyApprovalAllowsBooking ? [] : readiness.missingChecks;

  const prescribingMode = policy?.rx.canPrescribe ?? 'no';

  const hasPrescribingAuthorityCheck =
    checks.some(
      (c) =>
        c.kind === 'PRESCRIBING_AUTHORITY' &&
        (c.status === 'approved' || c.status === 'waived'),
    );

  const canPrescribe =
    prescribingMode === 'yes'
      ? readiness.okToBook && activation.canPractice
      : prescribingMode === 'conditional'
        ? readiness.okToBook && activation.canPractice && hasPrescribingAuthorityCheck
        : false;

  const claimedWorkspaces = normalizeWorkspaceClaims(rawProfile);
  const policyWorkspaces = defaultWorkspacesForPolicy(policy);
  const allowedWorkspaces = intersectAllowedWorkspaces(
    claimedWorkspaces,
    policyWorkspaces,
    canPrescribe,
  );

  const blockers = Array.from(
    new Set([
      ...(Array.isArray(activation.blockers) ? activation.blockers : []),
      ...(Array.isArray(outputReadinessBlockers) ? outputReadinessBlockers : []),
      ...outputMissingChecks.map((m) =>
        `missing_check:${m.kind}${m.regulator ? `:${m.regulator}` : ''}`,
      ),
    ]),
  );

  const riskFlags: string[] = [];

  if (!policy) riskFlags.push('unknown_profession_policy');
  if (legacyApprovalAllowsBooking) riskFlags.push('legacy_real_patient_approval_used_for_booking');
  if (activation.blockers.includes('smart_id_not_issued')) riskFlags.push('smart_id_not_issued_warning');
  if (prescribingMode === 'conditional' && !hasPrescribingAuthorityCheck) {
    riskFlags.push('conditional_prescribing_authority_not_approved');
  }
  if (
    prescribingMode !== 'no' &&
    !canPrescribe &&
    allowedWorkspaces.includes('erx')
  ) {
    riskFlags.push('workspace_erx_without_prescribing_clearance');
  }

  return {
    professionKey,
    policyFound: !!policy,
    track: policy?.track ?? null,
    tier: policy?.tier ?? null,

    canPractice: activation.canPractice,
    canBeListed: activation.visibleToPatients,
    canBeBooked: effectiveOkToBook && activation.visibleToPatients,

    canPrescribe,
    prescribingMode,
    maxRxSchedule: canPrescribe ? policy?.rx.maxSchedule ?? null : null,

    allowedWorkspaces,
    patientCategory: policy?.patientCategory ?? null,

    activation,
    readiness,

    blockers,
    riskFlags,

    credentialing: {
      regulatorBody:
        cleanStr(clinician?.regulatorBody, 80) ||
        cleanStr(rawProfile?.regulatorBody, 80) ||
        policy?.primaryRegulator ||
        null,
      regulatorRegistration:
        cleanStr(clinician?.regulatorRegistration, 120) ||
        cleanStr(rawProfile?.regulatorRegistration, 120) ||
        null,
      ambulantId: activation.ambulantId,
    },
  } satisfies ClinicianOperationalState;
}
