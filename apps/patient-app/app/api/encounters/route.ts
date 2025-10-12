import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type Encounter = {
  id: string;
  caseId: string;
  start: string; // ISO
  stop?: string; // ISO
  mode: 'chat' | 'audio' | 'video';
  status: 'Completed' | 'InProgress';
  clinician: { id: string; name: string; specialty: string };
  notes?: string;
  devices?: string[]; // e.g. ["Health Monitor", "NexRing"]
};

type Case = {
  id: string;
  title: string;
  status: 'Open' | 'Closed' | 'Referred';
  updatedAt: string;           // last activity across encounters
  encounters: Encounter[];
};

// ---- Mock seed (stable timestamps near "now") -----------------------------

function iso(d: Date) { return new Date(d).toISOString(); }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d; }
const now = new Date();

const MOCK: Case[] = [
  {
    id: 'CASE-24001',
    title: 'Hypertension follow-up',
    status: 'Open',
    updatedAt: iso(daysAgo(0)), // today
    encounters: [
      {
        id: 'ENC-24001-1',
        caseId: 'CASE-24001',
        start: iso(new Date(now.getTime() - 1000 * 60 * 50)),
        stop:  iso(new Date(now.getTime() - 1000 * 60 * 20)),
        mode: 'video',
        status: 'Completed',
        clinician: { id: 'CLN-001', name: 'Dr. A. Moyo', specialty: 'Cardiology' },
        notes: 'BP improved; adjust meds.',
        devices: ['Health Monitor', 'NexRing']
      }
    ]
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
        stop:  iso(daysAgo(7)),
        mode: 'chat',
        status: 'Completed',
        clinician: { id: 'CLN-014', name: 'Dr. N. Jacobs', specialty: 'Internal Medicine' },
        notes: 'Reassurance + inhaler',
        devices: ['Health Monitor']
      },
      {
        id: 'ENC-23987-2',
        caseId: 'CASE-23987',
        start: iso(daysAgo(6)),
        stop:  iso(daysAgo(6)),
        mode: 'audio',
        status: 'Completed',
        clinician: { id: 'CLN-014', name: 'Dr. N. Jacobs', specialty: 'Internal Medicine' },
        notes: 'Symptoms resolved; close case',
        devices: []
      }
    ]
  },
  {
    id: 'CASE-23810',
    title: 'Headache & dizziness',
    status: 'Referred',
    updatedAt: iso(daysAgo(14)),
    encounters: [
      {
        id: 'ENC-23810-1',
        caseId: 'CASE-23810',
        start: iso(daysAgo(15)),
        stop:  iso(daysAgo(15)),
        mode: 'video',
        status: 'Completed',
        clinician: { id: 'CLN-033', name: 'Dr. T. Dlamini', specialty: 'Neurology' },
        notes: 'Refer to neuro clinic',
        devices: ['Health Monitor']
      }
    ]
  }
];

// Ensure updatedAt reflects the most recent encounter end/start
function normalizeCases(cases: Case[]): Case[] {
  return cases.map(c => {
    const latest = [...c.encounters].sort((a, b) =>
      new Date(b.stop ?? b.start).getTime() - new Date(a.stop ?? a.start).getTime()
    )[0];
    const updatedAt = latest ? (latest.stop ?? latest.start) : c.updatedAt;
    return { ...c, updatedAt };
  });
}

function toLatestSummary(c: Case) {
  const latest = [...c.encounters].sort((a, b) =>
    new Date(b.stop ?? b.start).getTime() - new Date(a.stop ?? a.start).getTime()
  )[0];
  return latest
    ? {
        id: latest.id,
        start: latest.start,
        stop: latest.stop,
        mode: latest.mode,
        status: latest.status
      }
    : null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('mode');         // "sessions" to flatten
  const status = url.searchParams.get('status');     // "Open" | "Closed" | "Referred"
  const limit = Number(url.searchParams.get('limit') ?? 0);

  // Mocks default ON; set USE_MOCKS=0 to disable later.
  const useMocks = (process.env.USE_MOCKS ?? '1') === '1';

  if (!useMocks) {
    // Real backend placeholder
    return NextResponse.json({ cases: [] }, { headers: { 'Cache-Control': 'no-store' } });
  }

  // Work with mocks
  let cases = normalizeCases(MOCK);

  if (status && ['Open', 'Closed', 'Referred'].includes(status)) {
    cases = cases.filter(c => c.status === status);
  }

  // Sort by recency (updatedAt desc)
  cases.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  if (limit > 0) cases = cases.slice(0, limit);

  if (mode === 'sessions') {
    // Flatten encounters across cases, newest first
    const encounters: (Encounter & { caseStatus: Case['status']; caseTitle: string })[] = [];
    for (const c of cases) {
      for (const e of c.encounters) {
        encounters.push({
          ...e,
          caseStatus: c.status,
          caseTitle: c.title
        });
      }
    }
    encounters.sort((a, b) =>
      new Date(b.stop ?? b.start).getTime() - new Date(a.stop ?? a.start).getTime()
    );
    return NextResponse.json({ encounters }, { headers: { 'Cache-Control': 'no-store' } });
  }

  // Default: cases with summary
  const shaped = cases.map(c => ({
    id: c.id,
    title: c.title,
    status: c.status,
    updatedAt: c.updatedAt,
    encountersCount: c.encounters.length,
    latestEncounter: toLatestSummary(c)
  }));

  return NextResponse.json({ cases: shaped }, { headers: { 'Cache-Control': 'no-store' } });
}
