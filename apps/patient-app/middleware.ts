// apps/patient-app/middleware.ts
import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE_NAME = 'ambulant_session';

const PUBLIC_PATHS = new Set([
  '/favicon.ico',
  '/favicon.svg',
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.json',
  '/manifest.webmanifest',
]);

const PUBLIC_PREFIXES = [
  '/auth',
  '/privacy',
  '/terms',
  '/api/auth',
  '/_next',
  '/brand',
  '/assets',
  '/images',
  '/icons',
];

const TOKEN_AUTHENTICATED_PATHS = new Set([
  '/api/iomt/ingest',
]);
const IDENTITY_HEADERS = [
  'x-uid',
  'x-user-id',
  'x-ambulant-user-id',
  'x-role',
  'x-user-role',
  'x-ambulant-role',
  'x-org-id',
  'x-org',
  'x-ambulant-org-id',
  'x-actor-ref-id',
  'x-patient-id',
  'x-current-patient-id',
  'x-patient-origin',
  'x-ambulant-trusted',
  'x-ambulant-identity',
];

function isStaticAsset(pathname: string) {
  return /\.(?:png|jpg|jpeg|gif|webp|svg|ico|css|js|map|txt|xml|json|webmanifest|woff|woff2|ttf|otf)$/i.test(
    pathname,
  );
}

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (isStaticAsset(pathname)) return true;

  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    '=',
  );

  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function decodeJson(value: string) {
  try {
    return JSON.parse(
      new TextDecoder().decode(decodeBase64Url(value)),
    ) as Record<string, any>;
  } catch {
    return null;
  }
}

async function verifyPatientSession(request: NextRequest) {
  const secret = String(process.env.AUTH_SESSION_SECRET || '').trim();
  if (!secret) return null;

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;
    const header = decodeJson(encodedHeader);
    const payload = decodeJson(encodedPayload);

    if (
      !header ||
      !payload ||
      String(header.alg || '').toUpperCase() !== 'HS256'
    ) {
      return null;
    }

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      decodeBase64Url(signature),
      new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
    );

    if (!valid) return null;

    const now = Math.floor(Date.now() / 1000);

    if (typeof payload.exp !== 'number' || payload.exp <= now) {
      return null;
    }

    if (typeof payload.nbf === 'number' && payload.nbf > now + 30) {
      return null;
    }

    if (typeof payload.iat === 'number' && payload.iat > now + 60) {
      return null;
    }

    const actorType = String(
      payload.actorType || payload.actor_type || payload.role || '',
    )
      .trim()
      .toLowerCase();

    if (!["patient", "patient_user", "pat"].includes(actorType)) {
      return null;
    }

    const uid = String(
      payload.sub || payload.uid || payload.userId || '',
    ).trim();

    if (!uid) return null;

    return {
      uid,
      orgId:
        String(payload.orgId || payload.org_id || '').trim() || null,
      patientId:
        String(
          payload.actorRefId ||
            payload.actor_ref_id ||
            payload.patientId ||
            '',
        ).trim() || null,
    };
  } catch {
    return null;
  }
}

function applyVerifiedPatientIdentity(
  headers: Headers,
  session: {
    uid: string;
    orgId: string | null;
    patientId: string | null;
  },
) {
  headers.set('x-uid', session.uid);
  headers.set('x-user-id', session.uid);
  headers.set('x-ambulant-user-id', session.uid);
  headers.set('x-role', 'patient');
  headers.set('x-ambulant-role', 'patient');
  headers.set('x-ambulant-trusted', 'verified-patient-session');
  headers.set('x-patient-origin', 'verified-patient-session');

  if (session.orgId) {
    headers.set('x-org-id', session.orgId);
    headers.set('x-ambulant-org-id', session.orgId);
  }

  if (session.patientId) {
    headers.set('x-actor-ref-id', session.patientId);
    headers.set('x-patient-id', session.patientId);
    headers.set('x-current-patient-id', session.patientId);
  }
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const headers = new Headers(request.headers);

  // Caller-supplied identity is never authoritative inside patient-app.
  for (const name of IDENTITY_HEADERS) headers.delete(name);

  // Device/bridge ingestion uses its own route-level Bearer-token
  // authentication. Permit only the exact ingest path through the
  // patient-session perimeter while preserving the sanitised headers.
  if (TOKEN_AUTHENTICATED_PATHS.has(pathname)) {
    return NextResponse.next({ request: { headers } });
  }

  const session = await verifyPatientSession(request);

  if (session) {
    applyVerifiedPatientIdentity(headers, session);
  }

  // Preserve the established public-route contract, but forward only the
  // sanitised/reconstructed request headers.
  if (isPublicPath(pathname)) {
    return NextResponse.next({ request: { headers } });
  }

  // Preserve the existing protected-app gate, now using cryptographic
  // session verification rather than payload-only JWT inspection.
  if (session) {
    return NextResponse.next({ request: { headers } });
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/auth/login';
  loginUrl.search = '';
  loginUrl.searchParams.set('next', `${pathname}${search}` || '/');

  const response = NextResponse.redirect(loginUrl);
  response.headers.set('cache-control', 'no-store, max-age=0');

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|favicon.svg).*)'],
};
