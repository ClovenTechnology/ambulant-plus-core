// apps/patient-app/app/api/profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { API } from '@/src/lib/config';
import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type GatewayPatient = {
  id?: string;
  patientId?: string;
  userId?: string;
  name?: string;
  email?: string | null;
  age?: number | null;
  gender?: string | null;
  dob?: string | null;
  avatarUrl?: string | null;
  address?: string | null;
  mobile?: string | null;
  bloodType?: string | null;
  allergies?: string[] | null;
  chronicConditions?: string[] | null;
  primaryConditionsText?: string | null;
};

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

function base64urlToBuffer(s: string) {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64, 'base64');
}

function safeJsonParse(buf: Buffer) {
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch {
    return null;
  }
}

function verifyJwtHs256(token: string, secret: string): any | null {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return null;

    const [h, p, sig] = parts;
    const data = `${h}.${p}`;

    const expected = crypto.createHmac('sha256', secret).update(data).digest();
    const got = base64urlToBuffer(sig);

    if (got.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(got, expected)) return null;

    const payload = safeJsonParse(base64urlToBuffer(p));
    if (!payload) return null;

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === 'number' && payload.exp <= now) return null;

    return payload;
  } catch {
    return null;
  }
}

function readSessionPayload(req: NextRequest): any | null {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) return null;

  const token =
    req.cookies.get('ambulant_session')?.value ||
    req.cookies.get('__Host-ambulant_session')?.value ||
    req.cookies.get('ambulant.session')?.value ||
    req.cookies.get('auth_session')?.value ||
    req.cookies.get('session')?.value ||
    req.cookies.get('token')?.value ||
    '';

  if (!token) return null;

  return verifyJwtHs256(token, secret);
}

function resolveUserIdFromSession(req: NextRequest): string {
  const payload = readSessionPayload(req);

  return String(
    payload?.sub ||
      payload?.userId ||
      payload?.uid ||
      '',
  ).trim();
}

function normaliseAllergies(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

async function readLocalPatientProfile(userId: string) {
  if (!userId) return null;

  return prisma.patientProfile
    .findFirst({
      where: { userId },
    })
    .catch(() => null);
}

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function readUserId(req: NextRequest, url: URL) {
  return (
    url.searchParams.get('userId') ||
    req.headers.get('x-ambulant-user-id') ||
    req.headers.get('x-user-id') ||
    req.headers.get('x-uid') ||
    resolveUserIdFromSession(req) ||
    ''
  ).trim();
}

function forwardHeaders(req: NextRequest) {
  const h = new Headers();

  [
    'cookie',
    'authorization',
    'x-ambulant-identity',
    'x-ambulant-user-id',
    'x-ambulant-org-id',
    'x-ambulant-role',
    'x-user-id',
    'x-uid',
    'x-role',
    'x-email',
    'x-name',
    'x-display-name',
    'x-org-id',
    'x-correlation-id',
    'x-request-id',
  ].forEach((key) => {
    const value = req.headers.get(key);
    if (value) h.set(key, value);
  });

  h.set('accept', 'application/json');
  return h;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const userId = readUserId(req, url);

  const localPatient = await readLocalPatientProfile(userId);

  if (localPatient) {
    const allergies = normaliseAllergies((localPatient as any).allergies);

    return json({
      ok: true,
      userId: localPatient.userId || userId || null,
      patientId: localPatient.id || null,
      name: localPatient.name || null,
      email: (localPatient as any).contactEmail ?? null,
      age: null,
      gender: (localPatient as any).gender ?? null,
      dob: null,
      avatarUrl: (localPatient as any).avatarUrl || null,
      address: (localPatient as any).addressLine1 || null,
      mobile: (localPatient as any).phone || null,
      bloodType: null,
      allergies,
      chronicConditions: [],
      primaryConditionsText: null,
      patientRaw: localPatient,
      source: 'local_patient_profile',
    });
  }

  if (!API) {
    return json(
      {
        ok: false,
        error: 'api_gateway_base_not_configured',
        profile: null,
      },
      503,
    );
  }

  try {
    const baseUrl = API.replace(/\/+$/, '');
    const target = new URL('/api/patients/profile', baseUrl);

    if (userId) {
      target.searchParams.set('userId', userId);
    }

    const r = await fetch(target.toString(), {
      headers: forwardHeaders(req),
      cache: 'no-store',
    });

    const data = await r.json().catch(() => null);

    if (!r.ok || !data) {
      return json(
        {
          ok: false,
          error: data?.error || data?.message || `profile_gateway_http_${r.status}`,
          profile: null,
        },
        r.status === 404 ? 404 : 502,
      );
    }

    const patient: GatewayPatient = (data?.patient || data?.profile || data || {}) as GatewayPatient;
    const chronicConditions = Array.isArray(patient.chronicConditions)
      ? patient.chronicConditions
      : [];

    return json({
      ok: true,
      userId: patient.userId || userId || null,
      patientId: patient.patientId || patient.id || null,
      name: patient.name || data?.displayName || null,
      email: patient.email ?? null,
      age: patient.age ?? null,
      gender: patient.gender ?? null,
      dob: patient.dob ?? null,
      avatarUrl: patient.avatarUrl || null,
      address: patient.address || null,
      mobile: patient.mobile || null,
      bloodType: patient.bloodType ?? null,
      allergies: Array.isArray(patient.allergies) ? patient.allergies : [],
      chronicConditions,
      primaryConditionsText:
        patient.primaryConditionsText ??
        (chronicConditions.length ? chronicConditions.join(', ') : null),
      patientRaw: data,
    });
  } catch (err: any) {
    return json(
      {
        ok: false,
        error: err?.message || 'profile_gateway_failed',
        profile: null,
      },
      502,
    );
  }
}