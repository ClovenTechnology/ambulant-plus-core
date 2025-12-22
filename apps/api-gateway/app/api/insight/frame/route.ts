// apps/api-gateway/app/api/insight/frame/route.ts
import crypto from 'node:crypto';
import { prisma } from '@/src/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

declare const global: any;
if (!global.__INSIGHT_CLIENTS__) global.__INSIGHT_CLIENTS__ = [];
if (!global.__INSIGHT_MODEL_CACHE__) global.__INSIGHT_MODEL_CACHE__ = {};
type Client = { id: string; session: string; controller: ReadableStreamDefaultController<Uint8Array> };
const getClients = (): Client[] => global.__INSIGHT_CLIENTS__ || [];

function sse(data: any, event?: string) {
  const head = event ? `event: ${event}\n` : '';
  return new TextEncoder().encode(`${head}data: ${JSON.stringify(data)}\n\n`);
}

type Modality = 'steth' | 'ecg' | 'ppg' | 'image' | 'other';

function inferModality(kindRaw: string): Modality {
  const k = (kindRaw || '').toLowerCase();
  if (k.includes('steth') || k === 'pcm' || k.includes('pcm')) return 'steth';
  if (k.includes('ecg')) return 'ecg';
  if (k.includes('ppg')) return 'ppg';
  if (k.includes('photo') || k.includes('image') || k.includes('video') || k.includes('otoscope')) return 'image';
  return 'other';
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

async function getLatestModelFor(modality: Modality, orgId?: string | null) {
  // cache for 30s to avoid DB hit on every frame
  const key = `${orgId || 'org-default'}:${modality}`;
  const cache = global.__INSIGHT_MODEL_CACHE__ as Record<
    string,
    { fetchedAt: number; modelVersion: string; weights: Record<string, number> }
  >;

  const now = Date.now();
  const cached = cache[key];
  if (cached && now - cached.fetchedAt < 30_000) return cached;

  const kind = `insight.model.reweighted.${modality}`;
  const ev = await prisma.runtimeEvent.findFirst({
    where: {
      kind,
      ...(orgId ? { orgId } : {}),
    },
    orderBy: { ts: 'desc' },
  });

  let modelVersion = 'v0-demo';
  let weights: Record<string, number> = {};

  if (ev?.payload) {
    try {
      const p = JSON.parse(ev.payload);
      if (p?.modelVersion) modelVersion = String(p.modelVersion);
      if (p?.weights && typeof p.weights === 'object') weights = p.weights;
    } catch {}
  }

  cache[key] = { fetchedAt: now, modelVersion, weights };
  return cache[key];
}

async function persistInsightEvent(args: {
  ts: number;
  modality: Modality;
  kindRaw: string;
  predictionId: string;
  session: string;
  encounterId?: string | null;
  patientId?: string | null;
  clinicianId?: string | null;
  orgId?: string | null;
  annotation: any;
  modelVersion: string;
}) {
  const {
    ts,
    modality,
    kindRaw,
    predictionId,
    session,
    encounterId,
    patientId,
    clinicianId,
    orgId,
    annotation,
    modelVersion,
  } = args;

  const eventKind = `insight.ai.${modality}`;

  const payload = {
    predictionId,
    sessionId: session,
    modality,
    sourceKind: kindRaw,
    ts,
    modelVersion,
    annotation,
  };

  await prisma.runtimeEvent.create({
    data: {
      id: crypto.randomUUID(),
      ts: BigInt(ts),
      kind: eventKind,
      encounterId: encounterId || null,
      patientId: patientId || null,
      clinicianId: clinicianId || null,
      payload: JSON.stringify(payload),
      targetPatientId: patientId || null,
      targetClinicianId: clinicianId || null,
      targetAdmin: false,
      orgId: orgId || 'org-default',
    },
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type, authorization',
    },
  });
}

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as any;
  if (!b || !b.kind) {
    return new Response(JSON.stringify({ error: 'bad_request' }), {
      status: 400,
      headers: { 'Access-Control-Allow-Origin': '*', 'content-type': 'application/json' },
    });
  }

  const session = b.sessionId || b.roomId || b.session || 'default';
  const kindRaw = String(b.kind);
  const modality = inferModality(kindRaw);

  const ts = Number.isFinite(b.ts) ? Number(b.ts) : Date.now();
  const sampleRate = b.sampleRate;
  const cadenceHz = b.cadenceHz;
  const payloadB64 = b.payloadB64 || (typeof b.payload === 'string' ? b.payload : undefined);
  const mime =
    b.mime || (kindRaw.toLowerCase().includes('photo') || kindRaw.toLowerCase().includes('image') ? 'image/jpeg' : undefined);

  // Optional context (we persist these so patient/clinician can see the insight later)
  const patientId = b.patientId ? String(b.patientId) : null;
  const clinicianId = b.clinicianId ? String(b.clinicianId) : null;
  const encounterId = b.encounterId ? String(b.encounterId) : null;
  const orgId = b.orgId ? String(b.orgId) : 'org-default';

  // --- Lightweight demo annotation (you can swap later for real model output) ---
  let annotation: any = null;
  if (modality === 'steth') {
    annotation = { type: 'audio', label: 'murmur: none', conf: 0.92 };
  } else if (modality === 'ecg') {
    annotation = { type: 'ecg', label: 'rhythm: sinus', hr: 72, arrhythmia: 'none', conf: 0.88 };
  } else if (modality === 'ppg') {
    annotation = { type: 'ppg', label: 'signal ok', spo2_est: 97, hr: 70, conf: 0.75 };
  } else if (modality === 'image') {
    annotation = { type: 'image', label: 'no otitis detected', conf: 0.81 };
  }

  // --- Apply latest weights (the “model reweighted” workflow) ---
  const { modelVersion, weights } = await getLatestModelFor(modality, orgId);
  const predictionId = crypto.randomUUID();

  if (annotation && typeof annotation === 'object') {
    annotation.predictionId = predictionId;
    annotation.modelVersion = modelVersion;

    if (typeof annotation.conf === 'number' && typeof annotation.label === 'string') {
      const w = typeof weights[annotation.label] === 'number' ? weights[annotation.label] : 1.0;
      annotation.conf = clamp(annotation.conf * w, 0, 1);
      annotation.weightApplied = w;
    }
  }

  // --- Broadcast raw frame + annotation to SSE clients ---
  for (const c of getClients()) {
    if (c.session === session) {
      try {
        c.controller.enqueue(sse({ kind: kindRaw, modality, ts, sampleRate, cadenceHz, b64: payloadB64, mime }, 'frame'));
        if (annotation) c.controller.enqueue(sse({ kind: kindRaw, modality, ts, annotation }, 'ai'));
      } catch {}
    }
  }

  // --- Persist the AI insight for patient/clinician history ---
  // Only persist if we have an annotation and at least one target (patient/clinician), else it’s just a raw stream.
  if (annotation && (patientId || clinicianId)) {
    try {
      await persistInsightEvent({
        ts,
        modality,
        kindRaw,
        predictionId,
        session,
        encounterId,
        patientId,
        clinicianId,
        orgId,
        annotation,
        modelVersion,
      });
    } catch {
      // don’t fail ingestion because persistence failed
    }
  }

  return new Response(JSON.stringify({ ok: true, predictionId, modelVersion, annotation }), {
    headers: { 'content-type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}
