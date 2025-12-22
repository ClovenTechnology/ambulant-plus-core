// apps/patient-app/app/api/encounters/store.ts
// In-memory fallback store for encounters/cases (dev only).
// Export functions used by the route: listEncounters(), listCases(), getEncounter(), getCase()

import crypto from 'node:crypto';

export type MockClinician = { id: string; name: string; specialty?: string };
export type MockEncounter = {
  id: string;
  caseId: string;
  start: string; // ISO
  stop?: string;
  mode?: 'chat' | 'audio' | 'video' | 'in-person';
  status?: 'Completed' | 'InProgress' | 'Scheduled';
  clinician?: MockClinician;
  notes?: string;
  devices?: string[];
  caseTitle?: string;
  caseStatus?: 'Open' | 'Closed' | 'Referred';
};

export type MockCase = {
  id: string;
  title?: string;
  status: 'Open' | 'Closed' | 'Referred';
  updatedAt: string;
  encounters: MockEncounter[];
};

// small helpers
const now = Date.now();
function iso(d: Date) { return new Date(d).toISOString(); }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d; }

// Seed data (stable-ish)
const CASES: MockCase[] = [
  {
    id: 'CASE-24001',
    title: 'Hypertension follow-up',
    status: 'Open',
    updatedAt: iso(daysAgo(0)),
    encounters: [
      {
        id: 'ENC-24001-1',
        caseId: 'CASE-24001',
        start: iso(new Date(now - 1000 * 60 * 50)),
        stop: iso(new Date(now - 1000 * 60 * 20)),
        mode: 'video',
        status: 'Completed',
        clinician: { id: 'CLN-001', name: 'Dr. A. Moyo', specialty: 'Cardiology' },
        notes: 'BP improved; adjust meds.',
        devices: ['Health Monitor', 'NexRing'],
      },
    ],
  },
  {
    id: 'CASE-23987',
    title: 'Post-viral cough',
    status: 'Closed',
    updatedAt: iso(daysAgo(6)),
    encounters: [
      {
        id: 'ENC-23987-1',
        caseId: 'CASE-23987',
        start: iso(daysAgo(7)),
        stop: iso(daysAgo(7)),
        mode: 'chat',
        status: 'Completed',
        clinician: { id: 'CLN-014', name: 'Dr. N. Jacobs', specialty: 'Internal Medicine' },
        notes: 'Reassurance + inhaler',
        devices: ['Health Monitor', 'Digital Stethoscope'],
      },
      {
        id: 'ENC-23987-2',
        caseId: 'CASE-23987',
        start: iso(daysAgo(6)),
        stop: iso(daysAgo(6)),
        mode: 'audio',
        status: 'Completed',
        clinician: { id: 'CLN-014', name: 'Dr. N. Jacobs', specialty: 'Internal Medicine' },
        notes: 'Symptoms resolved; close case',
        devices: ['Health Monitor'],
      },
    ],
  },
  {
    id: 'CASE-23992',
    title: 'Post-viral cough',
    status: 'Open',
    updatedAt: iso(daysAgo(15)),
    encounters: [
      {
        id: 'ENC-23992-1',
        caseId: 'CASE-23992',
        start: iso(daysAgo(15)),
        stop: iso(daysAgo(15)),
        mode: 'video',
        status: 'Completed',
        clinician: { id: 'CLN-018', name: 'Dr. P. Mazula', specialty: 'Internal Medicine' },
        notes: 'Reassurance + inhaler Referred to Pulmonologist Dr. N. Moloyi Pulmonology',
        devices: ['Health Monitor'],
      },
      {
        id: 'ENC-23992-2',
        caseId: 'CASE-23992',
        start: iso(daysAgo(22)),
        stop: iso(daysAgo(22)),
        mode: 'video, audio, chat',
        status: 'Completed',
        clinician: { id: 'CLN-019', name: 'Dr. N. Moloyi', specialty: 'Pulmonology' },
        notes: 'Suspected Accute Bronchitis; case referred to Pulmonologist',
        devices: ['Health Monitor', 'NexRing', 'Digital Stethoscope', 'HD Otoscope'],
      },
    ],
  },  {
    id: 'CASE-23810',
    title: 'Headache & dizziness',
    status: 'Referred',
    updatedAt: iso(daysAgo(14)),
    encounters: [
      {
        id: 'ENC-23810-1',
        caseId: 'CASE-23810',
        start: iso(daysAgo(15)),
        stop: iso(daysAgo(15)),
        mode: 'video',
        status: 'Completed',
        clinician: { id: 'CLN-033', name: 'Dr. T. Dlamini', specialty: 'Neurology' },
        notes: 'Refer to neuro clinic',
        devices: ['Health Monitor'],
      },
    ],
  },
];

export function listCases(): MockCase[] {
  // Return a shallow clone so callers don't mutate the module state
  return CASES.map(c => ({ ...c, encounters: [...c.encounters] }));
}

export function listEncounters(): MockEncounter[] {
  const all: MockEncounter[] = [];
  for (const c of CASES) {
    for (const e of c.encounters) {
      all.push({ ...e, caseTitle: c.title, caseStatus: c.status });
    }
  }
  // newest first
  return all.sort((a, b) => new Date(b.stop ?? b.start).getTime() - new Date(a.stop ?? a.start).getTime());
}

export function getCase(id: string): MockCase | undefined {
  return CASES.find(c => c.id === id);
}

export function getEncounter(id: string): MockEncounter | undefined {
  return listEncounters().find(e => e.id === id);
}

// allow adding a mock encounter (useful for testing)
export function addEncounter(payload: Partial<MockEncounter>): MockEncounter {
  const id = payload.id ?? `ENC-${crypto.randomUUID().slice(0,8)}`;
  const start = payload.start ?? new Date().toISOString();
  const enc: MockEncounter = {
    id,
    caseId: payload.caseId ?? 'CASE-UNKNOWN',
    start,
    stop: payload.stop,
    mode: payload.mode ?? 'chat',
    status: payload.status ?? 'Completed',
    clinician: payload.clinician,
    notes: payload.notes,
    devices: payload.devices,
  };

  // find or create case
  let c = CASES.find(x => x.id === enc.caseId);
  if (!c) {
    c = { id: enc.caseId, title: payload.caseTitle ?? enc.caseId, status: (payload.caseStatus as any) ?? 'Open', updatedAt: start, encounters: [] };
    CASES.unshift(c);
  }
  c.encounters.unshift(enc);
  c.updatedAt = enc.stop ?? enc.start;
  return enc;
}
