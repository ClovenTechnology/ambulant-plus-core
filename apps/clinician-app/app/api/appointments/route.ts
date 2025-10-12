import { NextRequest, NextResponse } from 'next/server';

type Appt = {
  id: string;
  patientId?: string;
  patientName?: string;
  clinicianId: string;
  clinicianName?: string;
  startsAt: string;
  endsAt?: string;
  roomId?: string;
  status: 'scheduled'|'in_progress'|'completed'|'canceled';
};
// global in-memory store for dev
const g = globalThis as any;
if (!g.__APPTS__) g.__APPTS__ = [] as Appt[];
const APPTS: Appt[] = g.__APPTS__;

// helper: overlap for same clinician (simple)
function overlaps(a: Appt, b: Appt) {
  const a0 = new Date(a.startsAt).getTime();
  const a1 = new Date(a.endsAt || a.startsAt).getTime();
  const b0 = new Date(b.startsAt).getTime();
  const b1 = new Date(b.endsAt || b.startsAt).getTime();
  return Math.max(a0, b0) < Math.min(a1, b1);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const clinicianId = url.searchParams.get('clinicianId');
  const list = clinicianId ? APPTS.filter(a => a.clinicianId === clinicianId) : APPTS;
  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const startsAt = body.startsAt || body.timeISO; // keep legacy shape working
  const endsAt = body.endsAt || null;

  if (!body.clinicianId || !startsAt) {
    return NextResponse.json({ message: 'clinicianId and startsAt required' }, { status: 400 });
  }

  // prevent double-book for same clinician if times overlap & appt not canceled
  const incoming: Appt = {
    id: `apt_${Math.random().toString(36).slice(2,8)}`,
    clinicianId: body.clinicianId,
    clinicianName: body.clinicianName,
    patientId: body.patientId,
    patientName: body.patientName,
    startsAt,
    endsAt: endsAt || new Date(new Date(startsAt).getTime() + 30*60*1000).toISOString(),
    roomId: body?.meta?.roomId || body.roomId,
    status: 'scheduled',
  };
  const clash = APPTS.find(a =>
    a.clinicianId === incoming.clinicianId &&
    a.status !== 'canceled' &&
    overlaps(a, incoming)
  );
  if (clash) {
    return NextResponse.json({ message: 'Slot overlaps an existing appointment' }, { status: 409 });
  }

  APPTS.push(incoming);
  return NextResponse.json(incoming, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const idx = APPTS.findIndex(a => a.id === body.id);
  if (idx < 0) return NextResponse.json({ message: 'not found' }, { status: 404 });

  // allow status updates and reschedule
  if (body.status) APPTS[idx].status = body.status;
  if (body.startsAt) APPTS[idx].startsAt = body.startsAt;
  if (body.endsAt) APPTS[idx].endsAt = body.endsAt;
  if (body.roomId) APPTS[idx].roomId = body.roomId;

  return NextResponse.json(APPTS[idx]);
}

export const dynamic = 'force-dynamic';
