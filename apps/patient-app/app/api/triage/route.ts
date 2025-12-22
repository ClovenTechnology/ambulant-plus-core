// apps/patient-app/app/api/triage/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Dev in-memory audit log (redacted, limited)
const IN_MEMORY_TRIAGE_LOG: { t: string; vitals: Record<string, string | number>; symptoms: string[]; source?: string }[] = [];
const MAX_LOG = 200;

/** Utility: safe push to in-memory log (redacted) */
function pushLog(entry: { vitals: Record<string, string | number>; symptoms: string[]; source?: string }) {
  IN_MEMORY_TRIAGE_LOG.push({ t: new Date().toISOString(), ...entry });
  if (IN_MEMORY_TRIAGE_LOG.length > MAX_LOG) IN_MEMORY_TRIAGE_LOG.shift();
}

/** Fetch wrapper: timeout + retries */
async function fetchWithTimeoutAndRetry(url: string, opts: RequestInit = {}, { timeout = 4000, retries = 1 } = {}) {
  let attempt = 0;
  while (true) {
    attempt++;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, { signal: controller.signal, ...opts });
      clearTimeout(id);
      return res;
    } catch (err) {
      clearTimeout(id);
      if (attempt > retries) throw err;
      // backoff a bit
      await new Promise((r) => setTimeout(r, 200 * attempt));
    }
  }
}

/** Minimal model-response schema validator */
function validateModelResponse(obj: any) {
  if (!obj || typeof obj !== 'object') return false;
  if (typeof obj.score !== 'number' || Number.isNaN(obj.score)) return false;
  if (!Array.isArray(obj.diagnoses)) return false;
  return true;
}

/** Server-side safe fallback mock (non-diagnostic, patient-facing) */
async function mockAnalyze(payload: any) {
  await new Promise((r) => setTimeout(r, 300));
  const vitals = Array.isArray(payload.vitals) ? payload.vitals : [];
  const symptoms = payload.symptoms || {};
  const hr = vitals.find((v: any) => v.key === 'hr')?.value ?? null;
  const spo2 = vitals.find((v: any) => v.key === 'spo2')?.value ?? null;
  const temp = vitals.find((v: any) => v.key === 'temp')?.value ?? null;

  let score = 90;
  const symptomCount = Object.values(symptoms).filter(Boolean).length;
  score -= symptomCount * 6;
  if (typeof hr === 'number') { if (hr > 100) score -= Math.min(18, Math.round((hr - 80) * 0.6)); if (hr < 50) score -= 8; }
  if (typeof spo2 === 'number') { if (spo2 < 92) score -= 30; else if (spo2 < 95) score -= 8; }
  if (typeof temp === 'number') { if (temp >= 38) score -= 18; else if (temp >= 37.5) score -= 6; }
  score = Math.max(0, Math.min(100, Math.round(score)));

  const concerns: { name: string; prob: number }[] = [];
  if (spo2 !== null && spo2 < 92) concerns.push({ name: 'Low oxygen (SpO₂)', prob: 0.85 });
  if (temp !== null && temp >= 38) concerns.push({ name: 'Fever / infection risk', prob: 0.6 });
  if (typeof hr === 'number' && hr > 110) concerns.push({ name: 'Tachycardia (elevated HR)', prob: 0.5 });
  if (concerns.length === 0) concerns.push({ name: 'Wellness baseline', prob: 0.9 });

  const recommendations: string[] = [];
  if (spo2 !== null && spo2 < 92) recommendations.push('Low oxygen detected — seek urgent medical assessment or call your clinician.');
  if (temp !== null && temp >= 38) recommendations.push('Fever present — rest, hydrate, consider antipyretic as appropriate and monitor.');
  if ((symptoms.fatigue || (typeof hr === 'number' && hr > 90)) && score < 85) recommendations.push('Aim for hydration and light rest; monitor symptoms over the next 24 hours.');
  if (score > 80) recommendations.push('Vitals look stable. Keep hydrated, sleep well, and maintain balanced meals.');

  const explanations = [];
  explanations.push({ feature: 'Symptom count', impact: -Math.min(0.5, symptomCount * 0.07), note: `${symptomCount} active` });
  if (typeof hr === 'number') explanations.push({ feature: 'Resting HR', impact: -(hr - 60) / 400, note: `${hr} bpm` });
  if (typeof spo2 === 'number') explanations.push({ feature: 'SpO₂', impact: (Math.min(100, spo2) - 95) / 200, note: `${spo2}%` });
  if (typeof temp === 'number') explanations.push({ feature: 'Temperature', impact: -(temp - 36.5) / 10, note: `${temp} °C` });

  return { score, diagnoses: concerns, recommendations, explanations };
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const payload = { ...body };

    // If client didn't include vitals, use latest IoMT tick (if available)
    if ((!Array.isArray(payload.vitals) || payload.vitals.length === 0) && (globalThis as any).latestIoMTick) {
      const tick = (globalThis as any).latestIoMTick;
      const vitals: any[] = [];
      if (tick.hr != null) vitals.push({ key: 'hr', label: 'Heart Rate', value: tick.hr, unit: 'bpm' });
      if (tick.spo2 != null) vitals.push({ key: 'spo2', label: 'SpO₂', value: tick.spo2, unit: '%' });
      if (tick.sys != null && tick.dia != null) vitals.push({ key: 'bp', label: 'BP', value: `${tick.sys}/${tick.dia}`, unit: 'mmHg', trend: tick.bpTrend ?? undefined });
      if (tick.temp_c != null) vitals.push({ key: 'temp', label: 'Temp', value: tick.temp_c, unit: '°C' });
      payload.vitals = vitals;
      payload.meta = { ...(payload.meta || {}), source: 'iomt-latest' };
    }

    // Redacted log entry for dev inspection (no PII)
    const redactedVitals: Record<string, string | number> = {};
    (payload.vitals || []).forEach((v: any) => {
      const key = String(v.key || v.label || 'unknown');
      const val = typeof v.value === 'number' ? Number(v.value) : String(v.value || '').slice(0, 16);
      redactedVitals[key] = val;
    });
    pushLog({ vitals: redactedVitals, symptoms: Object.keys(payload.symptoms || {}).filter((k) => !!payload.symptoms[k]), source: payload.meta?.source });

    // If MODEL_URL is configured, try calling it server-side with timeout+retry and validate response.
    if (process.env.MODEL_URL) {
      try {
        const modelRes = await fetchWithTimeoutAndRetry(process.env.MODEL_URL, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(process.env.MODEL_API_KEY ? { Authorization: `Bearer ${process.env.MODEL_API_KEY}` } : {}),
          },
          body: JSON.stringify({ vitals: payload.vitals, symptoms: payload.symptoms, meta: payload.meta || {} }),
        }, { timeout: 5000, retries: 1 });

        if (modelRes && modelRes.ok) {
          const modelJson = await modelRes.json().catch(() => null);
          if (validateModelResponse(modelJson)) {
            // Only return sanitized fields to client
            const out = {
              score: Math.max(0, Math.min(100, Number(modelJson.score))),
              diagnoses: Array.isArray(modelJson.diagnoses) ? modelJson.diagnoses.slice(0, 6) : [],
              recommendations: Array.isArray(modelJson.recommendations) ? modelJson.recommendations : [],
              explanations: Array.isArray(modelJson.explanations) ? modelJson.explanations : [],
              backend: 'model',
            };
            return NextResponse.json(out);
          } else {
            // invalid shape -> fallback to mock
            // eslint-disable-next-line no-console
            console.warn('Model returned invalid schema, falling back to mock');
          }
        } else {
          // eslint-disable-next-line no-console
          console.warn('Model fetch failed or non-200, falling back to mock', modelRes?.status);
        }
      } catch (err) {
        // Model call timed out or network failure -> fallback
        // eslint-disable-next-line no-console
        console.warn('Model call error; falling back to mock', err);
      }
    }

    // fallback to built-in mock analyzer
    const out = await mockAnalyze(payload);

    // Fire-and-forget: request insight core if configured (non-blocking)
    if (process.env.INSIGHTCORE_URL) {
      try {
        fetch('/api/insightcore', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ patientName: payload.meta?.patientName ?? 'patient', vitals: payload.vitals }),
        }).catch(() => undefined);
      } catch {}
    }

    return NextResponse.json({ ...out, backend: 'mock' });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('triage POST error', err);
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}

export async function GET() {
  // admin/dev-only peek at logs (redacted). Keep gated if needed.
  return NextResponse.json({ ok: true, count: IN_MEMORY_TRIAGE_LOG.length, logs: IN_MEMORY_TRIAGE_LOG.slice(-50) });
}
