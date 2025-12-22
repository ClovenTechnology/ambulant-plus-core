// apps/api-gateway/app/api/insight/feedback/route.ts
import crypto from 'node:crypto';
import { prisma } from '@/src/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Modality = 'steth' | 'ecg' | 'ppg' | 'image' | 'other';

function inferModality(kindOrModality: string): Modality {
  const k = (kindOrModality || '').toLowerCase();
  if (k === 'steth' || k.includes('steth') || k.includes('pcm')) return 'steth';
  if (k === 'ecg' || k.includes('ecg')) return 'ecg';
  if (k === 'ppg' || k.includes('ppg')) return 'ppg';
  if (k === 'image' || k.includes('image') || k.includes('otoscope') || k.includes('photo') || k.includes('video')) return 'image';
  return 'other';
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as any;

  const predictionId = body?.predictionId ? String(body.predictionId) : '';
  if (!predictionId) {
    return new Response(JSON.stringify({ ok: false, error: 'missing_predictionId' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const modality = inferModality(String(body?.modality || body?.kind || 'other'));
  const encounterId = body?.encounterId ? String(body.encounterId) : null;
  const patientId = body?.patientId ? String(body.patientId) : null;
  const clinicianId = body?.clinicianId ? String(body.clinicianId) : null;
  const orgId = body?.orgId ? String(body.orgId) : 'org-default';

  const isCorrect = !!body?.isCorrect;
  const correctedLabel = body?.correctedLabel != null ? String(body.correctedLabel) : null;
  const originalLabel = body?.originalLabel != null ? String(body.originalLabel) : null;
  const comment = body?.comment != null ? String(body.comment) : null;

  // Actor identity is optional but helps QA auditing
  const actorRole = (req.headers.get('x-role') || body?.actorRole || 'unknown').toString();
  const actorId = (req.headers.get('x-uid') || body?.actorId || '').toString() || null;

  const ts = Date.now();
  const kind = `insight.feedback.${modality}`;

  const payload = {
    predictionId,
    modality,
    ts,
    isCorrect,
    originalLabel,
    correctedLabel,
    comment,
    actor: { role: actorRole, id: actorId },
    context: {
      encounterId,
      patientId,
      clinicianId,
    },
  };

  await prisma.runtimeEvent.create({
    data: {
      id: crypto.randomUUID(),
      ts: BigInt(ts),
      kind,
      encounterId,
      patientId,
      clinicianId,
      payload: JSON.stringify(payload),
      // feedback should be visible to clinicians (and optionally admins)
      targetPatientId: null,
      targetClinicianId: clinicianId,
      targetAdmin: true,
      orgId,
    },
  });

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json' },
  });
}
