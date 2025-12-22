// apps/admin-dashboard/app/clinicians/page.tsx
import Link from 'next/link';
import { cookies } from 'next/headers';
import ClinicianActions from './ClinicianActions';

export const dynamic = 'force-dynamic';

type Clinician = {
  id: string;
  userId?: string | null;
  displayName?: string | null;
  email?: string | null;
  phone?: string | null;
  specialty?: string | null;
  feeCents?: number | null;
  currency?: string | null;
  status?: string | null;
  trainingScheduledAt?: string | null;
  trainingCompleted?: boolean | null;
  createdAt?: string | null;
};

type FetchResult = { items: Clinician[]; error?: string };

async function fetchClinicians(status?: string): Promise<FetchResult> {
  const base =
    process.env.NEXT_PUBLIC_APIGW_BASE?.trim() ||
    'http://127.0.0.1:3010'; // 127.0.0.1 is often more reliable than localhost on Windows
  const url = new URL('/api/clinicians', base);
  if (status) url.searchParams.set('status', status);

  const cookieHeader = cookies().toString();

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        cookie: cookieHeader, // forward session for admin check
        accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('fetchClinicians non-OK', res.status, text);
      return { items: [], error: `Gateway responded ${res.status}` };
    }

    const data = await res.json().catch(() => ({}));
    const list = (data?.clinicians ?? data?.items ?? []) as Clinician[];
    return { items: Array.isArray(list) ? list : [] };
  } catch (e: any) {
    console.error('fetchClinicians failed', e?.message || e);
    return { items: [], error: 'fetch_failed' };
  }
}

function fmtMoney(feeCents?: number | null, currency = 'ZAR') {
  if (typeof feeCents !== 'number') return '—';
  try {
    // feeCents is already cents (e.g., 60000 = R600)
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(Math.round(feeCents / 100));
  } catch {
    return `R ${(feeCents / 100).toFixed(0)}`;
  }
}

export default async function AdminCliniciansPage() {
  const [pendingRes, activeRes] = await Promise.all([
    fetchClinicians('pending'),
    fetchClinicians('active'),
  ]);

  const pending = pendingRes.items;
  const active = activeRes.items;

  const anyError = pendingRes.error || activeRes.error;

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clinicians — Admin</h1>
        <div className="text-sm">
          <Link href="/" className="text-slate-600 underline">
            Back to admin home
          </Link>
        </div>
      </header>

      {anyError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Couldn’t reach the Gateway at{' '}
          <span className="font-mono">
            {process.env.NEXT_PUBLIC_APIGW_BASE || 'http://127.0.0.1:3010'}
          </span>
          . Ensure it’s running and that your env matches. (Error: {anyError})
        </div>
      )}

      {/* Pending */}
      <section className="bg-white border rounded p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Pending clinicians</h2>
          <div className="text-xs text-gray-500">{pending.length} waiting</div>
        </div>

        {pending.length === 0 ? (
          <div className="text-sm text-gray-600 mt-2">No pending clinicians.</div>
        ) : (
          <ul className="mt-3 space-y-3">
            {pending.map((c) => {
              const created =
                c.createdAt ? new Date(c.createdAt).toLocaleString() : '—';
              const scheduled =
                c.trainingScheduledAt
                  ? new Date(c.trainingScheduledAt).toLocaleString()
                  : null;

              return (
                <li
                  key={c.id}
                  className="border rounded p-3 flex flex-col md:flex-row md:items-start md:justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {c.displayName ?? c.userId ?? c.id}
                    </div>
                    <div className="text-sm text-gray-600">
                      {c.specialty ?? '—'}
                    </div>

                    <div className="mt-1 text-xs text-gray-500 space-x-3">
                      <span>Signed up: {created}</span>
                      {scheduled && <span>• Training: {scheduled}</span>}
                    </div>
                  </div>

                  <div className="shrink-0">
                    <ClinicianActions mode="pending" clinicianId={c.id} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Active */}
      <section className="bg-white border rounded p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Active clinicians</h2>
        </div>

        {active.length === 0 ? (
          <div className="text-sm text-gray-600 mt-2">No active clinicians.</div>
        ) : (
          <ul className="mt-3 space-y-3">
            {active.map((c) => {
              const fee = fmtMoney(c.feeCents ?? null, c.currency ?? 'ZAR');
              return (
                <li
                  key={c.id}
                  className="border rounded p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {c.displayName ?? c.userId ?? c.id}
                    </div>
                    <div className="text-sm text-gray-600">
                      {c.specialty ?? '—'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Consult fee: {fee}
                    </div>
                  </div>

                  <div className="shrink-0">
                    <ClinicianActions mode="active" clinicianId={c.id} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
