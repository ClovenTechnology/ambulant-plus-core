// apps/api-gateway/app/api/appointments/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { getClinician } from '@/src/store/appointments';
import { readIdentity } from '@/src/lib/identity';

export const dynamic = 'force-dynamic';

// CORS / preflight
export async function OPTIONS() {
  const h = new Headers({
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,x-uid,x-role',
  });
  return new NextResponse(null, { status: 200, headers: h });
}

function cors(json: any, status = 200) {
  const h = new Headers({ 'access-control-allow-origin': '*' });
  return NextResponse.json(json, { status, headers: h });
}

export async function GET(req: NextRequest) {
  const clinicianId = req.nextUrl.searchParams.get('clinicianId') || undefined;
  const patientId = req.nextUrl.searchParams.get('patientId') || undefined;

  const where: any = {};
  if (clinicianId) where.clinicianId = clinicianId;
  if (patientId) where.patientId = patientId;

  const items = await prisma.appointment.findMany({
    where,
    orderBy: { startsAt: 'desc' },
    take: 100,
  });
  return cors({ items });
}

export async function POST(req: NextRequest) {
  try {
    // If you have auth, prefer readIdentity(req.headers) to get real user
    const who = readIdentity(req.headers as any); // will fallback if you haven't implemented
    const body = await req.json().catch(() => ({}));

    // required input
    const clinicianId = String(body?.clinicianId || body?.clinician_id || body?.clinician || '');
    const patientId   = String(body?.patientId   || body?.patient_id   || who.uid || 'pt-local-001');

    if (!clinicianId) {
      return cors({ error: 'missing_clinicianId' }, 400);
    }

    const startsAt = new Date(body?.startsAt || body?.starts_at);
    const endsAt   = body?.endsAt ? new Date(body.endsAt) : new Date(startsAt.getTime() + 30 * 60 * 1000);

    if (!startsAt.getTime() || !endsAt.getTime() || endsAt <= startsAt) {
      return cors({ error: 'invalid_time' }, 400);
    }

    // conflict checks (same clinician or same patient overlap)
    const overlap = await prisma.appointment.findFirst({
      where: {
        status: { in: ['scheduled', 'confirmed', 'reserved'] },
        OR: [
          { clinicianId, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
          { patientId,   startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
        ],
      },
      select: { id: true },
    });
    if (overlap) {
      return cors({ error: 'conflict' }, 409);
    }

    // get clinician pricing info
    const clin = await getClinician(clinicianId);
    const priceCents = (clin?.feeCents ?? 60000) | 0;
    const currency = clin?.currency ?? 'ZAR';

    // simple split: platform takes 10% (adjust as required)
    const platformFeeCents = Math.floor(priceCents * 0.10);
    const clinicianTakeCents = priceCents - platformFeeCents;

    // build payload fields
    const apptData = {
      encounterId: String(body?.encounterId || body?.encounter_id || `enc-${crypto.randomUUID().slice(0,8)}`),
      sessionId:   String(body?.sessionId   || body?.session_id   || `sess-${crypto.randomUUID().slice(0,8)}`),
      caseId:      String(body?.caseId      || body?.case_id      || `case-${crypto.randomUUID().slice(0,8)}`),
      clinicianId,
      patientId,
      startsAt,
      endsAt,
      reason: body?.meta?.reason ?? body?.reason ?? 'Televisit consult',
      roomId: body?.meta?.roomId ?? body?.roomId ?? null,
      status: 'scheduled' as const,
      // required payment fields per your prisma schema
      priceCents,
      currency,
      platformFeeCents,
      clinicianTakeCents,
      paymentProvider: body?.paymentProvider ?? 'manual',
      paymentRef: body?.paymentRef ?? null,
      meta: body?.meta ? JSON.stringify(body.meta) : (body?.meta_json ? JSON.stringify(body.meta_json) : null)
    };

    const appt = await prisma.appointment.create({
      data: apptData,
    });

    // publish runtime event so clinician apps (readInbox) will pick it up
    await prisma.runtimeEvent.create({
      data: {
        ts: BigInt(Date.now()),
        kind: 'appointment.created',
        encounterId: appt.encounterId,
        patientId: appt.patientId,
        clinicianId: appt.clinicianId,
        payload: JSON.stringify({
          appointmentId: appt.id,
          startsAt: appt.startsAt.toISOString(),
          endsAt: appt.endsAt.toISOString(),
          clinicianId: appt.clinicianId,
          patientId: appt.patientId,
        }),
        targetPatientId: appt.patientId,
        targetClinicianId: appt.clinicianId,
        targetAdmin: false,
      }
    });

    return cors(appt, 201);
  } catch (e: any) {
    console.error('[appointments.create.err]', e?.message || e);
    return cors({ error: 'create_failed', detail: e?.message }, 500);
  }
}
