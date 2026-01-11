// apps/admin-dashboard/app/clinicians/[id]/page.tsx
import Link from 'next/link';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import ClinicianActions from '../ClinicianActions';

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
  const base = process.env.NEXT_PUBLIC_APIGW_BASE?.trim() || 'http://127.0.0.1:3010';
  const url = new URL('/api/clinicians', base);
  if (status) url.searchParams.set('status', status);

  const cookieHeader = cookies().toString();

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { cookie: cookieHeader, accept: 'application/json' },
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

async function fetchClinicianById(id: string): Promise<{ item?: Clinician; error?: string }> {
  const base = process.env.NEXT_PUBLIC_APIGW_BASE?.trim() || 'http://127.0.0.1:3010';
  const url = new URL(`/api/clinicians/${encodeURIComponent(id)}`, base);
  const cookieHeader = cookies().toString();

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { cookie: cookieHeader, accept: 'application/json' },
      cache: 'no-store',
    });

    if (!res.ok) return { error: `no_single_endpoint_${res.status}` };

    const data = await res.json().catch(() => ({}));
    const item = (data?.clinician ?? data?.item ?? data) as Clinician;
    if (!item || !item.id) return { error: 'bad_payload' };
    return { item };
  } catch (e: any) {
    return { error: e?.message || 'fetch_failed' };
  }
}

/* Demo */
const DEMO_PENDING: Clinician[] = [
  {
    id: 'demo-p-1',
    displayName: 'Dr Lindiwe Maseko',
    email: 'l.maseko@example.com',
    phone: '+27 71 555 0101',
    specialty: 'General Practice',
    status: 'pending',
    trainingScheduledAt: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString(),
    trainingCompleted: false,
    createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
  },
];
const DEMO_ACTIVE: Clinician[] = [
  {
    id: 'demo-a-1',
    displayName: 'Dr Thabo Molefe',
    email: 't.molefe@example.com',
    phone: '+27 74 555 0104',
    specialty: 'Family Medicine',
    status: 'active',
    feeCents: 65000,
    currency: 'ZAR',
    trainingCompleted: true,
    createdAt: new Date(Date.now() - 22 * 24 * 3600 * 1000).toISOString(),
  },
];

function fmtMoney(feeCents?: number | null, currency = 'ZAR') {
  if (typeof feeCents !== 'number') return '—';
  try {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(Math.round(feeCents / 100));
  } catch {
    return `R ${(feeCents / 100).toFixed(0)}`;
  }
}

function safeDate(s?: string | null) {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function fmtDateTimeShort(s?: string | null) {
  const d = safeDate(s);
  if (!d) return '—';
  try {
    return new Intl.DateTimeFormat('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

function initials(name?: string | null) {
  const t = (name ?? '').trim();
  if (!t) return 'CL';
  const parts = t.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? 'C';
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : parts[0]?.[1];
  return (a + (b ?? 'L')).toUpperCase();
}

type Tone = 'slate' | 'amber' | 'emerald' | 'blue';

function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: Tone }) {
  const tones: Record<Tone, string> = {
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
    amber: 'bg-amber-100 text-amber-800 ring-amber-200',
    emerald: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
    blue: 'bg-blue-100 text-blue-800 ring-blue-200',
  };
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        tones[tone],
      ].join(' ')}
    >
      {children}
    </span>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm text-slate-900 break-words">{value}</div>
    </div>
  );
}

export default async function ClinicianDetailPage({ params }: { params: { id: string } }) {
  const id = decodeURIComponent(params.id);

  // Try single endpoint first (if it exists)
  const direct = await fetchClinicianById(id);

  // Fallback to lists if no single endpoint / not found
  const [pendingRes, activeRes] = await Promise.all([fetchClinicians('pending'), fetchClinicians('active')]);
  const apiTotal = pendingRes.items.length + activeRes.items.length;
  const useDemo = apiTotal === 0;

  const all = useDemo ? [...DEMO_PENDING, ...DEMO_ACTIVE] : [...pendingRes.items, ...activeRes.items];
  const found =
    direct.item ??
    all.find((c) => c.id === id) ??
    null;

  const anyError = direct.error || pendingRes.error || activeRes.error;

  if (!found) {
    return (
      <main className="p-6 max-w-4xl mx-auto space-y-4">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Clinician</h1>
          <Link href="/clinicians" className="text-sm text-slate-600 underline underline-offset-4">
            Back to clinicians
          </Link>
        </header>

        <div className="rounded-xl border bg-white p-4 text-sm text-slate-700">
          Clinician not found. {anyError ? <span className="opacity-80">(Debug: {String(anyError)})</span> : null}
        </div>
      </main>
    );
  }

  const statusLower = (found.status ?? '').toLowerCase();
  const mode: 'pending' | 'active' = statusLower === 'pending' ? 'pending' : 'active';
  const isDemo = useDemo || found.id.startsWith('demo-');

  const name = found.displayName ?? found.userId ?? found.id;
  const fee = fmtMoney(found.feeCents ?? null, found.currency ?? 'ZAR');

  return (
    <main className="p-6 max-w-4xl mx-auto space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-slate-100 ring-1 ring-slate-200 flex items-center justify-center text-sm font-semibold text-slate-700">
              {initials(found.displayName)}
            </div>

            <div className="min-w-0">
              <h1 className="text-xl font-bold truncate">{name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge tone={mode === 'pending' ? 'amber' : 'emerald'}>{mode === 'pending' ? 'Pending' : 'Active'}</Badge>
                {found.status && <Badge tone="slate">{found.status}</Badge>}
                {isDemo && <Badge tone="blue">Demo</Badge>}
              </div>
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-500 font-mono break-all">{found.id}</div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <Link href="/clinicians" className="text-sm text-slate-600 underline underline-offset-4">
            Back to clinicians
          </Link>
          <div className={isDemo ? 'opacity-60 pointer-events-none' : ''}>
            <ClinicianActions mode={mode} clinicianId={found.id} />
          </div>
        </div>
      </header>

      {anyError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-medium">Note</div>
          <div className="mt-1 opacity-90">Some lookups failed (ok for now): {String(anyError)}</div>
        </div>
      )}

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Specialty" value={found.specialty ?? '—'} />
        <Field label="Consult fee" value={fee} />
        <Field
          label="Email"
          value={
            found.email ? (
              <a className="underline underline-offset-4" href={`mailto:${found.email}`}>
                {found.email}
              </a>
            ) : (
              '—'
            )
          }
        />
        <Field
          label="Phone"
          value={
            found.phone ? (
              <a className="underline underline-offset-4" href={`tel:${found.phone}`}>
                {found.phone}
              </a>
            ) : (
              '—'
            )
          }
        />
        <Field label="Signed up" value={fmtDateTimeShort(found.createdAt)} />
        <Field label="Training scheduled" value={fmtDateTimeShort(found.trainingScheduledAt)} />
        <Field
          label="Training status"
          value={
            found.trainingCompleted ? (
              <Badge tone="emerald">Complete</Badge>
            ) : found.trainingScheduledAt ? (
              <Badge tone="blue">Scheduled</Badge>
            ) : (
              <Badge tone="slate">Not set</Badge>
            )
          }
        />
        <Field label="Raw status" value={found.status ?? '—'} />
      </section>

      <section className="rounded-xl border bg-white p-4">
        <div className="text-sm font-semibold">Technical</div>
        <div className="text-xs text-slate-600 mt-1">Useful for debugging payload shape while you evolve the API.</div>
        <pre className="mt-3 overflow-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-800">
{JSON.stringify(found, null, 2)}
        </pre>
      </section>
    </main>
  );
}
