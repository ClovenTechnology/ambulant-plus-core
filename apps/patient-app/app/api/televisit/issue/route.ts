// apps/patient-app/app/api/televisit/issue/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { TelevisitRole } from '@prisma/client';
import { ipFromReq, safeUA, sha256Hex, randomToken } from '@/src/lib/televisit/security';
import { SignJWT } from 'jose';

type PersistedAppointmentParticipant = {
  partyId: string;
  role:
    | 'PRIMARY_PATIENT'
    | 'DEPENDANT_PATIENT'
    | 'OBSERVER'
    | 'CARE_ALLY'
    | 'SECOND_PATIENT_PARTICIPANT'
    | 'LEAD_CLINICIAN'
    | 'CO_CLINICIAN'
    | 'ADVISOR';
  name?: string | null;
  access?: {
    canJoinTelevisit?: boolean;
  };
};

function envFirst(names: string[]) {
  for (const n of names) {
    const v = process.env[n];
    if (v && v.trim()) return v.trim();
  }
  return '';
}

function envInt(name: string, fallback: number) {
  const v = process.env[name];
  const n = v != null ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function parseParticipants(meta: unknown): PersistedAppointmentParticipant[] {
  const obj =
    meta && typeof meta === 'object' && !Array.isArray(meta)
      ? (meta as Record<string, unknown>)
      : null;
  const list = Array.isArray(obj?.participants) ? obj?.participants : [];
  return list.filter(Boolean) as PersistedAppointmentParticipant[];
}

function toTelevisitRole(participantRole: PersistedAppointmentParticipant['role']): TelevisitRole {
  switch (participantRole) {
    case 'OBSERVER':
      return 'observer';
    case 'LEAD_CLINICIAN':
    case 'CO_CLINICIAN':
    case 'ADVISOR':
      return 'clinician';
    default:
      return 'patient';
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));

    const visitId = String(body.visitId || '').trim();
    const roomId = String(body.roomId || '').trim();
    const appointmentId = String(body.appointmentId || '').trim();
    const participantId = String(body.participantId || body.personId || '').trim();
    const force = !!body.force;

    if ((!visitId && !roomId) || !appointmentId || !participantId) {
      return NextResponse.json(
        { ok: false, error: 'visitId/roomId, appointmentId and participantId required' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const visit =
      (visitId ? await prisma.televisit.findUnique({ where: { id: visitId } }) : null) ||
      (roomId ? await prisma.televisit.findUnique({ where: { roomId } }) : null);

    if (!visit) {
      return NextResponse.json(
        { ok: false, error: 'Televisit not found' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { id: true, meta: true },
    });

    if (!appointment) {
      return NextResponse.json(
        { ok: false, error: 'Appointment not found' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const participant = parseParticipants(appointment.meta).find(
      (p) => p.partyId === participantId,
    );

    if (!participant) {
      return NextResponse.json(
        { ok: false, error: 'participant_not_authorized' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    if (participant.access?.canJoinTelevisit === false) {
      return NextResponse.json(
        { ok: false, error: 'participant_join_not_allowed' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const role = toTelevisitRole(participant.role);
    const uid = participant.partyId;

    const now = new Date();
    const joinOpen = now >= visit.joinOpensAt && now <= visit.joinClosesAt;
    if (!joinOpen) {
      return NextResponse.json(
        { ok: false, error: 'Join window not open', joinOpensAt: visit.joinOpensAt, joinClosesAt: visit.joinClosesAt },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const consent = await prisma.televisitConsent.findFirst({
      where: { visitId: visit.id, uid, role },
      orderBy: { acceptedAt: 'desc' },
      select: { id: true },
    });

    if (!consent) {
      return NextResponse.json(
        { ok: false, error: 'Consent required before issuing join ticket' },
        { status: 403, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const existing = await prisma.televisitJoinTicket.findFirst({
      where: { visitId: visit.id, uid, role, revokedAt: null, expiresAt: { gt: now } },
      orderBy: { issuedAt: 'desc' },
      select: { expiresAt: true },
    });

    if (existing && !force) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Active ticket already exists (client must keep token). Pass {force:true} to rotate.',
          expiresAt: existing.expiresAt,
        },
        { status: 409, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const joinSecret = envFirst(['TELEVISIT_JOIN_JWT_SECRET', 'RTC_JOIN_JWT_SECRET', 'JOIN_TICKET_JWT_SECRET']);
    if (!joinSecret) {
      return NextResponse.json(
        { ok: false, error: 'server_misconfig', message: 'Missing TELEVISIT_JOIN_JWT_SECRET' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const issuer = envFirst(['TELEVISIT_JOIN_JWT_ISSUER', 'JOIN_TICKET_JWT_ISSUER']);
    const audience = envFirst(['TELEVISIT_JOIN_JWT_AUDIENCE', 'JOIN_TICKET_JWT_AUDIENCE']);

    const ttlSec = envInt('TELEVISIT_JOIN_TOKEN_TTL_SEC', envInt('JOIN_TOKEN_TTL_SEC', 2 * 60 * 60));
    const expMsHard = Math.min(now.getTime() + ttlSec * 1000, new Date(visit.joinClosesAt).getTime());
    const expiresAt = new Date(expMsHard);

    const nbf = Math.floor((now.getTime() - 5_000) / 1000);
    const iat = Math.floor(now.getTime() / 1000);
    const exp = Math.floor(expiresAt.getTime() / 1000);

    const orgId = (visit as any)?.orgId ? String((visit as any).orgId) : 'org-default';

    const claims = {
      uid,
      role,
      visitId: visit.id,
      roomId: visit.roomId,
      orgId,
      appointmentId,
      participantId: participant.partyId,
    };

    const key = new TextEncoder().encode(joinSecret);

    let jwt = new SignJWT(claims)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(iat)
      .setNotBefore(nbf)
      .setExpirationTime(exp);

    if (issuer) {
      jwt = jwt.setIssuer(issuer);
    }

    if (audience) {
      jwt = jwt.setAudience(audience);
    }

    const joinJwt = await jwt.sign(key);
    const tokenHash = sha256Hex(joinJwt);

    const ip = ipFromReq(req);
    const ua = safeUA(req);

    await prisma.$transaction(async (tx) => {
      if (existing) {
        await tx.televisitJoinTicket.updateMany({
          where: { visitId: visit.id, uid, role, revokedAt: null, expiresAt: { gt: now } },
          data: { revokedAt: now },
        });
      }

      await tx.televisitJoinTicket.create({
        data: {
          visitId: visit.id,
          uid,
          role,
          tokenHash,
          expiresAt,
          ipHash: ip ? sha256Hex(ip) : null,
          userAgent: ua,
          orgId,
        },
      });
    });

    return NextResponse.json(
      {
        ok: true,
        joinToken: joinJwt,
        expiresAt,
        visitId: visit.id,
        roomId: visit.roomId,
        role,
        uid,
        orgId,
        appointmentId,
        participantId: participant.partyId,
        participantName: participant.name || null,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'Unknown error' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}