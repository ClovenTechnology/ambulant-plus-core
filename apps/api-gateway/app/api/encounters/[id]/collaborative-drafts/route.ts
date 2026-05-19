import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import {
  createCollaborativeAppointmentDraft,
  listCollaborativeAppointmentDrafts,
} from '@/src/lib/consultations/collaborative-draft-service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

async function requireEncounter(id: string) {
  const encounter = await prisma.encounter.findUnique({ where: { id } });
  if (!encounter) {
    const err = new Error('encounter_not_found') as Error & { status?: number };
    err.status = 404;
    throw err;
  }
  return encounter;
}

function normalizeDraftVisitMode(value: unknown) {
  const raw = String(value ?? '').trim().toUpperCase();
  if (raw === 'IN_PERSON' || raw === 'HOME_VISIT' || raw === 'CLINIC_VISIT') return 'IN_PERSON';
  return 'TELEVISIT';
}

export async function GET(
  req: NextRequest,
  ctx: { params: { id: string } },
) {
  try {
    const who = readIdentity(req.headers);
    if (!who.uid) return json({ ok: false, error: 'unauthorized' }, 401);

    const drafts = await listCollaborativeAppointmentDrafts({
      sourceEncounterId: ctx.params.id,
    });

    return json({ ok: true, drafts });
  } catch (err: any) {
    console.error('GET collaborative-drafts by encounter error', err);
    return json(
      { ok: false, error: err?.message || 'failed_to_list_collaborative_drafts' },
      err?.status || 500,
    );
  }
}

export async function POST(
  req: NextRequest,
  ctx: { params: { id: string } },
) {
  try {
    const who = readIdentity(req.headers);
    if (who.role !== 'clinician' || !who.uid) {
      return json({ ok: false, error: 'forbidden' }, 403);
    }

    const encounter = await requireEncounter(ctx.params.id);
    const body = await req.json().catch(() => ({} as any));

    const draft = await createCollaborativeAppointmentDraft({
      sourceConsultationSessionId: null,
      sourceEncounterId: encounter.id,
      appointmentId: null,
      caseId: encounter.caseId,
      patientId: encounter.patientId,
      leadClinicianId: encounter.clinicianId || who.uid,
      requestedByClinicianId: who.uid,
      visitMode: normalizeDraftVisitMode(body.visitMode) as any,
      startsAt: body.startsAt ? new Date(body.startsAt) : null,
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
      durationMin: typeof body.durationMin === 'number' ? body.durationMin : null,
      invitedClinicians: Array.isArray(body.invitedClinicians)
        ? body.invitedClinicians
        : [],
    });

    return json({ ok: true, draft }, 201);
  } catch (err: any) {
    console.error('POST collaborative-drafts by encounter error', err);
    return json(
      { ok: false, error: err?.message || 'failed_to_create_collaborative_draft' },
      err?.status || 500,
    );
  }
}