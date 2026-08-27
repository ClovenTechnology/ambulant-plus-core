import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import { upsertTicket } from '@/src/lib/join';
import {
  AvailabilityError,
  listAvailabilitySlots,
  validateAvailabilityInterval,
} from '@/src/availability/resolver';
import { verifyAdminRequest } from '../../utils/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REQUIRED_PASSES = 3;
const JOIN_OPEN_MIN = 15;
const JOIN_LATE_MIN = 30;
const CLOSED_STATUSES = new Set([
  'cancelled', 'canceled', 'no_show', 'no-show', 'completed', 'complete',
  'closed', 'ended', 'archived', 'expired', 'failed', 'declined',
]);
const ASSESSMENT_DOMAINS = [
  'identityPrivacy', 'communication', 'historyTaking', 'iomtUse',
  'clinicalReasoning', 'safetyEscalation', 'documentation',
] as const;
const ASSESSMENT_LABELS: Record<string, string> = {
  identityPrivacy: 'Identity & privacy',
  communication: 'Communication',
  historyTaking: 'History taking',
  iomtUse: 'IoMT use',
  clinicalReasoning: 'Clinical reasoning',
  safetyEscalation: 'Safety & escalation',
  documentation: 'Documentation',
};

type SupervisorMode = 'OBSERVE' | 'COACH';

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'cache-control': 'no-store, max-age=0',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
      'access-control-allow-headers':
        'content-type,authorization,cookie,x-uid,x-role,x-org-id,x-ambulant-identity',
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,PATCH,OPTIONS',
      'access-control-allow-headers':
        'content-type,authorization,cookie,x-uid,x-role,x-org-id,x-ambulant-identity',
    },
  });
}

function clean(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}
function optional(value: unknown, max = 240): string | null {
  const valueClean = clean(value, max);
  return valueClean || null;
}
function record(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}
function array(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}
function int(value: unknown, min: number, max: number): number | null {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const rounded = Math.trunc(number);
  return rounded >= min && rounded <= max ? rounded : null;
}
function date(value: unknown): Date | null {
  const raw = clean(value, 120);
  if (!raw) return null;
  const result = new Date(raw);
  return Number.isFinite(result.getTime()) ? result : null;
}
function addMinutes(value: Date, minutes: number) {
  return new Date(value.getTime() + minutes * 60_000);
}
function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}`;
}
function statusClosed(value: unknown) {
  return CLOSED_STATUSES.has(clean(value, 80).toLowerCase());
}
function normalizeMode(value: unknown): SupervisorMode {
  return clean(value, 30).toUpperCase() === 'COACH' ? 'COACH' : 'OBSERVE';
}
function normalizeSchedulingMode(value: unknown) {
  return clean(value, 40).toLowerCase() === 'custom' ? 'custom' : 'availability';
}
function appOrigin(req: NextRequest, names: string[], fallback: string) {
  for (const name of names) {
    const value = clean(process.env[name], 500);
    if (value) return value.replace(/\/+$/, '');
  }
  const origin = clean(req.headers.get('origin'), 500);
  return (origin || fallback).replace(/\/+$/, '');
}
function adminUid(req: NextRequest) {
  return clean(req.headers.get('x-uid'), 160) || 'admin';
}
function sessionNumberOf(meta: unknown, reason?: string | null) {
  const m = record(meta);
  const direct = int(m.sessionNumber, 1, 99);
  if (direct) return direct;
  const match = clean(reason || m.reason, 500).match(/(?:session|consultation)\s+(\d+)(?:\s*(?:of|\/)\s*3)?/i);
  return match ? int(match[1], 1, 99) : null;
}
function assessmentOf(meta: unknown) {
  return record(record(meta).simulationAssessment);
}
function finalizedPass(meta: unknown) {
  const assessment = assessmentOf(meta);
  return assessment.status === 'finalized' && assessment.outcome === 'PASS';
}
function supervisorOf(meta: unknown) {
  return record(record(meta).simulationSupervisor);
}
function participantsOf(meta: unknown) {
  return array(record(meta).participants).filter((item) => item && typeof item === 'object');
}
function sessionView(row: any) {
  const meta = record(row.meta);
  const assessment = assessmentOf(meta);
  const supervisor = supervisorOf(meta);
  return {
    appointmentId: row.id,
    encounterId: row.encounterId,
    caseId: row.caseId,
    clinicianId: row.clinicianId,
    patientId: row.patientId,
    subjectPatientId: row.subjectPatientId,
    roomId: row.roomId,
    reason: row.reason,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    status: row.status,
    paymentStatus: row.paymentStatus,
    bookingSource: row.bookingSource,
    sessionNumber: sessionNumberOf(meta, row.reason),
    patientDisplayName: optional(meta.patientDisplayName, 180),
    scenario: optional(meta.scenario, 2000),
    learningObjectives: array(meta.learningObjectives).map((v) => clean(v, 400)).filter(Boolean),
    expectedIoMTs: array(meta.expectedIoMTs).map((v) => clean(v, 120)).filter(Boolean),
    schedulingMode: meta.schedulingMode === 'custom' ? 'custom' : 'availability',
    customSchedulingReason: optional(meta.customSchedulingReason, 500),
    supervisor: {
      id: optional(supervisor.id, 160),
      userId: optional(supervisor.userId, 160),
      partyId: optional(supervisor.partyId, 240),
      name: optional(supervisor.name, 180),
      email: optional(supervisor.email, 240),
      mode: normalizeMode(supervisor.mode),
    },
    assessment: assessment.status
      ? {
          status: assessment.status,
          outcome: assessment.outcome || null,
          domains: record(assessment.domains),
          strengths: assessment.strengths || '',
          developmentPoints: assessment.developmentPoints || '',
          summary: assessment.summary || '',
          recommendation: assessment.recommendation || '',
          finalizedAt: assessment.finalizedAt || null,
          assessedByUserId: assessment.assessedByUserId || null,
        }
      : null,
    passed: finalizedPass(meta),
    joinWindow: {
      opensAt: meta.joinOpensAt || null,
      closesAt: meta.joinClosesAt || null,
    },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function requireAdmin(req: NextRequest) {
  const result = await verifyAdminRequest(req as any);
  if (!result.ok) return { response: result.response };
  return { response: null as NextResponse | null };
}

async function clinicianByRef(ref: string) {
  return (prisma as any).clinicianProfile.findFirst({
    where: { OR: [{ id: ref }, { userId: ref }] },
    select: {
      id: true, userId: true, displayName: true, specialty: true, email: true,
      trainingCompleted: true, disabled: true, archived: true, status: true, meta: true,
    },
  });
}

async function patientByRef(ref: string, email?: string | null) {
  const filters: any[] = [];
  if (ref) filters.push({ id: ref }, { userId: ref }, { mrn: ref });
  if (email) filters.push({ contactEmail: { equals: email, mode: 'insensitive' } });
  if (!filters.length) return null;
  return (prisma as any).patientProfile.findFirst({
    where: { OR: filters },
    select: { id: true, userId: true, mrn: true, name: true, contactEmail: true, phone: true },
  });
}

async function resolveSimulationPatient(body: any) {
  const requestedRef = clean(body.patientId || body.patientRef, 160);
  const requestedEmail = optional(body.patientEmail, 240);
  if (requestedRef || requestedEmail) return patientByRef(requestedRef, requestedEmail);

  const envRef = clean(
    process.env.ADMIN_SIMULATION_PATIENT_ID || process.env.SIMULATION_PATIENT_ID,
    160,
  );
  const envEmail = optional(
    process.env.ADMIN_SIMULATION_PATIENT_EMAIL || process.env.SIMULATION_PATIENT_EMAIL,
    240,
  );
  return patientByRef(envRef, envEmail);
}

async function supervisorByRef(ref: string) {
  if (!ref) return null;
  return (prisma as any).adminUserProfile.findFirst({
    where: { OR: [{ id: ref }, { userId: ref }, { email: ref }] },
    select: { id: true, userId: true, email: true, name: true, lifecycleState: true },
  });
}

function participantMatch(row: any, args: { clinicianId: string; patientId: string; supervisorUserId: string }) {
  const supervisor = supervisorOf(row.meta);
  return (
    clean(row.clinicianId, 160) === args.clinicianId ||
    clean(row.patientId, 160) === args.patientId ||
    clean(row.subjectPatientId, 160) === args.patientId ||
    clean(supervisor.userId, 160) === args.supervisorUserId
  );
}

async function findActiveOverlap(args: {
  startsAt: Date;
  endsAt: Date;
  clinicianId: string;
  patientId: string;
  supervisorUserId: string;
  excludeAppointmentId?: string | null;
}) {
  const rows = await (prisma as any).appointment.findMany({
    where: {
      startsAt: { lt: args.endsAt },
      endsAt: { gt: args.startsAt },
      ...(args.excludeAppointmentId ? { id: { not: args.excludeAppointmentId } } : {}),
    },
    select: {
      id: true, clinicianId: true, patientId: true, subjectPatientId: true,
      startsAt: true, endsAt: true, status: true, bookingSource: true, meta: true,
    },
  });

  return rows.find((row: any) => !statusClosed(row.status) && participantMatch(row, args)) || null;
}

async function validateSchedule(args: {
  clinicianId: string;
  startsAt: Date;
  endsAt: Date;
  schedulingMode: string;
  customReason: string | null;
  excludeAppointmentId?: string | null;
}) {
  if (args.schedulingMode === 'custom') {
    if (!args.customReason || args.customReason.length < 5) {
      const error: any = new Error('custom_scheduling_reason_required');
      error.status = 400;
      throw error;
    }
    return;
  }

  await validateAvailabilityInterval({
    clinicianRef: args.clinicianId,
    startsAt: args.startsAt,
    endsAt: args.endsAt,
    consultType: 'standard',
    allowExtendedDuration: false,
    excludeAppointmentId: args.excludeAppointmentId || null,
    enforceBookability: true,
    enforceAdvanceWindow: true,
    enforceConflicts: true,
  });
}

async function validateExtendedAvailability(args: {
  clinicianId: string;
  startsAt: Date;
  endsAt: Date;
  excludeAppointmentId: string;
}) {
  await validateAvailabilityInterval({
    clinicianRef: args.clinicianId,
    startsAt: args.startsAt,
    endsAt: args.endsAt,
    consultType: 'standard',
    allowExtendedDuration: true,
    excludeAppointmentId: args.excludeAppointmentId,
    enforceBookability: false,
    enforceAdvanceWindow: false,
    enforceConflicts: false,
  });
}

async function revokeVisitTickets(visitId: string) {
  await (prisma as any).televisitJoinTicket.updateMany({
    where: { visitId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

function joinPath(args: {
  roomId: string;
  visitId: string;
  appointmentId: string;
  participantId: string;
  token: string;
  mode: SupervisorMode;
}) {
  const query = new URLSearchParams({
    appointmentId: args.appointmentId,
    visitId: args.visitId,
    participantId: args.participantId,
    uid: args.participantId,
    participantRole: 'observer',
    role: 'observer',
    joinToken: args.token,
    jt: args.token,
    simulation: '1',
    supervisorMode: args.mode,
  });
  return `/sfu/${encodeURIComponent(args.roomId)}?${query.toString()}`;
}

async function audit(args: {
  appointmentId: string;
  action: string;
  actorUserId: string;
  reason?: string | null;
  beforeJson?: any;
  afterJson?: any;
  orgId?: string | null;
}) {
  await (prisma as any).appointmentAuditEvent.create({
    data: {
      appointmentId: args.appointmentId,
      action: args.action,
      actorType: 'admin',
      actorUserId: args.actorUserId,
      reason: args.reason || null,
      beforeJson: args.beforeJson ?? undefined,
      afterJson: args.afterJson ?? undefined,
      orgId: args.orgId || '',
    },
  }).catch(() => null);
}

export async function GET(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if (gate.response) return gate.response;

    const mode = clean(req.nextUrl.searchParams.get('mode'), 40).toLowerCase();
    const clinicianId = clean(req.nextUrl.searchParams.get('clinicianId'), 160);

    if (mode === 'clinicians') {
      const q = clean(req.nextUrl.searchParams.get('q'), 120);
      const rows = await (prisma as any).clinicianProfile.findMany({
        where: {
          trainingCompleted: true,
          disabled: false,
          archived: false,
          ...(q
            ? { OR: [
                { displayName: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
                { specialty: { contains: q, mode: 'insensitive' } },
              ] }
            : {}),
        },
        orderBy: [{ displayName: 'asc' }, { createdAt: 'asc' }],
        take: 80,
        select: { id: true, userId: true, displayName: true, email: true, specialty: true, status: true, trainingCompleted: true },
      });
      return json({ ok: true, clinicians: rows });
    }

    if (mode === 'availability') {
      if (!clinicianId) return json({ ok: false, error: 'clinicianId_required' }, 400);
      const from = clean(req.nextUrl.searchParams.get('from'), 10) || new Date().toISOString().slice(0, 10);
      const days = int(req.nextUrl.searchParams.get('days'), 1, 31) || 14;
      const result = await listAvailabilitySlots({
        clinicianRef: clinicianId,
        from,
        days,
        consultType: 'standard',
        includeUnavailable: false,
        enforceBookability: true,
        enforceAdvanceWindow: true,
      });
      return json({ ok: true, slots: result.slots, meta: result.meta });
    }

    const where: any = { bookingSource: 'admin_simulation' };
    if (clinicianId) where.clinicianId = clinicianId;

    const rows = await (prisma as any).appointment.findMany({
      where,
      orderBy: [{ startsAt: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true, encounterId: true, caseId: true, clinicianId: true, patientId: true,
        subjectPatientId: true, roomId: true, reason: true, startsAt: true, endsAt: true,
        status: true, paymentStatus: true, bookingSource: true, createdAt: true, updatedAt: true, meta: true,
      },
    });
    const sessions = rows.map(sessionView);
    const passedNumbers = new Set(
      sessions.filter((item: any) => item.passed && item.sessionNumber).map((item: any) => item.sessionNumber),
    );
    const createdNumbers = new Set(sessions.map((item: any) => item.sessionNumber).filter(Boolean));

    let clinician: any = null;
    if (clinicianId) clinician = await clinicianByRef(clinicianId);
    const clinicianMeta = record(clinician?.meta);
    const realPatientApproval = record(clinicianMeta.realPatientApproval);
    const visibleToPatients =
      clean(clinician?.status, 40).toLowerCase() === 'active' &&
      clinician?.disabled !== true && clinician?.archived !== true;

    return json({
      ok: true,
      clinicianId: clinician?.id || clinicianId || null,
      requiredSessions: REQUIRED_PASSES,
      createdCount: createdNumbers.size || sessions.length,
      completedCount: passedNumbers.size,
      passCount: passedNumbers.size,
      readyForApproval: passedNumbers.size >= REQUIRED_PASSES,
      visibleToPatients,
      realPatientApprovedAt: realPatientApproval.approvedAt || clinicianMeta.realPatientApprovedAt || null,
      realPatientApproval,
      sessions,
    });
  } catch (error: any) {
    if (error instanceof AvailabilityError) {
      return json({ ok: false, error: error.code, details: error.details }, error.status);
    }
    console.error('[api-gateway][admin][simulation][GET]', error);
    return json({ ok: false, error: clean(error?.message, 300) || 'simulation_status_failed' }, error?.status || 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if (gate.response) return gate.response;
    const body = await req.json().catch(() => ({} as any));
    const action = clean(body.action, 60).toLowerCase();

    if (action === 'supervisor_admission') {
      const appointmentId = clean(body.appointmentId, 160);
      if (!appointmentId) return json({ ok: false, error: 'appointmentId_required' }, 400);
      const appointment = await (prisma as any).appointment.findUnique({
        where: { id: appointmentId },
        select: { id: true, roomId: true, status: true, startsAt: true, endsAt: true, bookingSource: true, meta: true, orgId: true },
      });
      if (!appointment || appointment.bookingSource !== 'admin_simulation') return json({ ok: false, error: 'simulation_not_found' }, 404);
      if (statusClosed(appointment.status)) return json({ ok: false, error: 'simulation_closed' }, 409);
      const supervisor = supervisorOf(appointment.meta);
      const actor = adminUid(req);
      if (!actor || actor === 'admin' || ![clean(supervisor.userId, 160), clean(supervisor.id, 160)].includes(actor)) {
        return json({ ok: false, error: 'assigned_supervisor_required' }, 403);
      }
      const visit = await (prisma as any).televisit.findFirst({ where: { appointmentId }, orderBy: { createdAt: 'desc' } });
      if (!visit) return json({ ok: false, error: 'televisit_not_found' }, 404);
      const now = new Date();
      if (visit.joinOpensAt > now) return json({ ok: false, error: 'join_window_not_open', joinOpensAt: visit.joinOpensAt }, 409);
      if (visit.joinClosesAt < now) return json({ ok: false, error: 'join_window_closed', joinClosesAt: visit.joinClosesAt }, 409);
      const partyId = clean(supervisor.partyId, 240);
      if (!partyId) return json({ ok: false, error: 'supervisor_participant_missing' }, 409);
      await (prisma as any).televisitJoinTicket.updateMany({
        where: { visitId: visit.id, uid: partyId, role: 'observer', revokedAt: null },
        data: { revokedAt: now },
      });
      const ttl = Math.max(60, Math.min(900, Math.floor((visit.joinClosesAt.getTime() - now.getTime()) / 1000)));
      const ticket = await upsertTicket(visit.id, partyId, ttl, 'observer' as any, req as any);
      if (!ticket?.token) return json({ ok: false, error: 'supervisor_admission_not_issued' }, 500);
      const mode = normalizeMode(supervisor.mode);
      const path = joinPath({ roomId: visit.roomId, visitId: visit.id, appointmentId, participantId: partyId, token: ticket.token, mode });
      return json({
        ok: true,
        admission: {
          role: 'observer', mode, token: ticket.token, expiresAt: ticket.expiresAt,
          participantId: partyId, roomId: visit.roomId, visitId: visit.id,
          path,
          url: `${appOrigin(req, ['CLINICIAN_APP_ORIGIN', 'NEXT_PUBLIC_CLINICIAN_APP_ORIGIN'], 'https://clinician.ambulantplus.co.za')}${path}`,
        },
      });
    }

    const clinicianRef = clean(body.clinicianId, 160);
    const sessionNumber = int(body.sessionNumber, 1, 99);
    const startsAt = date(body.startsAt);
    const durationMinutes = int(body.durationMinutes, 10, 120);
    if (!clinicianRef) return json({ ok: false, error: 'clinicianId_required' }, 400);
    if (!sessionNumber) return json({ ok: false, error: 'sessionNumber_required' }, 400);
    if (!startsAt) return json({ ok: false, error: 'startsAt_required' }, 400);
    if (!durationMinutes) return json({ ok: false, error: 'durationMinutes_required' }, 400);
    if (startsAt <= new Date()) return json({ ok: false, error: 'startsAt_must_be_future' }, 409);

    const clinician = await clinicianByRef(clinicianRef);
    if (!clinician) return json({ ok: false, error: 'clinician_not_found' }, 404);
    if (clinician.disabled || clinician.archived) return json({ ok: false, error: 'clinician_not_active' }, 409);
    if (!clinician.trainingCompleted) return json({ ok: false, error: 'training_not_completed' }, 409);

    const patient = await resolveSimulationPatient(body);
    if (!patient) return json({ ok: false, error: 'canonical_simulation_patient_required' }, 409);
    const supervisorRef = clean(body.supervisorId || body.supervisorUserId || body.supervisorEmail, 240);
    const supervisor = await supervisorByRef(supervisorRef);
    if (!supervisor) return json({ ok: false, error: 'supervisor_not_found' }, 404);
    if (String(supervisor.lifecycleState || '').toUpperCase() !== 'ACTIVE') return json({ ok: false, error: 'supervisor_not_active' }, 409);

    const existingSessions = await (prisma as any).appointment.findMany({
      where: { clinicianId: clinician.id, bookingSource: 'admin_simulation' },
      select: { id: true, reason: true, status: true, meta: true },
    });
    const duplicate = existingSessions.find((row: any) => {
      if (sessionNumberOf(row.meta, row.reason) !== sessionNumber) return false;
      return !statusClosed(row.status) || finalizedPass(row.meta);
    });
    if (duplicate) return json({ ok: false, error: 'simulation_session_number_conflict', appointmentId: duplicate.id }, 409);

    const endsAt = addMinutes(startsAt, durationMinutes);
    const schedulingMode = normalizeSchedulingMode(body.schedulingMode);
    const customSchedulingReason = optional(body.customSchedulingReason, 500);
    await validateSchedule({
      clinicianId: clinician.id, startsAt, endsAt, schedulingMode,
      customReason: customSchedulingReason,
    });
    const collision = await findActiveOverlap({
      startsAt, endsAt, clinicianId: clinician.id, patientId: patient.id,
      supervisorUserId: supervisor.userId,
    });
    if (collision) {
      return json({
        ok: false, error: 'simulation_time_conflict', conflict: {
          appointmentId: collision.id, startsAt: collision.startsAt, endsAt: collision.endsAt,
        },
      }, 409);
    }

    const appointmentId = uid('sim-appt');
    const encounterId = uid('sim-enc');
    const caseId = uid('sim-case');
    const roomId = `simulation-${clinician.id.slice(-8)}-${Date.now()}`;
    const clinicianPartyId = `clin-${clinician.id}`;
    const patientPartyId = `pat-${patient.id}`;
    const supervisorPartyId = `sup-${supervisor.userId}`;
    const joinOpensAt = addMinutes(startsAt, -JOIN_OPEN_MIN);
    const joinClosesAt = addMinutes(endsAt, JOIN_LATE_MIN);
    const actor = adminUid(req);
    const identityOrgId = optional(readIdentity(req.headers).orgId, 120);
    const orgId = identityOrgId || optional(process.env.DEFAULT_ORG_ID, 120) || 'org-default';
    const reason = optional(body.reason, 500) ||
      (sessionNumber <= REQUIRED_PASSES
        ? `Supervised simulation consultation ${sessionNumber}/${REQUIRED_PASSES}`
        : `Extra supervised simulation consultation ${sessionNumber}`);
    const patientName = optional(patient.name, 180) || optional(patient.contactEmail, 180) || `Simulation Patient ${sessionNumber}`;
    const supervisorMode = normalizeMode(body.supervisorMode);
    const scenario = optional(body.scenario, 2000);
    const learningObjectives = array(body.learningObjectives).map((v) => clean(v, 400)).filter(Boolean).slice(0, 20);
    const expectedIoMTs = array(body.expectedIoMTs).map((v) => clean(v, 120)).filter(Boolean).slice(0, 20);

    const appointmentMeta = {
      simulation: true,
      billingMode: 'simulation',
      source: 'admin.simulation',
      supervised: true,
      sessionNumber,
      paymentWaived: true,
      createdByAdminId: actor,
      patientDisplayName: patientName,
      scenario,
      learningObjectives,
      expectedIoMTs,
      schedulingMode,
      customSchedulingReason,
      joinOpensAt: joinOpensAt.toISOString(),
      joinClosesAt: joinClosesAt.toISOString(),
      simulationSupervisor: {
        id: supervisor.id,
        userId: supervisor.userId,
        partyId: supervisorPartyId,
        name: supervisor.name || supervisor.email,
        email: supervisor.email,
        mode: supervisorMode,
      },
      participants: [
        {
          partyId: clinicianPartyId, role: 'LEAD_CLINICIAN', clinicianId: clinician.id,
          name: clinician.displayName || 'Clinician', specialty: clinician.specialty || null,
          required: true, source: 'implicit',
          access: { canJoinTelevisit: true, canViewHealth: true, canBookAppointments: false },
        },
        {
          partyId: patientPartyId, role: 'PRIMARY_PATIENT', patientId: patient.id,
          name: patientName, required: true, source: 'requested',
          access: { canJoinTelevisit: true, canViewHealth: false, canBookAppointments: false },
        },
        {
          partyId: supervisorPartyId, role: 'OBSERVER', adminUserId: supervisor.userId,
          name: supervisor.name || supervisor.email, required: true, source: 'assigned',
          access: {
            canJoinTelevisit: true, canViewHealth: true, canBookAppointments: false,
            canPublishMicrophone: supervisorMode === 'COACH', canPublishCamera: false, canPublishData: false,
          },
        },
      ],
      simulationChecklist: {
        appointmentBooked: true, televisitCreated: true, tokenFlowRequired: true,
        freshAdmissionRequired: true, cardPaymentRequired: false,
        medicalAidClaimRequired: false, payoutEligible: false,
      },
    };

    const created = await (prisma as any).$transaction(async (tx: any) => {
      await tx.clinicalCase.create({
        data: {
          id: caseId, patientId: patient.id, leadClinicianId: clinician.id,
          title: `Simulation session ${sessionNumber}`, summary: scenario,
          status: 'open', priority: 'routine', orgId,
        },
      });
      const encounter = await tx.encounter.create({
        data: {
          id: encounterId, caseId, patientId: patient.id, clinicianId: clinician.id,
          visitMode: 'TELEVISIT', status: 'simulation_scheduled', orgId,
          summaryPayload: { simulation: true, source: 'admin.simulation', sessionNumber },
        },
      });
      const appointment = await tx.appointment.create({
        data: {
          id: appointmentId, encounterId: encounter.id, caseId,
          clinicianId: clinician.id, patientId: patient.id, subjectPatientId: patient.id,
          roomId, reason, kind: 'STANDARD', visitMode: 'TELEVISIT', startsAt, endsAt,
          status: 'confirmed', confirmedAt: new Date(), paymentStatus: 'NOT_REQUIRED',
          paymentProvider: 'simulation', paymentRef: `simulation-waived-${appointmentId}`,
          priceCents: 0, currency: 'ZAR', platformFeeCents: 0, clinicianTakeCents: 0,
          amountMinor: 0, subtotalMinor: 0, taxMinor: 0, discountMinor: 0, totalMinor: 0,
          patientCopayMinor: 0, sponsorAmountMinor: 0, sponsorCurrency: 'ZAR',
          coverageDecision: 'simulation_not_billable', bookingSource: 'admin_simulation',
          meta: appointmentMeta, orgId,
        },
      });
      const televisit = await tx.televisit.create({
        data: {
          appointmentId: appointment.id, encounterId: encounter.id, roomId,
          scheduledStartAt: startsAt, scheduledEndAt: endsAt,
          joinOpensAt, joinClosesAt, status: 'planned', orgId,
        },
      });
      return { appointment, televisit };
    });

    await audit({
      appointmentId, action: 'simulation_appointment_created', actorUserId: actor, reason, orgId,
      afterJson: {
        clinicianId: clinician.id, patientId: patient.id, supervisorUserId: supervisor.userId,
        supervisorMode, sessionNumber, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(),
      },
    });

    return json({
      ok: true,
      appointment: sessionView({ ...created.appointment, createdAt: new Date(), updatedAt: new Date() }),
      televisit: {
        id: created.televisit.id, roomId: created.televisit.roomId,
        joinOpensAt: created.televisit.joinOpensAt, joinClosesAt: created.televisit.joinClosesAt,
        scheduledStartAt: created.televisit.scheduledStartAt, scheduledEndAt: created.televisit.scheduledEndAt,
        status: created.televisit.status,
      },
      join: { admissionPolicy: 'fresh_on_entry', tokenIssued: false },
    }, 201);
  } catch (error: any) {
    if (error instanceof AvailabilityError) {
      return json({ ok: false, error: error.code, details: error.details }, error.status);
    }
    console.error('[api-gateway][admin][simulation][POST]', error);
    return json({ ok: false, error: clean(error?.message, 300) || 'simulation_appointment_failed' }, error?.status || 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const gate = await requireAdmin(req);
    if (gate.response) return gate.response;
    const body = await req.json().catch(() => ({} as any));
    const appointmentId = clean(body.appointmentId, 160);
    const action = clean(body.action, 80).toLowerCase();
    if (!appointmentId) return json({ ok: false, error: 'appointmentId_required' }, 400);
    if (!action) return json({ ok: false, error: 'action_required' }, 400);

    const appointment = await (prisma as any).appointment.findUnique({
      where: { id: appointmentId },
      select: {
        id: true, clinicianId: true, patientId: true, subjectPatientId: true, startsAt: true,
        endsAt: true, status: true, reason: true, bookingSource: true, rescheduleCount: true,
        meta: true, orgId: true,
      },
    });
    if (!appointment || appointment.bookingSource !== 'admin_simulation') return json({ ok: false, error: 'simulation_not_found' }, 404);
    const currentMeta = record(appointment.meta);
    const currentAssessment = assessmentOf(currentMeta);
    const currentSupervisor = supervisorOf(currentMeta);
    const actor = adminUid(req);
    const visit = await (prisma as any).televisit.findFirst({ where: { appointmentId }, orderBy: { createdAt: 'desc' } });
    if (!visit) return json({ ok: false, error: 'televisit_not_found' }, 404);

    if (action === 'save_assessment' || action === 'finalize_assessment') {
      if (![clean(currentSupervisor.userId, 160), clean(currentSupervisor.id, 160)].includes(actor)) return json({ ok: false, error: 'assigned_supervisor_required' }, 403);
      if (statusClosed(appointment.status)) return json({ ok: false, error: 'simulation_closed' }, 409);
      if (currentAssessment.status === 'finalized') return json({ ok: false, error: 'assessment_already_finalized' }, 409);
      const input = record(body.assessment);
      const domainsInput = record(input.domains);
      const domains: Record<string, number | null> = {};
      for (const key of ASSESSMENT_DOMAINS) domains[key] = int(domainsInput[key], 1, 5);
      const outcomeRaw = clean(input.outcome, 80).toUpperCase().replace(/[\s_-]+/g, '_');
      const outcome = outcomeRaw === 'PASS'
        ? 'PASS'
        : outcomeRaw === 'NEEDS_DEVELOPMENT'
          ? 'NEEDS_DEVELOPMENT'
          : outcomeRaw === 'REPEAT_REQUIRED'
            ? 'REPEAT_REQUIRED'
            : null;
      const finalize = action === 'finalize_assessment';
      if (finalize && new Date() < new Date(appointment.endsAt)) return json({ ok: false, error: 'assessment_cannot_finalize_before_session_end' }, 409);
      if (finalize && (!outcome || ASSESSMENT_DOMAINS.some((key) => domains[key] == null))) {
        return json({ ok: false, error: 'complete_assessment_required', requiredDomains: ASSESSMENT_DOMAINS.map((key) => ASSESSMENT_LABELS[key]) }, 400);
      }
      const assessment = {
        status: finalize ? 'finalized' : 'draft',
        outcome,
        domains,
        strengths: clean(input.strengths, 4000),
        developmentPoints: clean(input.developmentPoints, 4000),
        summary: clean(input.summary, 5000),
        recommendation: clean(input.recommendation, 4000),
        assessedByUserId: actor,
        updatedAt: new Date().toISOString(),
        finalizedAt: finalize ? new Date().toISOString() : null,
      };
      const nextMeta = { ...currentMeta, simulationAssessment: assessment };
      await (prisma as any).appointment.update({ where: { id: appointmentId }, data: { meta: nextMeta } });
      await audit({ appointmentId, action: finalize ? 'simulation_assessment_finalized' : 'simulation_assessment_saved', actorUserId: actor, orgId: appointment.orgId, afterJson: assessment });
      return json({ ok: true, assessment });
    }

    if (statusClosed(appointment.status)) return json({ ok: false, error: 'simulation_closed' }, 409);
    if (currentAssessment.status === 'finalized') return json({ ok: false, error: 'finalized_simulation_locked' }, 409);

    if (action === 'cancel' || action === 'no_show') {
      const now = new Date();
      const nextStatus = action === 'cancel' ? 'cancelled' : 'no_show';
      await (prisma as any).$transaction(async (tx: any) => {
        await tx.appointment.update({
          where: { id: appointmentId },
          data: action === 'cancel'
            ? { status: nextStatus, cancelledAt: now, cancelledByUserId: actor, cancelReason: clean(body.reason, 500) || 'Simulation cancelled by Admin' }
            : { status: nextStatus },
        });
        await tx.televisit.update({ where: { id: visit.id }, data: { status: 'cancelled' } });
        await tx.televisitJoinTicket.updateMany({ where: { visitId: visit.id, revokedAt: null }, data: { revokedAt: now } });
      });
      await audit({ appointmentId, action: action === 'cancel' ? 'simulation_cancelled' : 'simulation_no_show', actorUserId: actor, reason: clean(body.reason, 500), orgId: appointment.orgId });
      return json({ ok: true, appointmentId, status: nextStatus });
    }

    if (action === 'reschedule') {
      const startsAt = date(body.startsAt);
      const durationMinutes = int(body.durationMinutes, 10, 120);
      if (!startsAt || !durationMinutes) return json({ ok: false, error: 'startsAt_and_durationMinutes_required' }, 400);
      if (startsAt <= new Date()) return json({ ok: false, error: 'startsAt_must_be_future' }, 409);
      const endsAt = addMinutes(startsAt, durationMinutes);
      const schedulingMode = normalizeSchedulingMode(body.schedulingMode ?? currentMeta.schedulingMode);
      const customSchedulingReason = optional(body.customSchedulingReason ?? currentMeta.customSchedulingReason, 500);
      await validateSchedule({
        clinicianId: appointment.clinicianId, startsAt, endsAt, schedulingMode,
        customReason: customSchedulingReason, excludeAppointmentId: appointmentId,
      });
      const conflict = await findActiveOverlap({
        startsAt, endsAt, clinicianId: appointment.clinicianId,
        patientId: appointment.subjectPatientId || appointment.patientId,
        supervisorUserId: clean(currentSupervisor.userId, 160), excludeAppointmentId: appointmentId,
      });
      if (conflict) return json({ ok: false, error: 'simulation_time_conflict', conflict: { appointmentId: conflict.id, startsAt: conflict.startsAt, endsAt: conflict.endsAt } }, 409);
      const joinOpensAt = addMinutes(startsAt, -JOIN_OPEN_MIN);
      const joinClosesAt = addMinutes(endsAt, JOIN_LATE_MIN);
      const nextMeta = {
        ...currentMeta, schedulingMode, customSchedulingReason,
        joinOpensAt: joinOpensAt.toISOString(), joinClosesAt: joinClosesAt.toISOString(),
        lastRescheduledAt: new Date().toISOString(), lastRescheduledByUserId: actor,
      };
      await (prisma as any).$transaction(async (tx: any) => {
        await tx.appointment.update({
          where: { id: appointmentId },
          data: { startsAt, endsAt, meta: nextMeta, rescheduleCount: (appointment.rescheduleCount || 0) + 1 },
        });
        await tx.televisit.update({
          where: { id: visit.id },
          data: { scheduledStartAt: startsAt, scheduledEndAt: endsAt, joinOpensAt, joinClosesAt, status: 'planned' },
        });
        await tx.televisitJoinTicket.updateMany({ where: { visitId: visit.id, revokedAt: null }, data: { revokedAt: new Date() } });
      });
      await audit({ appointmentId, action: 'simulation_rescheduled', actorUserId: actor, orgId: appointment.orgId, beforeJson: { startsAt: appointment.startsAt, endsAt: appointment.endsAt }, afterJson: { startsAt, endsAt } });
      return json({ ok: true, appointmentId, startsAt, endsAt, joinOpensAt, joinClosesAt });
    }

    if (action === 'extend') {
      const minutes = int(body.extensionMinutes, 5, 60);
      if (!minutes) return json({ ok: false, error: 'extensionMinutes_required' }, 400);
      const endsAt = addMinutes(new Date(appointment.endsAt), minutes);
      await validateExtendedAvailability({ clinicianId: appointment.clinicianId, startsAt: new Date(appointment.startsAt), endsAt, excludeAppointmentId: appointmentId });
      const conflict = await findActiveOverlap({
        startsAt: new Date(appointment.startsAt), endsAt, clinicianId: appointment.clinicianId,
        patientId: appointment.subjectPatientId || appointment.patientId,
        supervisorUserId: clean(currentSupervisor.userId, 160), excludeAppointmentId: appointmentId,
      });
      if (conflict) return json({ ok: false, error: 'simulation_extension_conflict', conflict: { appointmentId: conflict.id, startsAt: conflict.startsAt, endsAt: conflict.endsAt } }, 409);
      const joinClosesAt = addMinutes(endsAt, JOIN_LATE_MIN);
      const nextMeta = { ...currentMeta, joinClosesAt: joinClosesAt.toISOString(), lastExtendedAt: new Date().toISOString(), lastExtendedByUserId: actor };
      await (prisma as any).$transaction(async (tx: any) => {
        await tx.appointment.update({ where: { id: appointmentId }, data: { endsAt, meta: nextMeta } });
        await tx.televisit.update({ where: { id: visit.id }, data: { scheduledEndAt: endsAt, joinClosesAt } });
      });
      await audit({ appointmentId, action: 'simulation_extended', actorUserId: actor, orgId: appointment.orgId, beforeJson: { endsAt: appointment.endsAt }, afterJson: { endsAt, extensionMinutes: minutes } });
      return json({ ok: true, appointmentId, endsAt, joinClosesAt });
    }

    return json({ ok: false, error: 'unsupported_action' }, 400);
  } catch (error: any) {
    if (error instanceof AvailabilityError) return json({ ok: false, error: error.code, details: error.details }, error.status);
    console.error('[api-gateway][admin][simulation][PATCH]', error);
    return json({ ok: false, error: clean(error?.message, 300) || 'simulation_update_failed' }, error?.status || 500);
  }
}
