// apps/clinician-app/app/api/encounters/[id]/end/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { readDb, writeDb } from '../../../erx/_lib_db_compat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GW = process.env.APIGW_BASE?.replace(/\/+$/, '');

type EncounterEndDto = {
  encounterId: string;
  clinicianId: string;
  patientId?: string;
  patientName?: string;

  synopsis?: string;
  diagnosisText?: string;
  diagnosisCode?: string;
  plan?: string;
  notes?: string;

  startedAt?: string;  // ISO
  endedAt?: string;    // ISO
  elapsedMs?: number;
};

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const encounterId = params.id;
  const body = (await req.json().catch(() => null)) as EncounterEndDto | null;

  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.clinicianId) {
    return NextResponse.json({ error: 'clinicianId is required' }, { status: 400 });
  }

  // Ensure encounterId is set in body
  body.encounterId = body.encounterId || encounterId;

  // 1) Try API gateway first, if present
  if (GW) {
    try {
      const r = await fetch(
        `${GW}/api/encounters/${encodeURIComponent(encounterId)}/end`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (r.ok) {
        const json = await r.json().catch(() => ({}));
        return NextResponse.json(json, { status: r.status });
      }
      console.warn(
        '[encounters/end][POST] GW upstream non-OK, falling back to local store',
        r.status,
      );
    } catch (err) {
      console.error(
        '[encounters/end][POST] GW upstream error, falling back to local store',
        err,
      );
    }
  }

  // 2) Local demo fallback: store a summary row in db.encounterSummaries
  try {
    const db = await readDb();
    if (!Array.isArray(db.encounterSummaries)) db.encounterSummaries = [];

    const now = new Date().toISOString();
    const summary = {
      id: `es-${Math.random().toString(36).slice(2, 10)}`,
      encounterId,
      clinicianId: body.clinicianId,
      patientId: body.patientId ?? null,
      patientName: body.patientName ?? null,

      synopsis: body.synopsis ?? '',
      diagnosisText: body.diagnosisText ?? '',
      diagnosisCode: body.diagnosisCode ?? '',
      plan: body.plan ?? '',
      notes: body.notes ?? '',

      startedAt: body.startedAt ?? null,
      endedAt: body.endedAt ?? now,
      elapsedMs: typeof body.elapsedMs === 'number' ? body.elapsedMs : null,

      createdAt: now,
      source: 'clinician-app',
    };

    db.encounterSummaries.unshift(summary);
    await writeDb(db);

    return NextResponse.json(summary, { status: 201 });
  } catch (err) {
    console.error('[encounters/end][POST] local store failed', err);
    return NextResponse.json(
      { error: 'Failed to save encounter summary (local demo store failed).' },
      { status: 500 },
    );
  }
}
