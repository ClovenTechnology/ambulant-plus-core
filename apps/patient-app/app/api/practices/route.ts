// apps/patient-app/app/api/practices/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function apiGatewayBase() {
  return (
    process.env.APIGW_BASE ||
    process.env.API_GATEWAY_BASE_URL ||
    process.env.API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
    ''
  ).replace(/\/+$/, '');
}

function copyForwardHeaders(req: NextRequest) {
  const headers = new Headers();

  const passthrough = [
    'authorization',
    'cookie',
    'x-uid',
    'x-user-id',
    'x-role',
    'x-org',
    'x-org-id',
    'x-ambulant-user-id',
    'x-ambulant-org-id',
    'x-ambulant-role',
  ];

  for (const key of passthrough) {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  }

  headers.set('accept', 'application/json');

  return headers;
}

/**
 * Patient-facing practices listing.
 *
 * Production rule:
 * - Do not import or return mock practices.
 * - Proxy to API Gateway when configured.
 * - If practice directory is not wired, return an empty list with ok=true.
 */
export async function GET(req: NextRequest) {
  const incoming = new URL(req.url);
  const country = (incoming.searchParams.get('country') || 'ZA').toUpperCase();

  const base = apiGatewayBase();

  if (!base) {
    return json({
      ok: true,
      country,
      practices: [],
      source: 'not_configured',
      message: 'Practice directory is not configured yet.',
    });
  }

  try {
    const target = new URL('/api/practices', base);

    incoming.searchParams.forEach((value, key) => {
      target.searchParams.set(key, value);
    });

    if (!target.searchParams.get('country')) {
      target.searchParams.set('country', country);
    }

    const upstream = await fetch(target.toString(), {
      cache: 'no-store',
      headers: copyForwardHeaders(req),
    });

    const data = await upstream.json().catch(() => null);

    if (!upstream.ok) {
      return json(
        {
          ok: true,
          country,
          practices: [],
          source: 'gateway_error',
          error:
            data?.error ||
            data?.message ||
            `Practice directory unavailable: HTTP ${upstream.status}`,
        },
        200,
      );
    }

    const practices = Array.isArray(data)
      ? data
      : Array.isArray(data?.practices)
        ? data.practices
        : Array.isArray(data?.data)
          ? data.data
          : [];

    return json({
      ok: true,
      country: data?.country || country,
      practices,
      source: 'api_gateway',
    });
  } catch (err: any) {
    console.error('[patient-api][practices] GET error', err);

    return json({
      ok: true,
      country,
      practices: [],
      source: 'gateway_exception',
      error: err?.message || 'Practice directory unavailable.',
    });
  }
}