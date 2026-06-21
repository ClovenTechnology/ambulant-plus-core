// apps/api-gateway/app/api/consultation-sessions/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  checkInSession,
  completeSession,
  getOrCreateSessionByAppointment,
  getSessionById,
  readConsultationActor,
  serializeSession,
  startSession,
} from '@/src/consultation-sessions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

function guard(req: NextRequest) {
  const actor = readConsultationActor(req.headers);
  if (!actor.ok) return json({ ok: false, error: actor.error }, actor.status);
  return null;
}

export async function GET(
  req: NextRequest,
  ctx: { params: { id: string } },
) {
  const denied = guard(req);
  if (denied) return denied;

  try {
    const session = await getSessionById(String(ctx.params.id || '').trim());

    if (!session) {
      return json({ ok: false, error: 'session_not_found' }, 404);
    }

    return json({ ok: true, session: serializeSession(session) });
  } catch (err: any) {
    console.error('[consultation-sessions/get] failed', err);
    return json({ ok: false, error: err?.message || 'session_lookup_failed' }, 500);
  }
}
