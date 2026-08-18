import { NextRequest, NextResponse } from 'next/server';
import {
  forwardToGateway,
  gatewayBaseFromEnv,
  requireAdminCaller,
} from '../../clinicians/onboarding/_helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function safeJson(response: Response) {
  const text = await response.text().catch(() => '');
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: text || `HTTP_${response.status}` };
  }
}

function upstreamHeaders(request: NextRequest) {
  const headers = new Headers({
    accept: 'application/json',
    'cache-control': 'no-store',
    'x-admin-origin': request.nextUrl.origin,
  });

  const cookie = request.headers.get('cookie');
  if (cookie) headers.set('cookie', cookie);

  const authorization = request.headers.get('authorization');
  if (authorization) headers.set('authorization', authorization);

  const adminKey = String(process.env.ADMIN_API_KEY || '').trim();
  if (adminKey) headers.set('x-admin-key', adminKey);

  return headers;
}

export async function GET(request: NextRequest) {
  const caller = await requireAdminCaller(request);
  if (!caller.ok) return caller.response;

  const trainingSlotId = String(
    request.nextUrl.searchParams.get('trainingSlotId') || '',
  ).trim();

  if (!trainingSlotId) {
    return NextResponse.json(
      { ok: false, error: 'trainingSlotId_required' },
      { status: 400 },
    );
  }

  const url = new URL(
    '/api/admin/training/participations',
    gatewayBaseFromEnv(),
  );
  url.searchParams.set('trainingSlotId', trainingSlotId);

  const response = await fetch(url, {
    method: 'GET',
    headers: upstreamHeaders(request),
    cache: 'no-store',
  });

  const body = await safeJson(response);
  return NextResponse.json(body, {
    status: response.status,
    headers: { 'cache-control': 'no-store' },
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({} as any));
  return forwardToGateway(
    request,
    '/api/admin/training/participations',
    body,
  );
}
