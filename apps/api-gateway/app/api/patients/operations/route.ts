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

async function indexEhrOperation(recordId: string, patientId: string, clinicianUid: string | undefined | null) {
  try {
    const patientHash = sha256Hex(patientId);
    const clinicianHash = sha256Hex(clinicianUid || 'patient-self');
    const contentHash = sha256Hex(`operation:${recordId}`);
    const uri = `ehr://operations/${recordId}`;

    const tx = await writeEhrIndex({
      recordId,
      patientHash,
      clinicianHash,
      contentHash,
      uri,
      kind: 'operation',
    });

    if (tx?.txId) {
      await prisma.operation.update({
        where: { id: recordId },
        data: { ehrTxId: tx.txId },
      });
    }
  } catch (err) {
    console.warn('EHR index (operation) failed', err);
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

  const items = await prisma.operation.findMany({
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
    title,
    date,
    facility,
    surgeon,
    coClinicians,
    clinicianCount,
    notes,
    fileKey,
    fileName,
    source,
  } = body || {};

  const resolvedPatientId = patientId || (await resolvePatientProfileId(identity));
  if (!resolvedPatientId) {
    return NextResponse.json({ ok: false, error: 'patientId/PatientProfile missing' }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json({ ok: false, error: 'title is required' }, { status: 400 });
  }

  const created = await prisma.operation.create({
    data: {
      patientId: resolvedPatientId,
      title,
      date: date ? new Date(date) : null,
      facility: facility ?? null,
      surgeon: surgeon ?? null,
      coClinicians: Array.isArray(coClinicians) ? coClinicians : [],
      clinicianCount: clinicianCount ?? (Array.isArray(coClinicians) ? coClinicians.length + 1 : 1),
      notes: notes ?? null,
      fileKey: fileKey ?? null,
      fileName: fileName ?? null,
      source: source || 'patient',
      recordedBy: identity.uid ?? null,
    },
  });

  await indexEhrOperation(created.id, resolvedPatientId, identity.uid);

  return NextResponse.json({ ok: true, item: created }, { status: 201 });
}
