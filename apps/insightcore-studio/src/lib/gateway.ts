import { gatewayBase } from './env';

export function gatewayUrl(path: string) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${gatewayBase()}${cleanPath}`;
}

export async function gatewayFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  if (!headers.has('accept')) headers.set('accept', 'application/json');

  return fetch(gatewayUrl(path), {
    ...init,
    headers,
    cache: init.cache ?? 'no-store'
  });
}

export async function gatewayJson<T>(
  path: string,
  fallback: T,
  init: RequestInit = {}
): Promise<T> {
  try {
    const response = await gatewayFetch(path, init);
    if (!response.ok) return fallback;
    return (await response.json().catch(() => fallback)) as T;
  } catch {
    return fallback;
  }
}