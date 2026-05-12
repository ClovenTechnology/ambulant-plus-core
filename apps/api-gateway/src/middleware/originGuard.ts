// apps/api-gateway/src/middleware/originGuard.ts

const PATIENT_ORIGIN = process.env.PATIENT_ORIGIN || 'http://localhost:3000';
const CLINICIAN_ORIGIN = process.env.CLINICIAN_ORIGIN || 'http://localhost:3001';
const ADMIN_ORIGIN = process.env.ADMIN_ORIGIN || 'http://localhost:3002';

const DEFAULT_ALLOWED_ORIGINS = [
  PATIENT_ORIGIN,
  CLINICIAN_ORIGIN,
  ADMIN_ORIGIN,
].filter(Boolean);

type HeaderValue = string | string[] | undefined;

export type RequestLike = {
  headers?:
    | Headers
    | Record<string, HeaderValue>
    | {
        get?: (name: string) => string | null;
      };
};

export type ResponseLike = {
  status?: (code: number) => ResponseLike;
  json?: (body: unknown) => unknown;
  setHeader?: (name: string, value: string) => unknown;
  headers?: Headers;
};

export type NextLike = () => unknown;

function allowedOrigins() {
  const fromEnv = String(process.env.API_CORS_ORIGINS || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

  return fromEnv.length > 0 ? fromEnv : DEFAULT_ALLOWED_ORIGINS;
}

function getHeader(req: RequestLike, name: string): string | undefined {
  const headers = req.headers;
  const lower = name.toLowerCase();

  if (!headers) return undefined;

  if (headers instanceof Headers) {
    return headers.get(name) || headers.get(lower) || undefined;
  }

  if (typeof (headers as any).get === 'function') {
    return (headers as any).get(name) || (headers as any).get(lower) || undefined;
  }

  const record = headers as Record<string, HeaderValue>;
  const raw = record[name] ?? record[lower] ?? record[name.toUpperCase()];

  if (Array.isArray(raw)) return raw[0];

  return raw;
}

function setHeader(res: ResponseLike, name: string, value: string) {
  if (typeof res.setHeader === 'function') {
    res.setHeader(name, value);
    return;
  }

  if (res.headers instanceof Headers) {
    res.headers.set(name, value);
  }
}

function reject(res: ResponseLike) {
  const statusFn = res.status;
  const jsonFn = res.json;

  if (typeof statusFn === 'function' && typeof jsonFn === 'function') {
    const statusResult = statusFn.call(res, 403);
    const chainedJson = statusResult?.json;

    if (typeof chainedJson === 'function') {
      return chainedJson.call(statusResult, { error: 'origin_not_allowed' });
    }

    return jsonFn.call(res, { error: 'origin_not_allowed' });
  }

  return {
    status: 403,
    body: { error: 'origin_not_allowed' },
  };
}

export function isAllowedOrigin(origin?: string | null) {
  if (!origin) return true;

  const allowed = allowedOrigins();

  return allowed.includes(origin);
}

export function applyOriginHeaders(req: RequestLike, res: ResponseLike) {
  const origin = getHeader(req, 'origin');
  const allowed = allowedOrigins();

  const allowOrigin =
    origin && allowed.includes(origin)
      ? origin
      : allowed[0] || PATIENT_ORIGIN;

  setHeader(res, 'Access-Control-Allow-Origin', allowOrigin);
  setHeader(res, 'Access-Control-Allow-Credentials', 'true');
  setHeader(res, 'Vary', 'Origin');

  return res;
}

export function originGuard(req: RequestLike, res: ResponseLike, next: NextLike) {
  const origin = getHeader(req, 'origin');

  applyOriginHeaders(req, res);

  if (!isAllowedOrigin(origin)) {
    return reject(res);
  }

  return next();
}

export default originGuard;