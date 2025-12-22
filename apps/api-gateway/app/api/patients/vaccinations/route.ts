import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity, type Identity } from '@/src/lib/auth';
import { sha256Hex, writeEhrIndex } from '@/src/lib/chain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolvePatientProfileId(identity: Identity): Promise<string | null> {
  if (!identity.uid) return null;
  const profile = await prisma.patientProfile.findUnique({
    where: { userId: identity.uid },
    select: { id: true },
  });
  return profile?.id ?? null;
}

async function indexEhrVaccination(recordId: string, patientId: string, clinicianUid: string | undefined | null) {
  try {
    const patientHash = sha256Hex(patientId);
    const clinicianHash = sha256Hex(clinicianUid || 'patient-self');
    const contentHash = sha256Hex(`vaccination:${recordId}`);
    const uri = `ehr://vaccinations/${recordId}`;

    const tx = await writeEhrIndex({
      recordId,
      patientHash,
      clinicianHash,
      contentHash,
      uri,
      kind: 'vaccination',
    });

    if (tx?.txId) {
      await prisma.vaccination.update({
        where: { id: recordId },
        data: { ehrTxId: tx.txId },
      });
    }
  } catch (err) {
    console.warn('EHR index (vaccination) failed', err);
  }
}

export async function GET(req: NextRequest) {
  const identity = readIdentity(req.headers);

  if (identity.role !== 'patient') {
    return NextResponse.json({ ok: false, error: 'Patients only' }, { status: 403 });
  }

  const url = new URL(req.url);
  const explicitPatientId = url.searchParams.get('patientId');

  const patientId = explicitPatientId || (await resolvePatientProfileId(identity));
  if (!patientId) {
    return NextResponse.json({ ok: false, error: 'Patient profile not found' }, { status: 400 });
  }

  const items = await prisma.vaccination.findMany({
    where: { patientId },
    orderBy: { date: 'desc' },
  });

  return NextResponse.json({ ok: true, items });
}

export async function POST(req: NextRequest) {
  const identity = readIdentity(req.headers);

  if (identity.role !== 'patient') {
    return NextResponse.json({ ok: false, error: 'Patients only' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({} as any));
  let {
    patientId,
    vaccine,
    date,
    batch,
    facility,
    clinician,
    notes,
    fileKey,
    fileName,
    source,
  } = body || {};

  const resolvedPatientId = patientId || (await resolvePatientProfileId(identity));
  if (!resolvedPatientId) {
    return NextResponse.json({ ok: false, error: 'patientId/PatientProfile missing' }, { status: 400 });
  }
  if (!vaccine) {
    return NextResponse.json({ ok: false, error: 'vaccine is required' }, { status: 400 });
  }

  const created = await prisma.vaccination.create({
    data: {
      patientId: resolvedPatientId,
      vaccine,
      date: date ? new Date(date) : null,
      batch: batch ?? null,
      facility: facility ?? null,
      clinician: clinician ?? null,
      notes: notes ?? null,
      fileKey: fileKey ?? null,
      fileName: fileName ?? null,
      source: source || 'patient',
      recordedBy: identity.uid ?? null,
    },
  });

  await indexEhrVaccination(created.id, resolvedPatientId, identity.uid);

  return NextResponse.json({ ok: true, item: created }, { status: 201 });
}
