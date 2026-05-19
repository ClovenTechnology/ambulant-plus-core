// apps/api-gateway/app/api/televisit/issue/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import {
  getJoinWindowFromVisit,
  normalizeTelevisitRole,
  upsertTicket,
} from '@/src/lib/join';
import {
  readIdentity,
  requireTrustedIdentityInProduction,
} from '@/src/lib/identity';
import { resolveParticipantAdmission } from '@/src/lib/televisit/appointment-admission';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clean(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST,OPTIONS',
    'access-control-allow-headers':
      'content-type,authorization,cookie,x-uid,x-role,x-org-id,x-ambulant-identity,x-join-token',
    'cache-control': 'no-store',
  };
}

function isAdminLike(role: string) {
  return role === 'admin' || role === 'admin_staff' || role === 'system';
}

function actorCanUseParticipant(args: {
  actorRole: string;
  actorUid: string;
  actorRefId?: string | null;
  participant: any;
}) {
  const { actorRole, actorUid, actorRefId, participant } = args;
  if (isAdminLike(actorRole)) return true;

  const partyId = clean(participant?.partyId, 240);
  const patientId = clean(participant?.patientId, 240);
  const clinicianId = clean(participant?.clinicianId, 240);

  if (actorRole === 'clinician') {
    return clinicianId === actorUid || partyId === actorUid || partyId === `clin-${actorUid}`;
  }

  if (actorRole === 'patient') {
    return (
      patientId === actorUid ||
      patientId === actorRefId ||
      partyId === actorUid ||
      partyId === actorRefId ||
      partyId === `pat-${actorUid}` ||
      (actorRefId ? partyId === `pat-${actorRefId}` : false)
    );
  }

  return false;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(req: NextRequest) {
  try {
    const who = readIdentity(req.headers);
    requireTrustedIdentityInProduction(req.headers, who);

    if (!who.uid || who.role === 'anonymous') {
      return NextResponse.json(
        { ok: false, error: 'unauthorized' },
        { status: 401, headers: corsHeaders() },
      );
    }

    const body = await req.json().catch(() => ({} as any));
    const visitId = clean(body.visitId || body.id, 120);
    const requestedParticipantId = clean(
      body.participantId || body.participant_id || body.uid || body.partyId || '',
      240,
    );

    if (!visitId) {
      return NextResponse.json(
        { ok: false, error: 'visitId_required' },
        { status: 400, headers: corsHeaders() },
      );
    }

    const visit = await prisma.televisit.findUnique({ where: { id: visitId } });

    if (!visit) {
      return NextResponse.json(
        { ok: false, error: 'visit_not_found' },
        { status: 404, headers: corsHeaders() },
      );
    }

    if (!visit.appointmentId) {
      return NextResponse.json(
        { ok: false, error: 'appointment_context_required' },
        { status: 409, headers: corsHeaders() },
      );
    }

    if (!requestedParticipantId) {
      return NextResponse.json(
        { ok: false, error: 'participantId_required' },
        { status: 400, headers: corsHeaders() },
      );
    }

    const admission = await resolveParticipantAdmission({
      appointmentId: visit.appointmentId,
      participantId: requestedParticipantId,
      role: body.role ? clean(body.role, 80) : null,
    });

    if (
      !actorCanUseParticipant({
        actorRole: who.role,
        actorUid: who.uid,
        actorRefId: who.actorRefId,
        participant: admission.participant,
      })
    ) {
      return NextResponse.json(
        { ok: false, error: 'forbidden' },
        { status: 403, headers: corsHeaders() },
      );
    }

    const win = getJoinWindowFromVisit(visit);
    const now = Date.now();

    if (now < win.openAt) {
      return NextResponse.json(
        {
          ok: false,
          error: 'join_window_not_open',
          now,
          visitId,
          roomId: visit.roomId,
          window: {
            openAt: win.openAt,
            closeAt: win.closeAt,
            isOpen: false,
            opensAt: visit.joinOpensAt.toISOString(),
            closesAt: visit.joinClosesAt.toISOString(),
          },
        },
        { status: 403, headers: corsHeaders() },
      );
    }

    if (now > win.closeAt) {
      return NextResponse.json(
        {
          ok: false,
          error: 'join_window_closed',
          now,
          visitId,
          roomId: visit.roomId,
          window: {
            openAt: win.openAt,
            closeAt: win.closeAt,
            isOpen: false,
            opensAt: visit.joinOpensAt.toISOString(),
            closesAt: visit.joinClosesAt.toISOString(),
          },
        },
        { status: 403, headers: corsHeaders() },
      );
    }

    const ttlSec = Math.max(
      30,
      Number.parseInt(process.env.JOIN_TOKEN_TTL_SEC || '90', 10) || 90,
    );

    const role = normalizeTelevisitRole(admission.rtcRole);
    const ticket = await upsertTicket(visitId, admission.participant.partyId, ttlSec, role, req);

    return NextResponse.json(
      {
        ok: true,
        now,
        visit: {
          id: visit.id,
          roomId: visit.roomId,
          status: visit.status,
          appointmentId: visit.appointmentId,
          encounterId: visit.encounterId,
          scheduledStartAt: visit.scheduledStartAt.toISOString(),
          scheduledEndAt: visit.scheduledEndAt.toISOString(),
          joinOpensAt: visit.joinOpensAt.toISOString(),
          joinClosesAt: visit.joinClosesAt.toISOString(),
        },
        window: {
          openAt: win.openAt,
          closeAt: win.closeAt,
          isOpen: true,
          opensAt: visit.joinOpensAt.toISOString(),
          closesAt: visit.joinClosesAt.toISOString(),
        },
        ticket: {
          id: ticket.id,
          token: ticket.token || null,
          tokenHash: ticket.tokenHash,
          issuedAt: ticket.issuedAt.toISOString(),
          expiresAt: ticket.expiresAt.toISOString(),
          ttlSec,
          reused: !ticket.token,
        },
        actor: {
          uid: who.uid,
          role: who.role,
          participantId: admission.participant.partyId,
          participantRole: admission.participantRole,
        },
      },
      { headers: corsHeaders() },
    );
  } catch (err: any) {
    const code = String(err?.code || err?.message || '');

    if (code === 'Unauthorized' || code === 'unauthorized') {
      return NextResponse.json(
        { ok: false, error: 'unauthorized' },
        { status: 401, headers: corsHeaders() },
      );
    }

    if (
      code === 'participant_id_required' ||
      code === 'participant_not_authorized' ||
      code === 'participant_join_not_allowed' ||
      code === 'participant_role_mismatch'
    ) {
      return NextResponse.json(
        { ok: false, error: code },
        { status: 403, headers: corsHeaders() },
      );
    }

    console.error('[api-gateway][televisit/issue] error', err);
    return NextResponse.json(
      { ok: false, error: String(err?.message || 'televisit_issue_failed') },
      { status: 500, headers: corsHeaders() },
    );
  }
}
