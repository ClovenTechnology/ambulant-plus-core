import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const CLINICIAN_SESSION_COOKIE =
  process.env.CLINICIAN_SESSION_COOKIE ||
  'ambulant_clinician_session';

const SESSION_ISSUER = 'ambulant-clinician-app';
const SESSION_AUDIENCE = 'ambulant-clinician-app';

const PUBLIC_PATHS = new Set([
  '/favicon.ico',
  '/favicon.svg',
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.json',
  '/manifest.webmanifest',
  '/terms',
  '/privacy',
  '/flexible-payment-and-pay-later',
]);

const PUBLIC_PREFIXES = [
  '/auth',
  '/training',
  '/_next',
  '/brand',
  '/assets',
  '/images',
  '/icons',
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
    (prefix) =>
      pathname === prefix ||
      pathname.startsWith(
        `${prefix}/`,
      ),
  );
}

function isSimulationSupervisorAdmission(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (!pathname.startsWith('/sfu/')) return false;

  const params = request.nextUrl.searchParams;
  const simulation = params.get('simulation') === '1';
  const actor = String(params.get('simulationActor') || '').trim().toLowerCase();
  const role = String(params.get('participantRole') || params.get('role') || '').trim().toLowerCase();
  const joinToken = String(params.get('joinToken') || params.get('jt') || '').trim();
  const participantId = String(params.get('participantId') || params.get('uid') || '').trim();
  const appointmentId = String(params.get('appointmentId') || '').trim();
  const visitId = String(params.get('visitId') || '').trim();

  return (
    simulation &&
    actor === 'supervisor' &&
    role === 'observer' &&
    joinToken.split('.').length === 3 &&
    Boolean(participantId && appointmentId && visitId)
  );
}

function decodeBase64Url(
  value: string,
) {
  const normalized = value
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padded = normalized.padEnd(
    normalized.length +
      ((4 - (normalized.length % 4)) % 4),
    '=',
  );
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function encodeBase64Url(
  value: Uint8Array,
) {
  let binary = '';

  for (const byte of value) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

async function sessionSecretBytes() {
  const explicitSecret =
    process.env.CLINICIAN_SESSION_SECRET ||
    process.env.AUTH_SESSION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    '';

  if (explicitSecret) {
    return new TextEncoder().encode(
      explicitSecret,
    );
  }

  const internalSecret =
    process.env.AMBULANT_INTERNAL_IDENTITY_SECRET ||
    process.env.INTERNAL_IDENTITY_SECRET ||
    '';

  if (!internalSecret) return null;

  const derivationKey =
    await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(
        internalSecret,
      ),
      {
        name: 'HMAC',
        hash: 'SHA-256',
      },
      false,
      ['sign'],
    );

  const derived =
    await crypto.subtle.sign(
      'HMAC',
      derivationKey,
      new TextEncoder().encode(
        'ambulant-clinician-session:v1',
      ),
    );

  return new TextEncoder().encode(
    encodeBase64Url(
      new Uint8Array(derived),
    ),
  );
}

function decodeJson(value: string) {
  try {
    return JSON.parse(
      new TextDecoder().decode(
        decodeBase64Url(value),
      ),
    ) as Record<string, any>;
  }
  catch {
    return null;
  }
}

async function verifyClinicianSession(
  request: NextRequest,
) {
  const token = request.cookies
    .get(CLINICIAN_SESSION_COOKIE)
    ?.value
    ?.trim();

  const secretBytes =
    await sessionSecretBytes();

  if (!token || !secretBytes) return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] =
      parts;

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
      secretBytes,
      {
        name: 'HMAC',
        hash: 'SHA-256',
      },
      false,
      ['verify'],
    );

    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      decodeBase64Url(encodedSignature),
      new TextEncoder().encode(
        `${encodedHeader}.${encodedPayload}`,
      ),
    );

    if (!valid) return null;

    const now = Math.floor(Date.now() / 1000);

    if (payload.iss !== SESSION_ISSUER) return null;
    if (payload.aud !== SESSION_AUDIENCE) return null;
    if (!payload.sub || !payload.role) return null;
    if (!Number(payload.exp) || Number(payload.exp) <= now) {
      return null;
    }
    if (Number(payload.iat || 0) > now + 60) return null;

    return payload;
  }
  catch {
    return null;
  }
}

function canUseFullWorkspace(
  session: Record<string, any>,
) {
  if (
    session.role === 'admin' ||
    session.role === 'admin_staff'
  ) {
    return true;
  }

  if (session.canPractice === true) return true;
  if (session.trainingCompleted === true) return true;
  if (session.simulationMode === true) return true;

  if (
    String(
      session.onboardingStage || '',
    ).toLowerCase() === 'training_completed'
  ) {
    return true;
  }

  return (
    String(session.status || '').toLowerCase() ===
    'active'
  );
}

function corsResponse(request: NextRequest) {
  const allowOrigin =
    process.env.CORS_ALLOW_ORIGIN ?? '*';
  const response = NextResponse.next();

  response.headers.set(
    'Access-Control-Allow-Origin',
    allowOrigin,
  );
  response.headers.set(
    'Access-Control-Allow-Methods',
    'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  );
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Request-Id, X-Correlation-Id, X-Idempotency-Key',
  );

  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: response.headers,
    });
  }

  return response;
}

export async function middleware(
  request: NextRequest,
) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith('/api/')) {
    return corsResponse(request);
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Simulation supervisors are admitted by a fresh, signed participant-scoped
  // join capability issued from the authenticated Admin control plane. They
  // must not be forced through clinician authentication or impersonation.
  if (isSimulationSupervisorAdmission(request)) {
    const response = NextResponse.next();
    response.headers.set('cache-control', 'no-store, max-age=0');
    return response;
  }

  const session =
    await verifyClinicianSession(request);

  if (!session) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/auth/login';
    loginUrl.search = '';
    loginUrl.searchParams.set(
      'next',
      `${pathname}${search}` || '/',
    );

    const response =
      NextResponse.redirect(loginUrl);
    response.headers.set(
      'cache-control',
      'no-store, max-age=0',
    );

    return response;
  }

  if (!canUseFullWorkspace(session)) {
    const trainingUrl = request.nextUrl.clone();
    trainingUrl.pathname = '/training/schedule';
    trainingUrl.search = '';

    if (session.clinicianId) {
      trainingUrl.searchParams.set(
        'clinicianId',
        String(session.clinicianId),
      );
    }

    trainingUrl.searchParams.set(
      'reason',
      'training_required',
    );
    trainingUrl.searchParams.set(
      'next',
      `${pathname}${search}` || '/',
    );

    const response =
      NextResponse.redirect(trainingUrl);
    response.headers.set(
      'cache-control',
      'no-store, max-age=0',
    );

    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\.ico|favicon\.svg).*)',
  ],
};
