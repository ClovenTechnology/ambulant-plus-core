import { NextRequest, NextResponse } from 'next/server';
import {
  gatewayBaseFromEnv,
  requireAdminCaller,
} from '../../../clinicians/onboarding/_helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const caller = await requireAdminCaller(request);
  if (!caller.ok) return caller.response;

  const upstream = new URL('/api/admin/training/patients/revoke', gatewayBaseFromEnv());
  const body = await request.text();
  const cookie = request.headers.get('cookie');
  const authorization = request.headers.get('authorization');
  const adminKey = process.env.ADMIN_API_KEY?.trim();

  const response = await fetch(upstream, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
      ...(authorization ? { authorization } : {}),
      ...(adminKey ? { 'x-admin-key': adminKey } : {}),
    },
    body: body || '{}',
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