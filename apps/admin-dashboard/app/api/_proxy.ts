import { NextRequest, NextResponse } from 'next/server';
import { apigwBase } from '@/app/api/_apigw';
import { gatewayProxyHeaders } from '@/src/lib/gateway-proxy';

type ProxyOpts = {
  path: string; // relative upstream path e.g. "/api/settings/shop"
  channel?: string;
  forwardQuery?: boolean;
  stripQueryKeys?: string[];
  headers?: Record<string, string>;
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

function stripKeys(url: URL, keys: string[]) {
  for (const k of keys) url.searchParams.delete(k);
}

export async function proxyAdminJsonGET(req: NextRequest, opts: ProxyOpts) {
  try {
    const base = apigwBase();
    if (!base) return NextResponse.json({ ok: false, error: 'Missing API gateway base (apigwBase())' }, { status: 500 });



    const src = new URL(req.url);
    const forwardQuery = opts.forwardQuery !== false;

    const upstream = new URL(`${base}${opts.path}`);
    if (forwardQuery) src.searchParams.forEach((v, k) => upstream.searchParams.set(k, v));
    if (opts.channel) upstream.searchParams.set('channel', opts.channel);
    stripKeys(upstream, opts.stripQueryKeys ?? []);

    const res = await fetch(upstream.toString(), {
      cache: 'no-store',
      headers: gatewayProxyHeaders(
        req,
        {
          ...(opts.headers ?? {}),
        },
      ),
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



    const src = new URL(req.url);
    const forwardQuery = opts.forwardQuery !== false;

    const upstream = new URL(`${base}${opts.path}`);
    if (forwardQuery) src.searchParams.forEach((v, k) => upstream.searchParams.set(k, v));
    if (opts.channel) upstream.searchParams.set('channel', opts.channel);
    stripKeys(upstream, opts.stripQueryKeys ?? []);

    const res = await fetch(upstream.toString(), {
      cache: 'no-store',
      headers: gatewayProxyHeaders(
        req,
        {
          ...(opts.headers ?? {}),
        },
      ),
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

export async function proxyAdminJsonBody(req: NextRequest, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', opts: ProxyOpts) {
  try {
    const base = apigwBase();
    if (!base) return NextResponse.json({ ok: false, error: 'Missing API gateway base (apigwBase())' }, { status: 500 });


    const body = await req.json().catch(() => ({}));

    const upstream = new URL(`${base}${opts.path}`);

    const res = await fetch(upstream.toString(), {
      method,
      cache: 'no-store',
      headers: gatewayProxyHeaders(
        req,
        {
          'content-type': 'application/json',
          ...(opts.headers ?? {}),
        },
      ),
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

export async function proxyAdminBinaryGET(req: NextRequest, opts: ProxyOpts) {
  try {
    const base = apigwBase();
    if (!base) {
      return NextResponse.json(
        { ok: false, error: 'Missing API gateway base (apigwBase())' },
        { status: 500 },
      );
    }

    const src = new URL(req.url);
    const upstream = new URL(`${base}${opts.path}`);
    if (opts.forwardQuery !== false) {
      src.searchParams.forEach((value, key) => upstream.searchParams.set(key, value));
    }
    if (opts.channel) upstream.searchParams.set('channel', opts.channel);
    stripKeys(upstream, opts.stripQueryKeys ?? []);

    const gatewayResponse = await fetch(upstream.toString(), {
      cache: 'no-store',
      redirect: 'manual',
      headers: gatewayProxyHeaders(req, { ...(opts.headers ?? {}) }),
    });

    if (gatewayResponse.status >= 300 && gatewayResponse.status < 400) {
      const location = gatewayResponse.headers.get('location');
      if (!location) {
        return NextResponse.json(
          { ok: false, error: 'Upstream media redirect did not include a location.' },
          { status: 502 },
        );
      }

      const mediaResponse = await fetch(location, {
        cache: 'no-store',
        redirect: 'follow',
      });
      if (!mediaResponse.ok) {
        return NextResponse.json(
          { ok: false, error: 'Unable to load the requested media.' },
          { status: mediaResponse.status },
        );
      }
      const body = await mediaResponse.arrayBuffer();
      return new NextResponse(body, {
        status: 200,
        headers: {
          'content-type': mediaResponse.headers.get('content-type') || 'application/octet-stream',
          'content-disposition': mediaResponse.headers.get('content-disposition') || 'inline',
          'cache-control': 'private, no-store',
        },
      });
    }

    if (!gatewayResponse.ok) {
      const js = await safeReadJson(gatewayResponse);
      return NextResponse.json(js, { status: gatewayResponse.status });
    }

    const body = await gatewayResponse.arrayBuffer();
    return new NextResponse(body, {
      status: gatewayResponse.status,
      headers: {
        'content-type': gatewayResponse.headers.get('content-type') || 'application/octet-stream',
        'content-disposition': gatewayResponse.headers.get('content-disposition') || 'inline',
        'cache-control': 'private, no-store',
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'Admin proxy failed (BINARY GET)' },
      { status: 502 },
    );
  }
}
