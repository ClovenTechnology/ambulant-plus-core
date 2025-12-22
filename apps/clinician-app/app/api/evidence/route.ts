// apps/clinician-app/app/api/evidence/route.ts
import { createEvidence, filterByQuery, patchEvidence, store } from '../_workspacesStore';

export const dynamic = 'force-dynamic';

function json(data: any, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    status: init?.status ?? 200,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      ...(init?.headers ?? {}),
    },
  });
}

function genJobId() {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function asTrimmedString(v: any) {
  return String(v ?? '').trim();
}

function validateDentalLocationIfPresent(location: any): string | null {
  if (!location || typeof location !== 'object') return null;
  if (location.kind === 'dental_tooth') {
    const toothId = asTrimmedString(location.toothId);
    if (!toothId) return 'location.toothId is required for dental_tooth location';
  }
  return null;
}

/**
 * SFU / live_capture workflow (design):
 * - UI posts evidence with meta.source="live_capture" and roomId/trackId/captureMode/etc.
 * - This endpoint stores the evidence + returns {jobId,status:"processing"} if url not available yet.
 * - A capture worker (later) can PATCH /api/evidence with {id,status:"ready",url,thumbnailUrl,jobId}.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const s = store();
  let items = filterByQuery(s.evidence, url.searchParams);

  // optional filters (dental compatibility)
  const toothId = url.searchParams.get('toothId');
  if (toothId) items = items.filter((e: any) => e.location?.toothId === toothId);

  const findingId = url.searchParams.get('findingId');
  if (findingId) items = items.filter((e: any) => (e.findingId ?? null) === findingId);

  return json({ ok: true, items });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  // universal required
  if (!body?.kind) return json({ ok: false, message: 'kind is required' }, { status: 400 });
  if (!body?.device) return json({ ok: false, message: 'device is required' }, { status: 400 });
  if (!body?.patientId) return json({ ok: false, message: 'patientId is required' }, { status: 400 });
  if (!body?.encounterId) return json({ ok: false, message: 'encounterId is required' }, { status: 400 });

  // dental-only validation when location indicates dental tooth
  const dentalErr = validateDentalLocationIfPresent(body?.location);
  if (dentalErr) return json({ ok: false, message: dentalErr }, { status: 400 });

  const meta = body?.meta ?? {};
  const isLive = meta?.source === 'live_capture';

  // If live_capture and url not ready, auto-generate jobId and mark as processing
  if (isLive && !body.url) {
    body.status = body.status ?? 'processing';
    body.jobId = body.jobId ?? genJobId();
    body.url = body.url ?? null;
    body.thumbnailUrl = body.thumbnailUrl ?? null;
    body.meta = { ...meta, requestedAt: new Date().toISOString() };
  }

  const created = createEvidence(body);
  return json({ ok: true, item: created });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? '');
  if (!id) return json({ ok: false, message: 'id is required' }, { status: 400 });

  // dental-only validation when location indicates dental tooth
  const dentalErr = validateDentalLocationIfPresent(body?.location);
  if (dentalErr) return json({ ok: false, message: dentalErr }, { status: 400 });

  const updated = patchEvidence(id, body);
  if (!updated) return json({ ok: false, message: 'not found' }, { status: 404 });

  return json({ ok: true, item: updated });
}
