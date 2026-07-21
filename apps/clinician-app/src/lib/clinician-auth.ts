//apps/clinician-app/src/lib/clinician-auth.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import {
  CLINICIAN_SESSION_COOKIE,
  verifyClinicianSessionToken,
  type ClinicianSessionPayload,
  type ClinicianSessionRole,
} from '@/src/lib/clinician-session';

export {
  CLINICIAN_SESSION_COOKIE,
  verifyClinicianSessionToken,
};
export type {
  ClinicianSessionPayload,
  ClinicianSessionRole,
};
export type ResolvedClinicianAuth = {
  ok: true;
  session: ClinicianSessionPayload;
  role: ClinicianSessionRole;
  clinician: any;
  profileJson: any;
  clinicianId: string;
  specialty: string | null;
  specialties: string[];
  professionKey: string | null;
};

export type FailedClinicianAuth = {
  ok: false;
  status: number;
  error: string;
};

export type ClinicianAuthResult = ResolvedClinicianAuth | FailedClinicianAuth;

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

function normalizeText(v: unknown) {
  return String(v ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseStoredProfile(value: unknown): any {
  if (!value) return {};
  if (typeof value === 'object') return value;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return {};
}

function getProfileJson(metadata: any) {
  return parseStoredProfile(
    metadata?.rawProfileJson ??
    metadata?.rawProfile ??
    null,
  );
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(v => String(v ?? '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[;,|]/g)
      .map(v => v.trim())
      .filter(Boolean);
  }
  return [];
}

function deriveSpecialties(clinician: any, profileJson: any) {
  const out = Array.from(
    new Set(
      [
        ...stringArray(clinician?.specialty),
        ...stringArray(profileJson?.specialty),
        ...stringArray(profileJson?.specialties),
        ...stringArray(profileJson?.primarySpecialty),
        ...stringArray(profileJson?.practiceArea),
        ...stringArray(profileJson?.practiceAreas),
      ]
        .map(normalizeText)
        .filter(Boolean),
    ),
  );

  return out;
}

function deriveProfessionKey(clinician: any, profileJson: any): string | null {
  const raw =
    profileJson?.professionKey ??
    profileJson?.roleKey ??
    profileJson?.profession ??
    profileJson?.profession_key ??
    clinician?.professionKey ??
    null;

  const normalized = normalizeText(raw);
  return normalized || null;
}

function fallbackSessionFromHeaders(req: NextRequest): ClinicianSessionPayload | null {
  if (
    process.env.NODE_ENV === 'production' ||
    process.env.ALLOW_TRUST_HEADER_FALLBACK !== 'true'
  ) {
    return null;
  }

  const uid = String(req.headers.get('x-uid') || '').trim();
  const rawRole = String(req.headers.get('x-role') || '').trim().toLowerCase();

  if (!uid) return null;
  if (!['clinician', 'admin', 'admin_staff'].includes(rawRole)) return null;

  const now = Date.now();
  return {
    sub: uid,
    role: rawRole as ClinicianSessionRole,
    clinicianId: null,
    email: null,
    name: null,
    issuedAt: now,
    expiresAt: now + 60_000,
  };
}

export async function resolveAuthenticatedClinician(req: NextRequest): Promise<ClinicianAuthResult> {
  try {
    const sessionToken = req.cookies.get(CLINICIAN_SESSION_COOKIE)?.value || null;
    const session = verifyClinicianSessionToken(sessionToken) || fallbackSessionFromHeaders(req);

    if (!session) {
      return { ok: false, status: 401, error: 'unauthenticated' };
    }

    const clinician = await prisma.clinicianProfile.findFirst({
      where: {
        OR: [
          session.clinicianId ? { id: session.clinicianId } : undefined,
          { id: session.sub },
          { userId: session.sub },
          session.email ? { email: session.email } : undefined,
          { email: session.sub },
        ].filter(Boolean) as any[],
      },

    });

    if (!clinician) {
      return { ok: false, status: 404, error: 'clinician_not_found' };
    }

    const profileJson = getProfileJson((clinician.meta as any));
    const specialties = deriveSpecialties(clinician, profileJson);
    const professionKey = deriveProfessionKey(clinician, profileJson);

    return {
      ok: true,
      session,
      role: session.role,
      clinician,
      profileJson,
      clinicianId: clinician.id,
      specialty: clinician.specialty ?? null,
      specialties,
      professionKey,
    };
  } catch (err: any) {
    return { ok: false, status: 500, error: err?.message || 'auth_resolution_failed' };
  }
}

export async function requireClinicianAuth(
  req: NextRequest,
  opts?: {
    allowAdmin?: boolean;
    allowAdminStaff?: boolean;
  },
): Promise<ClinicianAuthResult> {
  const auth = await resolveAuthenticatedClinician(req);
  if (!auth.ok) return auth;

  if (auth.role === 'clinician') return auth;
  if (auth.role === 'admin' && opts?.allowAdmin) return auth;
  if (auth.role === 'admin_staff' && opts?.allowAdminStaff) return auth;

  return { ok: false, status: 403, error: 'forbidden' };
}

export function ensureClinicianSelfOrPrivileged(
  auth: ResolvedClinicianAuth,
  requestedClinicianId?: string | null,
): FailedClinicianAuth | null {
  if (!requestedClinicianId) return null;

  if (auth.role === 'admin' || auth.role === 'admin_staff') return null;
  if (requestedClinicianId === auth.clinicianId) return null;

  return { ok: false, status: 403, error: 'forbidden' };
}

export function authErrorResponse(result: FailedClinicianAuth) {
  return json({ ok: false, error: result.error }, result.status);
}
