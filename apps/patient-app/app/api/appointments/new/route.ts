// apps/patient-app/app/api/appointments/new/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const GATEWAY =
  process.env.APIGW_BASE ??
  process.env.NEXT_PUBLIC_APIGW_BASE ??
  'http://localhost:3010';

type PaymentMethod = 'card' | 'medical_aid' | 'voucher';

type NewAppointmentPerson = {
  mode: 'SELF' | 'FAMILY';
  subjectPatientId?: string | null;
  relationshipId?: string | null;
};

type NewAppointmentObserver = {
  email?: string;
  phone?: string;
  name?: string;
};

type NewAppointmentMedicalAid = {
  scheme?: string;
  memberNumber?: string;
  dependentCode?: string;
  telemedCovered?: boolean;
  telemedCoverType?: string | null;
  telemedCopayType?: string | null;
  telemedCopayValue?: number | null;
  policyId?: string | null;
};

type NewAppointmentRequestBody = {
  clinicianId: string;
  startsAt: string;
  endsAt: string;
  reason: string;
  roomId: string;

  paymentMethod: PaymentMethod;
  voucherCode?: string | null;
  medicalAid?: NewAppointmentMedicalAid | null;

  person?: NewAppointmentPerson;
  observers?: NewAppointmentObserver[];
};

function isISO(s: string) {
  const ms = Date.parse(s);
  return Number.isFinite(ms);
}

export async function POST(req: NextRequest) {
  let body: NewAppointmentRequestBody | null = null;
  try {
    body = (await req.json()) as NewAppointmentRequestBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  if (!body) {
    return NextResponse.json({ ok: false, error: 'Empty request body' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  const {
    clinicianId,
    startsAt,
    endsAt,
    reason,
    roomId,
    paymentMethod,
    voucherCode,
    medicalAid,
    person,
    observers = [],
  } = body;

  if (!clinicianId || !startsAt || !endsAt || !roomId) {
    return NextResponse.json(
      { ok: false, error: 'Missing required fields (clinicianId, startsAt, endsAt, roomId)' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  if (!isISO(startsAt) || !isISO(endsAt) || Date.parse(endsAt) <= Date.parse(startsAt)) {
    return NextResponse.json(
      { ok: false, error: 'Invalid time range' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const hostUserId = req.headers.get('x-uid') || req.headers.get('X-Uid') || 'anon';

  const gwMedicalAid =
    medicalAid && (medicalAid.scheme || medicalAid.memberNumber)
      ? {
          scheme: medicalAid.scheme,
          member_number: medicalAid.memberNumber,
          dependent_code: medicalAid.dependentCode ?? '',
          telemed_covered: medicalAid.telemedCovered ?? undefined,
          telemed_cover_type: medicalAid.telemedCoverType ?? undefined,
          telemed_copay_type: medicalAid.telemedCopayType ?? undefined,
          telemed_copay_value: medicalAid.telemedCopayValue ?? undefined,
          policy_id: medicalAid.policyId ?? undefined,
        }
      : undefined;

  const gwPayload: any = {
    clinician_id: clinicianId,
    starts_at: startsAt,
    ends_at: endsAt,
    reason,
    room_id: roomId,
    payment_method: paymentMethod,

    subject_patient_id: person?.mode === 'FAMILY' ? person.subjectPatientId ?? undefined : undefined,
    family_relationship_id: person?.mode === 'FAMILY' ? person.relationshipId ?? undefined : undefined,

    host_user_id: hostUserId,

    observers: observers.filter((o) => (o.email && o.email.trim()) || (o.phone && o.phone.trim())),
  };

  if (paymentMethod === 'voucher' && voucherCode) {
    gwPayload.voucher_code = voucherCode.trim();
  }

  if (paymentMethod === 'medical_aid' && gwMedicalAid) {
    gwPayload.medical_aid = gwMedicalAid;
  }

  try {
    const res = await fetch(`${GATEWAY}/api/appointments/book`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-role': 'patient',
        'x-uid': hostUserId,
      },
      body: JSON.stringify(gwPayload),
    });

    const raw = await res.json().catch(() => ({} as any));

    if (!res.ok) {
      const msg = raw?.error || `Gateway responded ${res.status}`;
      return NextResponse.json({ ok: false, error: msg }, { status: res.status, headers: { 'Cache-Control': 'no-store' } });
    }

    const appointmentId = raw.appointment_id || raw.id || null;
    const redirectUrl = typeof raw.redirect_url === 'string' ? raw.redirect_url : null;

    // Dev convenience: seed televisit runtime store (if present)
    try {
      const mod: any = await import('@runtime/store');
      const st = mod?.store;
      const tv = st?.televisits;
      if (appointmentId && tv && typeof tv.set === 'function') {
        const visitId = String(appointmentId);
        tv.set(visitId, {
          id: visitId,
          visitId,
          roomId: roomId || visitId,
          startsAt,
          endsAt,
          kind: 'televisit',
          title: 'Televisit',
          hostUserId,
          clinicianId,
        });
      }
    } catch {
      // ignore
    }

    return NextResponse.json(
      {
        ok: true,
        appointmentId,
        redirectUrl,
        raw,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'Failed to create appointment via gateway' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
