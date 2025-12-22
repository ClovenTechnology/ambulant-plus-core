// apps/clinician-app/app/api/findings/route.ts
import { createFinding, filterByQuery, patchFinding, store } from '../_workspacesStore';

export const runtime = 'nodejs';
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

type AnyObj = Record<string, any>;

function asTrimmedString(v: any) {
  return String(v ?? '').trim();
}

function asArray(v: any): any[] {
  return Array.isArray(v) ? v : [];
}

function validateDentalLocationIfPresent(location: any): string | null {
  if (!location || typeof location !== 'object') return null;

  // Only require toothId when the location is explicitly dental-tooth
  if (location.kind === 'dental_tooth') {
    const toothId = asTrimmedString(location.toothId);
    if (!toothId) return 'location.toothId is required for dental_tooth location';
  }
  return null;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const s = store();

  // allow GET by id via querystring
  const id = url.searchParams.get('id');
  if (id) {
    const item = s.findings.find((f: AnyObj) => String(f?.id) === String(id));
    if (!item) return json({ ok: false, message: 'not found' }, { status: 404 });
    return json({ ok: true, item });
  }

  let items = filterByQuery(s.findings, url.searchParams);

  // optional dental-specific filter (non-breaking for other specialties)
  const toothId = url.searchParams.get('toothId');
  if (toothId) items = items.filter((f: AnyObj) => f?.location?.toothId === toothId);

  return json({ ok: true, items });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as AnyObj | null;
  if (!body) return json({ ok: false, message: 'Invalid JSON body' }, { status: 400 });

  const patientId = asTrimmedString(body.patientId);
  const encounterId = asTrimmedString(body.encounterId);
  const specialty = asTrimmedString(body.specialty) || 'ent';
  const title = asTrimmedString(body.title);

  if (!patientId) return json({ ok: false, message: 'patientId is required' }, { status: 400 });
  if (!encounterId) return json({ ok: false, message: 'encounterId is required' }, { status: 400 });
  if (!title) return json({ ok: false, message: 'title is required' }, { status: 400 });

  const dentalErr = validateDentalLocationIfPresent(body.location);
  if (dentalErr) return json({ ok: false, message: dentalErr }, { status: 400 });

  // Normalize incoming payload so createFinding gets consistent shape
  const payload: AnyObj = {
    ...body,
    patientId,
    encounterId,
    specialty,
    title,
    status: body.status ?? 'draft',
    note: body.note ?? null,
    severity: body.severity ?? null,
    tags: asArray(body.tags),
    location: body.location ?? null,
    createdBy: body.createdBy ?? null,
    meta: body.meta ?? {},
  };

  const created = createFinding(payload);
  return json({ ok: true, item: created }, { status: 201 });
}

export async function PATCH(req: Request) {
  const url = new URL(req.url);
  const body = (await req.json().catch(() => ({}))) as AnyObj;

  // support id in body OR querystring (handy for some clients)
  const id = asTrimmedString(body?.id) || asTrimmedString(url.searchParams.get('id'));
  if (!id) return json({ ok: false, message: 'id is required' }, { status: 400 });

  // allow either {id, ...fields} or {id, patch:{...fields}}
  const patch = (body?.patch && typeof body.patch === 'object') ? body.patch : body;

  const dentalErr = validateDentalLocationIfPresent(patch.location);
  if (dentalErr) return json({ ok: false, message: dentalErr }, { status: 400 });

  const updated = patchFinding(id, patch);
  if (!updated) return json({ ok: false, message: 'not found' }, { status: 404 });

  return json({ ok: true, item: updated });
}
