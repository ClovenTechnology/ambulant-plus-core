// apps/medreach/app/api/jobs/data.ts

export type MedReachStatus =
  | 'Assigned'
  | 'En route'
  | 'Arrived'
  | 'Sample collected'
  | 'Delivered to lab';

export type MedReachJob = {
  id: string;
  labId?: string;
  phlebId?: string;
  patient?: string;
  address?: string;
  windowLabel?: string;
  status?: MedReachStatus | string;
  eta?: string;
};

export type LabTimelineEntry = {
  status: string;
  at: string;
  note?: string;
};