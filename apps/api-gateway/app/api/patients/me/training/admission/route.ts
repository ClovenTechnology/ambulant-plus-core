import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { readIdentity } from '@/src/lib/identity';
import {
  ipAddressFromRequest,
  issueTrainingAdmission,
  trainingPrincipalKey,
  TrainingAdmissionError,
} from '@/src/clinicians/onboarding/training-admission';

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

export async function POST(request: NextRequest) {
  try {
    const who = readIdentity(request.headers);

    if (!who.trusted || who.role !== 'patient' || !who.uid) {
      return json({ ok: false, error: 'patient_session_required' }, 401);
    }

    const db: any = prisma;
    const candidates: any[] = [{ userId: who.uid }];
    if (who.actorRefId) candidates.unshift({ id: who.actorRefId });

    const patient = await db.patientProfile.findFirst({
      where: { OR: candidates },
      select: { id: true, userId: true },
    });

    if (!patient) return json({ ok: false, error: 'patient_profile_not_found' }, 404);

    const body = await request.json().catch(() => ({} as any));
    const assignmentId = clean(body.assignmentId, 240);
    const trainingSlotId = clean(body.trainingSlotId || body.slotId, 240);
    const principalKey = trainingPrincipalKey('patient', String(patient.id));

    const assignment = await db.clinicianTrainingParticipantAssignment.findFirst({
      where: {
        ...(assignmentId ? { id: assignmentId } : {}),
        ...(trainingSlotId ? { trainingSlotId } : {}),
        principalType: 'patient',
        principalKey,
        role: 'patient',
        status: 'accepted',
        revokedAt: null,
      },
      orderBy: { acceptedAt: 'desc' },
    });

    if (!assignment) {
      return json({ ok: false, error: 'accepted_patient_training_invitation_required' }, 403);
    }

    const metadata = assignment.metadata && typeof assignment.metadata === 'object' ? assignment.metadata : {};
    if (!metadata.consent?.participationConsent || !metadata.consent?.audioVideoConsent) {
      return json({ ok: false, error: 'patient_training_consent_required' }, 403);
    }

    const admission = await issueTrainingAdmission({
      assignmentId: String(assignment.id),
      expectedPrincipalKey: principalKey,
      subjectId: String(patient.id),
      uid: String(patient.userId || who.uid),
      userAgent: request.headers.get('user-agent'),
      ipAddress: ipAddressFromRequest(request),
    });

    return json({
      ok: true,
      admission: {
        token: admission.token,
        admissionId: admission.admissionId,
        assignmentId: admission.assignmentId,
        roomId: admission.roomId,
        trainingSlotId: admission.trainingSlotId,
        sessionKey: admission.sessionKey,
        role: admission.role,
        uid: admission.uid,
        displayName: admission.displayName,
        notBeforeAt: admission.notBeforeAt.toISOString(),
        expiresAt: admission.expiresAt.toISOString(),
        joinOpensAt: admission.joinOpensAt.toISOString(),
        joinClosesAt: admission.joinClosesAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof TrainingAdmissionError) {
      return json({ ok: false, error: error.code, ...(error.details || {}) }, error.status);
    }

    console.error('[training admission][patient] failed', error);
    return json({ ok: false, error: 'patient_training_admission_unavailable' }, 500);
  }
}