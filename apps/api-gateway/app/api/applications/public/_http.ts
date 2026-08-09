import { NextRequest, NextResponse } from 'next/server';
import {
  applicationPortalBearerToken,
  applicationPortalClientKey,
  publicApplicationPortalResponse,
} from '@/src/lib/public-application-portal';

export function applicationPortalJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

export async function applicationPortalJsonBody(request: NextRequest) {
  const body = await request.json().catch(() => null);
  return body && typeof body === 'object' && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
}

export function applicationPortalRequestToken(request: NextRequest) {
  return applicationPortalBearerToken(request.headers.get('authorization'));
}

export function applicationPortalRequestClientKey(request: NextRequest) {
  return applicationPortalClientKey({
    forwardedFor: request.headers.get('x-forwarded-for'),
    realIp: request.headers.get('x-real-ip'),
    userAgent: request.headers.get('user-agent'),
  });
}

export function applicationPortalErrorResponse(error: unknown) {
  const known = publicApplicationPortalResponse(error);
  if (known) return applicationPortalJson(known.body, known.status);
  console.error('[public application portal] request failed', error);
  return applicationPortalJson({ ok: false, error: 'application_portal_request_failed' }, 500);
}
