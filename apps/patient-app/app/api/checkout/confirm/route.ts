// apps/patient-app/app/api/checkout/confirm/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAppointment, updateAppointment, sendEmail, sendSMS } from '@/app/api/_store';

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const q = url.searchParams.get('a') || url.searchParams.get('id');
    let id = q || null;

    if (!id) {
      const body = await req.json().catch(() => null);
      id = body?.id ?? null;
    }
    if (!id) return NextResponse.json({ error: 'Missing appointment id' }, { status: 400 });

    const appt = getAppointment(id);
    if (!appt) return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });

    const updated = updateAppointment(id, { status: 'confirmed' });
    // fire-and-forget demo notifications
    const when = new Date(updated!.startISO).toLocaleString();
    const subject = `Appointment confirmed (${updated!.id})`;
    const text = `Your televisit is confirmed for ${when}.`;

    if (updated?.patient?.email) await sendEmail(updated.patient.email, subject, text);
    if (updated?.patient?.phone) await sendSMS(updated.patient.phone, text);

    return NextResponse.json({ ok: true, appointment: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to confirm' }, { status: 500 });
  }
}
