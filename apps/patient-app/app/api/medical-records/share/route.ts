import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_SCOPES = new Set(['full_record', 'documents_only', 'labs_only', 'selected_documents']);
const ALLOWED_TTL_HOURS = new Set([1, 6, 12, 24, 72]);

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

function clean(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function tokenHash(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function sameOriginBase(req: NextRequest) {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

function appBaseUrl(req: NextRequest) {
  return process.env.NEXT_PUBLIC_PATIENT_APP_URL || sameOriginBase(req);
}

function forwardHeaders(req: NextRequest) {
  const headers = new Headers();
  const cookie = req.headers.get('cookie');
  if (cookie) headers.set('cookie', cookie);
  headers.set('accept', 'application/json');
  return headers;
}

async function readPatientSession(req: NextRequest) {
  const res = await fetch(`${sameOriginBase(req)}/api/auth/me`, {
    method: 'GET',
    cache: 'no-store',
    headers: forwardHeaders(req),
  });

  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload?.ok) return null;

  const patientId = clean(
    payload.patientId ||
      payload.actorRefId ||
      payload.profile?.patientId ||
      payload.profile?.id ||
      payload.user?.patientId ||
      payload.user?.actorRefId,
    180,
  );

  const userId = clean(payload.userId || payload.uid || payload.id || payload.user?.id, 180);
  const displayName = clean(payload.displayName || payload.name || payload.profile?.name, 240);

  if (!patientId) return null;

  return { patientId, userId, displayName };
}

export async function POST(req: NextRequest) {
  try {
    const session = await readPatientSession(req);
    if (!session) return json({ ok: false, error: 'patient_session_required' }, 401);

    const body = await req.json().catch(() => ({}));

    const scope = clean(body?.scope || 'documents_only', 80);
    if (!ALLOWED_SCOPES.has(scope)) {
      return json({ ok: false, error: 'invalid_scope' }, 400);
    }

    const ttlHours = Number(body?.ttlHours || 24);
    if (!ALLOWED_TTL_HOURS.has(ttlHours)) {
      return json({ ok: false, error: 'invalid_ttl_hours', allowed: Array.from(ALLOWED_TTL_HOURS) }, 400);
    }

    if (body?.consentConfirmed !== true) {
      return json({ ok: false, error: 'consent_required' }, 400);
    }

    const selectedDocumentIds = Array.isArray(body?.selectedDocumentIds)
      ? body.selectedDocumentIds.map((x: unknown) => clean(x, 180)).filter(Boolean).slice(0, 100)
      : [];

    if (scope === 'selected_documents' && selectedDocumentIds.length === 0) {
      return json({ ok: false, error: 'selected_documents_required' }, 400);
    }

    if (selectedDocumentIds.length > 0) {
      const count = await prisma.patientDocument.count({
        where: {
          patientId: session.patientId,
          id: { in: selectedDocumentIds },
        },
      });

      if (count !== selectedDocumentIds.length) {
        return json({ ok: false, error: 'selected_document_not_found' }, 404);
      }
    }

    const token = crypto.randomBytes(32).toString('base64url');
    const hash = tokenHash(token);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);

    await prisma.auditEvent.create({
      data: {
        kind: 'medical_record_share_created',
        actorId: session.userId || session.patientId,
        actorRole: 'patient',
        subjectId: hash,
        meta: {
          patientId: session.patientId,
          patientName: session.displayName || null,
          scope,
          ttlHours,
          expiresAt: expiresAt.toISOString(),
          selectedDocumentIds,
          consentConfirmed: true,
          tokenHint: token.slice(0, 6),
          createdAt: now.toISOString(),
        },
      },
    });

    const shareUrl = `${appBaseUrl(req).replace(/\/$/, '')}/share/medical-records/${encodeURIComponent(token)}`;

    return json({
      ok: true,
      share: {
        token,
        shareUrl,
        scope,
        expiresAt: expiresAt.toISOString(),
        ttlHours,
      },
    }, 201);
  } catch (error: any) {
    console.error('[medical-records-share-create] failed', error);
    return json({ ok: false, error: error?.message || 'medical_record_share_create_failed' }, 500);
  }
}
