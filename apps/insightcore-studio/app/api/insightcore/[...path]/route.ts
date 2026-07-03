import { NextRequest, NextResponse } from 'next/server';
import { gatewayBase } from '@/src/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Context = {
  params: {
    path?: string[];
  };
};

function targetUrl(req: NextRequest, path: string[] = []) {
  const joined = path.map((part) => encodeURIComponent(part)).join('/');
  const suffix = joined ? `/api/insightcore/${joined}` : '/api/insightcore';
  return `${gatewayBase()}${suffix}${req.nextUrl.search || ''}`;
}

function forwardedHeaders(req: NextRequest) {
  const headers = new Headers();

  const accept = req.headers.get('accept');
  const contentType = req.headers.get('content-type');
  const cookie = req.headers.get('cookie');
  const authorization = req.headers.get('authorization');

  if (accept) headers.set('accept', accept);
  if (contentType) headers.set('content-type', contentType);
  if (cookie) headers.set('cookie', cookie);
  if (authorization) headers.set('authorization', authorization);

  headers.set('x-admin-origin', req.nextUrl.origin);
  headers.set('x-insightcore-origin', req.nextUrl.origin);

  return headers;
}

async function proxy(req: NextRequest, context: Context) {
  try {
    const method = req.method.toUpperCase();
    const hasBody = !['GET', 'HEAD'].includes(method);
    const body = hasBody ? await req.text() : undefined;

    const upstream = await fetch(targetUrl(req, context.params.path || []), {
      method,
      headers: forwardedHeaders(req),
      body,
      cache: 'no-store'
    });

    const responseBody = await upstream.text();

    const headers = new Headers();
    const contentType = upstream.headers.get('content-type');
    const setCookie = upstream.headers.get('set-cookie');

    headers.set('cache-control', 'no-store');
    if (contentType) headers.set('content-type', contentType);
    if (setCookie) headers.set('set-cookie', setCookie);

    return new NextResponse(responseBody, {
      status: upstream.status,
      headers
    });
  } catch (error: any) {
    const message = String(error?.message || '');

    return NextResponse.json(
      {
        ok: false,
        error:
          message === 'gateway_base_not_configured'
            ? 'gateway_base_not_configured'
            : 'insightcore_gateway_proxy_failed'
      },
      {
        status: message === 'gateway_base_not_configured' ? 503 : 502,
        headers: {
          'cache-control': 'no-store'
        }
      }
    );
  }
}

export async function GET(req: NextRequest, context: Context) {
  return proxy(req, context);
}

export async function POST(req: NextRequest, context: Context) {
  return proxy(req, context);
}

export async function PUT(req: NextRequest, context: Context) {
  return proxy(req, context);
}

export async function PATCH(req: NextRequest, context: Context) {
  return proxy(req, context);
}

export async function DELETE(req: NextRequest, context: Context) {
  return proxy(req, context);
}