// apps/clinician-app/app/api/encounters/[id]/erx/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { readDb, writeDb } from '../../../erx/_lib_db_compat';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GW = process.env.APIGW_BASE?.replace(/\/+$/, '');

type Coding = {
  system: string;
  code: string;
  display: string;
};

type MedicationDto = {
  coding: Coding[];
  formText?: string;
  doseText?: string;
  routeText?: string;
  frequencyText?: string;
  durationText?: string;
  quantity?: { value?: number; unit?: string; text?: string };
  repeats?: number;
  note?: string;
};

type LabDto = {
  testText: string;
  priority?: 'Routine' | 'Urgent' | 'Stat';
  specimenText?: string;
  icd10?: Coding;
  note?: string;
};

type AllergyDto = {
  coding?: Coding[];
  substanceText: string;
  reactionText?: string | null;
  severity?: string | null;
  status?: string | null;
};

type PatientRef = {
  id: string;
  name?: string;
};

type ClinicianRef = {
  id: string;
  name?: string;
};

type ErxDto = {
  encounterId: string;
  patient: PatientRef;
  clinician: ClinicianRef;
  reason?: string;
  medications: MedicationDto[];
  labs: LabDto[];
  allergies?: AllergyDto[];
  note?: string;
};

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const encounterId = params.id;
  const body = (await req.json().catch(() => null)) as ErxDto | null;

  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const meds = Array.isArray((body as any).medications) ? (body as any).medications : [];
  const labs = Array.isArray((body as any).labs) ? (body as any).labs : [];

  if (meds.length === 0 && labs.length === 0) {
    return NextResponse.json(
      { error: 'At least one medication or lab order is required (medications[] or labs[]).' },
      { status: 400 },
    );
  }

  // If an API gateway is configured, try to forward the DTO as-is
  if (GW) {
    try {
      const r = await fetch(
        `${GW}/api/encounters/${encodeURIComponent(encounterId)}/erx`,
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
      // fall through to local fallback on non-2xx
      console.warn(
        '[encounters/erx][POST] GW upstream non-OK, falling back to local store',
        r.status,
      );
    } catch (err) {
      console.error('[encounters/erx][POST] GW upstream error, falling back to local store', err);
    }
  }

  // ---- local fallback: create a legacy ERX row for dev/demo ----
  const db = await readDb();

  const appt =
    db.appointments.find((a: any) => a.encounterId === encounterId) ||
    db.appointments[0];

  const legacyMeds = meds.map((m: MedicationDto) => {
    const first = (m.coding && m.coding[0]) || null;
    return {
      drug: first?.display || first?.code || '',
      dose: m.doseText || '',
      route: m.routeText || '',
      freq: m.frequencyText || '',
      duration: m.durationText || '',
      qty:
        m.quantity?.text ??
        (typeof m.quantity?.value === 'number'
          ? `${m.quantity.value}${m.quantity.unit ? ' ' + m.quantity.unit : ''}`
          : ''),
      refills: typeof m.repeats === 'number' ? m.repeats : 0,
      notes: m.note || '',
    };
  });

  const legacyLabs = labs.map((l: LabDto) => ({
    test: l.testText,
    priority: l.priority || '',
    specimen: l.specimenText || '',
    icd: l.icd10?.code || '',
    instructions: l.note || '',
  }));

  const erx = {
    id: `rx-${Math.random().toString(36).slice(2, 10)}`,
    appointmentId: appt?.id ?? `appt-${encounterId}`,
    encounterId,
    patientName: body.patient?.name ?? appt?.patientName ?? 'Demo Patient',
    clinicianName: body.clinician?.name ?? appt?.clinicianName ?? 'Demo Clinician',
    meds: legacyMeds,
    labTests: legacyLabs,
    notes: body.note ?? null,
    status: 'queued',
    createdAt: new Date().toISOString(),
    dispenseCode: '—',
  };

  if (!Array.isArray(db.erx)) db.erx = [];
  db.erx.unshift(erx);
  await writeDb(db);

  return NextResponse.json(erx, { status: 201 });
}

/**
 * GET /api/encounters/:id/erx
 *
 * Returns the latest ERX row for the encounter.
 * Used by FollowupSlotPicker to show upcoming lab tests.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const encounterId = params.id;

  // 1) Try upstream gateway if configured
  if (GW) {
    try {
      const r = await fetch(
        `${GW}/api/encounters/${encodeURIComponent(encounterId)}/erx`,
        { method: 'GET', headers: { accept: 'application/json' } },
      );
      if (r.ok) {
        const json = await r.json().catch(() => ({}));
        return NextResponse.json(json, { status: r.status });
      }
      console.warn('[encounters/erx][GET] GW non-OK, falling back to local store', r.status);
    } catch (err) {
      console.error('[encounters/erx][GET] GW error, falling back to local store', err);
    }
  }

  // 2) Local demo: read last ERX for this encounter from db.erx
  try {
    const db = await readDb();
    const list: any[] = Array.isArray(db.erx) ? db.erx : [];
    const forEncounter = list
      .filter((row) => row.encounterId === encounterId)
      .sort((a, b) =>
        (a.createdAt || '') > (b.createdAt || '') ? -1 : 1,
      );

    if (!forEncounter.length) {
      return NextResponse.json(
        { error: 'No eRx found for encounter', labs: [], meds: [] },
        { status: 404 },
      );
    }

    const latest = forEncounter[0];
    return NextResponse.json(latest, { status: 200 });
  } catch (err) {
    console.error('[encounters/erx][GET] local readDb failed', err);
    return NextResponse.json(
      { error: 'Failed to load eRx for encounter' },
      { status: 500 },
    );
  }
}
