// apps/clinician-app/app/api/followups/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STORE = path.join(process.cwd(), 'data-followups.json');

type FollowupRecord = {
  id: string;
  createdAt: string;
  encounterId: string;
  clinicianId?: string;
  patientId?: string;
  start: string;
  end: string;
  confirmed: boolean;
  holdMinutes?: number;
  holdUntil?: string | null;
  confirmedAt?: string | null;
  source?: 'api' | 'demo';
  [key: string]: any;
};

async function readList(): Promise<FollowupRecord[]> {
  try {
    const txt = await fs.readFile(STORE, 'utf8');
    const parsed = JSON.parse(txt);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeList(list: FollowupRecord[]) {
  await fs.writeFile(STORE, JSON.stringify(list, null, 2), 'utf8');
}

/**
 * POST /api/followups
 *
 * Expected body (from SessionConclusions):
 * {
 *   encounterId: string;
 *   clinicianId?: string;
 *   patientId?: string;
 *   start: string; // ISO
 *   end: string;   // ISO
 *   confirmed: boolean;
 *   holdMinutes?: number; // used when confirmed=false to create a 24h hold, etc.
 * }
 */
export async function POST(req: NextRequest) {
  const raw = await req.json().catch(() => ({}));
  const {
    encounterId,
    clinicianId,
    patientId,
    start,
    end,
    confirmed,
    holdMinutes,
    ...rest
  } = raw as {
    encounterId?: string;
    clinicianId?: string;
    patientId?: string;
    start?: string;
    end?: string;
    confirmed?: boolean;
    holdMinutes?: number;
    [key: string]: any;
  };

  if (!encounterId || !start || !end) {
    return NextResponse.json(
      { error: 'encounterId, start and end are required' },
      { status: 400 },
    );
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const id =
    raw.id || `fup-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const holdMins =
    typeof holdMinutes === 'number' && holdMinutes > 0
      ? holdMinutes
      : confirmed
      ? 0
      : 0; // no hold by default for confirmed bookings

  const holdUntil =
    holdMins > 0
      ? new Date(now.getTime() + holdMins * 60 * 1000).toISOString()
      : null;

  const entry: FollowupRecord = {
    id,
    createdAt: nowIso,
    encounterId,
    clinicianId,
    patientId,
    start,
    end,
    confirmed: !!confirmed,
    holdMinutes: holdMins || undefined,
    holdUntil,
    confirmedAt: !!confirmed ? nowIso : null,
    source: 'api',
    ...rest,
  };

  const list = await readList();
  list.unshift(entry);
  await writeList(list);

  return NextResponse.json({
    ok: true,
    id,
  });
}

/**
 * Optional: GET /api/followups?encounterId=&patientId=&clinicianId=&confirmed=
 * Simple helper for dashboards / debugging.
 *
 * Auto-hide expired holds: any followup with holdUntil < now AND !confirmed is filtered out.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const encounterIdFilter = url.searchParams.get('encounterId') || undefined;
  const patientIdFilter = url.searchParams.get('patientId') || undefined;
  const clinicianIdFilter = url.searchParams.get('clinicianId') || undefined;
  const confirmedFilter = url.searchParams.get('confirmed');

  let list = await readList();

  // Auto-hide expired holds
  const nowMs = Date.now();
  list = list.filter((f) => {
    if (f.confirmed) return true;
    if (!f.holdUntil) return true;
    const t = Date.parse(String(f.holdUntil));
    if (Number.isNaN(t)) return true;
    return t >= nowMs;
  });

  if (encounterIdFilter) {
    list = list.filter((f) => f.encounterId === encounterIdFilter);
  }
  if (patientIdFilter) {
    list = list.filter((f) => String(f.patientId) === String(patientIdFilter));
  }
  if (clinicianIdFilter) {
    list = list.filter(
      (f) => String(f.clinicianId) === String(clinicianIdFilter),
    );
  }
  if (confirmedFilter === 'true' || confirmedFilter === 'false') {
    const want = confirmedFilter === 'true';
    list = list.filter((f) => !!f.confirmed === want);
  }

  return NextResponse.json({
    items: list.slice(0, 200),
  });
}

/**
 * PATCH /api/followups
 *
 * Body:
 * {
 *   id: string;
 *   confirmed: boolean; // usually true when patient books
 * }
 */
export async function PATCH(req: NextRequest) {
  const raw = await req.json().catch(() => ({}));
  const id = raw.id as string | undefined;
  const confirmed = raw.confirmed !== false; // default true

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const list = await readList();
  const idx = list.findIndex((f) => f.id === id);
  if (idx === -1) {
    return NextResponse.json({ error: 'followup_not_found' }, { status: 404 });
  }

  const nowIso = new Date().toISOString();
  const current = list[idx];

  const updated: FollowupRecord = {
    ...current,
    confirmed,
    confirmedAt: confirmed ? nowIso : current.confirmedAt ?? null,
    holdMinutes: confirmed ? undefined : current.holdMinutes,
    holdUntil: confirmed ? null : current.holdUntil ?? null,
  };

  list[idx] = updated;
  await writeList(list);

  return NextResponse.json({
    ok: true,
    followup: updated,
  });
}
