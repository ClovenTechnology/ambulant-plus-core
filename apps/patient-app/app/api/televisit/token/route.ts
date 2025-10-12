// apps/patient-app/app/api/televisit/token/route.ts
export const runtime = 'edge';

import { SignJWT } from 'jose';

type Body = { appointmentId?: string; startsAt?: string; endsAt?: string };
type Appt = { id: string; startsAt: string; endsAt: string; role: 'patient' | 'clinician' };

function envNum(name: string, fallback: number) {
  const v = (process.env as any)[name];
  const n = v != null ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

const OPEN_MIN = envNum('JOIN_WINDOW_START_MIN', -10);
const CLOSE_MIN = envNum('JOIN_WINDOW_END_MIN', 15);
const TTL_SEC = envNum('JOIN_TOKEN_TTL_SEC', 90);

function withinJoinWindow(startsAtISO: string, endsAtISO: string, nowMs = Date.now()) {
  const s = new Date(startsAtISO).getTime();
  const e = new Date(endsAtISO).getTime();
  const open = s + OPEN_MIN * 60_000;
  const close = e + CLOSE_MIN * 60_000;
  return nowMs >= open && nowMs <= close;
}

// TEMP: since weâ€™re mock-listing, we accept startsAt/endsAt from client (validated here).
// In production, look up appointment from DB by appointmentId and verify ownership.
export async function POST(req: Request) {
  try {
    const { appointmentId, startsAt, endsAt } = (await req.json()) as Body;

    if (!appointmentId || !startsAt || !endsAt) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400 });
    }

    // Gate window
    if (!withinJoinWindow(startsAt, endsAt)) {
      return new Response(JSON.stringify({ error: 'Outside join window' }), { status: 403 });
    }

    const secret = (process.env as any).TELEVISIT_JWT_SECRET;
    if (!secret) return new Response(JSON.stringify({ error: 'Server misconfig' }), { status: 500 });

    const appt: Appt = { id: appointmentId, startsAt, endsAt, role: 'patient' }; // role can be set from auth later

    const jwt = await new SignJWT({
      apptId: appt.id,
      role: appt.role,
      startsAt: appt.startsAt,
      endsAt: appt.endsAt,
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + TTL_SEC)
      .sign(new TextEncoder().encode(secret));

    return new Response(JSON.stringify({ token: jwt }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Bad request' }), { status: 400 });
  }
}
