import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity, type Identity } from '@/src/lib/auth';
import { sha256Hex, writeEhrIndex } from '@/src/lib/chain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function indexEhrCondition(recordId: string, patientId: string, clinicianUid: string | undefined | null) {
  try {
    const patientHash = sha256Hex(patientId);
    const clinicianHash = sha256Hex(clinicianUid || 'clinician-unknown');
    const contentHash = sha256Hex(`condition:${recordId}`);
    const uri = `ehr://conditions/${recordId}`;

    const tx = await writeEhrIndex({
      recordId,
      patientHash,
      clinicianHash,
      contentHash,
      uri,
      kind: 'condition',
    });

    if (tx?.txId) {
      await prisma.condition.update({
        where: { id: recordId },
        data: { ehrTxId: tx.txId },
      });
    }
  } catch (err) {
    console.warn('EHR index (condition, clinician) failed', err);
  }
}

export async function GET(req: NextRequest) {
  const identity = readIdentity(req.headers);

  if (identity.role !== 'clinician') {
    return NextResponse.json({ ok: false, error: 'Clinicians only' }, { status: 403 });
  }

  const url = new URL(req.url);
  const patientId = url.searchParams.get('patientId');

  if (!patientId) {
    return NextResponse.json({ ok: false, error: 'patientId is required' }, { status: 400 });
  }

  const items = await prisma.condition.findMany({
    where: { patientId },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ ok: true, items });
}

export async function POST(req: NextRequest) {
  const identity = readIdentity(req.headers);

  if (identity.role !== 'clinician') {
    return NextResponse.json({ ok: false, error: 'Clinicians only' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({} as any));
  const {
    patientId,
    name,
    status,
    diagnosedAt,
    facility,
    clinician,
    onAmbulant,
    notes,
    fileKey,
    fileName,
    source,
  } = body || {};

  if (!patientId) {
    return NextResponse.json({ ok: false, error: 'patientId is required' }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ ok: false, error: 'name is required' }, { status: 400 });
  }

  const created = await prisma.condition.create({
    data: {
      patientId,
      name,
      status: status || 'Active',
      diagnosedAt: diagnosedAt ? new Date(diagnosedAt) : null,
      facility: facility ?? null,
      clinician: clinician ?? null,
      onAmbulant: onAmbulant ?? false,
      notes: notes ?? null,
      fileKey: fileKey ?? null,
      fileName: fileName ?? null,
      source: source || 'clinician',
      recordedBy: identity.uid ?? null,
    },
  });

  await indexEhrCondition(created.id, patientId, identity.uid);

  return NextResponse.json({ ok: true, item: created }, { status: 201 });
}
