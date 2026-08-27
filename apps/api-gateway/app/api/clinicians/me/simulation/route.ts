import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { upsertTicket } from '@/src/lib/join';
import { readIdentity, requireTrustedIdentityInProduction } from '@/src/lib/identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CLOSED = new Set(['cancelled','canceled','no_show','no-show','completed','complete','closed','ended','archived','expired','failed','declined']);
function clean(value: unknown, max = 240) { return String(value ?? '').trim().slice(0, max); }
function record(value: unknown): Record<string, any> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}; }
function closed(value: unknown) { return CLOSED.has(clean(value, 80).toLowerCase()); }
function json(data: any, status = 200) { return NextResponse.json(data, { status, headers: { 'cache-control': 'no-store' } }); }
function sessionNumber(meta: unknown, reason?: string | null) {
  const m = record(meta); const direct = Number(m.sessionNumber);
  if (Number.isInteger(direct) && direct > 0) return direct;
  const match = clean(reason, 500).match(/(?:session|consultation)\s+(\d+)/i);
  return match ? Number(match[1]) : null;
}
function view(row: any) {
  const meta = record(row.meta); const assessment = record(meta.simulationAssessment); const supervisor = record(meta.simulationSupervisor);
  return {
    appointmentId: row.id, roomId: row.roomId, startsAt: row.startsAt, endsAt: row.endsAt,
    status: row.status, reason: row.reason, sessionNumber: sessionNumber(meta, row.reason),
    patientName: meta.patientDisplayName || 'Simulation patient', scenario: meta.scenario || null,
    expectedIoMTs: Array.isArray(meta.expectedIoMTs) ? meta.expectedIoMTs : [],
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
    const rows = await (prisma as any).appointment.findMany({
      where: { clinicianId: clinician.id, bookingSource: 'admin_simulation' },
      orderBy: [{ startsAt: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, roomId: true, startsAt: true, endsAt: true, status: true, reason: true, meta: true },
    });
    const sessions = rows.map(view); const passed = new Set(sessions.filter((s: any) => s.passed && s.sessionNumber).map((s: any) => s.sessionNumber));
    return json({ ok: true, clinician: { id: clinician.id, displayName: clinician.displayName }, requiredSessions: 3, passedCount: passed.size, progress: Math.min(100, Math.round((passed.size / 3) * 100)), sessions });
  } catch (error: any) { return json({ ok: false, error: clean(error?.message, 300) || 'simulation_load_failed' }, error?.status || 500); }
}
export async function POST(req: NextRequest) {
  try {
    const clinician = await identity(req); if (!clinician) return json({ ok: false, error: 'clinician_required' }, 401);
    const body = await req.json().catch(() => ({} as any)); const appointmentId = clean(body.appointmentId, 160);
    if (!appointmentId) return json({ ok: false, error: 'appointmentId_required' }, 400);
    const appointment = await (prisma as any).appointment.findFirst({
      where: { id: appointmentId, clinicianId: clinician.id, bookingSource: 'admin_simulation' },
      select: { id: true, roomId: true, status: true, startsAt: true, endsAt: true, meta: true },
    });
    if (!appointment) return json({ ok: false, error: 'simulation_not_found' }, 404);
    if (closed(appointment.status)) return json({ ok: false, error: 'simulation_closed' }, 409);
    const visit = await (prisma as any).televisit.findFirst({ where: { appointmentId }, orderBy: { createdAt: 'desc' } });
    if (!visit) return json({ ok: false, error: 'televisit_not_found' }, 404);
    const now = new Date(); if (visit.joinOpensAt > now) return json({ ok: false, error: 'join_window_not_open', joinOpensAt: visit.joinOpensAt }, 409);
    if (visit.joinClosesAt < now) return json({ ok: false, error: 'join_window_closed', joinClosesAt: visit.joinClosesAt }, 409);
    const participant = (Array.isArray(record(appointment.meta).participants) ? record(appointment.meta).participants : []).find((p: any) => clean(p?.clinicianId,160) === clinician.id || clean(p?.role,80).toUpperCase() === 'LEAD_CLINICIAN');
    const partyId = clean(participant?.partyId, 240) || `clin-${clinician.id}`;
    await (prisma as any).televisitJoinTicket.updateMany({ where: { visitId: visit.id, uid: partyId, role: 'clinician', revokedAt: null }, data: { revokedAt: now } });
    const ttl = Math.max(60, Math.min(900, Math.floor((visit.joinClosesAt.getTime() - now.getTime()) / 1000)));
    const ticket = await upsertTicket(visit.id, partyId, ttl, 'clinician' as any, req as any);
    if (!ticket?.token) return json({ ok: false, error: 'clinician_admission_not_issued' }, 500);
    return json({ ok: true, admission: { token: ticket.token, expiresAt: ticket.expiresAt, visitId: visit.id, roomId: visit.roomId, appointmentId, participantId: partyId, participantRole: 'clinician' } });
  } catch (error: any) { return json({ ok: false, error: clean(error?.message, 300) || 'simulation_admission_failed' }, error?.status || 500); }
}
