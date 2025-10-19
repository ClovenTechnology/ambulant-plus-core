// apps/admin-dashboard/app/clinicians/page.tsx
import React from 'react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

type Clinician = {
  id: string;
  userId?: string;
  displayName?: string | null;
  specialty?: string | null;
  feeCents?: number | null;
  status?: string | null;
  trainingScheduledAt?: string | null;
  trainingCompleted?: boolean | null;
  createdAt?: string | null;
};

// server-side fetch — uses server env ADMIN_API_KEY so secret is never exposed to client
async function fetchClinicians(status?: string): Promise<Clinician[]> {
  const base = process.env.NEXT_PUBLIC_PATIENT_BASE ?? 'http://localhost:3000';
  const url = new URL('/api/clinicians', base);
  if (status) url.searchParams.set('status', status);
  const res = await fetch(url.toString(), {
    headers: {
      'x-admin-key': process.env.ADMIN_API_KEY ?? 'b2f7e4d4089bfdf04e7f686d499037aa8d9e47d35e89f3f0c31b8dcd16a72647',
      'accept': 'application/json',
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    console.error('fetchClinicians failed', await res.text().catch(() => ''));
    return [];
  }
  const data = await res.json().catch(() => ({}));
  return Array.isArray(data?.clinicians) ? data.clinicians : data?.clinicians ?? [];
}

export default async function AdminCliniciansPage() {
  const pending = await fetchClinicians('pending');
  const active = await fetchClinicians('active');

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clinicians — Admin</h1>
        <div>
          <Link href="/" className="text-sm text-slate-600 underline">Back to admin home</Link>
        </div>
      </header>

      <section className="bg-white border rounded p-4">
        <h2 className="font-semibold">Pending clinicians</h2>
        {pending.length === 0 ? (
          <div className="text-sm text-gray-600 mt-2">No pending clinicians.</div>
        ) : (
          <ul className="mt-3 space-y-3">
            {pending.map(c => (
              <li key={c.id} className="border rounded p-3 flex justify-between items-start">
                <div>
                  <div className="font-medium">{c.displayName ?? c.userId}</div>
                  <div className="text-sm text-gray-600">{c.specialty ?? '—'}</div>
                  <div className="text-xs text-gray-500 mt-1">Signed up: {c.createdAt ? new Date(c.createdAt).toLocaleString() : '—'}</div>
                </div>

                <div className="flex gap-2">
                  <button
                    data-id={c.id}
                    className="approve-btn px-3 py-1 text-sm rounded bg-emerald-600 text-white"
                    onClick={async (ev) => {
                      // This is a client-side handler; keep it simple by calling admin route below.
                      const id = (ev.currentTarget as HTMLButtonElement).getAttribute('data-id')!;
                      const res = await fetch('/api/admin/clinicians/approve', {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({ id })
                      });
                      if (res.ok) {
                        // reload page
                        location.reload();
                      } else {
                        const txt = await res.text().catch(() => 'error');
                        alert('Approve failed: ' + txt);
                      }
                    }}
                  >
                    Approve
                  </button>

                  <button
                    data-id={c.id}
                    className="reject-btn px-3 py-1 text-sm rounded bg-rose-600 text-white"
                    onClick={async (ev) => {
                      const id = (ev.currentTarget as HTMLButtonElement).getAttribute('data-id')!;
                      const res = await fetch('/api/admin/clinicians/reject', {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({ id })
                      });
                      if (res.ok) location.reload(); else alert('Reject failed');
                    }}
                  >
                    Reject
                  </button>

                  <Link href={`/admin/clinicians/${c.id}`} className="px-3 py-1 rounded border text-sm">View</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-white border rounded p-4">
        <h2 className="font-semibold">Active clinicians</h2>
        {active.length === 0 ? (
          <div className="text-sm text-gray-600 mt-2">No active clinicians.</div>
        ) : (
          <ul className="mt-3 space-y-3">
            {active.map(c => (
              <li key={c.id} className="border rounded p-3 flex justify-between">
                <div>
                  <div className="font-medium">{c.displayName ?? c.userId}</div>
                  <div className="text-sm text-gray-600">{c.specialty ?? '—'}</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      const res = await fetch('/api/admin/clinicians/archive', {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({ id: c.id })
                      });
                      if (res.ok) location.reload(); else alert('Archive failed');
                    }}
                    className="px-3 py-1 rounded bg-amber-600 text-white text-sm"
                  >
                    Archive
                  </button>
                  <Link href={`/admin/clinicians/${c.id}`} className="px-3 py-1 rounded border text-sm">Manage</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
