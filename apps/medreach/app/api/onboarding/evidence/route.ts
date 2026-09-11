// apps/medreach/app/api/onboarding/evidence/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { gatewayErrorMessage, gatewayUrl, medreachHeaders, readJson } from '../_gateway';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function proxy(req: NextRequest, method: 'GET' | 'POST') {
  try {
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

    if (!upstream.ok) {
      return NextResponse.json(
        { ok: false, error: gatewayErrorMessage(json, `gateway_http_${upstream.status}`) },
        { status: upstream.status },
      );
    }

    return NextResponse.json(json && typeof json === 'object' ? json : { ok: true }, {
      status: upstream.status,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: gatewayErrorMessage(error, 'medreach_evidence_gateway_unavailable') },
      { status: 503 },
    );
  }
}

export async function GET(req: NextRequest) {
  return proxy(req, 'GET');
}

export async function POST(req: NextRequest) {
  return proxy(req, 'POST');
}