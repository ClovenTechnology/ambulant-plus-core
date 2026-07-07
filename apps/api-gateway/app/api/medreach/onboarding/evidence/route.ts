// apps/api-gateway/app/api/medreach/onboarding/evidence/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import { emitEvent } from '@/src/lib/events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUBMITTED_KIND = 'medreach_onboarding_evidence_submitted';
const REVIEWED_KIND = 'medreach_onboarding_evidence_reviewed';

const MAX_INLINE_FILE_CHARS = 1_800_000;

const ALLOWED_SUBJECT_TYPES = new Set(['lab', 'phleb']);
const ALLOWED_DECISIONS = new Set(['ACCEPTED', 'REJECTED', 'NEEDS_MORE_INFO']);
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanUpper(value: unknown) {
  return clean(value).toUpperCase();
}

function cleanInt(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : fallback;
}

function roleOf(who: any) {
  return String(who?.role || '').toLowerCase();
}

function metaOf(row: any): Record<string, any> {
  return row?.meta && typeof row.meta === 'object' ? row.meta : {};
}

function canSubmitEvidence(role: string) {
  return ['admin', 'system', 'lab', 'phleb'].includes(role);
}

function canReviewEvidence(role: string) {
  return ['admin', 'system'].includes(role);
}

async function assertSubjectExists(subjectType: string, subjectId: string) {
  if (subjectType === 'lab') {
    const lab = await prisma.labPartner.findUnique({
      where: { id: subjectId },
      select: { id: true },
    });

    return Boolean(lab);
  }

  if (subjectType === 'phleb') {
    const phleb = await prisma.medReachPhlebProfile.findFirst({
      where: {
        OR: [{ id: subjectId }, { userId: subjectId }],
      },
      select: { id: true },
    });

    return Boolean(phleb);
  }

  return false;
}

function projectEvidence(row: any) {
  const meta = metaOf(row);

  return {
    id: row.id,
    kind: row.kind,
    subjectId: row.subjectId ?? null,
    subjectType: meta.subjectType ?? null,
    applicantRef: meta.applicantRef ?? null,
    documentType: meta.documentType ?? null,
    fileName: meta.fileName ?? null,
    mimeType: meta.mimeType ?? null,
    sizeBytes: meta.sizeBytes ?? null,
    sha256: meta.sha256 ?? null,
    storageMode: meta.storageMode ?? null,
    status: meta.status ?? (row.kind === REVIEWED_KIND ? meta.decision : 'SUBMITTED'),
    decision: meta.decision ?? null,
    reviewReason: meta.reviewReason ?? null,
    sourceEvidenceId: meta.sourceEvidenceId ?? null,
    hasInlineFile: Boolean(meta.fileDataUrl),
    fileDataUrl: meta.fileDataUrl ?? null,
    notes: meta.notes ?? null,
    actorId: row.actorId ?? null,
    actorRole: row.actorRole ?? null,
    at: row.at?.toISOString?.() ?? row.at ?? null,
  };
}

export async function GET(req: NextRequest) {
  const who = readIdentity(req.headers);
  const role = roleOf(who);

  if (!['admin', 'system', 'lab', 'phleb'].includes(role)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const subjectType = clean(url.searchParams.get('subjectType')).toLowerCase();
  const subjectId = clean(url.searchParams.get('subjectId'));
  const status = cleanUpper(url.searchParams.get('status'));
  const limit = Math.min(500, Math.max(1, cleanInt(url.searchParams.get('limit'), 200)));

  const rows = await prisma.auditEvent.findMany({
    where: {
      kind: { in: [SUBMITTED_KIND, REVIEWED_KIND] },
      ...(subjectId ? { subjectId } : {}),
    },
    orderBy: { at: 'desc' },
    take: limit * 2,
  });

  const items = rows
    .map(projectEvidence)
    .filter((item) => {
      if (subjectType && item.subjectType !== subjectType) return false;
      if (status && item.status !== status && item.decision !== status) return false;

      if (role === 'lab') {
        return item.subjectType === 'lab' && item.subjectId === who.actorRefId;
      }

      if (role === 'phleb') {
        return item.subjectType === 'phleb' && item.subjectId === who.actorRefId;
      }

      return true;
    })
    .slice(0, limit);

  return NextResponse.json({
    ok: true,
    data: items,
  });
}

export async function POST(req: NextRequest) {
  const who = readIdentity(req.headers);
  const role = roleOf(who);

  if (!canSubmitEvidence(role)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const subjectType = clean(body.subjectType).toLowerCase();
  const subjectId = clean(body.subjectId);
  const applicantRef = clean(body.applicantRef) || subjectId;
  const documentType = cleanUpper(body.documentType);
  const fileName = clean(body.fileName);
  const mimeType = clean(body.mimeType);
  const sizeBytes = cleanInt(body.sizeBytes);
  const sha256 = clean(body.sha256);
  const notes = clean(body.notes);
  const fileDataUrl = clean(body.fileDataUrl);

  if (!ALLOWED_SUBJECT_TYPES.has(subjectType)) {
    return NextResponse.json({ ok: false, error: 'invalid_subjectType' }, { status: 400 });
  }

  if (!subjectId) {
    return NextResponse.json({ ok: false, error: 'missing_subjectId' }, { status: 400 });
  }

  if (!documentType) {
    return NextResponse.json({ ok: false, error: 'missing_documentType' }, { status: 400 });
  }

  if (!fileName) {
    return NextResponse.json({ ok: false, error: 'missing_fileName' }, { status: 400 });
  }

  if (mimeType && !ALLOWED_MIME.has(mimeType)) {
    return NextResponse.json({ ok: false, error: 'unsupported_mimeType' }, { status: 400 });
  }

  if (fileDataUrl && fileDataUrl.length > MAX_INLINE_FILE_CHARS) {
    return NextResponse.json({ ok: false, error: 'file_too_large_for_inline_evidence' }, { status: 413 });
  }

  const exists = await assertSubjectExists(subjectType, subjectId);

  if (!exists) {
    return NextResponse.json({ ok: false, error: 'subject_not_found' }, { status: 404 });
  }

  const event = await prisma.auditEvent.create({
    data: {
      kind: SUBMITTED_KIND,
      actorId: who.uid ?? applicantRef ?? null,
      actorRole: who.role ?? role,
      subjectId,
      meta: {
        subjectType,
        subjectId,
        applicantRef,
        documentType,
        fileName,
        mimeType: mimeType || null,
        sizeBytes,
        sha256: sha256 || null,
        storageMode: fileDataUrl ? 'INLINE_LIMITED_AUDIT_META' : 'REFERENCE_ONLY',
        fileDataUrl: fileDataUrl || null,
        status: 'SUBMITTED',
        notes: notes || null,
        submittedAt: new Date().toISOString(),
      },
    },
  });

  await prisma.auditEvent.create({
    data: {
      kind: 'medreach_onboarding_evidence_touchpoint',
      actorId: who.uid ?? applicantRef ?? null,
      actorRole: who.role ?? role,
      subjectId,
      meta: {
        subjectType,
        subjectId,
        evidenceId: event.id,
        documentType,
        action: 'SUBMITTED',
      },
    },
  });

  emitEvent({
    kind: SUBMITTED_KIND,
    payload: {
      evidenceId: event.id,
      subjectType,
      subjectId,
      documentType,
      fileName,
    },
    targets: { admin: true },
  });

  return NextResponse.json(
    {
      ok: true,
      data: projectEvidence(event),
    },
    { status: 201 },
  );
}

export async function PATCH(req: NextRequest) {
  const who = readIdentity(req.headers);
  const role = roleOf(who);

  if (!canReviewEvidence(role)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const evidenceId = clean(body.evidenceId);
  const decision = cleanUpper(body.decision);
  const reviewReason = clean(body.reviewReason);

  if (!evidenceId) {
    return NextResponse.json({ ok: false, error: 'missing_evidenceId' }, { status: 400 });
  }

  if (!ALLOWED_DECISIONS.has(decision)) {
    return NextResponse.json({ ok: false, error: 'invalid_decision' }, { status: 400 });
  }

  if ((decision === 'REJECTED' || decision === 'NEEDS_MORE_INFO') && !reviewReason) {
    return NextResponse.json({ ok: false, error: 'review_reason_required' }, { status: 400 });
  }

  const source = await prisma.auditEvent.findUnique({
    where: { id: evidenceId },
  });

  if (!source || source.kind !== SUBMITTED_KIND) {
    return NextResponse.json({ ok: false, error: 'evidence_not_found' }, { status: 404 });
  }

  const sourceMeta = metaOf(source);

  const event = await prisma.auditEvent.create({
    data: {
      kind: REVIEWED_KIND,
      actorId: who.uid ?? null,
      actorRole: who.role ?? role,
      subjectId: source.subjectId,
      meta: {
        ...sourceMeta,
        fileDataUrl: undefined,
        sourceEvidenceId: source.id,
        decision,
        status: decision,
        reviewReason: reviewReason || null,
        reviewedAt: new Date().toISOString(),
        reviewedByUserId: who.uid ?? null,
      },
    } as any,
  });

  emitEvent({
    kind: REVIEWED_KIND,
    payload: {
      sourceEvidenceId: source.id,
      reviewEventId: event.id,
      subjectType: sourceMeta.subjectType ?? null,
      subjectId: source.subjectId,
      documentType: sourceMeta.documentType ?? null,
      decision,
    },
    targets: { admin: true },
  });

  return NextResponse.json({
    ok: true,
    data: projectEvidence(event),
  });
}