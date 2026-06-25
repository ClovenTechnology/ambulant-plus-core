import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

async function readPatientSession(req: NextRequest) {
  const headers = new Headers();
  const cookie = req.headers.get('cookie');
  if (cookie) headers.set('cookie', cookie);
  headers.set('accept', 'application/json');

  const res = await fetch(`${sameOriginBase(req)}/api/auth/me`, {
    method: 'GET',
    cache: 'no-store',
    headers,
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

  return patientId ? { patientId, userId } : null;
}

export async function POST(req: NextRequest, ctx: { params: { token: string } }) {
  try {
    const session = await readPatientSession(req);
    if (!session) return json({ ok: false, error: 'patient_session_required' }, 401);

    const token = clean(ctx.params.token, 500);
    if (!token) return json({ ok: false, error: 'token_required' }, 400);

    const hash = tokenHash(token);

    const created = await prisma.auditEvent.findFirst({
      where: {
        kind: 'medical_record_share_created',
        subjectId: hash,
      },
      orderBy: { at: 'desc' },
    });

    const meta = created?.meta as any;
    if (!created || meta?.patientId !== session.patientId) {
      return json({ ok: false, error: 'share_not_found' }, 404);
    }

    const revoked = await prisma.auditEvent.findFirst({
      where: {
        kind: 'medical_record_share_revoked',
        subjectId: hash,
      },
      orderBy: { at: 'desc' },
    });

    if (!revoked) {
      await prisma.auditEvent.create({
        data: {
          kind: 'medical_record_share_revoked',
          actorId: session.userId || session.patientId,
          actorRole: 'patient',
          subjectId: hash,
          meta: {
            patientId: session.patientId,
            revokedAt: new Date().toISOString(),
          },
        },
      });
    }

    return json({ ok: true, revoked: true });
  } catch (error: any) {
    console.error('[medical-records-share-revoke] failed', error);
    return json({ ok: false, error: error?.message || 'medical_record_share_revoke_failed' }, 500);
  }
}
