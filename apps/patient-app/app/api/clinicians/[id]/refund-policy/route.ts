import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_REFUND_POLICY = {
  within24hPercent: 50,
  noShowPercent: 0,
  clinicianMissPercent: 100,
  networkProrate: true,
};

function getApigwBase() {
  return (
    process.env.APIGW_BASE ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.API_GATEWAY_URL ||
    process.env.API_GATEWAY_BASE_URL ||
    process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_APIGW_URL ||
    (process.env.NODE_ENV === 'production' ? 'https://api-gateway.ambulantplus.co.za' : '')
  ).replace(/\/+$/, '');
}

function forwardHeaders(req: NextRequest) {
  const headers = new Headers();

  [
    'authorization',
    'cookie',
    'x-ambulant-identity',
    'x-ambulant-user-id',
    'x-ambulant-org-id',
    'x-ambulant-role',
    'x-user-id',
    'x-uid',
    'x-org',
    'x-org-id',
    'x-role',
    'x-email',
    'x-name',
    'x-display-name',
    'x-correlation-id',
    'x-request-id',
  ].forEach((key) => {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  });

  headers.set('accept', 'application/json');

  if (!headers.get('x-role') && !headers.get('x-ambulant-role')) {
    headers.set('x-role', 'patient');
  }

  if (!headers.get('x-org-id') && !headers.get('x-ambulant-org-id')) {
    headers.set('x-org-id', process.env.NEXT_PUBLIC_DEFAULT_ORG_ID || 'org-default');
  }

  return headers;
}

function normalizePolicy(raw: any) {
  const src = raw && typeof raw === 'object' ? raw : {};

  return {
    within24hPercent: Number.isFinite(Number(src.within24hPercent))
      ? Math.max(0, Math.min(100, Math.round(Number(src.within24hPercent))))
      : DEFAULT_REFUND_POLICY.within24hPercent,
    noShowPercent: Number.isFinite(Number(src.noShowPercent))
      ? Math.max(0, Math.min(100, Math.round(Number(src.noShowPercent))))
      : DEFAULT_REFUND_POLICY.noShowPercent,
    clinicianMissPercent: Number.isFinite(Number(src.clinicianMissPercent))
      ? Math.max(0, Math.min(100, Math.round(Number(src.clinicianMissPercent))))
      : DEFAULT_REFUND_POLICY.clinicianMissPercent,
    networkProrate:
      typeof src.networkProrate === 'boolean'
        ? src.networkProrate
        : DEFAULT_REFUND_POLICY.networkProrate,
  };
}

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  const base = getApigwBase();
  const id = encodeURIComponent(ctx.params.id);

  if (!base) {
    const effective = normalizePolicy(DEFAULT_REFUND_POLICY);
    return NextResponse.json(
      {
        ok: true,
        effective,
        refundPolicy: effective,
        meta: {
          source: 'patient_refund_policy_default',
          warning: 'api_gateway_not_configured',
        },
      },
      { headers: { 'cache-control': 'no-store, max-age=0' } },
    );
  }

  try {
    const r = await fetch(`${base}/api/clinicians/${id}/booking-profile`, {
      cache: 'no-store',
      headers: forwardHeaders(req),
    });

    const j = await r.json().catch(() => null);
    const effective = normalizePolicy(j?.refundPolicy ?? j?.effective ?? DEFAULT_REFUND_POLICY);

    return NextResponse.json(
      {
        ok: true,
        effective,
        refundPolicy: effective,
        meta: {
          source: r.ok ? 'patient_refund_policy_from_booking_profile' : 'patient_refund_policy_default',
          upstreamStatus: r.status,
        },
      },
      { headers: { 'cache-control': 'no-store, max-age=0' } },
    );
  } catch (e: any) {
    const effective = normalizePolicy(DEFAULT_REFUND_POLICY);

    return NextResponse.json(
      {
        ok: true,
        effective,
        refundPolicy: effective,
        meta: {
          source: 'patient_refund_policy_default',
          warning: e?.message || 'booking_profile_fetch_failed',
        },
      },
      { headers: { 'cache-control': 'no-store, max-age=0' } },
    );
  }
}
