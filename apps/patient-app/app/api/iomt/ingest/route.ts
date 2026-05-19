// apps/patient-app/app/api/iomt/ingest/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type IoMTick = {
  ts: string;

  // Core Health Monitor vitals
  hr?: number;
  sys?: number;
  dia?: number;
  spo2?: number;
  temp_c?: number;
  glucose?: number;
  ecg?: unknown;

  // Optional wearable/derived metrics
  hrv?: number;
  stress?: number;
  steps?: number;
  calories_kcal?: number;
  distance_km?: number;
  sitting_min?: number;
  sleep?: unknown;

  // Optional chart/trend arrays
  bpTrend?: number[];
};

declare global {
  // eslint-disable-next-line no-var
  var latestIoMTick: IoMTick | undefined;

  // eslint-disable-next-line no-var
  var externalModeStarted: boolean | undefined;
}

function corsHeaders(extra?: Record<string, string>) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    ...extra,
  };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders({
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    }),
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

function checkAuth(req: Request) {
  const auth = req.headers.get('authorization') || '';

  if (!auth.startsWith('Bearer ')) {
    return false;
  }

  const token = auth.slice(7).trim();
  const expected = process.env.IOMT_INGEST_TOKEN || '';

  return Boolean(token && expected && token === expected);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function readNumericArray(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const arr = value.filter(isFiniteNumber);

  return arr.length === value.length ? arr : undefined;
}

function hasAnyVital(body: Partial<IoMTick>) {
  return (
    body.hr != null ||
    body.sys != null ||
    body.dia != null ||
    body.spo2 != null ||
    body.temp_c != null ||
    body.hrv != null ||
    body.glucose != null ||
    body.stress != null ||
    body.ecg != null ||
    body.steps != null ||
    body.calories_kcal != null ||
    body.distance_km != null ||
    body.sitting_min != null ||
    body.sleep != null
  );
}

export async function POST(req: Request) {
  const allowUnauthInDev =
    process.env.NODE_ENV !== 'production' && !process.env.IOMT_INGEST_TOKEN;

  if (!allowUnauthInDev && !checkAuth(req)) {
    return json({ ok: false, error: 'unauthorized' }, 401);
  }

  try {
    const body = (await req.json()) as Partial<IoMTick>;

    if (!hasAnyVital(body)) {
      return json({ ok: false, error: 'no_vitals_in_payload' }, 400);
    }

    const tick: IoMTick = {
      ts: new Date().toISOString(),
    };

    if (isFiniteNumber(body.hr)) tick.hr = body.hr;
    if (isFiniteNumber(body.sys)) tick.sys = body.sys;
    if (isFiniteNumber(body.dia)) tick.dia = body.dia;
    if (isFiniteNumber(body.spo2)) tick.spo2 = body.spo2;
    if (isFiniteNumber(body.temp_c)) tick.temp_c = body.temp_c;
    if (isFiniteNumber(body.hrv)) tick.hrv = body.hrv;
    if (isFiniteNumber(body.glucose)) tick.glucose = body.glucose;
    if (isFiniteNumber(body.stress)) tick.stress = body.stress;
    if (isFiniteNumber(body.steps)) tick.steps = body.steps;
    if (isFiniteNumber(body.calories_kcal)) tick.calories_kcal = body.calories_kcal;
    if (isFiniteNumber(body.distance_km)) tick.distance_km = body.distance_km;
    if (isFiniteNumber(body.sitting_min)) tick.sitting_min = body.sitting_min;

    const bpTrend = readNumericArray(body.bpTrend);
    if (bpTrend) tick.bpTrend = bpTrend;

    /*
     * Keep this intentionally minimal:
     * - no patient name
     * - no clinician name
     * - no device owner metadata
     * - no free-text payload
     *
     * This endpoint only stores the latest numeric IoMT tick for live display.
     */
    globalThis.latestIoMTick = tick;
    globalThis.externalModeStarted = true;

    return json({ ok: true });
  } catch {
    return json({ ok: false, error: 'bad_json' }, 400);
  }
}