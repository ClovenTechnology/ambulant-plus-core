export type MedicationReminderLike = {
  status?: string | null;
  verificationRequired?: boolean | null;
  verificationStatus?: string | null;
  takenSource?: string | null;
  meta?: Record<string, any> | null;
};

export type MedicationAdherenceSummary = {
  pending: number;
  missed: number;
  verifiedTaken: number;
  selfReportedTaken: number;
  taken: number;
  concluded: number;
  weightedPct: number;
  confidencePct: number;
};

export const VERIFIED_TAKEN_WEIGHT = 1.0;
export const SELF_REPORTED_TAKEN_WEIGHT = 0.55;
export const MISSED_CONFIDENCE_WEIGHT = 0.5;

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function fromMeta(r: MedicationReminderLike, key: string): any {
  return r?.meta && typeof r.meta === 'object' ? (r.meta as any)[key] : undefined;
}

export function isMedicationVerificationRequired(r: MedicationReminderLike): boolean {
  const direct = r.verificationRequired;
  if (typeof direct === 'boolean') return direct;

  const metaValue = fromMeta(r, 'verificationRequired');
  return Boolean(metaValue);
}

export function isMedicationVerified(r: MedicationReminderLike): boolean {
  const verificationStatus = readString(r.verificationStatus) ?? readString(fromMeta(r, 'verificationStatus'));
  const takenSource = readString(r.takenSource) ?? readString(fromMeta(r, 'takenSource'));

  return verificationStatus === 'VERIFIED' || takenSource === 'CAMERA_VERIFIED';
}

export function isMedicationSelfReported(r: MedicationReminderLike): boolean {
  const verificationStatus = readString(r.verificationStatus) ?? readString(fromMeta(r, 'verificationStatus'));
  const takenSource = readString(r.takenSource) ?? readString(fromMeta(r, 'takenSource'));

  if (verificationStatus === 'SELF_REPORTED') return true;
  if (takenSource === 'SELF_REPORTED' || takenSource === 'MANUAL_CLINICIAN') return true;

  return false;
}

export function getMedicationEvidenceLabel(r: MedicationReminderLike): 'verified' | 'self_reported' | 'missed' | 'pending' {
  const status = readString(r.status);

  if (status === 'Missed') return 'missed';
  if (status !== 'Taken') return 'pending';
  if (isMedicationVerified(r)) return 'verified';
  return 'self_reported';
}

export function computeMedicationAdherence(reminders: MedicationReminderLike[]): MedicationAdherenceSummary {
  let pending = 0;
  let missed = 0;
  let verifiedTaken = 0;
  let selfReportedTaken = 0;

  for (const r of reminders) {
    const status = readString(r.status);

    if (status === 'Pending' || !status) {
      pending += 1;
      continue;
    }

    if (status === 'Missed') {
      missed += 1;
      continue;
    }

    if (status === 'Taken') {
      if (isMedicationVerified(r)) verifiedTaken += 1;
      else selfReportedTaken += 1;
      continue;
    }

    pending += 1;
  }

  const taken = verifiedTaken + selfReportedTaken;
  const concluded = taken + missed;

  const weightedNumerator =
    verifiedTaken * VERIFIED_TAKEN_WEIGHT +
    selfReportedTaken * SELF_REPORTED_TAKEN_WEIGHT;

  const confidenceNumerator =
    verifiedTaken * VERIFIED_TAKEN_WEIGHT +
    selfReportedTaken * SELF_REPORTED_TAKEN_WEIGHT +
    missed * MISSED_CONFIDENCE_WEIGHT;

  const weightedPct = concluded === 0 ? 100 : Math.round((weightedNumerator / concluded) * 100);
  const confidencePct = concluded === 0 ? 100 : Math.round((confidenceNumerator / concluded) * 100);

  return {
    pending,
    missed,
    verifiedTaken,
    selfReportedTaken,
    taken,
    concluded,
    weightedPct,
    confidencePct,
  };
}