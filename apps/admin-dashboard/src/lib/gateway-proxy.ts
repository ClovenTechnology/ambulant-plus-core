// apps/admin-dashboard/src/lib/gateway-proxy.ts

import { NextRequest } from 'next/server';

export function gatewayProxyHeaders(
  req: NextRequest,
  extra?: Record<string, string>,
) {
  const headers = new Headers();

  const cookie =
    req.headers.get('cookie');

  if (cookie) {
    headers.set(
      'cookie',
      cookie,
    );
  }

  headers.set(
    'accept',
    'application/json',
  );

  if (extra) {
    Object.entries(extra).forEach(
      ([key, value]) => {
        headers.set(
          key,
          value,
        );
      },
    );
  }

  return headers;
}
