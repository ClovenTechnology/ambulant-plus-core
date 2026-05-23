import { NextRequest } from 'next/server';

function trimSlash(s: string) {
  return String(s || '').replace(/\/+$/, '');
}

export function gatewayBase(): string {
  return trimSlash(
    process.env.APIGW_BASE ??
      process.env.NEXT_PUBLIC_APIGW_BASE ??
      process.env.APIGW_ORIGIN ??
      process.env.API_GATEWAY_ORIGIN ??
      'https://ambulant-plus-core-api-gateway-kdon.vercel.app',
  );
}

export function forwardIdentityHeaders(req: NextRequest) {
  const headers = new Headers();

  [
    'cookie',
    'authorization',
    'x-ambulant-identity',
    'x-uid',
    'x-role',
    'x-org-id',
  ].forEach((k) => {
    const v = req.headers.get(k);
    if (v) headers.set(k, v);
  });

  headers.set('accept', 'application/json');
  if (!headers.get('x-role')) headers.set('x-role', 'patient');

  return headers;
}

export async function readJsonSafe(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}