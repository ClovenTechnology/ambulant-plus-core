// apps/patient-app/app/api/allergy-reactions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { prisma } from '@/src/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Actor = {
  uid: string;
  role: 'patient';
  actorRefId: string | null;
};

type SubjectContext = {
  actor: Actor;
  subjectPatientId: string;
  mode: 'self' | 'proxy';
  relationshipId: string | null;
};

type ReactionSeverity = 'mild' | 'moderate' | 'severe';

type ReactionLogItem = {
  id: string;
  occurredAtISO: string;
  suspectedTrigger: string;
  symptoms: string[];
  severity: ReactionSeverity;
  medsTaken?: string;
  notes?: string;
  resolvedAtISO?: string;
};

function noStore(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
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

    return { uid, role: 'patient', actorRefId };
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

async function resolveSubject(req: NextRequest): Promise<SubjectContext> {
  const actor = await readPatientActor(req);
  const actorPatientId = await resolveActorPatientId(actor);

  const url = new URL(req.url);
  const requestedSubjectPatientId =
    url.searchParams.get('subjectPatientId')?.trim() ||
    url.searchParams.get('patientId')?.trim() ||
    '';

  if (!requestedSubjectPatientId || requestedSubjectPatientId === actorPatientId) {
    return {
      actor,
      subjectPatientId: actorPatientId,
      mode: 'self',
      relationshipId: null,
    };
  }

  const requestedRelationshipId = url.searchParams.get('relationshipId')?.trim() || '';
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

  return {
    actor,
    subjectPatientId: requestedSubjectPatientId,
    mode: 'proxy',
    relationshipId: relationship.id,
  };
}

function normalizeSeverity(value: unknown): ReactionSeverity {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'severe') return 'severe';
  if (raw === 'moderate') return 'moderate';
  return 'mild';
}

function cleanText(value: unknown, max = 300) {
  return String(value || '').trim().slice(0, max);
}

function normalizeSymptoms(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((x) => cleanText(x, 40))
      .filter(Boolean)
      .slice(0, 12);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((x) => cleanText(x, 40))
      .filter(Boolean)
      .slice(0, 12);
  }

  return [];
}

function toDateOrNull(value: unknown): Date | null {
  if (!value) return null;
  const dt = new Date(String(value));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function shapeReaction(row: any): ReactionLogItem {
  const symptomsRaw = row?.symptoms;
  const symptoms = Array.isArray(symptomsRaw)
    ? symptomsRaw.map((x) => String(x))
    : Array.isArray(symptomsRaw?.items)
      ? symptomsRaw.items.map((x: any) => String(x))
      : [];

  return {
    id: String(row.id),
    occurredAtISO: new Date(row.occurredAt).toISOString(),
    suspectedTrigger: String(row.suspectedTrigger || ''),
    symptoms,
    severity: normalizeSeverity(row.severity),
    medsTaken: row.medsTaken ?? undefined,
    notes: row.notes ?? undefined,
    resolvedAtISO: row.resolvedAt ? new Date(row.resolvedAt).toISOString() : undefined,
  };
}

export async function GET(req: NextRequest) {
  try {
    const subject = await resolveSubject(req);
    const rows = await prisma.allergyReactionLog.findMany({
      where: { patientId: subject.subjectPatientId },
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        occurredAt: true,
        suspectedTrigger: true,
        symptoms: true,
        severity: true,
        medsTaken: true,
        notes: true,
        resolvedAt: true,
      },
    });

    return noStore(rows.map(shapeReaction));
  } catch (err: any) {
    return noStore(
      { ok: false, error: String(err?.message || 'allergy_reactions_unavailable') },
      Number(err?.status) || 500,
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const subject = await resolveSubject(req);
    const body = await req.json().catch(() => ({}));

    const suspectedTrigger = cleanText(body?.suspectedTrigger, 160);
    const symptoms = normalizeSymptoms(body?.symptoms);
    const severity = normalizeSeverity(body?.severity);
    const medsTaken = cleanText(body?.medsTaken, 180) || null;
    const notes = cleanText(body?.notes, 700) || null;
    const occurredAt = toDateOrNull(body?.occurredAtISO || body?.occurredAt) || new Date();
    const resolvedAt = toDateOrNull(body?.resolvedAtISO || body?.resolvedAt);

    if (!suspectedTrigger) {
      return noStore({ ok: false, error: 'suspected_trigger_required' }, 400);
    }

    const row = await prisma.allergyReactionLog.create({
      data: {
        patientId: subject.subjectPatientId,
        occurredAt,
        suspectedTrigger,
        symptoms,
        severity,
        medsTaken,
        notes,
        resolvedAt,
      },
      select: {
        id: true,
        occurredAt: true,
        suspectedTrigger: true,
        symptoms: true,
        severity: true,
        medsTaken: true,
        notes: true,
        resolvedAt: true,
      },
    });

    return noStore({ ok: true, row: shapeReaction(row) });
  } catch (err: any) {
    return noStore(
      { ok: false, error: String(err?.message || 'could_not_add_reaction_log') },
      Number(err?.status) || 500,
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const subject = await resolveSubject(req);
    const body = await req.json().catch(() => ({}));
    const id = String(body?.id || '').trim();

    if (!id) {
      return noStore({ ok: false, error: 'id_required' }, 400);
    }

    const existing = await prisma.allergyReactionLog.findFirst({
      where: { id, patientId: subject.subjectPatientId },
      select: { id: true },
    });

    if (!existing?.id) {
      return noStore({ ok: false, error: 'not_found' }, 404);
    }

    await prisma.allergyReactionLog.delete({ where: { id } });

    return noStore({ ok: true, id });
  } catch (err: any) {
    return noStore(
      { ok: false, error: String(err?.message || 'could_not_delete_reaction_log') },
      Number(err?.status) || 500,
    );
  }
}
