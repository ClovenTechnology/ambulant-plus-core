// apps/patient-app/app/api/bookings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// window (ms) for counting "recent" bookings (e.g. 24h)
const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;

async function emitEvent(evt: any) {
  try {
    // prefer configured upstream; fallback to internal route
    const base = process.env.EVENTS_EMIT_BASE || (process.env.NEXT_PUBLIC_BASE_URL ?? '');
    const url = base ? `${base.replace(/\/$/, '')}/api/events/emit` : '/api/events/emit';
    await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-role': 'patient',
      },
      body: JSON.stringify(evt),
      cache: 'no-store',
    });
  } catch (err) {
    console.warn('emitEvent failed', err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const clinicianId = body?.clinicianId;
    const patientId = body?.patientId ?? null;
    const reason = body?.reason ?? 'Televisit consult';

    if (!clinicianId) return NextResponse.json({ ok: false, error: 'clinicianId required' }, { status: 400 });

    // Use a transaction: create booking + update clinician summary atomically
    const now = new Date();
    const booking = await prisma.$transaction(async (tx) => {
      const b = await tx.booking.create({
        data: {
          clinicianId,
          patientId,
          reason,
        },
      });

      // Option A: increment a stored counter
      // Use increment so concurrent bookings are safe.
      const clin = await tx.clinicianProfile.update({
        where: { id: clinicianId },
        data: {
          lastBookedAt: now,
          recentBookedCount: { increment: 1 },
        },
      });

      return { booking: b, clinician: clin };
    });

    // Optionally, compute a decayed / recomputed recentBookedCount for correctness (sliding window)
    // Example: recompute bookings in last RECENT_WINDOW_MS and sync back (low freq / background recommended).
    // For demo, we'll fire an event containing the update; production can recompute in background job.

    await emitEvent({
      type: 'clinician.booked',
      clinicianId,
      bookingId: booking.booking.id,
      ts: Date.now(),
      payload: { reason, patientId },
    });

    return NextResponse.json({ ok: true, booking: booking.booking, clinician: booking.clinician }, { status: 201 });
  } catch (err: any) {
    console.error('bookings POST error', err);
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}
