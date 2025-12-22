// apps/clinician-app/app/api/annotations/route.ts
import { createAnnotation, filterByQuery, store } from '../_workspacesStore';

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

export async function GET(req: Request) {
  const url = new URL(req.url);
  const s = store();
  let items = filterByQuery(s.annotations, url.searchParams);

  const evidenceId = url.searchParams.get('evidenceId');
  if (evidenceId) items = items.filter((a: any) => a.evidenceId === evidenceId);

  return json({ ok: true, items });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  if (!body?.evidenceId) {
    return json({ ok: false, message: 'evidenceId is required' }, { status: 400 });
  }
  if (!body?.patientId) return json({ ok: false, message: 'patientId is required' }, { status: 400 });
  if (!body?.encounterId) return json({ ok: false, message: 'encounterId is required' }, { status: 400 });

  const dentalErr = validateDentalLocationIfPresent(body?.location);
  if (dentalErr) return json({ ok: false, message: dentalErr }, { status: 400 });

  const created = createAnnotation(body);
  return json({ ok: true, item: created });
}
