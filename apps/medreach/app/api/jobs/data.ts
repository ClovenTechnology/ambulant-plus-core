// apps/medreach/app/api/jobs/data.ts
export type MedReachStatus =
  | 'Assigned'
  | 'En route'
  | 'Arrived'
  | 'Sample collected'
  | 'Delivered to lab';

export type MedReachJob = {
  id: string;
  labId: string;
  phlebId: string;
  patient: string;
  address: string;
  windowLabel?: string;
  status: MedReachStatus;
  eta?: string;
};

export type LabTimelineEntry = {
  status: string;
  at: string;
  note?: string;
};

const now = Date.now();

export const JOBS: MedReachJob[] = [
  {
    id: 'LAB-2001',
    labId: 'demo-lab-1',
    phlebId: 'phleb-001',
    patient: 'Thabo M.',
    address: 'Randburg, Johannesburg',
    windowLabel: 'Today 14:00–16:00',
    status: 'En route',
    eta: '~25 min'
  },
  {
    id: 'LAB-2002',
    labId: 'demo-lab-1',
    phlebId: 'phleb-001',
    patient: 'Lerato K.',
    address: 'Fourways, Johannesburg',
    windowLabel: 'Today 16:00–18:00',
    status: 'Assigned',
    eta: '—'
  }
];

export const LABS = [
  {
    id: 'demo-lab-1',
    name: 'Ambulant Labs – Sandton',
    city: 'Johannesburg',
    contact: '+27 11 000 0000'
  }
];

export const TIMELINE: Record<string, LabTimelineEntry[]> = {
  'LAB-2001': [
    {
      status: 'PHLEB_ASSIGNED',
      at: new Date(now - 70 * 60 * 1000).toISOString()
    },
    {
      status: 'TRAVELING',
      at: new Date(now - 55 * 60 * 1000).toISOString()
    }
  ],
  'LAB-2002': [
    {
      status: 'PHLEB_ASSIGNED',
      at: new Date(now - 20 * 60 * 1000).toISOString()
    }
  ]
};

export function appendTimeline(jobId: string, status: string, note?: string) {
  const list = TIMELINE[jobId] ?? [];
  const entry: LabTimelineEntry = {
    status,
    at: new Date().toISOString(),
    note
  };
  TIMELINE[jobId] = [...list, entry];
}
