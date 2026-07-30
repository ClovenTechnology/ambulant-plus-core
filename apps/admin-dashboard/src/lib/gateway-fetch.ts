// apps/admin-dashboard/src/lib/gateway-fetch.ts

import { cookies } from 'next/headers';

function serializeCookies(): string {
  try {
    return cookies()
      .getAll()
      .map(
        (cookie) =>
          `${cookie.name}=${encodeURIComponent(cookie.value)}`
      )
      .join('; ');
  }
  catch {
    return '';
  }
}

export async function gatewayFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {

  const cookieHeader =
    serializeCookies();

  return fetch(
    url,
    {
      ...init,
      headers: {
        ...(init.headers || {}),
        ...(cookieHeader
          ? {
              cookie: cookieHeader,
            }
          : {}),
      },
      cache:
        init.cache ||
        'no-store',
    },
  );
}
