import { NextRequest, NextResponse } from 'next/server';
import { apigwBase } from '@/app/api/_apigw';

type ProxyOpts = {
  /** Relative upstream path, e.g. "/api/shop/orders" */
  path: string;

  /** Force a channel query param upstream (recommended). */
  channel?: string;

  /** For patient endpoints that require auth. */
  requireUid?: boolean;

  /** Where to read uid from (default: query "uid", then header x-uid). */
  uidQueryKey?: string;

  /** Extra headers to add to upstream request. */
  headers?: Record<string, string>;

  /** Optional: remove query keys before forwarding upstream. */
  stripQueryKeys?: string[];

  /** Forward query params from current request (default true). */
  forwardQuery?: boolean;
};

async function safeReadJson(res: Response) {
  const text = await res.text();
  if (!text) return { __empty: true };
  try {
    return JSON.parse(text);
  } catch {
    return { __nonJson: true, raw: text };
  }
}

function getUid(req: NextRequest, uidQueryKey = 'uid') {
  const url = new URL(req.url);
  const fromQuery = String(url.searchParams.get(uidQueryKey) || '').trim();
  if (fromQuery) return fromQuery;
  const fromHeader = String(req.headers.get('x-uid') || '').trim();
  return fromHeader;
}

function stripKeys(url: URL, keys: string[]) {
  for (const k of keys) url.searchParams.delete(k);
}

export async function proxyJsonGET(req: NextRequest, opts: ProxyOpts) {
  try {
    const base = apigwBase();
    if (!base) {
      return NextResponse.json({ ok: false, error: 'Missing API gateway base (apigwBase())' }, { status: 500 });
    }

    const src = new URL(req.url);
    const forwardQuery = opts.forwardQuery !== false;

    // Build upstream URL
    const upstream = new URL(`${base}${opts.path}`);
    if (forwardQuery) {
      src.searchParams.forEach((v, k) => upstream.searchParams.set(k, v));
    }

    if (opts.channel) upstream.searchParams.set('channel', opts.channel);

    // remove demo/internal keys before forwarding
    stripKeys(upstream, opts.stripQueryKeys ?? []);

    const uid = getUid(req, opts.uidQueryKey);
    if (opts.requireUid && !uid) {
      return NextResponse.json({ ok: false, error: 'Missing uid' }, { status: 400 });
    }

    const res = await fetch(upstream.toString(), {
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        ...(uid ? { 'x-uid': uid } : {}),
        'x-role': 'patient',
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
    return NextResponse.json({ ok: false, error: e?.message || 'Proxy failed (JSON GET)' }, { status: 502 });
  }
}

export async function proxyTextGET(req: NextRequest, opts: ProxyOpts) {
  try {
    const base = apigwBase();
    if (!base) {
      return NextResponse.json({ ok: false, error: 'Missing API gateway base (apigwBase())' }, { status: 500 });
    }

    const src = new URL(req.url);
    const forwardQuery = opts.forwardQuery !== false;

    const upstream = new URL(`${base}${opts.path}`);
    if (forwardQuery) {
      src.searchParams.forEach((v, k) => upstream.searchParams.set(k, v));
    }

    if (opts.channel) upstream.searchParams.set('channel', opts.channel);
    stripKeys(upstream, opts.stripQueryKeys ?? []);

    const uid = getUid(req, opts.uidQueryKey);
    if (opts.requireUid && !uid) {
      return NextResponse.json({ ok: false, error: 'Missing uid' }, { status: 400 });
    }

    const res = await fetch(upstream.toString(), {
      cache: 'no-store',
      headers: {
        ...(uid ? { 'x-uid': uid } : {}),
        'x-role': 'patient',
        ...(opts.headers ?? {}),
      },
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
    return NextResponse.json({ ok: false, error: e?.message || 'Proxy failed (TEXT GET)' }, { status: 502 });
  }
}
