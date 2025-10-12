// Accept POSTed IoMT packets and feed the live stream.
// After first valid POST, the stream switches to EXTERNAL mode permanently.
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
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function POST(req: Request) {
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
    globalThis.latestIoMTick = { ...(body as IoMTick), ts: nowIso };
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
