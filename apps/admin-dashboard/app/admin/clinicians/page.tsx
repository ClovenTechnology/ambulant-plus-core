// apps/admin-dashboard/app/admin/clinicians/page.tsx
// server component — protected admin page to list pending clinicians
import React from 'react';
import Link from 'next/link';
import { headers } from 'next/headers';
import { verifyAdminToken } from '@/src/lib/auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Clinician = {
  id: string;
  userId?: string;
  displayName?: string;
  specialty?: string;
  feeCents?: number;
  status?: string;
  trainingScheduledAt?: string | null;
  trainingCompleted?: boolean;
  createdAt?: string;
};

type CliniciansResp =
  | { clinicians?: Clinician[]; ok?: boolean }
  | { items?: Clinician[]; total?: number; page?: number; pageSize?: number }
  | any;

async function fetchClinicians(status?: string, adminKey?: string) {
  const gateway =
    process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ??
    process.env.APIGW_BASE ??
    process.env.GATEWAY_URL ??
    process.env.NEXT_PUBLIC_PATIENT_BASE ??
    'http://localhost:3010';

  const url = new URL(`${gateway}/api/clinicians`);
  if (status) url.searchParams.set('status', status);

  // Make sure we get enough rows (your gateway defaults to 20)
  url.searchParams.set('page', '1');
  url.searchParams.set('pageSize', '100');

  const headersObj: Record<string, string> = { 'content-type': 'application/json' };
  if (adminKey) headersObj['x-admin-key'] = adminKey;

  const res = await fetch(url.toString(), { headers: headersObj, cache: 'no-store' });
  const js = (await res.json().catch(() => ({}))) as CliniciansResp;

  if (!res.ok || js?.ok === false) {
    const txt = await res.text().catch(() => '');
    throw new Error(js?.error || `Clinicians fetch failed: ${res.status} ${txt}`);
  }

  const items: Clinician[] = js?.items ?? js?.clinicians ?? [];
  const meta = {
    total: typeof js?.total === 'number' ? js.total : items.length,
    page: typeof js?.page === 'number' ? js.page : 1,
    pageSize: typeof js?.pageSize === 'number' ? js.pageSize : items.length,
  };

  return { items, meta };
}

export default async function AdminCliniciansPage() {
  const h = headers();
  const authHeader = h.get('authorization') || h.get('Authorization') || null;

  const v = await verifyAdminToken(authHeader ?? undefined);
  if (!v.ok) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-bold">Admin — Clinicians</h1>
        <div className="mt-4 text-sm text-rose-600">Access denied: {v.error}</div>
        <div className="mt-3 text-sm">
          To access this page you must sign in with an admin Auth0 account and provide a valid Access Token.
        </div>
      </main>
    );
  }

  const adminKey = process.env.ADMIN_API_KEY ?? '';
  let clinicians: Clinician[] = [];
  let meta: { total: number; page: number; pageSize: number } | null = null;

  try {
    const out = await fetchClinicians('pending', adminKey);
    clinicians = out.items;
    meta = out.meta;
  } catch (err) {
    console.error('fetchClinicians error', err);
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Admin — Clinicians</h1>
          <div className="text-sm text-gray-600">Signed in as admin</div>
          {meta && (
            <div className="mt-1 text-xs text-gray-500">
              Showing {clinicians.length} of {meta.total} (page {meta.page}, pageSize {meta.pageSize})
            </div>
          )}
        </div>

        <Link
          href="/admin/clinicians/onboarding"
          className="rounded border bg-white px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50"
        >
          Onboarding board
        </Link>
      </header>

      <section className="mt-6 space-y-4">
        <div className="text-sm text-gray-700">Pending clinicians awaiting approval</div>

        {clinicians.length === 0 ? (
          <div className="p-4 border rounded bg-white text-sm text-gray-500">No pending clinicians.</div>
        ) : (
          <ul className="space-y-2">
            {clinicians.map((c) => (
              <li key={c.id} className="border rounded p-3 bg-white">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{c.displayName ?? c.userId ?? c.id}</div>
                    <div className="text-xs text-gray-500">{c.specialty ?? '—'}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/clinicians/${encodeURIComponent(c.id)}`}
                      className="px-3 py-1 rounded border bg-white text-gray-800 text-sm hover:bg-gray-50"
                    >
                      View
                    </Link>
                    <div className="text-xs text-gray-600">
                      {c.createdAt ? new Date(c.createdAt).toLocaleString() : ''}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <form action="/api/admin/clinicians/approve" method="post">
                    <input type="hidden" name="id" value={c.id} />
                    <button type="submit" className="px-3 py-1 rounded bg-emerald-600 text-white text-sm">
                      Approve
                    </button>
                  </form>

                  <form action="/api/admin/clinicians/reject" method="post">
                    <input type="hidden" name="id" value={c.id} />
                    <button type="submit" className="px-3 py-1 rounded bg-rose-600 text-white text-sm">
                      Reject
                    </button>
                  </form>

                  <form action="/api/admin/clinicians/disable" method="post">
                    <input type="hidden" name="id" value={c.id} />
                    <button type="submit" className="px-3 py-1 rounded bg-gray-800 text-white text-sm">
                      Disable
                    </button>
                  </form>

                  <form action="/api/admin/clinicians/archive" method="post">
                    <input type="hidden" name="id" value={c.id} />
                    <button type="submit" className="px-3 py-1 rounded bg-slate-600 text-white text-sm">
                      Archive
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
