import { NextRequest, NextResponse } from 'next/server';

function gatewayBase() {
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

async function safeJson(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: 'application_gateway_invalid_response' };
  }
}

function forwardHeaders(request: NextRequest, accessToken?: string) {
  const headers = new Headers();
  headers.set('content-type', 'application/json');
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);

  const userAgent = request.headers.get('user-agent');
  if (userAgent) headers.set('user-agent', userAgent);
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) headers.set('x-forwarded-for', forwardedFor);
  const realIp = request.headers.get('x-real-ip');
  if (realIp) headers.set('x-real-ip', realIp);
  return headers;
}

export function applicationAccessTokenFromRequest(request: NextRequest) {
  const token = String(request.headers.get('x-application-access-token') || '').trim();
  return /^[A-Za-z0-9_-]{32,500}$/.test(token) ? token : '';
}

export async function applicationGatewayFetch(
  request: NextRequest,
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'DELETE';
    body?: unknown;
    accessToken?: string;
  } = {},
) {
  const method = options.method || 'GET';
  const response = await fetch(`${gatewayBase()}${path}`, {
    method,
    cache: 'no-store',
    headers: forwardHeaders(request, options.accessToken),
    ...(method === 'POST' ? { body: JSON.stringify(options.body ?? {}) } : {}),
  });

  return { response, json: await safeJson(response) };
}

export function applicationJsonNoStore(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'cache-control': 'no-store, no-cache, must-revalidate, private',
      pragma: 'no-cache',
      expires: '0',
    },
  });
}

export function applicationUpstreamJson(response: Response, json: any) {
  return applicationJsonNoStore(json, response.status || (json?.ok === false ? 400 : 200));
}
