// apps/medreach/app/api/labs/settings/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export type LabSettings = {
  id: string;
  name: string;
  contact?: string | null;
  active?: boolean;
  status?: string | null;
  onboardingStatus?: string | null;
  country?: string | null;
  currency?: string | null;
  canManageStaff?: boolean;
  canPublishResults?: boolean;
  payoutAccountMasked?: string | null;
  ownerUserId?: string | null;
  commissionKind?: string | null;
  commissionValue?: number | null;
  monthlyAccessFeeCents?: number | null;
};

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function gatewayBase() {
  return (
    process.env.APIGW_BASE ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
    process.env.API_GATEWAY_BASE_URL ||
    ''
  ).replace(/\/+$/, '');
}

function gatewayUrl(path: string) {
  const base = gatewayBase();
  if (!base) return null;

  const cleanPath = path.replace(/^\/+/, '');
  const finalPath =
    base.endsWith('/api') && cleanPath.startsWith('api/')
      ? cleanPath.slice(4)
      : cleanPath;

  return `${base}/${finalPath}`;
}

function copyHeaders(req: NextRequest, labId: string) {
  const headers = new Headers();

  for (const [key, value] of req.headers.entries()) {
    const lower = key.toLowerCase();

    if (lower === 'authorization' || lower === 'cookie' || lower.startsWith('x-')) {
      headers.set(key, value);
    }
  }

  headers.set('accept', 'application/json');
  headers.set('x-lab-id', headers.get('x-lab-id') || labId);

  return headers;
}

function normalizeLab(raw: any): LabSettings | null {
  const lab = raw?.data || raw?.lab || raw?.settings || raw;

  if (!lab || typeof lab !== 'object') return null;

  return {
    id: String(lab.id || ''),
    name: String(lab.name || ''),
    contact: lab.contact ?? null,
    active: lab.active,
    status: lab.status ?? null,
    onboardingStatus: lab.onboardingStatus ?? null,
    country: lab.country ?? null,
    currency: lab.currency ?? null,
    canManageStaff: lab.canManageStaff,
    canPublishResults: lab.canPublishResults,
    payoutAccountMasked: lab.payoutAccountMasked ?? null,
    ownerUserId: lab.ownerUserId ?? null,
    commissionKind: lab.commissionKind ?? null,
    commissionValue:
      lab.commissionValue == null ? null : Number(lab.commissionValue),
    monthlyAccessFeeCents: lab.monthlyAccessFeeCents ?? null,
  };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const labId = clean(url.searchParams.get('labId'));

  if (!labId) {
    return NextResponse.json({ ok: false, error: 'missing_labId' }, { status: 400 });
  }

  const upstreamUrl = gatewayUrl(`/api/medreach/labs/${encodeURIComponent(labId)}`);

  if (!upstreamUrl) {
    return NextResponse.json(
      { ok: false, error: 'api_gateway_not_configured' },
      { status: 503 },
    );
  }

  const upstream = await fetch(upstreamUrl, {
    method: 'GET',
    headers: copyHeaders(req, labId),
    cache: 'no-store',
  });

  const json = await upstream.json().catch(() => null);

  if (!upstream.ok) {
    return NextResponse.json(
      { ok: false, error: json?.error || 'lab_settings_upstream_failed', detail: json },
      { status: upstream.status },
    );
  }

  const settings = normalizeLab(json);

  return NextResponse.json({
    ok: true,
    data: settings,
    settings,
    ...settings,
  });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const labId = clean(body.labId);

  if (!labId) {
    return NextResponse.json({ ok: false, error: 'missing_labId' }, { status: 400 });
  }

  const upstreamUrl = gatewayUrl(`/api/medreach/labs/${encodeURIComponent(labId)}`);

  if (!upstreamUrl) {
    return NextResponse.json(
      { ok: false, error: 'api_gateway_not_configured' },
      { status: 503 },
    );
  }

  const headers = copyHeaders(req, labId);
  headers.set('content-type', 'application/json');

  const upstream = await fetch(upstreamUrl, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  const json = await upstream.json().catch(() => null);

  if (!upstream.ok) {
    return NextResponse.json(
      { ok: false, error: json?.error || 'lab_settings_update_failed', detail: json },
      { status: upstream.status },
    );
  }

  const settings = normalizeLab(json);

  return NextResponse.json({
    ok: true,
    data: settings,
    settings,
    ...settings,
  });
}