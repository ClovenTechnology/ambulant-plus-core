import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
  requireStaffCapability,
} from '@/src/lib/admin-staff-auth';
import { cleanText, staffAuditData } from '@/src/lib/admin-staff-data';
import {
  canTransitionStaffLifecycle,
  type StaffLifecycleState,
} from '@/src/lib/admin-staff-policy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATES = new Set<StaffLifecycleState>(['ACTIVE', 'LEAVE', 'SUSPENDED', 'ARCHIVED']);

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requireAdminStaffActor(request, { requirePassword: true });
    requireStaffCapability(actor, 'staff.manage');

    const id = String(params.id || '').trim();
    if (id === actor.profileId) {
      return NextResponse.json({ ok: false, error: 'self_lifecycle_change_forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const nextState = String(body?.state || '').trim().toUpperCase() as StaffLifecycleState;
    if (!STATES.has(nextState)) {
      return NextResponse.json({ ok: false, error: 'invalid_staff_lifecycle_state' }, { status: 400 });
    }

    const reason = cleanText(body?.reason, 1000);
    if ((nextState === 'SUSPENDED' || nextState === 'ARCHIVED') && !reason) {
      return NextResponse.json({ ok: false, error: 'lifecycle_reason_required' }, { status: 400 });
    }

    const target = await prisma.adminUserProfile.findUnique({
      where: { id },
      select: { id: true, lifecycleState: true, email: true, name: true },
    });
    if (!target) return NextResponse.json({ ok: false, error: 'staff_not_found' }, { status: 404 });

    if (!canTransitionStaffLifecycle(target.lifecycleState, nextState)) {
      return NextResponse.json({ ok: false, error: 'invalid_staff_lifecycle_transition', from: target.lifecycleState, to: nextState }, { status: 409 });
    }

    if (target.lifecycleState === nextState) {
      return NextResponse.json({ ok: true, state: nextState, unchanged: true });
    }

    const changedAt = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.adminUserProfile.update({
        where: { id },
        data: {
          lifecycleState: nextState,
          lifecycleChangedAt: changedAt,
          lifecycleChangedBy: actor.userId,
          lifecycleReason: reason,
          lastActivityAt: nextState === 'ACTIVE' ? undefined : changedAt,
        },
      });
      if (nextState === 'SUSPENDED' || nextState === 'ARCHIVED' || nextState === 'LEAVE') {
        await tx.adminStaffPresence.upsert({
          where: { staffProfileId: id },
          update: { state: 'OFFLINE', lastHeartbeatAt: changedAt, expiresAt: changedAt, updatedByUserId: actor.userId },
          create: { staffProfileId: id, state: 'OFFLINE', lastHeartbeatAt: changedAt, expiresAt: changedAt, updatedByUserId: actor.userId },
        });
      }
      await tx.auditLog.create({
        data: staffAuditData(request, actor, {
          action: 'admin.staff.lifecycle.changed',
          entityId: id,
          description: `Staff lifecycle changed from ${target.lifecycleState} to ${nextState}`,
          meta: { before: target.lifecycleState, after: nextState, reason },
        }),
      });
    });

    return NextResponse.json({ ok: true, state: nextState, changedAt });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return NextResponse.json(auth.body, { status: auth.status });
    console.error('[admin staff] lifecycle failed', error);
    return NextResponse.json({ ok: false, error: 'staff_lifecycle_failed' }, { status: 500 });
  }
}
