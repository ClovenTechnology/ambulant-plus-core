import { NextRequest, NextResponse } from 'next/server';
import { gatewayBaseFromEnv, requireAdminCaller } from '../../../clinicians/onboarding/_helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function forward(request: NextRequest) {
  const caller = await requireAdminCaller(request);
  if (!caller.ok) return caller.response;

  const upstream = new URL('/api/admin/training/patients/invite', gatewayBaseFromEnv());
  upstream.search = request.nextUrl.search;
  const method = request.method.toUpperCase();
  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.text();
  const cookie = request.headers.get('cookie');
  const authorization = request.headers.get('authorization');
  const adminKey = process.env.ADMIN_API_KEY?.trim();

  const response = await fetch(upstream, {
    method,
    headers: {
      accept: 'application/json',
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
      ...(authorization ? { authorization } : {}),
      ...(adminKey ? { 'x-admin-key': adminKey } : {}),
    },
    body,
    cache: 'no-store',
  });

  return new NextResponse(await response.text(), {
    status: response.status,
    headers: {
      'content-type': response.headers.get('content-type') || 'application/json',
      'cache-control': 'no-store',
    },
  });
}

export async function GET(request: NextRequest) { return forward(request); }
export async function POST(request: NextRequest) { return forward(request); }
