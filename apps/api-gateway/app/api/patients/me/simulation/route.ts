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
async function patientIdentity(req: NextRequest) {
  const who = readIdentity(req.headers); requireTrustedIdentityInProduction(req.headers, who);
  if (!who.uid || who.role !== 'patient') return null;
  const ref = clean((who as any).actorRefId, 160);
  return (prisma as any).patientProfile.findFirst({ where: { OR: [{ userId: who.uid }, ...(ref ? [{ id: ref }] : [])] }, select: { id: true, userId: true, name: true } });
}
function view(row: any) {
  const meta = record(row.meta); const supervisor = record(meta.simulationSupervisor);
  return { appointmentId: row.id, roomId: row.roomId, clinicianId: row.clinicianId, startsAt: row.startsAt, endsAt: row.endsAt, status: row.status, reason: row.reason, sessionNumber: meta.sessionNumber || null, clinicianName: meta.participants?.find?.((p: any) => String(p?.role || '').includes('CLINICIAN'))?.name || 'Clinician', supervisor: { name: supervisor.name || supervisor.email || 'Assigned supervisor', mode: supervisor.mode || 'OBSERVE' }, paymentStatus: row.paymentStatus, noCharge: true };
}
export async function GET(req: NextRequest) {
  try {
    const patient = await patientIdentity(req); if (!patient) return json({ ok: false, error: 'patient_required' }, 401);
    const rows = await (prisma as any).appointment.findMany({ where: { bookingSource: 'admin_simulation', OR: [{ patientId: patient.id }, { subjectPatientId: patient.id }] }, orderBy: [{ startsAt: 'asc' }, { createdAt: 'asc' }], select: { id: true, roomId: true, clinicianId: true, patientId: true, subjectPatientId: true, startsAt: true, endsAt: true, status: true, reason: true, paymentStatus: true, meta: true } });
    return json({ ok: true, patient: { id: patient.id, name: patient.name }, sessions: rows.map(view) });
  } catch (error: any) { return json({ ok: false, error: clean(error?.message, 300) || 'simulation_load_failed' }, error?.status || 500); }
}
export async function POST(req: NextRequest) {
  try {
    const patient = await patientIdentity(req); if (!patient) return json({ ok: false, error: 'patient_required' }, 401);
    const body = await req.json().catch(() => ({} as any)); const appointmentId = clean(body.appointmentId, 160);
    if (!appointmentId) return json({ ok: false, error: 'appointmentId_required' }, 400);
    const appointment = await (prisma as any).appointment.findFirst({ where: { id: appointmentId, bookingSource: 'admin_simulation', OR: [{ patientId: patient.id }, { subjectPatientId: patient.id }] }, select: { id: true, roomId: true, status: true, meta: true } });
    if (!appointment) return json({ ok: false, error: 'simulation_not_found' }, 404); if (closed(appointment.status)) return json({ ok: false, error: 'simulation_closed' }, 409);
    const visit = await (prisma as any).televisit.findFirst({ where: { appointmentId }, orderBy: { createdAt: 'desc' } }); if (!visit) return json({ ok: false, error: 'televisit_not_found' }, 404);
    const now = new Date(); if (visit.joinOpensAt > now) return json({ ok: false, error: 'join_window_not_open', joinOpensAt: visit.joinOpensAt }, 409); if (visit.joinClosesAt < now) return json({ ok: false, error: 'join_window_closed', joinClosesAt: visit.joinClosesAt }, 409);
    const participants = Array.isArray(record(appointment.meta).participants) ? record(appointment.meta).participants : [];
    const participant = participants.find((p: any) => clean(p?.patientId,160) === patient.id || clean(p?.role,80).toUpperCase() === 'PRIMARY_PATIENT');
    const partyId = clean(participant?.partyId, 240) || `pat-${patient.id}`;
    await (prisma as any).televisitJoinTicket.updateMany({ where: { visitId: visit.id, uid: partyId, role: 'patient', revokedAt: null }, data: { revokedAt: now } });
    const ttl = Math.max(60, Math.min(900, Math.floor((visit.joinClosesAt.getTime() - now.getTime()) / 1000))); const ticket = await upsertTicket(visit.id, partyId, ttl, 'patient' as any, req as any); if (!ticket?.token) return json({ ok: false, error: 'patient_admission_not_issued' }, 500);
    return json({
      ok: true,
      admission: {
        token: ticket.token,
        expiresAt: ticket.expiresAt,
        visitId: visit.id,
        roomId: visit.roomId,
        appointmentId,
        patientId: patient.id,
        patientName: patient.name || 'Simulation patient',
        participantId: partyId,
        participantRole: 'patient',
      },
    });
  } catch (error: any) { return json({ ok: false, error: clean(error?.message, 300) || 'simulation_admission_failed' }, error?.status || 500); }
}
