import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CANONICAL_API_GATEWAY = 'https://api-gateway.ambulantplus.co.za';

function clean(value: unknown, max = 2000) {
  return String(value ?? '').trim().slice(0, max);
}

function isProductionRuntime() {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
}

function gatewayBase() {
  const raw = clean(process.env.APIGW_BASE || process.env.NEXT_PUBLIC_APIGW_BASE, 500).replace(/\/+$/, '');
  if (raw) return raw;
  if (isProductionRuntime()) return CANONICAL_API_GATEWAY;
  throw new Error('APIGW_BASE_required');
}

function sameOriginBase(req: NextRequest) {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

async function readMe(req: NextRequest) {
  const cookie = req.headers.get('cookie');
  const res = await fetch(`${sameOriginBase(req)}/api/auth/me`, {
    method: 'GET',
    cache: 'no-store',
    headers: cookie ? { cookie } : {},
  });

  return res.json().catch(() => null);
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const v = clean(value, 240);
    if (v) return v;
  }
  return '';
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = clean(params.id, 180);
    if (!id) {
      return NextResponse.json({ ok: false, error: 'erx_id_required' }, { status: 400 });
    }

    const me = await readMe(req);
    if (!me?.ok) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    const user = me.user || me.account || {};
    const patient = me.patient || me.profile || {};
    const role = firstText(me.role, user.role, 'patient');
    const userId = firstText(me.uid, me.userId, user.id, patient.userId, patient.id);
    const actorRefId = firstText(me.actorRefId, patient.id, me.patientId, user.patientId, userId);
    const orgId = firstText(me.orgId, user.orgId, patient.orgId);

    const headers = new Headers();
    headers.set('accept', 'application/pdf');
    headers.set('x-ambulant-user-id', userId);
    headers.set('x-ambulant-role', role);
    headers.set('x-ambulant-actor-ref-id', actorRefId);
    if (orgId) headers.set('x-ambulant-org-id', orgId);

    const cookie = req.headers.get('cookie');
    if (cookie) headers.set('cookie', cookie);

    const upstream = await fetch(`${gatewayBase()}/api/erx/${encodeURIComponent(id)}/pdf`, {
      method: 'GET',
      cache: 'no-store',
      headers,
    });

    const body = await upstream.arrayBuffer();
    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', upstream.headers.get('Content-Type') || 'application/pdf');
    responseHeaders.set(
      'Content-Disposition',
      upstream.headers.get('Content-Disposition') || `inline; filename="ambulant-erx-${id}.pdf"`,
    );
    responseHeaders.set('Cache-Control', 'no-store');

    return new NextResponse(body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: String(err?.message || 'failed_to_fetch_erx_pdf') },
      { status: 500 },
    );
  }
}
