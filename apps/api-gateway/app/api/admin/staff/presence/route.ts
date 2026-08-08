import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
} from '@/src/lib/admin-staff-auth';
import { cleanText } from '@/src/lib/admin-staff-data';
import {
  effectivePresence,
  staffPresenceTtlMs,
  type StaffPresenceState,
} from '@/src/lib/admin-staff-policy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SELF_STATES = new Set<StaffPresenceState>(['AVAILABLE', 'BUSY', 'DO_NOT_DISTURB', 'OFFLINE']);

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAdminStaffActor(request);
    const row = await prisma.adminStaffPresence.findUnique({ where: { staffProfileId: actor.profileId } });
    return NextResponse.json({
      ok: true,
      presence: effectivePresence(row),
      expiresAt: row?.expiresAt || null,
      note: row?.note || null,
    }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return NextResponse.json(auth.body, { status: auth.status });
    return NextResponse.json({ ok: false, error: 'staff_presence_failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAdminStaffActor(request);
    const body = await request.json().catch(() => ({}));
    const requestedState = body?.state == null ? null : String(body.state).trim().toUpperCase() as StaffPresenceState;
    if (requestedState && !SELF_STATES.has(requestedState)) {
      return NextResponse.json({ ok: false, error: 'invalid_self_presence_state' }, { status: 400 });
    }
    const current = requestedState
      ? null
      : await prisma.adminStaffPresence.findUnique({ where: { staffProfileId: actor.profileId } });
    const currentEffective = effectivePresence(current);
    const state: StaffPresenceState = requestedState || (currentEffective === 'OFFLINE' ? 'AVAILABLE' : currentEffective);
    const note = Object.prototype.hasOwnProperty.call(body, 'note') ? cleanText(body?.note, 240) : (current?.note || null);
    const now = new Date();
    const expiresAt = state === 'OFFLINE' ? now : new Date(now.getTime() + staffPresenceTtlMs());

    const row = await prisma.$transaction(async (tx) => {
      const presence = await tx.adminStaffPresence.upsert({
        where: { staffProfileId: actor.profileId },
        update: { state, note, lastHeartbeatAt: now, expiresAt, updatedByUserId: actor.userId },
        create: { staffProfileId: actor.profileId, state, note, lastHeartbeatAt: now, expiresAt, updatedByUserId: actor.userId },
      });
      await tx.adminUserProfile.update({
        where: { id: actor.profileId },
        data: { lastActivityAt: now },
      });
      return presence;
    });

    return NextResponse.json({ ok: true, presence: effectivePresence(row, now), expiresAt: row.expiresAt, note: row.note });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return NextResponse.json(auth.body, { status: auth.status });
    console.error('[admin staff] presence failed', error);
    return NextResponse.json({ ok: false, error: 'staff_presence_failed' }, { status: 500 });
  }
}
