// apps/api-gateway/src/lib/httpUtils.ts

type HeaderValue = string | string[] | undefined;

type HeaderLike =
  | Headers
  | Record<string, HeaderValue>
  | {
      get?: (name: string) => string | null;
      headers?: Record<string, HeaderValue> | Headers;
      ip?: string;
      socket?: {
        remoteAddress?: string;
      };
      connection?: {
        remoteAddress?: string;
      };
    };

function getHeader(source: HeaderLike | undefined, name: string): string | undefined {
  if (!source) return undefined;

  const lower = name.toLowerCase();

  if (source instanceof Headers) {
    return source.get(name) ?? source.get(lower) ?? undefined;
  }

  if (typeof (source as any).get === 'function') {
    return (source as any).get(name) ?? (source as any).get(lower) ?? undefined;
  }

  const headers = (source as any).headers;

  if (headers instanceof Headers) {
    return headers.get(name) ?? headers.get(lower) ?? undefined;
  }

  const record =
    headers && typeof headers === 'object'
      ? (headers as Record<string, HeaderValue>)
      : (source as Record<string, HeaderValue>);

  const raw =
    record[name] ??
    record[lower] ??
    record[name.toUpperCase()];

  if (Array.isArray(raw)) return raw[0];
  return raw;
}

function firstForwardedIp(value: string | undefined): string | undefined {
  if (!value) return undefined;

  const first = value
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)[0];

  return first || undefined;
}

export function getClientInfo(req: HeaderLike = {}) {
  const userAgent = getHeader(req, 'user-agent');

  const ip =
    firstForwardedIp(getHeader(req, 'x-forwarded-for')) ||
    getHeader(req, 'x-real-ip') ||
    (req as any).ip ||
    (req as any).socket?.remoteAddress ||
    (req as any).connection?.remoteAddress ||
    undefined;

  return {
    ip,
    userAgent,
  };
}

export function getClientIp(req: HeaderLike = {}) {
  return getClientInfo(req).ip;
}

export function getUserAgent(req: HeaderLike = {}) {
  return getClientInfo(req).userAgent;
}