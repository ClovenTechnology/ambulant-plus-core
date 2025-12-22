// apps/patient-app/app/api/iomt/ingest/route.ts
export const runtime = 'nodejs';
import type { IoMTick } from '../stream/route';

declare global {
  // eslint-disable-next-line no-var
  var latestIoMTick: IoMTick | undefined;
  // eslint-disable-next-line no-var
  var externalModeStarted: boolean | undefined;
}

// CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

// Helper: check bearer token (simple)
function checkAuth(req: Request) {
  const auth = req.headers.get('authorization') || '';
  if (!auth.startsWith('Bearer ')) return false;
  const token = auth.slice(7).trim();
  const expected = process.env.IOMT_INGEST_TOKEN || '';
  return token && expected && token === expected;
}

export async function POST(req: Request) {
  // require auth for ingest in non-dev
  const allowUnauthInDev = process.env.NODE_ENV !== 'production' && !process.env.IOMT_INGEST_TOKEN;
  if (!allowUnauthInDev && !checkAuth(req)) {
    return new Response('Unauthorized', { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  try {
    const body = await req.json() as Partial<IoMTick>;
    // minimal sanity: require at least one vital to avoid empty packets
    const hasAnyVital =
      body.hr != null || body.sys != null || body.dia != null || body.spo2 != null ||
      body.temp_c != null || body.hrv != null || body.glucose != null || body.stress != null ||
      body.ecg != null || body.steps != null || body.calories_kcal != null ||
      body.distance_km != null || body.sitting_min != null || body.sleep != null;

    if (!hasAnyVital) {
      return new Response('No vitals in payload', { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    const nowIso = new Date().toISOString();

    // Redact potentially sensitive string fields — only keep numeric vitals in global tick
    const tick: Partial<IoMTick> = { ts: nowIso };
    if (typeof body.hr === 'number') tick.hr = body.hr;
    if (typeof body.sys === 'number') tick.sys = body.sys;
    if (typeof body.dia === 'number') tick.dia = body.dia;
    if (typeof body.spo2 === 'number') tick.spo2 = body.spo2;
    if (typeof body.temp_c === 'number') tick.temp_c = body.temp_c;
    if (typeof body.hrv === 'number') tick.hrv = body.hrv;
    if (typeof body.glucose === 'number') tick.glucose = body.glucose;
    // store optional trend arrays in tick.bpTrend etc if present and numeric-only
    if (Array.isArray(body.bpTrend) && body.bpTrend.every((n) => typeof n === 'number')) tick.bpTrend = body.bpTrend as any;

    globalThis.latestIoMTick = tick as IoMTick;
    globalThis.externalModeStarted = true;

    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return new Response('Bad JSON', { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
}
