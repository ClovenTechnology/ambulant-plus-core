// server component — protected admin page to list pending clinicians
import React from 'react';
import { headers, cookies } from 'next/headers';
import { verifyAdminToken } from '@/src/lib/auth'; // adjust path if using different alias

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

async function fetchClinicians(status?: string, adminKey?: string) {
  const base = process.env.NEXT_PUBLIC_PATIENT_BASE ?? 'http://localhost:3000';
  const url = new URL(`${base}/api/clinicians`);
  if (status) url.searchParams.set('status', status);
  const headersObj: Record<string,string> = { 'Content-Type': 'application/json' };
  if (adminKey) headersObj['x-admin-key'] = adminKey;
  const res = await fetch(url.toString(), { headers: headersObj, cache: 'no-store' });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Clinicians fetch failed: ${res.status} ${txt}`);
  }
  const json = await res.json();
  return json?.clinicians ?? [];
}

export default async function AdminCliniciansPage() {
  // read incoming Authorization header from the browser (server-side) or cookie
  const h = headers();
  const authHeader = h.get('authorization') || h.get('Authorization') || null;

  // Verify token
  const v = await verifyAdminToken(authHeader ?? undefined);
  if (!v.ok) {
    // show unauthorized and instructions (do not expose secrets)
    return (
      <main className="p-6">
        <h1 className="text-2xl font-bold">Admin — Clinicians</h1>
        <div className="mt-4 text-sm text-rose-600">Access denied: {v.error}</div>
        <div className="mt-3 text-sm">
          To access this page you must sign in with an admin Auth0 account and provide a valid Access Token.
          Use Auth0 Universal Login or your admin client to obtain a token containing the <code>admin</code> role/scope.
        </div>
        <div className="mt-3 text-xs text-gray-500">
          Example (dev): set <code>Authorization: Bearer &lt;TOKEN&gt;</code> in the browser devtools request header or
          use a small client to fetch a token then navigate here.
        </div>
      </main>
    );
  }

  // fetch clinicians server-side using server-only ADMIN_API_KEY (keeps it off the browser)
  const adminKey = process.env.ADMIN_API_KEY;
  let clinicians: Clinician[] = [];
  try {
    clinicians = await fetchClinicians('pending', adminKey);
  } catch (err) {
    console.error('fetchClinicians error', err);
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin — Clinicians</h1>
        <div className="text-sm text-gray-600">Signed in as admin</div>
      </header>

      <section className="mt-6 space-y-4">
        <div className="text-sm text-gray-700">Pending clinicians awaiting approval</div>
        {clinicians.length === 0 ? (
          <div className="p-4 border rounded bg-white text-sm text-gray-500">No pending clinicians.</div>
        ) : (
          <ul className="space-y-2">
            {clinicians.map((c) => (
              <li key={c.id} className="border rounded p-3 bg-white">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{c.displayName ?? c.userId}</div>
                    <div className="text-xs text-gray-500">{c.specialty ?? '—'}</div>
                  </div>
                  <div className="text-xs text-gray-600">{c.createdAt ? new Date(c.createdAt).toLocaleString() : ''}</div>
                </div>
                <div className="mt-3 flex gap-2">
                  <form action={`/api/admin/clinicians/approve`} method="post">
                    {/* These server-side admin API routes should exist and accept admin key */}
                    <input type="hidden" name="id" value={c.id} />
                    <button type="submit" className="px-3 py-1 rounded bg-emerald-600 text-white text-sm">Approve</button>
                  </form>
                  <form action={`/api/admin/clinicians/reject`} method="post">
                    <input type="hidden" name="id" value={c.id} />
                    <button type="submit" className="px-3 py-1 rounded bg-rose-600 text-white text-sm">Reject</button>
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
