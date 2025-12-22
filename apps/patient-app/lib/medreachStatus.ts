// apps/patient-app/lib/medreachStatus.ts

/**
 * Canonical MedReach job status model for the patient app.
 *
 * This mirrors the shared FSM used by MedReach (lab + phleb + admin),
 * but is kept local here so the patient-app doesn't need the @shared/fsm package.
 */

export type JobStatus =
  | 'WAITING_LAB_SELECTION'
  | 'WAITING_PHLEB'
  | 'PHLEB_EN_ROUTE_TO_PATIENT'
  | 'PHLEB_ARRIVED'
  | 'SAMPLING_IN_PROGRESS'
  | 'PHLEB_EN_ROUTE_TO_LAB'
  | 'DELIVERED_TO_LAB'
  // result-oriented states
  | 'RESULT_PENDING'
  | 'RESULT_IN_PROGRESS'
  | 'RESULT_READY'
  | 'RESULT_SENT';

/**
 * Normalize any raw backend / legacy / mock status into a canonical JobStatus.
 */
export function normalizeToJobStatus(raw: unknown): JobStatus {
  if (!raw || typeof raw !== 'string') {
    return 'WAITING_LAB_SELECTION';
  }

  const upper = raw.toUpperCase().trim();

  const map: Record<string, JobStatus> = {
    // canonical
    WAITING_LAB_SELECTION: 'WAITING_LAB_SELECTION',
    WAITING_PHLEB: 'WAITING_PHLEB',
    PHLEB_EN_ROUTE_TO_PATIENT: 'PHLEB_EN_ROUTE_TO_PATIENT',
    PHLEB_ARRIVED: 'PHLEB_ARRIVED',
    SAMPLING_IN_PROGRESS: 'SAMPLING_IN_PROGRESS',
    PHLEB_EN_ROUTE_TO_LAB: 'PHLEB_EN_ROUTE_TO_LAB',
    DELIVERED_TO_LAB: 'DELIVERED_TO_LAB',
    RESULT_PENDING: 'RESULT_PENDING',
    RESULT_IN_PROGRESS: 'RESULT_IN_PROGRESS',
    RESULT_READY: 'RESULT_READY',
    RESULT_SENT: 'RESULT_SENT',

    // aliases / legacy statuses -> pre-lab
    IDLE: 'WAITING_LAB_SELECTION',
    PENDING: 'WAITING_LAB_SELECTION',
    MARKETPLACE_OPEN: 'WAITING_LAB_SELECTION',
    LAB_MARKETPLACE: 'WAITING_LAB_SELECTION',

    PHLEB_ASSIGNED: 'WAITING_PHLEB',

    TRAVELING: 'PHLEB_EN_ROUTE_TO_PATIENT',
    EN_ROUTE: 'PHLEB_EN_ROUTE_TO_PATIENT',
    ON_THE_WAY_TO_PATIENT: 'PHLEB_EN_ROUTE_TO_PATIENT',

    ARRIVED: 'PHLEB_ARRIVED',

    SAMPLING: 'SAMPLING_IN_PROGRESS',
    COLLECTING_SAMPLE: 'SAMPLING_IN_PROGRESS',

    SAMPLE_COLLECTED: 'PHLEB_EN_ROUTE_TO_LAB',
    ON_WAY_TO_LAB: 'PHLEB_EN_ROUTE_TO_LAB',

    LAB_RECEIVED: 'DELIVERED_TO_LAB',

    // aliases for result statuses
    RESULT_PROCESSING: 'RESULT_IN_PROGRESS',
    PROCESSING: 'RESULT_IN_PROGRESS',

    COMPLETE: 'RESULT_READY',
    DONE: 'RESULT_READY',
  };

  return map[upper] ?? 'WAITING_LAB_SELECTION';
}

/**
 * Human-friendly label for a canonical JobStatus.
 */
export function getStatusLabel(status: JobStatus): string {
  switch (status) {
    case 'WAITING_LAB_SELECTION':
      return 'Waiting for lab';
    case 'WAITING_PHLEB':
      return 'Waiting for phlebotomist';
    case 'PHLEB_EN_ROUTE_TO_PATIENT':
      return 'Phlebotomist en route';
    case 'PHLEB_ARRIVED':
      return 'Phlebotomist arrived';
    case 'SAMPLING_IN_PROGRESS':
      return 'Sampling in progress';
    case 'PHLEB_EN_ROUTE_TO_LAB':
      return 'On the way to lab';
    case 'DELIVERED_TO_LAB':
      return 'Delivered to lab';
    case 'RESULT_PENDING':
      return 'Result pending';
    case 'RESULT_IN_PROGRESS':
      return 'Result in progress';
    case 'RESULT_READY':
      return 'Result ready';
    case 'RESULT_SENT':
      return 'Result sent to clinician';
    default:
      return status.replace(/_/g, ' ').toLowerCase()
        .replace(/^./, (c) => c.toUpperCase());
  }
}

/**
 * Tailwind classes for a colored pill. Caller already adds the base
 * pill classes, so we only return color-related bits.
 */
export function getStatusClasses(status: JobStatus): string {
  switch (status) {
    case 'WAITING_LAB_SELECTION':
      return 'bg-slate-50 text-slate-700 border-slate-200';
    case 'WAITING_PHLEB':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'PHLEB_EN_ROUTE_TO_PATIENT':
      return 'bg-sky-50 text-sky-700 border-sky-200';
    case 'PHLEB_ARRIVED':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'SAMPLING_IN_PROGRESS':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'PHLEB_EN_ROUTE_TO_LAB':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'DELIVERED_TO_LAB':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'RESULT_PENDING':
      return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    case 'RESULT_IN_PROGRESS':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'RESULT_READY':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'RESULT_SENT':
      return 'bg-teal-50 text-teal-700 border-teal-200';
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200';
  }
}

/**
 * Optional: for ordering timelines or job lists consistently.
 */
export const jobStatusOrder: JobStatus[] = [
  'WAITING_LAB_SELECTION',
  'WAITING_PHLEB',
  'PHLEB_EN_ROUTE_TO_PATIENT',
  'PHLEB_ARRIVED',
  'SAMPLING_IN_PROGRESS',
  'PHLEB_EN_ROUTE_TO_LAB',
  'DELIVERED_TO_LAB',
  'RESULT_PENDING',
  'RESULT_IN_PROGRESS',
  'RESULT_READY',
  'RESULT_SENT',
];

export function isTerminalStatus(status: JobStatus): boolean {
  return (
    status === 'DELIVERED_TO_LAB' ||
    status === 'RESULT_READY' ||
    status === 'RESULT_SENT'
  );
}
