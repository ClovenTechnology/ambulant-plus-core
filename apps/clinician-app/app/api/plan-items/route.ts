// apps/clinician-app/app/api/plan-items/route.ts
import { createPlanItem, filterByQuery, patchPlanItem, store } from '../_workspacesStore';

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

export async function GET(req: Request) {
  const url = new URL(req.url);
  const s = store();
  let items = filterByQuery(s.planItems, url.searchParams);

  items = [...items].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return json({ ok: true, items });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (!body?.label) return json({ ok: false, message: 'label is required' }, { status: 400 });

  const created = createPlanItem(body);
  return json({ ok: true, item: created });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id ?? '');
  if (!id) return json({ ok: false, message: 'id is required' }, { status: 400 });

  const updated = patchPlanItem(id, body);
  if (!updated) return json({ ok: false, message: 'not found' }, { status: 404 });

  return json({ ok: true, item: updated });
}
