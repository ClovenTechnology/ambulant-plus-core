// apps/clinician-app/app/api/revisions/route.ts
import { createRevision, filterByQuery, store } from '../_workspacesStore';

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
  let items = filterByQuery(s.revisions, url.searchParams);

  // newest first
  items = [...items].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  return json({ ok: true, items });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const created = createRevision(body);
  return json({ ok: true, item: created });
}
