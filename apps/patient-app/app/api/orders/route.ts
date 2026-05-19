// apps/patient-app/app/api/orders/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const revalidate = 0;

function getGatewayBase() {
  return (
    process.env.APIGW_BASE ||
    process.env.API_GATEWAY_BASE_URL ||
    process.env.API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ||
    process.env.NEXT_PUBLIC_GATEWAY_BASE ||
    ''
  ).replace(/\/+$/, '');
}

async function readBody(req: Request) {
  const text = await req.text();
  return text ? text : undefined;
}

async function proxy(req: Request, path: string, init?: RequestInit) {
  const gateway = getGatewayBase();

  if (!gateway) {
    return NextResponse.json({ error: 'API gateway is not configured.' }, { status: 503 });
  }

  const res = await fetch(`${gateway}${path}`, {
    ...init,
    cache: 'no-store',
    headers: {
      'content-type': 'application/json',
      'x-role': 'patient',
      ...(init?.headers || {}),
    },
  });

  const data = await res.json().catch(() => null);
  return NextResponse.json(data ?? {}, { status: res.status });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const search = url.search || '';
  return proxy(req, `/api/orders${search}`);
}

export async function POST(req: Request) {
  const body = await readBody(req);
  return proxy(req, '/api/orders', {
    method: 'POST',
    body,
  });
}
