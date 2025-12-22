// apps/careport/app/api/jobs/data.ts

export type CarePortStatus =
  | 'Assigned'
  | 'At pharmacy'
  | 'Picked up'
  | 'Out for delivery'
  | 'Delivered';

export type CarePortJob = {
  id: string;
  pharmacyId: string;
  riderId: string;
  patient: string;
  address: string;
  status: CarePortStatus;
  eta?: string;
};

export type CarePortTimelineEntry = {
  t: string; // ISO timestamp
  msg: string;
  entity?: 'rider' | 'pharmacy' | 'system';
  lat?: number;
  lng?: number;
};

export type Pharmacy = {
  id: string;
  name: string;
  city?: string;
  contact?: string;
};

const now = Date.now();

// ---- demo data ----

export const PHARMACIES: Pharmacy[] = [
  {
    id: 'demo-pharmacy-1',
    name: 'MedCare Sandton',
    city: 'Johannesburg',
    contact: '+27 11 000 0000',
  },
];

export const JOBS: CarePortJob[] = [
  {
    id: 'CP-1001',
    pharmacyId: 'demo-pharmacy-1',
    riderId: 'rider-001',
    patient: 'Ayanda N.',
    address: 'Sandton, Johannesburg',
    status: 'Out for delivery',
    eta: '~20 min',
  },
  {
    id: 'CP-1002',
    pharmacyId: 'demo-pharmacy-1',
    riderId: 'rider-001',
    patient: 'Michael K.',
    address: 'Bryanston, Johannesburg',
    status: 'Assigned',
    eta: '—',
  },
];

export const TIMELINE: Record<string, CarePortTimelineEntry[]> = {
  'CP-1001': [
    {
      t: new Date(now - 60 * 60 * 1000).toISOString(),
      msg: 'Pharmacy selected',
      entity: 'pharmacy',
    },
    {
      t: new Date(now - 45 * 60 * 1000).toISOString(),
      msg: 'Rider assigned',
      entity: 'system',
    },
    {
      t: new Date(now - 20 * 60 * 1000).toISOString(),
      msg: 'Picked up at pharmacy',
      entity: 'rider',
    },
    {
      t: new Date(now - 10 * 60 * 1000).toISOString(),
      msg: 'Out for delivery',
      entity: 'rider',
    },
  ],
  'CP-1002': [
    {
      t: new Date(now - 15 * 60 * 1000).toISOString(),
      msg: 'Pharmacy selected',
      entity: 'pharmacy',
    },
    {
      t: new Date(now - 5 * 60 * 1000).toISOString(),
      msg: 'Rider assigned',
      entity: 'system',
    },
  ],
};

// helper to append timeline entries from mutations (status changes etc.)
export function appendTimeline(
  jobId: string,
  partial: Partial<CarePortTimelineEntry> & { msg: string },
) {
  const list = TIMELINE[jobId] ?? [];
  const entry: CarePortTimelineEntry = {
    t: new Date().toISOString(),
    entity: 'system',
    ...partial,
  };
  TIMELINE[jobId] = [...list, entry];
}
