import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity, requireTrustedIdentityInProduction } from '@/src/lib/identity';
import { sha256Hex, writeEhrIndex } from '@/src/lib/chain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolvePatientProfileId(identity: ReturnType<typeof readIdentity>): Promise<string | null> {
  if (!identity.uid) return null;
  const profile = await prisma.patientProfile.findUnique({
    where: { userId: identity.uid },
    select: { id: true },
  });
  return profile?.id ?? null;
}

async function requirePatientProfile(req: NextRequest) {
  const identity = readIdentity(req.headers);
  try {
    requireTrustedIdentityInProduction(req.headers, identity);
  } catch {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 }),
    };
  }
  if (identity.role !== 'patient' || !identity.uid) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: 'Patients only' }, { status: 403 }),
    };
  }
  const patientId = await resolvePatientProfileId(identity);
  if (!patientId) {
    return {
      ok: false as const,
      response: NextResponse.json({ ok: false, error: 'Patient profile not found' }, { status: 400 }),
    };
  }
  return { ok: true as const, identity, patientId };
}

async function indexEhrVaccination(recordId: string, patientId: string, clinicianUid: string | undefined | null) {
  try {
    const patientHash = sha256Hex(patientId);
    const clinicianHash = sha256Hex(clinicianUid || 'patient-self');
    const contentHash = sha256Hex(`vaccination:${recordId}`);
    const uri = `ehr://vaccinations/${recordId}`;
    const tx = await writeEhrIndex({ recordId, patientHash, clinicianHash, contentHash, uri, kind: 'vaccination' });
    if (tx?.txId) {
      await prisma.vaccination.update({ where: { id: recordId }, data: { ehrTxId: tx.txId } });
    }
  } catch (err) {
    console.warn('EHR index (vaccination) failed', err);
  }
}

export async function GET(req: NextRequest) {
  const context = await requirePatientProfile(req);
  if (!context.ok) return context.response;

  const items = await prisma.vaccination.findMany({
    where: { patientId: context.patientId },
    orderBy: { date: 'desc' },
  });

  return NextResponse.json({ ok: true, items }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const context = await requirePatientProfile(req);
  if (!context.ok) return context.response;

  const body = await req.json().catch(() => ({} as any));
  const { vaccine, date, batch, facility, clinician, notes, fileKey, fileName, source } = body || {};
  const requestedSource = String(source || '').trim().toLowerCase();
  const isScheduledFollowup = requestedSource === 'patient-followup';

  if (!String(vaccine || '').trim()) {
    return NextResponse.json({ ok: false, error: 'vaccine is required' }, { status: 400 });
  }

  const parsedDate = date ? new Date(date) : null;
  if (parsedDate && !Number.isFinite(parsedDate.getTime())) {
    return NextResponse.json({ ok: false, error: 'invalid_date' }, { status: 400 });
  }
  if (isScheduledFollowup && (!parsedDate || parsedDate.getTime() <= Date.now())) {
    return NextResponse.json(
      { ok: false, error: 'followup_date_must_be_future' },
      { status: 400 },
    );
  }

  const created = await prisma.vaccination.create({
    data: {
      patientId: context.patientId,
      vaccine: String(vaccine).trim(),
      date: parsedDate,
      batch: batch ?? null,
      facility: facility ?? null,
      clinician: clinician ?? null,
      notes: notes ?? null,
      fileKey: fileKey ?? null,
      fileName: fileName ?? null,
      source: isScheduledFollowup ? 'patient-followup' : 'patient',
      recordedBy: context.identity.uid,
    },
  });

  if (!isScheduledFollowup) {
    await indexEhrVaccination(created.id, context.patientId, context.identity.uid);
  }

  return NextResponse.json(
    { ok: true, item: created, scheduled: isScheduledFollowup },
    { status: 201, headers: { 'Cache-Control': 'no-store' } },
  );
}

/* B2B continuity deliberately uses future-dated vaccination records with
 * source='patient-followup'. The schema has no dedicated follow-up columns,
 * so no PATCH contract is exposed here. Scheduled follow-ups are not EHR-indexed
 * as administered vaccinations. */
export async function PATCH(_req: NextRequest) {
  return NextResponse.json(
    { ok: false, error: 'vaccination_patch_not_supported_use_followup_record' },
    { status: 405, headers: { 'Cache-Control': 'no-store' } },
  );
}
