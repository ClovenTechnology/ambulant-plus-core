// apps/patient-app/app/api/televisit/token/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { store, getJoinWindow, upsertTicket } from '@runtime/store';

export const dynamic = 'force-dynamic';

function envInt(name: string, fallback: number) {
  const v = process.env[name];
  const n = v != null ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function envBool(name: string, fallback: boolean) {
  const v = process.env[name];
  if (v == null) return fallback;
  return v === '1' || v.toLowerCase() === 'true' || v.toLowerCase() === 'yes';
}

function parseISO(s?: string | null) {
  if (!s) return null;
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/**
 * Compatibility route:
 * POST /api/televisit/token
 * body: { visitId, startsAt?, endsAt? }
 *
 * Returns a joinTicket token compatible with /api/rtc/token (x-join-token).
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    visitId?: string;
    startsAt?: string;
    endsAt?: string;
  };

  const visitId = String(body?.visitId || '').trim();
  if (!visitId) {
    return NextResponse.json(
      { ok: false, error: 'visit_id_required', message: 'Missing visitId' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const uid = req.headers.get('x-uid') || req.headers.get('X-Uid') || '';
  if (!uid) {
    return NextResponse.json(
      { ok: false, error: 'unauthorized', message: 'Missing x-uid' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  let visit = store.televisits.get(visitId) as any;

  if (!visit) {
    const allowCompatibilityVisitCreation = envBool('TELEVISIT_ALLOW_COMPATIBILITY_VISIT_CREATION', false);
    if (!allowCompatibilityVisitCreation) {
      return NextResponse.json(
        { ok: false, error: 'visit_not_found', message: 'Visit not found' },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const s = parseISO(body?.startsAt);
    const e = parseISO(body?.endsAt);

    if (!s || !e) {
      return NextResponse.json(
        {
          ok: false,
          error: 'appointment_times_required',
          message: 'Compatibility visit creation requires real appointment startsAt and endsAt.',
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const startMs = Date.parse(s);
    const endMs = Date.parse(e);

    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
      return NextResponse.json(
        {
          ok: false,
          error: 'invalid_appointment_window',
          message: 'Televisit appointment window must have endsAt after startsAt.',
        },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const startsAtISO = s;
    const endsAtISO = e;

    const tv = (store as any)?.televisits;
    if (tv && typeof tv.set === 'function') {
      visit = {
        id: visitId,
        visitId,
        roomId: visitId,
        startsAt: startsAtISO,
        endsAt: endsAtISO,
        kind: 'televisit',
        title: 'Televisit',
      };
      try {
        tv.set(visitId, visit);
      } catch {
        // ignore
      }
    }
  }

  if (!visit) {
    return NextResponse.json(
      { ok: false, error: 'visit_not_found', message: 'Visit not found' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const { openAt, closeAt } = getJoinWindow(visit);
  const now = Date.now();

  if (now < openAt) {
    return NextResponse.json(
      { ok: false, error: 'join_window_not_open', message: 'Join window not open yet', now, openAt, closeAt },
      { status: 403, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  if (now > closeAt) {
    return NextResponse.json(
      { ok: false, error: 'join_window_closed', message: 'Join window has closed', now, openAt, closeAt },
      { status: 403, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const ttlSec = envInt('JOIN_TOKEN_TTL_SEC', 90);
  const ticket = upsertTicket(visitId, uid, ttlSec);

  return NextResponse.json(
    {
      ok: true,
      now,
      visitId,
      window: { openAt, closeAt, isOpen: true },
      ticket: { token: ticket.token, issuedAt: ticket.issuedAt, expiresAt: ticket.expiresAt, ttlSec },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
