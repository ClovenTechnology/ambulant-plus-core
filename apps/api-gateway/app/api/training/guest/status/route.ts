import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { verifyTrainingGuestSession } from '@/src/clinicians/onboarding/training-invitations';

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

export async function GET(request: NextRequest) {
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

    const slot = assignment.trainingSlot;
    if (
      !slot ||
      String(slot.status || '').toLowerCase() === 'cancelled' ||
      slot.cancelledAt
    ) {
      return json({ ok: false, error: 'training_slot_cancelled' }, 409);
    }

    return json({
      ok: true,
      participant: {
        assignmentId: String(assignment.id),
        name: assignment.name,
        email: assignment.email,
        organisation: assignment.organisation,
        designation: assignment.designation,
        role: 'observer',
        status: 'accepted',
      },
      training: {
        id: String(slot.id),
        title: slot.title,
        summary: slot.summary,
        startsAt: new Date(slot.startsAt).toISOString(),
        endsAt: new Date(slot.endsAt).toISOString(),
        timezone: slot.timezone || 'Africa/Johannesburg',
        mode: slot.mode || 'virtual',
        status: slot.status,
        roomId: `training-slot-${String(slot.id)}`,
      },
    });
  } catch (error: any) {
    const code = String(error?.message || '').trim();
    return json(
      {
        ok: false,
        error:
          code === 'training_guest_session_required'
            ? code
            : 'invalid_training_guest_session',
      },
      401,
    );
  }
}
