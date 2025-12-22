// apps/medreach/lib/fsm.ts
// Shared job status model for MedReach (can be reused across apps)

export type JobStatus =
  | 'WAITING_LAB_SELECTION'
  | 'WAITING_PHLEB'
  | 'PHLEB_EN_ROUTE_TO_PATIENT'
  | 'PHLEB_ARRIVED'
  | 'SAMPLING_IN_PROGRESS'
  | 'PHLEB_EN_ROUTE_TO_LAB'
  | 'DELIVERED_TO_LAB';

export const JOB_STATUS_SEQUENCE: JobStatus[] = [
  'WAITING_LAB_SELECTION',
  'WAITING_PHLEB',
  'PHLEB_EN_ROUTE_TO_PATIENT',
  'PHLEB_ARRIVED',
  'SAMPLING_IN_PROGRESS',
  'PHLEB_EN_ROUTE_TO_LAB',
  'DELIVERED_TO_LAB',
];

export function getNextStatus(current: JobStatus): JobStatus {
  const idx = JOB_STATUS_SEQUENCE.indexOf(current);
  if (idx === -1) return current;
  if (idx === JOB_STATUS_SEQUENCE.length - 1) return current; // terminal
  return JOB_STATUS_SEQUENCE[idx + 1];
}

export function getStatusLabel(status: JobStatus): string {
  switch (status) {
    case 'WAITING_LAB_SELECTION':
      return 'Waiting for lab';
    case 'WAITING_PHLEB':
      return 'Waiting for phleb';
    case 'PHLEB_EN_ROUTE_TO_PATIENT':
      return 'En route to patient';
    case 'PHLEB_ARRIVED':
      return 'Arrived at patient';
    case 'SAMPLING_IN_PROGRESS':
      return 'Sampling in progress';
    case 'PHLEB_EN_ROUTE_TO_LAB':
      return 'En route to lab';
    case 'DELIVERED_TO_LAB':
      return 'Delivered to lab';
    default:
      return status;
  }
}

export function getStatusClasses(status: JobStatus): string {
  switch (status) {
    case 'WAITING_LAB_SELECTION':
      return 'bg-slate-50 text-slate-700 border-slate-200';
    case 'WAITING_PHLEB':
      return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    case 'PHLEB_EN_ROUTE_TO_PATIENT':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'PHLEB_ARRIVED':
      return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    case 'SAMPLING_IN_PROGRESS':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'PHLEB_EN_ROUTE_TO_LAB':
      return 'bg-teal-50 text-teal-700 border-teal-200';
    case 'DELIVERED_TO_LAB':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200';
  }
}
