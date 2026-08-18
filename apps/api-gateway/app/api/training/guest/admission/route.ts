import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import {
  ipAddressFromRequest,
  issueTrainingAdmission,
  TrainingAdmissionError,
} from '@/src/clinicians/onboarding/training-admission';
import {
  clinicianTrainingRoomUrl,
  recordTrainingParticipationAudit,
  verifyTrainingGuestSession,
} from '@/src/clinicians/onboarding/training-invitations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

function guestSessionFromRequest(request: NextRequest) {
  return String(
    request.headers.get('x-training-guest-session') || '',
  ).trim();
}

export async function POST(request: NextRequest) {
  try {
    const session = await verifyTrainingGuestSession(
      guestSessionFromRequest(request),
    );

    const db: any = prisma;
    const assignment =
      await db.clinicianTrainingParticipantAssignment.findUnique({
        where: { id: session.assignmentId },
        include: { trainingSlot: true },
      });

    if (
      !assignment ||
      assignment.principalType !== 'external_guest' ||
      assignment.role !== 'observer' ||
      String(assignment.principalKey) !== session.principalKey ||
      String(assignment.status || '').toLowerCase() !== 'accepted' ||
      assignment.revokedAt ||
      (assignment.expiresAt &&
        new Date(assignment.expiresAt).getTime() <= Date.now())
    ) {
      return json({ ok: false, error: 'training_guest_session_inactive' }, 401);
    }

    const admission = await issueTrainingAdmission({
      assignmentId: String(assignment.id),
      expectedPrincipalKey: String(assignment.principalKey),
      subjectId: String(assignment.id),
      uid: `training-observer-${String(assignment.id)}`,
      userAgent: request.headers.get('user-agent'),
      ipAddress: ipAddressFromRequest(request),
    });

    await recordTrainingParticipationAudit(
      'training.observer.admission.issue',
      {
        actorType: 'external_guest',
        actorRefId: String(assignment.principalKey),
        assignmentId: String(assignment.id),
        trainingSlotId: String(assignment.trainingSlotId),
        description: 'External observer signed training admission issued.',
      },
    );

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
      roomUrl: clinicianTrainingRoomUrl(admission.trainingSlotId),
    });
  } catch (error: any) {
    if (error instanceof TrainingAdmissionError) {
      return json(
        {
          ok: false,
          error: error.code,
          ...(error.details || {}),
        },
        error.status,
      );
    }

    const code = String(error?.message || '').trim();
    if (
      code === 'training_guest_session_required' ||
      code === 'invalid_training_guest_session'
    ) {
      return json({ ok: false, error: code }, 401);
    }

    console.error('[training-guest-admission] failed', error);
    return json(
      { ok: false, error: 'training_guest_admission_unavailable' },
      500,
    );
  }
}
