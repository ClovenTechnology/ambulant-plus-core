import { NextRequest, NextResponse } from 'next/server';
import { apigwBase } from '@/app/api/_apigw';

type ProxyOpts = {
  path: string; // relative upstream path e.g. "/api/settings/shop"
  channel?: string;
  forwardQuery?: boolean;
  stripQueryKeys?: string[];
  headers?: Record<string, string>;
};

function mustEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function safeReadJson(res: Response) {
  const text = await res.text();
  if (!text) return { __empty: true };
  try {
    return JSON.parse(text);
  } catch {
    return { __nonJson: true, raw: text };
  }
}

function stripKeys(url: URL, keys: string[]) {
  for (const k of keys) url.searchParams.delete(k);
}

export async function proxyAdminJsonGET(req: NextRequest, opts: ProxyOpts) {
  try {
    const base = apigwBase();
    if (!base) return NextResponse.json({ ok: false, error: 'Missing API gateway base (apigwBase())' }, { status: 500 });

    const key = mustEnv('API_GATEWAY_ADMIN_KEY');

    const src = new URL(req.url);
    const forwardQuery = opts.forwardQuery !== false;

    const upstream = new URL(`${base}${opts.path}`);
    if (forwardQuery) src.searchParams.forEach((v, k) => upstream.searchParams.set(k, v));
    if (opts.channel) upstream.searchParams.set('channel', opts.channel);
    stripKeys(upstream, opts.stripQueryKeys ?? []);

    const res = await fetch(upstream.toString(), {
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        'x-admin-key': key,
        ...(opts.headers ?? {}),
      },
    });

    const js = await safeReadJson(res);

    if ((js as any)?.__empty) {
      return NextResponse.json(
        { ok: false, error: `Upstream returned empty body (HTTP ${res.status})`, status: res.status },
        { status: 502 }
      );
    }

    if (typeof js === 'object' && js) (js as any).ok ??= res.ok;
    return NextResponse.json(js, { status: res.status });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Admin proxy failed (JSON GET)' }, { status: 502 });
  }
}

export async function proxyAdminTextGET(req: NextRequest, opts: ProxyOpts) {
  try {
    const base = apigwBase();
    if (!base) return NextResponse.json({ ok: false, error: 'Missing API gateway base (apigwBase())' }, { status: 500 });

    const key = mustEnv('API_GATEWAY_ADMIN_KEY');

    const src = new URL(req.url);
    const forwardQuery = opts.forwardQuery !== false;

    const upstream = new URL(`${base}${opts.path}`);
    if (forwardQuery) src.searchParams.forEach((v, k) => upstream.searchParams.set(k, v));
    if (opts.channel) upstream.searchParams.set('channel', opts.channel);
    stripKeys(upstream, opts.stripQueryKeys ?? []);

    const res = await fetch(upstream.toString(), {
      cache: 'no-store',
      headers: { 'x-admin-key': key, ...(opts.headers ?? {}) },
    });

    const body = await res.text();

    return new NextResponse(body, {
      status: res.status,
      headers: {
        'content-type': res.headers.get('content-type') || 'text/plain; charset=utf-8',
        'content-disposition': res.headers.get('content-disposition') || 'inline',
        'cache-control': 'no-store',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Admin proxy failed (TEXT GET)' }, { status: 502 });
  }
}

function jsonOrEmpty(body: any) {
  try {
    return JSON.stringify(body ?? {});
  } catch {
    return JSON.stringify({});
  }
}

export async function proxyAdminJsonBody(req: NextRequest, method: 'POST' | 'PATCH' | 'DELETE', opts: ProxyOpts) {
  try {
    const base = apigwBase();
    if (!base) return NextResponse.json({ ok: false, error: 'Missing API gateway base (apigwBase())' }, { status: 500 });

    const key = mustEnv('API_GATEWAY_ADMIN_KEY');
    const body = await req.json().catch(() => ({}));

    const upstream = new URL(`${base}${opts.path}`);

    const res = await fetch(upstream.toString(), {
      method,
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-admin-key': key,
        ...(opts.headers ?? {}),
      },
      body: jsonOrEmpty(body),
    });

    const js = await safeReadJson(res);

    if ((js as any)?.__empty) {
      return NextResponse.json(
        { ok: false, error: `Upstream returned empty body (HTTP ${res.status})`, status: res.status },
        { status: 502 }
      );
    }

    if (typeof js === 'object' && js) (js as any).ok ??= res.ok;
    return NextResponse.json(js, { status: res.status });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Admin proxy failed (JSON BODY)' }, { status: 502 });
  }
}
