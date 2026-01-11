//apps/admin-dashboard/app/api/admin/clinicians/onboarding/_helpers.ts
import { NextRequest, NextResponse } from 'next/server';

export function gatewayBaseFromEnv() {
  return (
    process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ??
    process.env.APIGW_BASE ??
    process.env.GATEWAY_URL ??
    process.env.NEXT_PUBLIC_APIGW_BASE ??
    process.env.NEXT_PUBLIC_PATIENT_BASE ??
    'http://localhost:3010'
  );
}

export async function readJson(req: NextRequest) {
  const ct = req.headers.get('content-type') || '';
  if (ct.includes('application/json')) return req.json().catch(() => ({} as any));
  // fallback (rare): formData
  const fd = await req.formData().catch(() => null);
  if (!fd) return {} as any;
  const out: any = {};
  fd.forEach((v, k) => (out[k] = v));
  return out;
}

export async function forwardToGateway(req: NextRequest, path: string, body: any) {
  const gateway = gatewayBaseFromEnv();
  const adminKey = process.env.ADMIN_API_KEY ?? '';

  const url = `${gateway}${path.startsWith('/') ? path : `/${path}`}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-admin-key': adminKey,
    },
    body: JSON.stringify(body ?? {}),
    cache: 'no-store',
  });

  const text = await res.text().catch(() => '');
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    return NextResponse.json(
      { ok: false, error: json?.error || text || `HTTP_${res.status}`, status: res.status },
      { status: res.status }
    );
  }

  // pass-through success payload
  return NextResponse.json(json ?? { ok: true }, { status: 200 });
}

export async function bestEffortNotifyDispatch(payload: any) {
  const gateway = gatewayBaseFromEnv();
  const adminKey = process.env.ADMIN_API_KEY ?? '';
  const url = `${gateway}/api/admin/clinicians/onboarding/notify-dispatch`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-admin-key': adminKey },
      body: JSON.stringify(payload ?? {}),
      cache: 'no-store',
    });

    // If endpoint not implemented yet, ignore.
    if (res.status === 404) return { ok: false, ignored: true, reason: 'notify_404' };

    if (!res.ok) {
      const t = await res.text().catch(() => '');
      return { ok: false, ignored: false, reason: t || `notify_http_${res.status}` };
    }

    return { ok: true };
  } catch (e: any) {
    // do not break the main action
    return { ok: false, ignored: false, reason: e?.message || 'notify_failed' };
  }
}
