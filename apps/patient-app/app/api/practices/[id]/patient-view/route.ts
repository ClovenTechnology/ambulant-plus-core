// apps/patient-app/app/api/practices/[id]/patient-view/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  applyPatientSessionHeaders,
  resolvePatientAppSession,
} from '../../../_session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function trimSlash(value: string) {
  return String(value || '').replace(/\/+$/, '');
}

function gatewayBase() {
  return trimSlash(
    process.env.APIGW_BASE ||
      process.env.API_GATEWAY_BASE_URL ||
      process.env.API_GATEWAY_URL ||
      process.env.NEXT_PUBLIC_APIGW_BASE ||
      process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
      '',
  );
}

function forwardHeaders(req: NextRequest) {
  const session = resolvePatientAppSession();
  const headers = new Headers();

  for (const key of [
    'cookie',
    'authorization',
    'x-ambulant-identity',
    'x-ambulant-user-id',
    'x-ambulant-org-id',
    'x-ambulant-role',
    'x-uid',
    'x-user-id',
    'x-org-id',
    'x-role',
  ]) {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  }

  headers.set('accept', 'application/json');

  if (!headers.get('x-role') && !headers.get('x-ambulant-role')) {
    headers.set('x-role', 'patient');
  }

  applyPatientSessionHeaders(headers, session);
  return headers;
}

async function readJsonSafe(res: Response) {
  return res.json().catch(() => null);
}

function cleanString(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeClinician(input: any) {
  const id = cleanString(input?.id ?? input?.clinicianId);
  if (!id) return null;

  const status = cleanString(
    input?.status ??
      input?.clinicianStatus ??
      input?.profile?.status ??
      '',
  ).toLowerCase();

  const canBeListed =
    input?.operational?.canBeListed !== false &&
    input?.operational?.canBeBooked !== false;

  if (status && status !== 'active') return null;
  if (!canBeListed) return null;

  return {
    id,
    name: cleanString(input?.name ?? input?.displayName),
    specialty: cleanString(input?.specialty ?? input?.discipline) || undefined,
    gender: input?.gender ?? undefined,
    priceCents:
      typeof input?.priceCents === 'number'
        ? input.priceCents
        : typeof input?.feeCents === 'number'
          ? input.feeCents
          : undefined,
    currency: input?.currency ?? undefined,
    rating:
      typeof input?.rating === 'number'
        ? input.rating
        : typeof input?.avgRating === 'number'
          ? input.avgRating
          : undefined,
    acceptsMedicalAid:
      typeof input?.acceptsMedicalAid === 'boolean'
        ? input.acceptsMedicalAid
        : typeof input?.medicalAidAccepted === 'boolean'
          ? input.medicalAidAccepted
          : undefined,
    acceptedSchemes: Array.isArray(input?.acceptedSchemes)
      ? input.acceptedSchemes.map(String)
      : [],
    hasEncounter: Boolean(input?.hasEncounter),
    online: Boolean(input?.online),
    status: 'active',
  };
}

function normalizePayload(raw: any, practiceId: string) {
  const source = raw?.practice ? raw : raw?.data ?? raw;
  const practiceRaw = source?.practice ?? source;

  if (!practiceRaw || typeof practiceRaw !== 'object') {
    return null;
  }

  const practice = {
    id: cleanString(practiceRaw?.id ?? practiceRaw?.practiceId ?? practiceId),
    name: cleanString(practiceRaw?.name ?? practiceRaw?.displayName),
    class: practiceRaw?.class ?? practiceRaw?.type ?? practiceRaw?.kind ?? undefined,
    subType:
      practiceRaw?.subType ??
      practiceRaw?.segment ??
      practiceRaw?.practiceType ??
      undefined,
    rating:
      typeof practiceRaw?.rating === 'number'
        ? practiceRaw.rating
        : typeof practiceRaw?.avgRating === 'number'
          ? practiceRaw.avgRating
          : undefined,
    ratingCount:
      typeof practiceRaw?.ratingCount === 'number'
        ? practiceRaw.ratingCount
        : typeof practiceRaw?.ratingsCount === 'number'
          ? practiceRaw.ratingsCount
          : undefined,
    logoUrl: practiceRaw?.logoUrl ?? practiceRaw?.logo ?? undefined,
    tagline: practiceRaw?.tagline ?? practiceRaw?.header ?? undefined,
    bio: practiceRaw?.bio ?? practiceRaw?.about ?? undefined,
    acceptsMedicalAid:
      typeof practiceRaw?.acceptsMedicalAid === 'boolean'
        ? practiceRaw.acceptsMedicalAid
        : typeof practiceRaw?.medicalAidAccepted === 'boolean'
          ? practiceRaw.medicalAidAccepted
          : undefined,
    acceptedSchemes: Array.isArray(practiceRaw?.acceptedSchemes)
      ? practiceRaw.acceptedSchemes.map(String)
      : [],
    services: Array.isArray(practiceRaw?.services)
      ? practiceRaw.services.map(String)
      : [],
    specialties: Array.isArray(practiceRaw?.specialties)
      ? practiceRaw.specialties.map(String)
      : [],
    operatingHours: Array.isArray(practiceRaw?.operatingHours)
      ? practiceRaw.operatingHours
      : Array.isArray(practiceRaw?.hours)
        ? practiceRaw.hours
        : [],
    locations: Array.isArray(practiceRaw?.locations)
      ? practiceRaw.locations
      : [],
    hasEncounter: Boolean(practiceRaw?.hasEncounter),
    lastEncounterAt: practiceRaw?.lastEncounterAt ?? null,
    encounterCount:
      typeof practiceRaw?.encounterCount === 'number'
        ? practiceRaw.encounterCount
        : undefined,
    yourRating: practiceRaw?.yourRating ?? null,
  };

  if (!practice.id || !practice.name) {
    return null;
  }

  const cliniciansRaw = Array.isArray(source?.clinicians)
    ? source.clinicians
    : Array.isArray(practiceRaw?.clinicians)
      ? practiceRaw.clinicians
      : [];

  const encounters = Array.isArray(source?.encounters) ? source.encounters : [];

  return {
    ok: true,
    practice,
    clinicians: cliniciansRaw.map(normalizeClinician).filter(Boolean),
    encounters,
    source: 'api_gateway',
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const practiceId = String(params?.id || '').trim();

  if (!practiceId) {
    return NextResponse.json(
      { ok: false, error: 'practice_id_required' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const base = gatewayBase();

  if (!base) {
    return NextResponse.json(
      { ok: false, error: 'service_not_configured' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const incoming = new URL(req.url);

  const candidates = [
    `/api/practices/${encodeURIComponent(practiceId)}/patient-view`,
    `/api/practices/${encodeURIComponent(practiceId)}`,
  ];

  let lastError = '';

  for (const path of candidates) {
    try {
      const upstream = new URL(path, base);

      incoming.searchParams.forEach((value, key) => {
        upstream.searchParams.set(key, value);
      });

      const res = await fetch(upstream.toString(), {
        method: 'GET',
        headers: forwardHeaders(req),
        cache: 'no-store',
      });

      const data = await readJsonSafe(res);

      if (!res.ok) {
        lastError = data?.error || data?.message || `HTTP ${res.status}`;
        continue;
      }

      const normalized = normalizePayload(data, practiceId);

      if (!normalized) {
        lastError = 'invalid_practice_payload';
        continue;
      }

      return NextResponse.json(normalized, {
        headers: { 'Cache-Control': 'no-store' },
      });
    } catch (err: any) {
      lastError = err?.message || 'practice_view_proxy_failed';
    }
  }

  return NextResponse.json(
    {
      ok: false,
      error: lastError || 'practice_not_found',
    },
    { status: 502, headers: { 'Cache-Control': 'no-store' } },
  );
}