// apps/api-gateway/app/api/appointments/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { updateAppointment } from '@/src/store/appointments';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'PUT,OPTIONS',
      'access-control-allow-headers': 'content-type'
    }
  });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string }}) {
  const id = params.id;
  try {
    const body = await req.json();
    const out = await updateAppointment(id, {
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      meta: body.meta,
    });
    return NextResponse.json(out, { headers: { 'access-control-allow-origin': '*' } });
  } catch (e:any) {
    if (e?.code === 'patient_conflict' || e?.message === 'patient_conflict') {
      return NextResponse.json({ error: 'patient_conflict' }, { status: 409, headers: { 'access-control-allow-origin': '*' }});
    }
    if (e?.code === 'clinician_conflict' || e?.message === 'clinician_conflict') {
      return NextResponse.json({ error: 'clinician_conflict' }, { status: 409, headers: { 'access-control-allow-origin': '*' }});
    }
    if (e?.message === 'not_found') {
      return NextResponse.json({ error: 'not_found' }, { status: 404, headers: { 'access-control-allow-origin': '*' }});
    }
    return NextResponse.json({ error: 'bad_request', detail: e?.message }, { status: 400, headers: { 'access-control-allow-origin': '*' }});
  }
}
