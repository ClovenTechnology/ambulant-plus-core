// apps/clinician-app/app/api/_proxy/appointments/[id]/reschedule/route.ts
import { NextRequest, NextResponse } from 'next/server';

const GATEWAY = process.env.GATEWAY_URL || process.env.APIGW_BASE || process.env.NEXT_PUBLIC_APIGW_BASE || '';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;
  const body = await req.json().catch(() => ({}));
  const { startsAt, startsAt: startsAtAlt } = body;
  const startIso = startsAt || startsAtAlt || body.start || body.startsAt;

  if (!startIso) {
    return NextResponse.json({ error: 'Missing startsAt' }, { status: 400 });
  }

  if (GATEWAY) {
    const r = await fetch(`${GATEWAY}/api/appointments/${encodeURIComponent(id)}/reschedule`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ startsAt: startIso }),
    });
    const text = await r.text();
    return new NextResponse(text, { status: r.status, headers: { 'content-type': 'application/json' } });
  }

  // local reschedule
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const store = await import('../../../../_store');
    const patched = store.rescheduleAppointment(id, startIso);
    if (!patched) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(patched);
  } catch (e) {
    console.error('local reschedule error', e);
    return NextResponse.json({ error: 'Internal' }, { status: 500 });
  }
}
