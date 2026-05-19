import crypto from 'node:crypto';
import { SignJWT } from 'jose';
import { TelevisitRole } from '@prisma/client';
import { prisma } from './db';

export type JoinWindow = {
  openAt: number;
  closeAt: number;
  isOpen: boolean;
};

export type IssuedJoinTicket = {
  id: string;
  token: string;
  tokenHash: string;
  visitId: string;
  uid: string;
  role: TelevisitRole;
  issuedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
};

export function sha256Hex(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function getJoinWindowFromVisit(visit: {
  joinOpensAt: Date;
  joinClosesAt: Date;
}): JoinWindow {
  const openAt = visit.joinOpensAt.getTime();
  const closeAt = visit.joinClosesAt.getTime();
  const now = Date.now();

  return {
    openAt,
    closeAt,
    isOpen: now >= openAt && now <= closeAt,
  };
}

/**
 * Backward-compatible helper retained only for older imports.
 * New code should prefer getJoinWindowFromVisit().
 */
export function getJoinWindow(
  startMs: number,
  durMin: number,
  openLeadSec: number,
  closeLagSec: number,
) {
  const openAt = startMs - openLeadSec * 1000;
  const closeAt = startMs + durMin * 60_000 + closeLagSec * 1000;
  return { openAt, closeAt };
}

export function normalizeTelevisitRole(raw: unknown): TelevisitRole {
  const role = String(raw || '').trim().toLowerCase();

  if (role === 'clinician') return TelevisitRole.clinician;
  if (role === 'staff') return TelevisitRole.staff;
  if (role === 'observer') return TelevisitRole.observer;
  if (role === 'admin') return TelevisitRole.admin;

  return TelevisitRole.patient;
}

function envFirst(names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim()) return value.trim();
  }
  return '';
}

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

function cleanString(value: unknown, max = 240): string {
  return String(value ?? '').trim().slice(0, max);
}

function roleToParticipantRole(role: TelevisitRole): string {
  if (role === TelevisitRole.clinician) return 'lead_clinician';
  if (role === TelevisitRole.staff) return 'advisor';
  if (role === TelevisitRole.observer) return 'observer';
  if (role === TelevisitRole.admin) return 'advisor';
  return 'lead_patient';
}

function parseParticipants(meta: unknown): Array<Record<string, any>> {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return [];
  const raw = (meta as any).participants;
  return Array.isArray(raw) ? raw.filter(Boolean) : [];
}

async function resolveVisitTicketContext(args: {
  visit: any;
  uid: string;
  role: TelevisitRole;
}) {
  const visit = args.visit;

  const appointmentId = cleanString(visit.appointmentId, 160);
  if (!appointmentId) {
    throw new Error('visit_missing_appointment_id');
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true,
      clinicianId: true,
      patientId: true,
      subjectPatientId: true,
      hostUserId: true,
      meta: true,
    },
  });

  if (!appointment) {
    throw new Error('appointment_not_found_for_visit');
  }

  const participants = parseParticipants(appointment.meta);

  const matchingParticipant =
    participants.find((p) => cleanString(p.partyId, 240) === args.uid) ||
    participants.find((p) => {
      if (args.role === TelevisitRole.clinician) {
        return cleanString(p.clinicianId, 240) === args.uid || cleanString(p.partyId, 240) === appointment.clinicianId;
      }

      if (args.role === TelevisitRole.patient) {
        return (
          cleanString(p.patientId, 240) === args.uid ||
          cleanString(p.partyId, 240) === args.uid ||
          cleanString(p.partyId, 240) === appointment.subjectPatientId ||
          cleanString(p.partyId, 240) === appointment.patientId
        );
      }

      return false;
    }) ||
    (args.role === TelevisitRole.clinician
      ? {
          partyId: appointment.clinicianId,
          role: 'LEAD_CLINICIAN',
          clinicianId: appointment.clinicianId,
          required: true,
        }
      : null) ||
    (args.role === TelevisitRole.patient
      ? {
          partyId: appointment.subjectPatientId || appointment.patientId,
          role: 'PRIMARY_PATIENT',
          patientId: appointment.subjectPatientId || appointment.patientId,
          required: true,
        }
      : null);

  const participantId = cleanString(matchingParticipant?.partyId || args.uid, 240);

  if (!participantId) {
    throw new Error('participant_id_required');
  }

  return {
    appointmentId: appointment.id,
    participantId,
    participantRole: roleToParticipantRole(args.role),
  };
}

async function makeJoinJwt(args: {
  visit: any;
  uid: string;
  role: TelevisitRole;
  ttlSec: number;
}) {
  const secret = envFirst([
    'TELEVISIT_JOIN_JWT_SECRET',
    'RTC_JOIN_JWT_SECRET',
    'JOIN_TICKET_JWT_SECRET',
    'TELEVISIT_JOIN_TICKET_SECRET',
  ]);

  if (!secret) {
    throw new Error('missing_join_jwt_secret');
  }

  const nbf = nowSec();
  const visitClosesAtSec = Math.floor(new Date(args.visit.joinClosesAt).getTime() / 1000);
  const desiredTtl = Math.max(30, Math.min(Number(args.ttlSec || 90), 30 * 60));
  const exp = Math.min(nbf + desiredTtl, visitClosesAtSec);

  if (exp <= nbf + 10) {
    throw new Error('join_ticket_ttl_too_short');
  }

  const ctx = await resolveVisitTicketContext({
    visit: args.visit,
    uid: args.uid,
    role: args.role,
  });

  const ticketUid = ctx.participantId;

  const issuer = envFirst(['TELEVISIT_JOIN_JWT_ISSUER', 'JOIN_TICKET_JWT_ISSUER']);
  const audience = envFirst(['TELEVISIT_JOIN_JWT_AUDIENCE', 'JOIN_TICKET_JWT_AUDIENCE']);

  let jwt = new SignJWT({
    // IMPORTANT:
    // uid/sub must match Appointment.meta.participants[].partyId,
    // because /api/rtc/token enforces ticket.uid === participant.partyId.
    uid: ticketUid,
    sub: ticketUid,
    userId: args.uid,
    actorUid: args.uid,

    role: args.role,
    televisitRole: args.role,
    roomId: args.visit.roomId,
    rid: args.visit.roomId,
    visitId: args.visit.id,
    vid: args.visit.id,
    orgId: args.visit.orgId || 'org-default',
    appointmentId: ctx.appointmentId,
    participantId: ctx.participantId,
    participantRole: ctx.participantRole,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(nbf)
    .setNotBefore(nbf)
    .setExpirationTime(exp)
    .setJti(crypto.randomUUID());

  if (issuer) jwt = jwt.setIssuer(issuer);
  if (audience) jwt = jwt.setAudience(audience);

  const token = await jwt.sign(new TextEncoder().encode(secret));

  return {
    token,
    expiresAt: new Date(exp * 1000),
    ticketUid,
  };
}

/**
 * Legacy name retained for older imports.
 * It now returns a JWT-compatible join ticket, not the old opaque TV.* token.
 */
export async function upsertTicket(
  visitId: string,
  uid: string,
  ttlSec: number,
  role: TelevisitRole = TelevisitRole.patient,
  req?: Request,
): Promise<IssuedJoinTicket> {
  const now = new Date();
  const minReusableExpiry = new Date(Date.now() + 10_000);

  const visit = await prisma.televisit.findUnique({
    where: { id: visitId },
  });

  if (!visit) {
    throw new Error('visit_not_found');
  }

  const issued = await makeJoinJwt({
    visit,
    uid,
    role,
    ttlSec,
  });

  const ticketUid = issued.ticketUid;

  const existing = await prisma.televisitJoinTicket.findFirst({
    where: {
      visitId,
      uid: ticketUid,
      role,
      revokedAt: null,
      expiresAt: { gt: minReusableExpiry },
    },
    orderBy: { issuedAt: 'desc' },
  });

  if (existing) {
    return {
      id: existing.id,
      token: '',
      tokenHash: existing.tokenHash,
      visitId: existing.visitId,
      uid: existing.uid,
      role: existing.role,
      issuedAt: existing.issuedAt,
      expiresAt: existing.expiresAt,
      revokedAt: existing.revokedAt,
    };
  }

  const tokenHash = sha256Hex(issued.token);

  const userAgent = req?.headers.get('user-agent') || null;
  const ip =
    req?.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req?.headers.get('x-real-ip') ||
    null;

  const created = await prisma.televisitJoinTicket.create({
    data: {
      visitId,
      uid: ticketUid,
      role,
      tokenHash,
      issuedAt: now,
      expiresAt: issued.expiresAt,
      userAgent,
      ipHash: ip ? sha256Hex(ip) : null,
      orgId: visit.orgId || 'org-default',
    },
  });

  return {
    id: created.id,
    token: issued.token,
    tokenHash: created.tokenHash,
    visitId: created.visitId,
    uid: created.uid,
    role: created.role,
    issuedAt: created.issuedAt,
    expiresAt: created.expiresAt,
    revokedAt: created.revokedAt,
  };
}

export async function verifyJoinToken(token: string) {
  const tokenHash = sha256Hex(token);
  const now = new Date();

  const ticket = await prisma.televisitJoinTicket.findUnique({
    where: { tokenHash },
    include: { visit: true },
  });

  if (!ticket) throw new Error('invalid_join_token');
  if (ticket.revokedAt) throw new Error('ticket_revoked');
  if (ticket.expiresAt <= now) throw new Error('ticket_expired');
  if (ticket.visit.joinOpensAt > now) throw new Error('join_window_not_open');
  if (ticket.visit.joinClosesAt < now) throw new Error('join_window_closed');

  await prisma.televisitJoinTicket
    .update({
      where: { id: ticket.id },
      data: { lastUsedAt: now },
    })
    .catch(() => null);

  return {
    uid: ticket.uid,
    role: ticket.role,
    visitId: ticket.visitId,
    roomId: ticket.visit.roomId,
    ticketId: ticket.id,
    visit: ticket.visit,
  };
}