// apps/admin-dashboard/src/lib/gateway-fetch.ts

import { headers } from 'next/headers';

function requestCookieHeader() {
  try {
    return headers().get('cookie') || '';
  } catch {
    return '';
  }
}

export async function gatewayFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const outgoingHeaders =
    new Headers(init.headers);

  const cookieHeader =
    requestCookieHeader();

  if (cookieHeader) {
    outgoingHeaders.set(
      'cookie',
      cookieHeader,
    );
  }

  return fetch(
    url,
    {
      ...init,
      headers: outgoingHeaders,
      cache:
        init.cache ||
        'no-store',
    },
  );
}