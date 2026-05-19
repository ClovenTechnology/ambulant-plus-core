import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Actor = {
  uid: string;
  role: string;
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

function getActor(req: NextRequest): Actor | null {
  const uid =
    req.headers.get('x-uid') ??
    req.headers.get('x-user') ??
    req.headers.get('x-user-id');

  const role = req.headers.get('x-role') ?? 'patient';
  return uid ? { uid: String(uid), role: String(role) } : null;
}

async function resolveSubject(req: NextRequest): Promise<SubjectContext> {
  const actor = getActor(req);
  if (!actor?.uid) {
    const err = new Error('unauthenticated') as Error & { status?: number };
    err.status = 401;
    throw err;
  }

  if (actor.role !== 'patient') {
    const err = new Error('forbidden') as Error & { status?: number };
    err.status = 403;
    throw err;
  }

  const actorProfile = await prisma.patientProfile.findUnique({
    where: { userId: actor.uid },
    select: { id: true },
  });

  if (!actorProfile?.id) {
    const err = new Error('actor_patient_profile_not_found') as Error & { status?: number };
    err.status = 404;
    throw err;
  }

  const url = new URL(req.url);
  const requestedSubjectPatientId =
    url.searchParams.get('subjectPatientId')?.trim() ||
    url.searchParams.get('patientId')?.trim() ||
    '';

  if (!requestedSubjectPatientId || requestedSubjectPatientId === actorProfile.id) {
    return {
      actor,
      subjectPatientId: actorProfile.id,
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

function shapeReaction(row: any): ReactionLogItem {
  const symptomsRaw = row.symptoms;
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

    return NextResponse.json(
      rows.map(shapeReaction),
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err: any) {
    const status = Number(err?.status) || 500;
    return NextResponse.json(
      { ok: false, error: String(err?.message || 'allergy_reactions_unavailable') },
      { status, headers: { 'Cache-Control': 'no-store' } },
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

    const occurredAt = (() => {
      const dt = new Date(String(body?.occurredAtISO || body?.occurredAt || ''));
      return Number.isNaN(dt.getTime()) ? new Date() : dt;
    })();

    const resolvedAt = (() => {
      const raw = String(body?.resolvedAtISO || body?.resolvedAt || '').trim();
      if (!raw) return null;
      const dt = new Date(raw);
      return Number.isNaN(dt.getTime()) ? null : dt;
    })();

    if (!suspectedTrigger) {
      return NextResponse.json(
        { ok: false, error: 'suspected_trigger_required' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
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

    return NextResponse.json(
      { ok: true, row: shapeReaction(row) },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err: any) {
    const status = Number(err?.status) || 500;
    return NextResponse.json(
      { ok: false, error: String(err?.message || 'could_not_add_reaction_log') },
      { status, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const subject = await resolveSubject(req);
    const body = await req.json().catch(() => ({}));
    const id = String(body?.id || '').trim();

    if (!id) {
      return NextResponse.json(
        { ok: false, error: 'id_required' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const existing = await prisma.allergyReactionLog.findFirst({
      where: { id, patientId: subject.subjectPatientId },
      select: { id: true },
    });

    if (!existing?.id) {
      return NextResponse.json(
        { ok: false, error: 'not_found' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    await prisma.allergyReactionLog.delete({ where: { id } });

    return NextResponse.json(
      { ok: true, id },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err: any) {
    const status = Number(err?.status) || 500;
    return NextResponse.json(
      { ok: false, error: String(err?.message || 'could_not_delete_reaction_log') },
      { status, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
