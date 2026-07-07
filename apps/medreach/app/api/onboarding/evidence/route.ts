// apps/medreach/app/api/onboarding/evidence/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { gatewayUrl, medreachHeaders, readJson } from '../_gateway';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function proxy(req: NextRequest, method: 'GET' | 'POST') {
  const url = new URL(req.url);
  const upstreamUrl = gatewayUrl(
    `/api/medreach/onboarding/evidence${method === 'GET' ? url.search : ''}`,
  );

  if (!upstreamUrl) {
    return NextResponse.json(
      {
        ok: false,
        error: 'api_gateway_not_configured',
        detail: 'Set APIGW_BASE or API_GATEWAY_BASE_URL for MedReach evidence.',
      },
      { status: 503 },
    );
  }

  const body = method === 'POST' ? await readJson(req) : undefined;
  const actorRef =
    typeof body?.subjectId === 'string' ? body.subjectId : 'medreach-onboarding-evidence';

  const upstream = await fetch(upstreamUrl, {
    method,
    headers: medreachHeaders(req, actorRef),
    body: method === 'POST' ? JSON.stringify(body || {}) : undefined,
    cache: 'no-store',
  });

  const json = await upstream.json().catch(() => null);

  return NextResponse.json(json || { ok: upstream.ok }, {
    status: upstream.status,
  });
}

export async function GET(req: NextRequest) {
  return proxy(req, 'GET');
}

export async function POST(req: NextRequest) {
  return proxy(req, 'POST');
}