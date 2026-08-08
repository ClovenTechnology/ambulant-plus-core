import { NextRequest, NextResponse } from 'next/server';

export const MEETING_GUEST_COOKIE = 'ambulant.meeting_guest';

export function meetingGatewayBase() {
  return String(
    process.env.APIGW_BASE ||
      process.env.APIGW_BASE_URL ||
      process.env.API_GATEWAY_BASE_URL ||
      process.env.API_GATEWAY_URL ||
      process.env.NEXT_PUBLIC_APIGW_BASE ||
      process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
      (process.env.NODE_ENV === 'production'
        ? 'https://api-gateway.ambulantplus.co.za'
        : 'http://localhost:3010'),
  ).replace(/\/+$/, '');
}

export async function safeJson(response: Response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: 'meeting_gateway_invalid_response' };
  }
}

function guestForwardHeaders(request: NextRequest, sessionToken?: string) {
  const headers = new Headers();
  headers.set('content-type', 'application/json');

  if (sessionToken) {
    headers.set('x-meeting-guest-session', sessionToken);
  }

  const userAgent = request.headers.get('user-agent');
  if (userAgent) headers.set('user-agent', userAgent);

  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) headers.set('x-forwarded-for', forwardedFor);

  const realIp = request.headers.get('x-real-ip');
  if (realIp) headers.set('x-real-ip', realIp);

  return headers;
}

export async function guestGatewayFetch(
  request: NextRequest,
  path: string,
  options: {
    method?: 'GET' | 'POST';
    body?: unknown;
    sessionToken?: string;
  } = {},
) {
  const response = await fetch(`${meetingGatewayBase()}${path}`, {
    method: options.method || 'GET',
    cache: 'no-store',
    headers: guestForwardHeaders(request, options.sessionToken),
    ...(options.method === 'POST'
      ? { body: JSON.stringify(options.body ?? {}) }
      : {}),
  });

  return {
    response,
    json: await safeJson(response),
  };
}

export function guestSessionCookieOptions(expiresAt: unknown) {
  const expiry = new Date(String(expiresAt || ''));
  const seconds = Number.isFinite(expiry.getTime())
    ? Math.max(60, Math.min(24 * 60 * 60, Math.floor((expiry.getTime() - Date.now()) / 1000)))
    : 60 * 60;

  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: seconds,
  };
}

export function guestSessionFromRequest(request: NextRequest) {
  return String(request.cookies.get(MEETING_GUEST_COOKIE)?.value || '').trim();
}

export function jsonNoStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}
