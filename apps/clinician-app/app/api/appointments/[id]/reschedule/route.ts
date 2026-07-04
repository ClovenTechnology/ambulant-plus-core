import { NextRequest, NextResponse } from 'next/server';
import { store, emitEvent } from '@runtime/store';

export const dynamic = 'force-dynamic';

function parseDate(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms) : null;
}

function parseDurationMinutes(body: Record<string, unknown>) {
  const raw =
    body.durationMinutes ??
    body.slotDurationMinutes ??
    body.sessionDurationMinutes ??
    body.consultationDurationMinutes ??
    body.duration;

  const n = Number(raw);
  if (!Number.isFinite(n)) return null;

  const minutes = Math.trunc(n);
  return minutes > 0 && minutes <= 24 * 60 ? minutes : null;
}

function windowError(start: Date | null, end: Date | null) {
  if (!start || !end) return 'startsAt_and_endsAt_required';
  if (end.getTime() <= start.getTime()) return 'invalid_appointment_window';
  return null;
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;
  const appt = store.appointments.get(id);
  if (!appt) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const start = parseDate(body?.startsAt);
  const end = parseDate(body?.endsAt);
  const error = windowError(start, end);

  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error,
        message: 'Reschedule requires real appointment startsAt and endsAt.',
      },
      { status: 400 },
    );
  }

  const startsAt = start!.toISOString();
  const endsAt = end!.toISOString();

  appt.startsAt = startsAt;
  appt.endsAt = endsAt;
  appt.status = 'scheduled';
  store.appointments.set(id, appt);

  emitEvent({
    kind: 'appointment_rescheduled',
    encounterId: appt.encounterId,
    patientId: appt.patientId,
    clinicianId: appt.clinicianId,
    payload: { apptId: appt.id, startsAt, endsAt },
    targets: { patientId: appt.patientId, clinicianId: appt.clinicianId, admin: true },
  });

  return NextResponse.json({ ok: true, appointment: appt });
}

/**
 * Compatibility POST.
 * Old callers may send startISO, but they must now also send either:
 * - endsAt, or
 * - an explicit configured durationMinutes / slotDurationMinutes / sessionDurationMinutes.
 *
 * No production path may silently assume 30 minutes.
 */
export async function POST(
  req: NextRequest,
  ctx: { params: { id: string } }
) {
  const legacy = await req.json().catch(() => ({}));

  const start = parseDate(legacy?.startsAt ?? legacy?.startISO);
  if (!start) {
    return NextResponse.json(
      { ok: false, error: 'start_time_required', message: 'startISO or startsAt is required.' },
      { status: 400 },
    );
  }

  let end = parseDate(legacy?.endsAt);
  const durationMinutes = parseDurationMinutes(legacy);

  if (!end && durationMinutes) {
    end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  }

  const error = windowError(start, end);
  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error === 'startsAt_and_endsAt_required' ? 'appointment_duration_required' : error,
        message: 'Cannot reschedule without endsAt or an explicit configured appointment duration.',
      },
      { status: 400 },
    );
  }

  return PUT(
    new NextRequest(req.url, {
      method: 'PUT',
      body: JSON.stringify({
        startsAt: start.toISOString(),
        endsAt: end!.toISOString(),
      }),
      headers: { 'content-type': 'application/json' },
    }),
    ctx,
  );
}
