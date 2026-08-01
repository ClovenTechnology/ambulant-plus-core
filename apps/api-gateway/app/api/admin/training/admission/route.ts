import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { readIdentity } from '@/src/lib/identity';
import { verifyAdminRequest } from '../../utils/auth';
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

function staffRole(value: unknown): 'admin' | 'trainer' | 'observer' {
  const role = clean(value, 40).toLowerCase();
  if (role === 'trainer' || role === 'observer') return role;
  return 'admin';
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdminRequest(request);
  if (!admin.ok) return admin.response;

  try {
    const body = await request.json().catch(() => ({} as any));
    const trainingSlotId = clean(body.trainingSlotId || body.slotId, 240);
    const sessionKey = clean(body.sessionKey || 'slot', 160) || 'slot';
    const role = staffRole(body.role);

    if (!trainingSlotId) {
      return json({ ok: false, error: 'trainingSlotId_required' }, 400);
    }

    const db: any = prisma;
    const slot = await db.clinicianTrainingSlot.findUnique({
      where: { id: trainingSlotId },
      select: { id: true, title: true, status: true, cancelledAt: true },
    });

    if (!slot) return json({ ok: false, error: 'training_slot_not_found' }, 404);
    if (String(slot.status).toLowerCase() === 'cancelled' || slot.cancelledAt) {
      return json({ ok: false, error: 'training_slot_cancelled' }, 409);
    }

    const who = readIdentity(request.headers);
    const actorId = clean(admin.uid || who.uid, 240);
    if (!actorId) return json({ ok: false, error: 'admin_identity_required' }, 401);

    const displayName =
      clean(body.displayName || body.name, 240) ||
      (role === 'trainer'
        ? 'Training trainer'
        : role === 'observer'
          ? 'Training observer'
          : 'Training administrator');

    const principalKey = trainingPrincipalKey('org_user', actorId);
    const permissions = role === 'observer'
      ? ['training:join', 'training:observe']
      : [
          'training:join',
          'training:moderate',
          'training:attendance:manage',
          'training:recording:manage',
        ];
    const now = new Date();

    const assignment = await db.clinicianTrainingParticipantAssignment.upsert({
      where: {
        trainingSlotId_sessionKey_principalKey: {
          trainingSlotId,
          sessionKey,
          principalKey,
        },
      },
      create: {
        trainingSlotId,
        sessionKey,
        principalType: 'org_user',
        principalKey,
        principalId: actorId,
        email: actorId.includes('@') ? actorId : null,
        name: displayName,
        role,
        permissions,
        scopeSnapshot: {
          actorId,
          authenticatedRole: admin.role,
        },
        status: 'assigned',
        assignedByUserId: actorId,
        assignedAt: now,
        metadata: {
          source: 'admin_training_room_join',
          trainingSlotTitle: slot.title,
        },
      },
      update: {
        name: displayName,
        role,
        permissions,
        scopeSnapshot: {
          actorId,
          authenticatedRole: admin.role,
        },
        status: 'assigned',
        assignedByUserId: actorId,
        assignedAt: now,
        revokedAt: null,
        metadata: {
          source: 'admin_training_room_join',
          trainingSlotTitle: slot.title,
        },
      },
    });

    await db.clinicianTrainingAdmission.updateMany({
      where: { assignmentId: String(assignment.id), revokedAt: null },
      data: { revokedAt: now },
    });

    const admission = await issueTrainingAdmission({
      assignmentId: String(assignment.id),
      expectedPrincipalKey: principalKey,
      subjectId: actorId,
      uid: `training-${role}-${actorId}`,
      userAgent: request.headers.get('user-agent'),
      ipAddress: ipAddressFromRequest(request),
      issuedByUserId: actorId,
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

    console.error('[training admission][admin] failed', error);
    return json({ ok: false, error: 'admin_training_admission_unavailable' }, 500);
  }
}