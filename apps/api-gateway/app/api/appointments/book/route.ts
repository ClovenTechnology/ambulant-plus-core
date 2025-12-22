// apps/api-gateway/app/api/appointments/book/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { split } from '@ambulant/payments/src/utils';
import { paystackCharge } from '@ambulant/payments/src/providers/paystack';
import { readIdentity } from '@/src/lib/identity';
import { getClinician, createAppointment, updateAppointment } from '@/src/store/appointments';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const who = readIdentity(req.headers);
  if (who.role !== 'patient' || !who.uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const b = await req.json();
  const clinicianId = b.clinician_id as string;
  const startsAt = new Date(b.starts_at);
  const endsAt = new Date(b.ends_at ?? (startsAt.getTime() + 30*60*1000));

  const clin = await getClinician(clinicianId);
  if (!clin) return NextResponse.json({ error: 'unknown_clinician' }, { status: 404 });

  const priceCents = clin.feeCents;
  const currency = clin.currency;
  const { platformFeeCents, clinicianTakeCents } = split(priceCents);

  const apptId = `appt-${crypto.randomUUID().slice(0,8)}`;
  const appt = await createAppointment({
    id: apptId,
    patientId: who.uid,
    clinicianId,
    encounterId: b.encounter_id ?? 'enc-za-001',
    sessionId: b.session_id ?? 'sess-001',
    caseId: b.case_id ?? 'case-za-001',
    startsAt, endsAt,
    priceCents, currency,
    platformFeeCents, clinicianTakeCents,
    paymentProvider: 'paystack'
  });

  const charge = await paystackCharge({
    amount_cents: priceCents,
    currency,
    description: `Consultation`,
    metadata: { appointment_id: appt.id, clinician_id: clinicianId },
    idempotencyKey: appt.id
  }, b.patient_email ?? 'patient@example.com');

  await updateAppointment(appt.id, { paymentRef: charge.payment_ref });

  return NextResponse.json({
    appointment_id: appt.id,
    status: 'pending',
    redirect_url: charge.redirect_url
  });
}
