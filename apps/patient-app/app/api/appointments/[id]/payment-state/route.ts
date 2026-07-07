import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function trimSlash(s: string) {
  return String(s || '').replace(/\/+$/, '');
}

function gatewayBase(): string {
  const configured =
    process.env.APIGW_BASE ||
    process.env.API_GATEWAY_BASE_URL ||
    process.env.API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
    process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
    process.env.APIGW_ORIGIN ||
    process.env.API_GATEWAY_ORIGIN ||
    '';

  const base = trimSlash(configured);
  if (!base) throw new Error('APIGW_BASE_required');
  return base;
}

function forwardAuthHeaders(req: NextRequest) {
  const headers = new Headers();

  ['cookie', 'authorization', 'x-ambulant-identity', 'x-uid', 'x-org-id', 'x-role'].forEach((k) => {
    const v = req.headers.get(k);
    if (v) headers.set(k, v);
  });

  headers.set('accept', 'application/json');

  if (!headers.get('x-role')) {
    headers.set('x-role', 'patient');
  }

  return headers;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const appointmentId = String(params?.id || '').trim();

    if (!appointmentId) {
      return NextResponse.json(
        { ok: false, error: 'appointment_id_required' },
        { status: 400 },
      );
    }

    const upstream = `${gatewayBase()}/api/appointments/${encodeURIComponent(appointmentId)}`;

    const res = await fetch(upstream, {
      method: 'GET',
      headers: forwardAuthHeaders(req),
      cache: 'no-store',
    });

    const raw = await res.json().catch(() => ({} as any));

    if (!res.ok || raw?.ok === false) {
      return NextResponse.json(
        raw?.ok === false ? raw : { ok: false, error: raw?.error || `Gateway responded ${res.status}` },
        { status: res.status },
      );
    }

    const appointment = raw.appointment ?? raw;

    const paymentStatus = String(
      appointment?.paymentStatus ??
        appointment?.payment_status ??
        appointment?.payment?.status ??
        '',
    ).toUpperCase();

    const status = String(appointment?.status ?? '').toLowerCase();

    const ready =
      paymentStatus === 'CAPTURED' ||
      paymentStatus === 'PAID' ||
      paymentStatus === 'SETTLED' ||
      status === 'confirmed' ||
      status === 'in_consult' ||
      status === 'completed';

    const failed =
      paymentStatus === 'FAILED' ||
      status === 'payment_expired' ||
      status === 'payment_init_failed' ||
      status === 'cancelled_payment_timeout';

    const pending =
      !ready &&
      !failed &&
      (paymentStatus === 'PENDING' ||
        status === 'pending_payment' ||
        status === 'pending');

    return NextResponse.json(
      {
        ok: true,
        appointmentId,
        status,
        paymentStatus,
        ready,
        pending,
        failed,
        appointment,
        raw: process.env.NODE_ENV === 'development' ? raw : undefined,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'payment_state_proxy_failed' },
      { status: 502 },
    );
  }
}
