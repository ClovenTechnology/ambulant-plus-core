// apps/clinician-app/app/api/encounters/[id]/fitness/route.ts
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

type PatientRef = {
  id: string;
  name?: string;
};

type ClinicianRef = {
  id: string;
  name?: string;
};

type FitnessCertificateDto = {
  encounterId: string;
  patient: PatientRef;
  clinician: ClinicianRef;
  diagnosis?: {
    primary?: Coding;
    secondary?: Coding[];
  };
  text: string;
  validFrom?: string; // ISO
  validTo?: string;   // ISO
  issuedAt?: string;  // ISO
  restrictions?: string;
  allowedActivities?: string;
  status?: 'Draft' | 'Final';
  note?: string;
};

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const encounterId = params.id;
  const body = (await req.json().catch(() => null)) as FitnessCertificateDto | null;

  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.text || typeof body.text !== 'string') {
    return NextResponse.json({ error: 'text is required' }, { status: 400 });
  }

  // Ensure encounterId is set in body for the gateway
  body.encounterId = body.encounterId || encounterId;

  if (GW) {
    try {
      const r = await fetch(
        `${GW}/api/encounters/${encodeURIComponent(encounterId)}/fitness`,
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
        '[encounters/fitness] GW upstream non-OK, falling back to local store',
        r.status,
      );
    } catch (err) {
      console.error(
        '[encounters/fitness] GW upstream error, falling back to local store',
        err,
      );
    }
  }

  // ---- local fallback: store a simple fitness certificate in the demo DB ----
  const db = await readDb();

  const appt =
    db.appointments.find((a: any) => a.encounterId === encounterId) ||
    db.appointments[0];

  if (!Array.isArray(db.fitnesscerts)) db.fitnesscerts = [];

  const cert = {
    id: `fc-${Math.random().toString(36).slice(2, 10)}`,
    encounterId,
    patientName: body.patient?.name ?? appt?.patientName ?? 'Demo Patient',
    clinicianName: body.clinician?.name ?? appt?.clinicianName ?? 'Demo Clinician',
    text: body.text,
    diagnosisCode: body.diagnosis?.primary?.code ?? null,
    diagnosisText: body.diagnosis?.primary?.display ?? null,
    validFrom: body.validFrom ?? null,
    validTo: body.validTo ?? null,
    issuedAt: body.issuedAt ?? new Date().toISOString(),
    restrictions: body.restrictions ?? null,
    allowedActivities: body.allowedActivities ?? null,
    status: body.status ?? 'Draft',
    createdAt: new Date().toISOString(),
  };

  db.fitnesscerts.unshift(cert);
  await writeDb(db);

  return NextResponse.json(cert, { status: 201 });
}
