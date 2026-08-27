import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { upsertTicket } from '@/src/lib/join';
import { readIdentity, requireTrustedIdentityInProduction } from '@/src/lib/identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CLOSED = new Set(['cancelled','canceled','no_show','no-show','completed','complete','closed','ended','archived','expired','failed','declined']);
function clean(value: unknown, max = 240) { return String(value ?? '').trim().slice(0, max); }
function record(value: unknown): Record<string, any> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}; }
function participants(meta: unknown): any[] { return Array.isArray(record(meta).participants) ? record(meta).participants.filter(Boolean) : []; }
function closed(value: unknown) { return CLOSED.has(clean(value, 80).toLowerCase()); }
function json(data: any, status = 200) { return NextResponse.json(data, { status, headers: { 'cache-control': 'no-store' } }); }
function clinicianParticipant(row: any, clinicianId: string) {
  const exact = participants(row?.meta).find((p: any) => clean(p?.clinicianId, 160) === clinicianId);
  if (exact) return exact;
  if (clean(row?.clinicianId, 160) === clinicianId) {
    return { clinicianId, partyId: `clin-${clinicianId}`, role: 'LEAD_CLINICIAN', required: true };
  }
  return null;
}
function clinicianAssessment(meta: unknown, clinicianId: string, leadClinicianId?: string | null) {
  const m = record(meta);
  const mapped = record(record(m.simulationAssessments)[clinicianId]);
  if (mapped.status) return mapped;
  if (!leadClinicianId || clean(leadClinicianId, 160) === clinicianId) return record(m.simulationAssessment);
  return {};
}
function sessionNumber(meta: unknown, reason?: string | null) {
  const m = record(meta); const direct = Number(m.sessionNumber);
  if (Number.isInteger(direct) && direct > 0) return direct;
  const match = clean(reason, 500).match(/(?:session|consultation)\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}
function view(row: any, clinicianId: string) {
  const meta = record(row.meta);
  const assessment = clinicianAssessment(meta, clinicianId, row.clinicianId);
  const supervisor = record(meta.simulationSupervisor);
  const mine = clinicianParticipant(row, clinicianId);
  const cohort = participants(meta)
    .filter((p: any) => clean(p?.clinicianId, 160))
    .map((p: any) => ({
      clinicianId: clean(p.clinicianId, 160),
      name: clean(p.name, 180) || 'Clinician',
      specialty: clean(p.specialty, 180) || null,
      role: clean(p.role, 80).toUpperCase() || 'TRAINEE',
    }));
  return {
    appointmentId: row.id, roomId: row.roomId, startsAt: row.startsAt, endsAt: row.endsAt,
    status: row.status, reason: row.reason, sessionNumber: sessionNumber(meta, row.reason),
    patientName: meta.patientDisplayName || 'Simulation patient', scenario: meta.scenario || null,
    expectedIoMTs: Array.isArray(meta.expectedIoMTs) ? meta.expectedIoMTs : [],
    leadClinicianId: row.clinicianId,
    cohortRole: clean(mine?.role, 80).toUpperCase() || (row.clinicianId === clinicianId ? 'LEAD_CLINICIAN' : 'TRAINEE'),
    clinicians: cohort.length ? cohort : [{ clinicianId: row.clinicianId, name: 'Clinician', specialty: null, role: 'LEAD_CLINICIAN' }],
    supervisor: { name: supervisor.name || supervisor.email || 'Assigned supervisor', mode: supervisor.mode || 'OBSERVE' },
    assessment: assessment.status ? { status: assessment.status, outcome: assessment.outcome || null, finalizedAt: assessment.finalizedAt || null } : null,
    passed: assessment.status === 'finalized' && assessment.outcome === 'PASS',
  };
}
async function identity(req: NextRequest) {
  const who = readIdentity(req.headers); requireTrustedIdentityInProduction(req.headers, who);
  if (!who.uid || who.role !== 'clinician') return null;
  return (prisma as any).clinicianProfile.findFirst({
    where: { OR: [{ userId: who.uid }, { id: clean((who as any).actorRefId, 160) || who.uid }] },
    select: { id: true, userId: true, displayName: true },
  });
}
export async function GET(req: NextRequest) {
  try {
    const clinician = await identity(req); if (!clinician) return json({ ok: false, error: 'clinician_required' }, 401);
    const rowsAll = await (prisma as any).appointment.findMany({
      where: { bookingSource: 'admin_simulation' },
      orderBy: [{ startsAt: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, clinicianId: true, roomId: true, startsAt: true, endsAt: true, status: true, reason: true, meta: true },
    });
    const rows = rowsAll.filter((row: any) => Boolean(clinicianParticipant(row, clinician.id)));
    const sessions = rows.map((row: any) => view(row, clinician.id)); const passed = new Set(sessions.filter((s: any) => s.passed && s.sessionNumber).map((s: any) => s.sessionNumber));
    return json({ ok: true, clinician: { id: clinician.id, displayName: clinician.displayName }, requiredSessions: 3, passedCount: passed.size, progress: Math.min(100, Math.round((passed.size / 3) * 100)), sessions });
  } catch (error: any) { return json({ ok: false, error: clean(error?.message, 300) || 'simulation_load_failed' }, error?.status || 500); }
}
export async function POST(req: NextRequest) {
  try {
    const clinician = await identity(req); if (!clinician) return json({ ok: false, error: 'clinician_required' }, 401);
    const body = await req.json().catch(() => ({} as any)); const appointmentId = clean(body.appointmentId, 160);
    if (!appointmentId) return json({ ok: false, error: 'appointmentId_required' }, 400);
    const appointment = await (prisma as any).appointment.findFirst({
      where: { id: appointmentId, bookingSource: 'admin_simulation' },
      select: {
        id: true, clinicianId: true, encounterId: true, patientId: true, subjectPatientId: true,
        roomId: true, status: true, startsAt: true, endsAt: true, meta: true,
      },
    });
    if (!appointment || !clinicianParticipant(appointment, clinician.id)) return json({ ok: false, error: 'simulation_not_found' }, 404);
    if (closed(appointment.status)) return json({ ok: false, error: 'simulation_closed' }, 409);
    const visit = await (prisma as any).televisit.findFirst({ where: { appointmentId }, orderBy: { createdAt: 'desc' } });
    if (!visit) return json({ ok: false, error: 'televisit_not_found' }, 404);
    const now = new Date(); if (visit.joinOpensAt > now) return json({ ok: false, error: 'join_window_not_open', joinOpensAt: visit.joinOpensAt }, 409);
    if (visit.joinClosesAt < now) return json({ ok: false, error: 'join_window_closed', joinClosesAt: visit.joinClosesAt }, 409);
    const participant = clinicianParticipant(appointment, clinician.id);
    const partyId = clean(participant?.partyId, 240) || `clin-${clinician.id}`;
    await (prisma as any).televisitJoinTicket.updateMany({ where: { visitId: visit.id, uid: partyId, role: 'clinician', revokedAt: null }, data: { revokedAt: now } });
    const ttl = Math.max(60, Math.min(900, Math.floor((visit.joinClosesAt.getTime() - now.getTime()) / 1000)));
    const ticket = await upsertTicket(visit.id, partyId, ttl, 'clinician' as any, req as any);
    if (!ticket?.token) return json({ ok: false, error: 'clinician_admission_not_issued' }, 500);
    return json({
      ok: true,
      admission: {
        token: ticket.token,
        expiresAt: ticket.expiresAt,
        visitId: visit.id,
        roomId: visit.roomId,
        appointmentId,
        encounterId: clean(appointment.encounterId, 160) || null,
        patientId: clean(appointment.subjectPatientId || appointment.patientId, 160) || null,
        patientName: clean(record(appointment.meta).patientDisplayName, 180) || 'Simulation patient',
        participantId: partyId,
        participantRole: 'clinician',
        cohortRole: clean(participant?.role, 80).toUpperCase() || 'TRAINEE',
      },
    });
  } catch (error: any) { return json({ ok: false, error: clean(error?.message, 300) || 'simulation_admission_failed' }, error?.status || 500); }
}
