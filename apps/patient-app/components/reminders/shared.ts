// components/reminders/shared.ts
import {
  computeMedicationAdherence,
  getMedicationEvidenceLabel,
  isMedicationVerificationRequired,
  isMedicationVerified,
  isMedicationSelfReported,
} from '@/src/lib/medication-adherence';

export type ReminderVerificationMode = 'NONE' | 'CAMERA_SEQUENCE';
export type ReminderVerificationStatus =
  | 'NOT_REQUIRED'
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'VERIFIED'
  | 'SELF_REPORTED'
  | 'FAILED'
  | 'ABORTED';

export type ReminderTakenSource =
  | 'NONE'
  | 'CAMERA_VERIFIED'
  | 'SELF_REPORTED'
  | 'MANUAL_CLINICIAN'
  | 'IMPORTED_SYSTEM';

export type ApiReminder = {
  id: string;
  name: string;
  dose?: string | null;
  time?: string | null;
  scheduledFor?: string | null;
  status: 'Pending' | 'Taken' | 'Missed';
  snoozedUntil?: string | null;
  takenAt?: string | null;
  reportedTakenAt?: string | null;
  verifiedAt?: string | null;
  verificationRequired?: boolean | null;
  verificationMode?: ReminderVerificationMode | null;
  verificationStatus?: ReminderVerificationStatus | null;
  takenSource?: ReminderTakenSource | null;
  confidenceScore?: number | null;
  integrityScore?: number | null;
  source?: string | null;
  medicationId?: string | null;
  meta?: any;
  createdAt?: string;
};

export type TabId =
  | 'overview'
  | 'pills'
  | 'hydration'
  | 'exercise'
  | 'meditation'
  | 'sleep';

export type ReminderCategory =
  | 'pill'
  | 'hydration'
  | 'exercise'
  | 'sleep'
  | 'meditation'
  | 'other';

export type Stats = {
  pending: number;
  taken: number;
  verifiedTaken: number;
  selfReportedTaken: number;
  missed: number;
  concluded: number;
  pct: number;
  confidencePct: number;
};

export type NexRingExerciseMetrics = {
  steps: number;
  avgHeartRate?: number | null;
  distanceKm?: number | null;
  calories?: number | null;
  startTimeIso?: string | null;
  endTimeIso?: string | null;
};

export type NexRingSleepMetrics = {
  sleepScore: number;
  totalSleepMinutes: number;
  deepMinutes?: number | null;
  remMinutes?: number | null;
  efficiencyPct?: number | null;
  latencyMinutes?: number | null;
  startTimeIso?: string | null;
  endTimeIso?: string | null;
};


export function nowHHMM() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function timeToIsoToday(time: string) {
  const d = new Date();
  const [hh, mm] = time.split(':').map((x) => parseInt(x, 10));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return d.toISOString();
  d.setHours(hh, mm, 0, 0);
  return d.toISOString();
}

export function computeWakeTime(bedTime: string, hoursStr: string): string {
  if (!bedTime || !hoursStr) return '';
  const [hh, mm] = bedTime.split(':').map((v) => parseInt(v, 10));
  const hours = parseFloat(hoursStr);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || !Number.isFinite(hours)) {
    return '';
  }
  const d = new Date();
  d.setHours(hh, mm, 0, 0);
  d.setHours(d.getHours() + hours);
  const wh = String(d.getHours()).padStart(2, '0');
  const wm = String(d.getMinutes()).padStart(2, '0');
  return `${wh}:${wm}`;
}

export function getReminderType(r: ApiReminder): ReminderCategory {
  if (r.source === 'medication') return 'pill';
  if (r.source === 'hydration') return 'hydration';
  if (r.source === 'exercise') return 'exercise';
  if (r.source === 'sleep') return 'sleep';
  if (r.source === 'meditation') return 'meditation';

  const metaType = r.meta?.type || r.meta?.category;
  if (metaType === 'pill' || metaType === 'medication') return 'pill';
  if (metaType === 'hydration') return 'hydration';
  if (metaType === 'exercise') return 'exercise';
  if (metaType === 'sleep') return 'sleep';
  if (metaType === 'meditation' || metaType === 'mindfulness' || metaType === 'breathing') return 'meditation';

  return 'other';
}

export function computeStats(arr: ApiReminder[]): Stats {
  const pending = arr.filter((r) => r.status === 'Pending').length;
  const taken = arr.filter((r) => r.status === 'Taken').length;
  const missed = arr.filter((r) => r.status === 'Missed').length;
  const concluded = taken + missed;
  const pct = concluded === 0 ? 100 : Math.round((taken / concluded) * 100);

  return {
    pending,
    taken,
    verifiedTaken: taken,
    selfReportedTaken: 0,
    missed,
    concluded,
    pct,
    confidencePct: pct,
  };
}

export function computeMedicationStats(arr: ApiReminder[]): Stats {
  const summary = computeMedicationAdherence(arr);

  return {
    pending: summary.pending,
    taken: summary.taken,
    verifiedTaken: summary.verifiedTaken,
    selfReportedTaken: summary.selfReportedTaken,
    missed: summary.missed,
    concluded: summary.concluded,
    pct: summary.weightedPct,
    confidencePct: summary.confidencePct,
  };
}

export {
  isMedicationVerificationRequired,
  isMedicationVerified,
  isMedicationSelfReported,
  getMedicationEvidenceLabel,
};

export function getCategoryIcon(category: ReminderCategory): string {
  switch (category) {
    case 'pill':
      return '⚕️';
    case 'hydration':
      return '💧';
    case 'exercise':
      return '🏋️';
    case 'sleep':
      return '🌙';
    case 'meditation':
      return '🧘';
    default:
      return '⏰';
  }
}

export function getTabIcon(tab: TabId): string {
  switch (tab) {
    case 'overview':
      return '📋';
    case 'pills':
      return '⚕️';
    case 'hydration':
      return '💧';
    case 'exercise':
      return '🏋️';
    case 'meditation':
      return '🧘';
    case 'sleep':
      return '🌙';
    default:
      return '';
  }
}

export const tabs: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'pills', label: 'Pills' },
  { id: 'hydration', label: 'Hydration' },
  { id: 'exercise', label: 'Exercise' },
  { id: 'meditation', label: 'Meditation' },
  { id: 'sleep', label: 'Sleep' },
];

export function hasNotificationSupport(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}