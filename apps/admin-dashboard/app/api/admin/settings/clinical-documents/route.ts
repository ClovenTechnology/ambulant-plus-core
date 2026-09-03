import { NextRequest, NextResponse } from 'next/server';
import { apigwBase } from '@/app/api/_apigw';
import { gatewayProxyHeaders } from '@/src/lib/gateway-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function relay(req: NextRequest, method: 'GET' | 'PUT') {
  const upstream = `${apigwBase()}/api/admin/settings/clinical-documents`;
  const headers = gatewayProxyHeaders(req, method === 'PUT' ? { 'content-type': 'application/json' } : undefined);
  const res = await fetch(upstream, {
    method,
    headers,
    cache: 'no-store',
    body: method === 'PUT' ? await req.text() : undefined,
  });
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: {
      'content-type': res.headers.get('content-type') || 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export async function GET(req: NextRequest) { return relay(req, 'GET'); }
export async function PUT(req: NextRequest) { return relay(req, 'PUT'); }
