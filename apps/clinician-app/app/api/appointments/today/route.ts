import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function gatewayBase() {
  return (
    process.env.API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
    ''
  ).replace(/\/$/, '');
}

function asList(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.appointments)) return payload.appointments;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function startsAtOf(item: any): string | null {
  return item?.startsAt || item?.start || item?.startISO || null;
}

function isToday(value: string | null) {
  if (!value) return false;

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;

  const now = new Date();

  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export async function GET(req: NextRequest) {
  const gateway = gatewayBase();

  if (!gateway) {
    return NextResponse.json(
      { ok: false, error: 'api_gateway_url_missing' },
      { status: 500 }
    );
  }

  try {
    const urlIn = new URL(req.url);
    const clinicianId = urlIn.searchParams.get('clinicianId') || '';

    const upstream = new URL('/api/appointments', gateway);
    if (clinicianId) upstream.searchParams.set('clinicianId', clinicianId);

    const r = await fetch(upstream.toString(), {
      method: 'GET',
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });

    const text = await r.text();

    if (!r.ok) {
      return new NextResponse(text, {
        status: r.status,
        headers: {
          'content-type': r.headers.get('content-type') || 'application/json',
          'cache-control': 'no-store',
        },
      });
    }

    const payload = text ? JSON.parse(text) : {};
    const today = asList(payload).filter((item) => isToday(startsAtOf(item)));

    return NextResponse.json(today, {
      headers: { 'cache-control': 'no-store' },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: 'appointments_today_upstream_failed', detail: String(e?.message || e) },
      { status: 502 }
    );
  }
}
