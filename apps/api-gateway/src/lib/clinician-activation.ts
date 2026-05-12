type AnyObj = Record<string, any>;

function cleanStr(v: unknown, max = 240): string | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function safeParseJson(v: unknown): AnyObj {
  if (!v) return {};
  if (typeof v === 'object' && !Array.isArray(v)) return v as AnyObj;
  try {
    return JSON.parse(String(v));
  } catch {
    return {};
  }
}

function toIso(v: unknown): string | null {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

function isFuture(iso?: string | null) {
  if (!iso) return false;
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) && d.getTime() > Date.now();
}

function hasTrainingCertificate(rawProfile: AnyObj) {
  const training = rawProfile?.training || {};
  const additionalQualifications = Array.isArray(rawProfile?.additionalQualifications)
    ? rawProfile.additionalQualifications
    : [];

  const q = additionalQualifications.find(
    (x: any) =>
      String(x?.degree || '').trim() === 'Ambulant+ Mandatory Clinician Training',
  );

  const certificateNumber =
    cleanStr(training?.certificateNumber, 120) ||
    cleanStr(q?.certificateNumber, 120) ||
    null;

  const completedAt =
    toIso(training?.completedAt) ||
    toIso(q?.completedAt) ||
    null;

  return {
    available: !!certificateNumber && !!completedAt,
    certificateNumber,
    completedAt,
  };
}

export type ClinicianActivationState = {
  verificationStatus: 'pending' | 'screened' | 'approved' | 'rejected';
  trainingStatus: 'not_scheduled' | 'scheduled' | 'completed';
  certificateStatus: 'missing' | 'issued';
  smartIdStatus:
    | 'not_issued'
    | 'issued'
    | 'expired'
    | 'revoked'
    | 'reissue_pending';
  dispatchStatus:
    | 'not_created'
    | 'pending'
    | 'packed'
    | 'shipped'
    | 'delivered'
    | 'canceled';
  activationStatus: 'pending' | 'eligible' | 'active' | 'blocked';
  listingStatus: 'hidden' | 'visible';
  canPractice: boolean;
  visibleToPatients: boolean;
  ambulantId: string | null;
  blockers: string[];
  evidence: {
    onboardingStatus: string | null;
    clinicianStatus: string | null;
    trainingCompletedFlag: boolean;
    certificateNumber: string | null;
    smartIdCardSerial: string | null;
    smartIdExpiresAt: string | null;
    smartIdIssueCount: number;
    dispatchId: string | null;
  };
};

export function extractRawProfile(clinician: AnyObj) {
  return (
    safeParseJson(clinician?.meta?.rawProfile) ||
    safeParseJson(clinician?.meta?.rawProfileJson) ||
    safeParseJson(clinician?.metadata?.rawProfile) ||
    safeParseJson(clinician?.metadata?.rawProfileJson)
  );
}

export function computeClinicianActivationState(args: {
  clinician: AnyObj;
  onboarding?: AnyObj | null;
  trainingSlot?: AnyObj | null;
  dispatch?: AnyObj | null;
}): ClinicianActivationState {
  const clinician = args.clinician || {};
  const onboarding = args.onboarding || null;
  const trainingSlot = args.trainingSlot || null;
  const dispatch = args.dispatch || null;

  const rawProfile = extractRawProfile(clinician);
  const cert = hasTrainingCertificate(rawProfile);

  const onboardingStatus = cleanStr(onboarding?.status, 80) || 'pending';
  const clinicianStatus = cleanStr(clinician?.status, 80);
  const trainingCompletedFlag = !!clinician?.trainingCompleted;

  let verificationStatus: ClinicianActivationState['verificationStatus'] = 'pending';
  if (onboardingStatus === 'screened') verificationStatus = 'screened';
  else if (onboardingStatus === 'approved') verificationStatus = 'approved';
  else if (onboardingStatus === 'rejected') verificationStatus = 'rejected';

  /* ✅ NEW: clinician status override */
  const clinicianStatusLower = String(clinicianStatus || '').toLowerCase();
  if (clinicianStatusLower === 'approved' || clinicianStatusLower === 'active') {
    verificationStatus = 'approved';
  }

  let trainingStatus: ClinicianActivationState['trainingStatus'] = 'not_scheduled';
  if (
    trainingCompletedFlag ||
    onboardingStatus === 'training_completed' ||
    String(trainingSlot?.status || '').toLowerCase() === 'completed'
  ) {
    trainingStatus = 'completed';
  } else if (trainingSlot || onboardingStatus === 'training_scheduled') {
    trainingStatus = 'scheduled';
  }

  const certificateStatus: ClinicianActivationState['certificateStatus'] =
    cert.available ? 'issued' : 'missing';

  const smartId = rawProfile?.smartId || {};
  const smartIdIssueCount =
    Number.isFinite(Number(smartId?.issueCount)) ? Number(smartId.issueCount) : 0;
  const smartIdExpiresAt = toIso(smartId?.expiresAt);
  const rawSmartStatus = String(smartId?.status || '').trim().toLowerCase();

  let smartIdStatus: ClinicianActivationState['smartIdStatus'] = 'not_issued';
  if (rawSmartStatus === 'revoked') {
    smartIdStatus = 'revoked';
  } else if (rawSmartStatus === 'reissue_pending') {
    smartIdStatus = 'reissue_pending';
  } else if (rawSmartStatus === 'issued') {
    smartIdStatus = isFuture(smartIdExpiresAt) ? 'issued' : 'expired';
  }

  let dispatchStatus: ClinicianActivationState['dispatchStatus'] = 'not_created';
  const rawDispatchStatus = String(dispatch?.status || smartId?.dispatchStatus || '')
    .trim()
    .toLowerCase();

  /* ✅ FIX: treat 'prepared' as 'pending' */
  if (rawDispatchStatus === 'pending' || rawDispatchStatus === 'prepared') dispatchStatus = 'pending';
  else if (rawDispatchStatus === 'packed') dispatchStatus = 'packed';
  else if (rawDispatchStatus === 'shipped') dispatchStatus = 'shipped';
  else if (rawDispatchStatus === 'delivered') dispatchStatus = 'delivered';
  else if (rawDispatchStatus === 'canceled' || rawDispatchStatus === 'cancelled')
    dispatchStatus = 'canceled';

  const blockers: string[] = [];

  if (verificationStatus === 'rejected') blockers.push('screening_rejected');
  if (verificationStatus !== 'approved' && verificationStatus !== 'rejected')
    blockers.push('screening_not_approved');
  if (trainingStatus !== 'completed') blockers.push('training_incomplete');
  if (certificateStatus !== 'issued') blockers.push('training_certificate_missing');
  if (smartIdStatus === 'not_issued') blockers.push('smart_id_not_issued');
  if (smartIdStatus === 'expired') blockers.push('smart_id_expired');
  if (smartIdStatus === 'revoked') blockers.push('smart_id_revoked');
  if (smartIdStatus === 'reissue_pending') blockers.push('smart_id_reissue_pending');
  if (dispatchStatus === 'not_created') blockers.push('starter_kit_dispatch_not_created');

  const hardBlocked =
    blockers.includes('screening_rejected') ||
    blockers.includes('smart_id_revoked');

  const eligible =
    verificationStatus === 'approved' &&
    trainingStatus === 'completed' &&
    certificateStatus === 'issued' &&
    (smartIdStatus === 'issued' || smartIdStatus === 'not_issued') &&
    dispatchStatus !== 'canceled';

  const persistedActive = String(clinicianStatus || '').toLowerCase() === 'active';

  let activationStatus: ClinicianActivationState['activationStatus'] = 'pending';
  if (hardBlocked) activationStatus = 'blocked';
  else if (persistedActive) activationStatus = 'active';
  else if (eligible) activationStatus = 'eligible';

  const canPractice = activationStatus === 'active';
  const visibleToPatients = activationStatus === 'active';
  const listingStatus: ClinicianActivationState['listingStatus'] = visibleToPatients
    ? 'visible'
    : 'hidden';

  return {
    verificationStatus,
    trainingStatus,
    certificateStatus,
    smartIdStatus,
    dispatchStatus,
    activationStatus,
    listingStatus,
    canPractice,
    visibleToPatients,
    ambulantId:
      cleanStr(rawProfile?.ambulantId, 120) ||
      cleanStr(smartId?.ambulantId, 120),
    blockers,
    evidence: {
      onboardingStatus,
      clinicianStatus,
      trainingCompletedFlag,
      certificateNumber: cert.certificateNumber,
      smartIdCardSerial: cleanStr(smartId?.cardSerial, 120),
      smartIdExpiresAt,
      smartIdIssueCount,
      dispatchId:
        cleanStr(dispatch?.id, 120) || cleanStr(smartId?.dispatchId, 120),
    },
  };
}