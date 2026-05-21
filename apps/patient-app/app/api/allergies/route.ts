// apps/patient-app/app/api/allergies/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { prisma } from '@/src/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type AllergySeverity = 'Mild' | 'Moderate' | 'Severe';
type AllergyStatus = 'Active' | 'Resolved';

type Actor = {
  uid: string;
  actorRefId: string | null;
};

type AllergyDto = {
  id: string;
  substance: string;
  reaction: string;
  severity: AllergySeverity;
  status: AllergyStatus;
  notedAt: string;
  source?: string | null;
  notes?: string | null;
};

function noStore(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

function sessionSecret() {
  const secret = process.env.AUTH_SESSION_SECRET || '';
  if (!secret.trim()) {
    const err = new Error('AUTH_SESSION_SECRET_required') as Error & { status?: number };
    err.status = 500;
    throw err;
  }

  return new TextEncoder().encode(secret);
}

function readCookie(req: NextRequest, name: string) {
  return req.cookies.get(name)?.value || '';
}

async function readPatientActor(req: NextRequest): Promise<Actor> {
  const token =
    readCookie(req, 'ambulant_session') ||
    readCookie(req, '__Host-ambulant_session') ||
    '';

  if (!token) {
    const err = new Error('unauthenticated') as Error & { status?: number };
    err.status = 401;
    throw err;
  }

  try {
    const { payload } = await jwtVerify(token, sessionSecret(), {
      algorithms: ['HS256'],
    });

    const uid = String(payload.uid || payload.sub || '').trim();
    const actorType = String(payload.actorType || payload.role || 'patient').trim().toLowerCase();
    const actorRefId = String(payload.actorRefId || '').trim() || null;

    if (!uid) {
      const err = new Error('unauthenticated') as Error & { status?: number };
      err.status = 401;
      throw err;
    }

    if (actorType !== 'patient') {
      const err = new Error('forbidden') as Error & { status?: number };
      err.status = 403;
      throw err;
    }

    return { uid, actorRefId };
  } catch (error: any) {
    if (error?.status) throw error;
    const err = new Error('invalid_session') as Error & { status?: number };
    err.status = 401;
    throw err;
  }
}

async function resolveActorPatientId(actor: Actor): Promise<string> {
  if (actor.actorRefId) {
    const byActorRef = await prisma.patientProfile.findUnique({
      where: { id: actor.actorRefId },
      select: { id: true, userId: true },
    });

    if (byActorRef?.id && (!byActorRef.userId || byActorRef.userId === actor.uid)) {
      return byActorRef.id;
    }
  }

  const byUser = await prisma.patientProfile.findUnique({
    where: { userId: actor.uid },
    select: { id: true },
  });

  if (!byUser?.id) {
    const err = new Error('actor_patient_profile_not_found') as Error & { status?: number };
    err.status = 404;
    throw err;
  }

  return byUser.id;
}

async function resolveSubjectPatientId(req: NextRequest): Promise<string> {
  const actor = await readPatientActor(req);
  const actorPatientId = await resolveActorPatientId(actor);

  const url = new URL(req.url);
  const requestedSubjectPatientId =
    cleanText(url.searchParams.get('subjectPatientId'), 120) ||
    cleanText(url.searchParams.get('patientId'), 120);

  if (!requestedSubjectPatientId || requestedSubjectPatientId === actorPatientId) {
    return actorPatientId;
  }

  const requestedRelationshipId = cleanText(url.searchParams.get('relationshipId'), 120);
  const where: any = {
    hostUserId: actor.uid,
    subjectPatientId: requestedSubjectPatientId,
    status: 'ACTIVE',
  };

  if (requestedRelationshipId) where.id = requestedRelationshipId;

  const relationship = await prisma.familyRelationship.findFirst({
    where,
    select: { id: true },
  });

  if (!relationship?.id) {
    const err = new Error('forbidden') as Error & { status?: number };
    err.status = 403;
    throw err;
  }

  return requestedSubjectPatientId;
}

function cleanText(value: unknown, max = 300) {
  return String(value ?? '').trim().slice(0, max);
}

function normalizeSeverity(value: unknown): AllergySeverity {
  const raw = cleanText(value, 40).toLowerCase();
  if (raw === 'severe' || raw === 'critical' || raw === 'high') return 'Severe';
  if (raw === 'moderate' || raw === 'medium') return 'Moderate';
  return 'Mild';
}

function normalizeStatus(value: unknown): AllergyStatus {
  const raw = cleanText(value, 40).toLowerCase();
  if (raw === 'resolved' || raw === 'inactive' || raw === 'entered-in-error') return 'Resolved';
  return 'Active';
}

function asIso(value: unknown) {
  const date = value instanceof Date ? value : value ? new Date(String(value)) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function shapeAllergy(row: any): AllergyDto {
  return {
    id: String(row?.id || ''),
    substance: cleanText(row?.substance ?? row?.substanceText ?? row?.allergen ?? row?.name ?? 'Allergy', 300),
    reaction: cleanText(row?.reaction ?? row?.reactionText ?? row?.manifestation ?? '', 500),
    severity: normalizeSeverity(row?.severity),
    status: normalizeStatus(row?.status ?? row?.clinicalStatus),
    notedAt: asIso(row?.recordedAt ?? row?.notedAt ?? row?.createdAt ?? row?.updatedAt),
    source: row?.source == null ? null : cleanText(row.source, 120),
    notes: row?.notes == null ? null : cleanText(row.notes, 1000),
  };
}

function allergyDelegate() {
  const db = prisma as any;
  return db.allergy ?? db.patientAllergy ?? db.allergyIntolerance ?? null;
}

async function findAllergies(patientId: string) {
  const delegate = allergyDelegate();

  if (!delegate?.findMany) {
    const err = new Error('allergy_store_unavailable') as Error & { status?: number };
    err.status = 503;
    throw err;
  }

  const orderByAttempts = [
    [{ status: 'asc' }, { recordedAt: 'desc' }, { createdAt: 'desc' }],
    [{ createdAt: 'desc' }],
  ];

  let lastError: any = null;

  for (const orderBy of orderByAttempts) {
    try {
      const rows = await delegate.findMany({
        where: { patientId },
        orderBy,
        take: 250,
      });

      return Array.isArray(rows) ? rows.map(shapeAllergy).filter((row) => row.id) : [];
    } catch (err: any) {
      lastError = err;
    }
  }

  const err = new Error(`allergy_store_query_failed: ${lastError?.message || lastError}`) as Error & { status?: number };
  err.status = 503;
  throw err;
}

async function createAllergy(patientId: string, args: {
  substance: string;
  reaction: string;
  severity: AllergySeverity;
  notes?: string | null;
}) {
  const delegate = allergyDelegate();

  if (!delegate?.create) {
    const err = new Error('allergy_store_unavailable') as Error & { status?: number };
    err.status = 503;
    throw err;
  }

  const baseData = {
    patientId,
    substance: args.substance,
    reaction: args.reaction,
    severity: args.severity,
    status: 'Active',
    source: 'patient-self-report',
    notes: args.notes || null,
  };

  const dataAttempts = [
    { ...baseData, recordedAt: new Date() },
    {
      patientId,
      substanceText: args.substance,
      reactionText: args.reaction,
      severity: args.severity,
      status: 'Active',
      notes: args.notes || null,
      recordedAt: new Date(),
    },
    {
      patientId,
      allergen: args.substance,
      reaction: args.reaction,
      severity: args.severity,
      clinicalStatus: 'Active',
      notes: args.notes || null,
    },
  ];

  let lastError: any = null;

  for (const data of dataAttempts) {
    try {
      const row = await delegate.create({ data });
      return shapeAllergy(row);
    } catch (err: any) {
      lastError = err;

      if (String(err?.code || '') === 'P2002') {
        const existing = await delegate.findFirst?.({
          where: {
            patientId,
            substance: args.substance,
            reaction: args.reaction,
          },
        }).catch(() => null);

        if (existing?.id) return shapeAllergy(existing);
      }
    }
  }

  const err = new Error(`allergy_store_create_failed: ${lastError?.message || lastError}`) as Error & { status?: number };
  err.status = 503;
  throw err;
}

async function updateAllergyStatus(patientId: string, id: string, status: AllergyStatus) {
  const delegate = allergyDelegate();

  if (!delegate?.findFirst || !delegate?.update) {
    const err = new Error('allergy_store_unavailable') as Error & { status?: number };
    err.status = 503;
    throw err;
  }

  const existing = await delegate.findFirst({ where: { id, patientId } });
  if (!existing?.id) {
    const err = new Error('allergy_not_found') as Error & { status?: number };
    err.status = 404;
    throw err;
  }

  const updateAttempts = [
    { status },
    { clinicalStatus: status },
  ];

  let lastError: any = null;

  for (const data of updateAttempts) {
    try {
      const row = await delegate.update({
        where: { id },
        data,
      });
      return shapeAllergy(row);
    } catch (err: any) {
      lastError = err;
    }
  }

  const err = new Error(`allergy_store_update_failed: ${lastError?.message || lastError}`) as Error & { status?: number };
  err.status = 503;
  throw err;
}

export async function GET(req: NextRequest) {
  try {
    const patientId = await resolveSubjectPatientId(req);
    const items = await findAllergies(patientId);
    return noStore({ ok: true, items, allergies: items });
  } catch (err: any) {
    return noStore(
      { ok: false, error: String(err?.message || 'allergies_unavailable') },
      Number(err?.status) || 500,
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const patientId = await resolveSubjectPatientId(req);
    const body = await req.json().catch(() => ({}));

    const substance = cleanText(body?.substance ?? body?.substanceText ?? body?.allergen, 300);
    const reaction = cleanText(body?.reaction ?? body?.reactionText, 500);
    const severity = normalizeSeverity(body?.severity);
    const notes = cleanText(body?.notes, 1000) || null;

    if (!substance || !reaction) {
      return noStore({ ok: false, error: 'substance_and_reaction_required' }, 400);
    }

    const row = await createAllergy(patientId, { substance, reaction, severity, notes });
    return noStore({ ok: true, row, item: row });
  } catch (err: any) {
    return noStore(
      { ok: false, error: String(err?.message || 'could_not_add_allergy') },
      Number(err?.status) || 500,
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const patientId = await resolveSubjectPatientId(req);
    const body = await req.json().catch(() => ({}));

    const id = cleanText(body?.id, 120);
    const status = normalizeStatus(body?.status);

    if (!id) {
      return noStore({ ok: false, error: 'id_required' }, 400);
    }

    const row = await updateAllergyStatus(patientId, id, status);
    return noStore({ ok: true, row, item: row });
  } catch (err: any) {
    return noStore(
      { ok: false, error: String(err?.message || 'could_not_update_allergy') },
      Number(err?.status) || 500,
    );
  }
}
