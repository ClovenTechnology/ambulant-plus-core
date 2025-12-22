// apps/clinician-app/app/api/_proxy/appointments/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';

const GATEWAY = process.env.GATEWAY_URL || process.env.APIGW_BASE || process.env.NEXT_PUBLIC_APIGW_BASE || '';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;
  if (GATEWAY) {
    const r = await fetch(`${GATEWAY}/api/appointments/${encodeURIComponent(id)}`, {
      method: 'GET',
      headers: { 'content-type': 'application/json' },
      cache: 'no-store',
    });
    const text = await r.text();
    return new NextResponse(text, { status: r.status, headers: { 'content-type': 'application/json' } });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const store = await import('../../../../_store');
    const a = store.getAppointment(id);
    if (!a) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(a);
  } catch (e) {
    console.error('local get appointment error', e);
    return NextResponse.json({ error: 'Internal' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;
  if (GATEWAY) {
    const r = await fetch(`${GATEWAY}/api/appointments/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
    });
    const text = await r.text();
    return new NextResponse(text, { status: r.status, headers: { 'content-type': 'application/json' } });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const store = await import('../../../../_store');
    // No explicit delete in store — mark as cancelled if updateAppointment available
    const upd = store.updateAppointment ? store.updateAppointment(id, { status: 'cancelled' }) : undefined;
    if (!upd) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, appointment: upd });
  } catch (e) {
    console.error('local delete appointment error', e);
    return NextResponse.json({ error: 'Internal' }, { status: 500 });
  }
}
