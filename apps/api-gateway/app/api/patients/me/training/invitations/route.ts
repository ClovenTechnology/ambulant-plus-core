import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { readIdentity } from '@/src/lib/identity';
import { trainingPrincipalKey } from '@/src/clinicians/onboarding/training-admission';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

function clean(value: unknown, max = 320) {
  return String(value ?? '').trim().slice(0, max);
}

async function patientFromRequest(request: NextRequest) {
  const who = readIdentity(request.headers);

  if (!who.trusted || who.role !== 'patient' || !who.uid) {
    return { ok: false as const, response: json({ ok: false, error: 'patient_session_required' }, 401) };
  }

  const db: any = prisma;
  const candidates: any[] = [{ userId: who.uid }];
  if (who.actorRefId) candidates.unshift({ id: who.actorRefId });

  const patient = await db.patientProfile.findFirst({
    where: { OR: candidates },
    select: {
      id: true,
      userId: true,
      name: true,
      contactEmail: true,
    },
  });

  if (!patient) {
    return { ok: false as const, response: json({ ok: false, error: 'patient_profile_not_found' }, 404) };
  }

  return { ok: true as const, patient, who };
}

function publicInvitation(row: any) {
  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  const slot = row.trainingSlot;

  return {
    id: String(row.id),
    assignmentId: String(row.id),
    status: String(row.status),
    role: 'patient',
    invitedAt: row.invitedAt?.toISOString?.() || null,
    acceptedAt: row.acceptedAt?.toISOString?.() || null,
    revokedAt: row.revokedAt?.toISOString?.() || null,
    consentVersion: metadata.consentVersion || 'training-patient-v1',
    iomtRequested: metadata.iomtRequested === true,
    recordingRequested: metadata.recordingRequested === true,
    consent: metadata.consent || null,
    slot: slot ? {
      id: String(slot.id),
      title: slot.title,
      summary: slot.summary,
      startsAt: new Date(slot.startsAt).toISOString(),
      endsAt: new Date(slot.endsAt).toISOString(),
      timezone: slot.timezone,
      mode: slot.mode,
      sessions: slot.sessions,
      trainerName: slot.trainerName,
      status: slot.status,
    } : null,
  };
}

export async function GET(request: NextRequest) {
  const auth = await patientFromRequest(request);
  if (!auth.ok) return auth.response;

  const db: any = prisma;
  const principalKey = trainingPrincipalKey('patient', String(auth.patient.id));
  const rows = await db.clinicianTrainingParticipantAssignment.findMany({
    where: {
      principalType: 'patient',
      principalKey,
      role: 'patient',
    },
    include: { trainingSlot: true },
    orderBy: [{ invitedAt: 'desc' }, { createdAt: 'desc' }],
    take: 100,
  });

  return json({ ok: true, invitations: rows.map(publicInvitation) });
}

export async function POST(request: NextRequest) {
  const auth = await patientFromRequest(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({} as any));
    const assignmentId = clean(body.assignmentId, 240);
    const action = clean(body.action, 40).toLowerCase();

    if (!assignmentId || !['accept', 'decline'].includes(action)) {
      return json({ ok: false, error: 'assignmentId_and_supported_action_required' }, 400);
    }

    const db: any = prisma;
    const principalKey = trainingPrincipalKey('patient', String(auth.patient.id));
    const current = await db.clinicianTrainingParticipantAssignment.findFirst({
      where: {
        id: assignmentId,
        principalType: 'patient',
        principalKey,
        role: 'patient',
      },
      include: { trainingSlot: true },
    });

    if (!current) return json({ ok: false, error: 'patient_training_invitation_not_found' }, 404);
    if (current.status === 'revoked' || current.status === 'expired') {
      return json({ ok: false, error: 'patient_training_invitation_inactive' }, 409);
    }

    const now = new Date();
    const priorMeta = current.metadata && typeof current.metadata === 'object' ? current.metadata : {};

    if (action === 'decline') {
      const declined = await db.clinicianTrainingParticipantAssignment.update({
        where: { id: assignmentId },
        data: {
          status: 'revoked',
          revokedAt: now,
          metadata: {
            ...priorMeta,
            revokedReason: 'patient_declined',
            declinedAt: now.toISOString(),
          },
        },
        include: { trainingSlot: true },
      });

      return json({ ok: true, invitation: publicInvitation(declined) });
    }

    const participationConsent = body.participationConsent === true;
    const audioVideoConsent = body.audioVideoConsent === true;
    const iomtRequired = priorMeta.iomtRequested === true;
    const recordingRequired = priorMeta.recordingRequested === true;
    const iomtConsent = body.iomtConsent === true;
    const recordingAcknowledged = body.recordingAcknowledged === true;

    if (!participationConsent || !audioVideoConsent || (iomtRequired && !iomtConsent) || (recordingRequired && !recordingAcknowledged)) {
      return json({ ok: false, error: 'required_training_consent_missing' }, 422);
    }

    const accepted = await db.clinicianTrainingParticipantAssignment.update({
      where: { id: assignmentId },
      data: {
        status: 'accepted',
        acceptedAt: now,
        revokedAt: null,
        metadata: {
          ...priorMeta,
          consent: {
            version: priorMeta.consentVersion || 'training-patient-v1',
            participationConsent,
            audioVideoConsent,
            iomtConsent,
            recordingAcknowledged,
            acceptedAt: now.toISOString(),
            userAgent: request.headers.get('user-agent'),
          },
        },
      },
      include: { trainingSlot: true },
    });

    return json({ ok: true, invitation: publicInvitation(accepted) });
  } catch (error: any) {
    console.error('[patient-training-invitations] update failed', error);
    return json({ ok: false, error: error?.message || 'patient_training_invitation_update_failed' }, 500);
  }
}