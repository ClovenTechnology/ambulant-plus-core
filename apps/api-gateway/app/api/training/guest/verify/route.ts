import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import {
  hashTrainingInvitationToken,
  issueTrainingGuestSession,
  recordTrainingParticipationAudit,
} from '@/src/clinicians/onboarding/training-invitations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

function inactiveSlot(slot: any) {
  return (
    !slot ||
    String(slot.status || '').toLowerCase() === 'cancelled' ||
    Boolean(slot.cancelledAt) ||
    new Date(slot.endsAt).getTime() <= Date.now()
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({} as any));
    const token = String(body?.token || '').trim();

    if (!token) {
      return json({ ok: false, error: 'training_invitation_token_required' }, 400);
    }

    const db: any = prisma;
    const invitationTokenHash = hashTrainingInvitationToken(token);
    const assignment =
      await db.clinicianTrainingParticipantAssignment.findUnique({
        where: { invitationTokenHash },
        include: { trainingSlot: true },
      });

    if (
      !assignment ||
      assignment.principalType !== 'external_guest' ||
      assignment.role !== 'observer'
    ) {
      return json({ ok: false, error: 'invalid_or_expired_training_invitation' }, 401);
    }

    const status = String(assignment.status || '').toLowerCase();
    if (
      assignment.revokedAt ||
      !['invited', 'accepted'].includes(status) ||
      (assignment.expiresAt &&
        new Date(assignment.expiresAt).getTime() <= Date.now()) ||
      inactiveSlot(assignment.trainingSlot)
    ) {
      return json({ ok: false, error: 'invalid_or_expired_training_invitation' }, 401);
    }

    const now = new Date();
    const accepted =
      status === 'invited'
        ? await db.clinicianTrainingParticipantAssignment.update({
            where: { id: assignment.id },
            data: {
              status: 'accepted',
              acceptedAt: now,
              invitationTokenHash: null,
            },
          })
        : await db.clinicianTrainingParticipantAssignment.update({
            where: { id: assignment.id },
            data: {
              invitationTokenHash: null,
            },
          });

    const assignmentExpiry =
      accepted.expiresAt &&
      new Date(accepted.expiresAt).getTime() > now.getTime()
        ? new Date(accepted.expiresAt)
        : new Date(
            new Date(assignment.trainingSlot.endsAt).getTime() +
              60 * 60 * 1000,
          );

    const guestSession = await issueTrainingGuestSession({
      assignmentId: String(assignment.id),
      principalKey: String(assignment.principalKey),
      expiresAt: assignmentExpiry,
    });

    await recordTrainingParticipationAudit(
      'training.observer.invitation.verify',
      {
        actorType: 'external_guest',
        actorRefId: String(assignment.principalKey),
        assignmentId: String(assignment.id),
        trainingSlotId: String(assignment.trainingSlotId),
        description: 'External observer training invitation verified.',
      },
    );

    return json({
      ok: true,
      guestSessionToken: guestSession.token,
      expiresAt: guestSession.expiresAt.toISOString(),
      participant: {
        assignmentId: String(assignment.id),
        name: assignment.name,
        email: assignment.email,
        role: 'observer',
        status: 'accepted',
      },
      training: {
        id: String(assignment.trainingSlot.id),
        title: assignment.trainingSlot.title,
        startsAt: new Date(assignment.trainingSlot.startsAt).toISOString(),
        endsAt: new Date(assignment.trainingSlot.endsAt).toISOString(),
        timezone:
          assignment.trainingSlot.timezone || 'Africa/Johannesburg',
        mode: assignment.trainingSlot.mode || 'virtual',
      },
    });
  } catch (error: any) {
    console.error('[training-guest-verify] failed', error);
    return json(
      {
        ok: false,
        error:
          String(error?.message || '').trim() ||
          'training_invitation_verification_failed',
      },
      500,
    );
  }
}
