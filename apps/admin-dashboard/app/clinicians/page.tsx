// apps/admin-dashboard/app/clinicians/page.tsx
import Link from 'next/link';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import CliniciansSectionClient from './CliniciansSectionClient';

export const dynamic = 'force-dynamic';

export type Clinician = {
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

  // Admin scan-fields (may be absent until Gateway supports them)
  updatedAt?: string | null;
  lastLoginAt?: string | null;
  hpcsaVerified?: boolean | null;
};

type FetchResult = {
  items: Clinician[];
  total: number;
  page: number;
  pageSize: number;
  serverPaged: boolean; // true when Gateway returns total/page/pageSize (real paging)
  error?: string;
};

function toPosInt(v: unknown, fallback: number) {
  const n = typeof v === 'string' ? Number.parseInt(v, 10) : Number.NaN;
  return Number.isFinite(n) && n >= 1 ? n : fallback;
}
function toPageSize(v: unknown, fallback = 20) {
  const n = typeof v === 'string' ? Number.parseInt(v, 10) : Number.NaN;
  const allowed = new Set([10, 20, 50, 100]);
  return allowed.has(n) ? n : fallback;
}

async function fetchClinicians(opts: {
  status?: string;
  q?: string;
  sort?: string;
  dir?: string;
  page?: number;
  pageSize?: number;
}): Promise<FetchResult> {
  const base = process.env.NEXT_PUBLIC_APIGW_BASE?.trim() || 'http://127.0.0.1:3010';
  const url = new URL('/api/clinicians', base);

  if (opts.status) url.searchParams.set('status', opts.status);
  if (opts.q) url.searchParams.set('q', opts.q);
  if (opts.sort) url.searchParams.set('sort', opts.sort);
  if (opts.dir) url.searchParams.set('dir', opts.dir);
  if (typeof opts.page === 'number') url.searchParams.set('page', String(opts.page));
  if (typeof opts.pageSize === 'number') url.searchParams.set('pageSize', String(opts.pageSize));

  const cookieHeader = cookies().toString();

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        cookie: cookieHeader,
        accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('fetchClinicians non-OK', res.status, text);
      return {
        items: [],
        total: 0,
        page: opts.page ?? 1,
        pageSize: opts.pageSize ?? 20,
        serverPaged: false,
        error: `Gateway responded ${res.status}`,
      };
    }

    const data = await res.json().catch(() => ({} as any));

    // New (desired): { items, total, page, pageSize }
    // Legacy (current): { clinicians: [...] } or { items: [...] }
    const list = (data?.items ?? data?.clinicians ?? []) as Clinician[];
    const items = Array.isArray(list) ? list : [];

    const total =
      typeof data?.total === 'number' && Number.isFinite(data.total) ? data.total : items.length;

    const page =
      typeof data?.page === 'number' && Number.isFinite(data.page) ? data.page : opts.page ?? 1;

    const pageSize =
      typeof data?.pageSize === 'number' && Number.isFinite(data.pageSize)
        ? data.pageSize
        : opts.pageSize ?? 20;

    const serverPaged =
      typeof data?.total === 'number' &&
      typeof data?.page === 'number' &&
      typeof data?.pageSize === 'number';

    return { items, total, page, pageSize, serverPaged };
  } catch (e: any) {
    console.error('fetchClinicians failed', e?.message || e);
    return {
      items: [],
      total: 0,
      page: opts.page ?? 1,
      pageSize: opts.pageSize ?? 20,
      serverPaged: false,
      error: 'fetch_failed',
    };
  }
}

/* -----------------------------
   Demo fallback (only when API returns zero total clinicians)
------------------------------ */
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
    updatedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    lastLoginAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    hpcsaVerified: false,
  },
  {
    id: 'demo-p-2',
    displayName: 'Dr Kabelo Ndlovu',
    email: 'k.ndlovu@example.com',
    phone: '+27 72 555 0102',
    specialty: 'Paediatrics',
    status: 'pending',
    trainingScheduledAt: null,
    trainingCompleted: false,
    createdAt: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString(),
    lastLoginAt: null,
    hpcsaVerified: null,
  },
  {
    id: 'demo-p-3',
    displayName: 'Dr Ayanda Khumalo',
    email: 'a.khumalo@example.com',
    phone: '+27 73 555 0103',
    specialty: 'Dermatology',
    status: 'pending',
    trainingScheduledAt: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString(),
    trainingCompleted: false,
    createdAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
    lastLoginAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    hpcsaVerified: true,
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
    updatedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    lastLoginAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    hpcsaVerified: true,
  },
  {
    id: 'demo-a-2',
    displayName: 'Dr Zanele Dlamini',
    email: 'z.dlamini@example.com',
    phone: '+27 75 555 0105',
    specialty: 'Psychiatry',
    status: 'active',
    feeCents: 90000,
    currency: 'ZAR',
    trainingCompleted: true,
    createdAt: new Date(Date.now() - 45 * 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
    lastLoginAt: new Date(Date.now() - 26 * 3600 * 1000).toISOString(),
    hpcsaVerified: true,
  },
  {
    id: 'demo-a-3',
    displayName: 'Dr Sipho Naidoo',
    email: 's.naidoo@example.com',
    phone: '+27 76 555 0106',
    specialty: 'Cardiology',
    status: 'disciplinary',
    feeCents: 120000,
    currency: 'ZAR',
    trainingCompleted: true,
    createdAt: new Date(Date.now() - 70 * 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
    lastLoginAt: new Date(Date.now() - 10 * 3600 * 1000).toISOString(),
    hpcsaVerified: true,
  },
  {
    id: 'demo-a-4',
    displayName: 'Dr Nandi van Wyk',
    email: 'n.vanwyk@example.com',
    phone: '+27 77 555 0107',
    specialty: 'Obstetrics & Gynaecology',
    status: 'disabled',
    feeCents: 110000,
    currency: 'ZAR',
    trainingCompleted: true,
    createdAt: new Date(Date.now() - 18 * 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString(),
    lastLoginAt: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
    hpcsaVerified: false,
  },
];

type Tone = 'slate' | 'amber' | 'emerald' | 'blue' | 'rose' | 'gray';
function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: Tone }) {
  const tones: Record<Tone, string> = {
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
    amber: 'bg-amber-100 text-amber-800 ring-amber-200',
    emerald: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
    blue: 'bg-blue-100 text-blue-800 ring-blue-200',
    rose: 'bg-rose-100 text-rose-800 ring-rose-200',
    gray: 'bg-gray-100 text-gray-700 ring-gray-200',
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

/* -----------------------------
   Sorting (query params; Gateway does real sort once upgraded)
------------------------------ */
type SortKey =
  | 'name'
  | 'specialty'
  | 'email'
  | 'status'
  | 'fee'
  | 'created'
  | 'training'
  | 'updated'
  | 'login'
  | 'hpcsa';
type SortDir = 'asc' | 'desc';

function normalizeSortKey(v: unknown): SortKey | null {
  const s = typeof v === 'string' ? v : '';
  const ok: SortKey[] = [
    'name',
    'specialty',
    'email',
    'status',
    'fee',
    'created',
    'training',
    'updated',
    'login',
    'hpcsa',
  ];
  return (ok as string[]).includes(s) ? (s as SortKey) : null;
}
function normalizeSortDir(v: unknown): SortDir {
  return v === 'desc' ? 'desc' : 'asc';
}

function DemoInfo({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
      <div className="flex items-center gap-2">
        <Badge tone="blue">DEMO</Badge>
        <div className="font-medium">Showing demo clinicians</div>
      </div>
      <div className="mt-1 opacity-90">
        The Gateway returned no clinicians, so the UI fell back to mock data for presentation.
      </div>
      <div className="mt-2 text-xs opacity-80">Actions are disabled in demo mode.</div>
    </div>
  );
}

/* -----------------------------
   Query helpers
------------------------------ */
function hrefClinicians(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === '') continue;
    sp.set(k, v);
  }
  const qs = sp.toString();
  return qs ? `/clinicians?${qs}` : '/clinicians';
}

export default async function AdminCliniciansPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const viewRaw = searchParams?.view;
  const view = typeof viewRaw === 'string' ? viewRaw : 'all';

  const qRaw = searchParams?.q;
  const q = typeof qRaw === 'string' ? qRaw.trim() : '';

  const sort = normalizeSortKey(searchParams?.sort);
  const dir = normalizeSortDir(searchParams?.dir);

  const pageSize = toPageSize(searchParams?.pageSize, 20);

  // Pagination params:
  // - For view=pending|active: use `page`
  // - For view=all: use `pp` (pending page) and `ap` (active page)
  const page = toPosInt(searchParams?.page, 1);
  const pp = toPosInt(searchParams?.pp, 1);
  const ap = toPosInt(searchParams?.ap, 1);

  const pendingPage = view === 'all' ? pp : view === 'pending' ? page : 1;
  const activePage = view === 'all' ? ap : view === 'active' ? page : 1;

  const [pendingRes, activeRes] = await Promise.all([
    fetchClinicians({ status: 'pending', q, sort: sort ?? undefined, dir, page: pendingPage, pageSize }),
    fetchClinicians({ status: 'active', q, sort: sort ?? undefined, dir, page: activePage, pageSize }),
  ]);

  const apiTotal = pendingRes.total + activeRes.total;
  const apiItemsTotal = pendingRes.items.length + activeRes.items.length;

  // Demo only when the API truly returned no clinicians at all.
  const useDemo = apiTotal === 0 && apiItemsTotal === 0;

  const anyError = pendingRes.error || activeRes.error;

  // Prepare rows + totals for UI
  const pendingRows = useDemo ? DEMO_PENDING : pendingRes.items;
  const activeRows = useDemo ? DEMO_ACTIVE : activeRes.items;

  const totalPending = useDemo ? DEMO_PENDING.length : pendingRes.total;
  const totalActive = useDemo ? DEMO_ACTIVE.length : activeRes.total;
  const totalAll = totalPending + totalActive;

  // Base params for links/forms
  const baseParams: Record<string, string | undefined> = {
    view: view !== 'all' ? view : undefined,
    q: q || undefined,
    sort: sort || undefined,
    dir: dir || undefined,
    pageSize: String(pageSize),
  };

  // Tab hrefs keep paging and sort; reset pages when switching tabs
  const hrefAll = hrefClinicians({ ...baseParams, view: undefined, page: undefined, pp: '1', ap: '1' });
  const hrefPending = hrefClinicians({ ...baseParams, view: 'pending', page: '1', pp: undefined, ap: undefined });
  const hrefActive = hrefClinicians({ ...baseParams, view: 'active', page: '1', pp: undefined, ap: undefined });

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Clinicians</h1>
            <Badge tone="slate">Admin</Badge>
            {useDemo && <Badge tone="blue">Demo Mode</Badge>}
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Review pending clinicians, manage active clinicians, and keep onboarding tidy.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-sm text-slate-600 hover:text-slate-900 underline underline-offset-4"
          >
            Back to admin home
          </Link>
        </div>
      </header>

      <DemoInfo show={useDemo} />

      {anyError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-medium">Couldn’t reach the Gateway (showing what we can)</div>
          <div className="mt-1">
            Base:{' '}
            <span className="font-mono">
              {process.env.NEXT_PUBLIC_APIGW_BASE || 'http://127.0.0.1:3010'}
            </span>
          </div>
          <div className="mt-1 opacity-90">Error: {anyError}</div>
        </div>
      )}

      {/* Top controls */}
      <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Tabs */}
        <div className="flex items-center gap-2">
          <Link
            href={hrefAll}
            className={[
              'rounded-full px-3 py-1 text-sm ring-1 ring-inset transition',
              view === 'all'
                ? 'bg-black text-white ring-black'
                : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50',
            ].join(' ')}
          >
            All <span className="ml-1 opacity-80">{totalAll}</span>
          </Link>
          <Link
            href={hrefPending}
            className={[
              'rounded-full px-3 py-1 text-sm ring-1 ring-inset transition',
              view === 'pending'
                ? 'bg-black text-white ring-black'
                : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50',
            ].join(' ')}
          >
            Pending <span className="ml-1 opacity-80">{totalPending}</span>
          </Link>
          <Link
            href={hrefActive}
            className={[
              'rounded-full px-3 py-1 text-sm ring-1 ring-inset transition',
              view === 'active'
                ? 'bg-black text-white ring-black'
                : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50',
            ].join(' ')}
          >
            Active <span className="ml-1 opacity-80">{totalActive}</span>
          </Link>
        </div>

        {/* Search + Page size */}
        <form action="/clinicians" method="get" className="flex flex-col sm:flex-row sm:items-center gap-2">
          {view !== 'all' && <input type="hidden" name="view" value={view} />}
          {sort && <input type="hidden" name="sort" value={sort} />}
          {dir && <input type="hidden" name="dir" value={dir} />}

          {/* Reset paging on new search/pageSize */}
          {view === 'all' ? (
            <>
              <input type="hidden" name="pp" value="1" />
              <input type="hidden" name="ap" value="1" />
            </>
          ) : (
            <input type="hidden" name="page" value="1" />
          )}

          <input
            name="q"
            defaultValue={q}
            placeholder="Search name, email, phone, userId…"
            className="w-full sm:w-80 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
          />

          <select
            name="pageSize"
            defaultValue={String(pageSize)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
            title="Rows per page"
          >
            <option value="10">10 / page</option>
            <option value="20">20 / page</option>
            <option value="50">50 / page</option>
            <option value="100">100 / page</option>
          </select>

          <button
            type="submit"
            className="rounded-lg bg-black px-3 py-2 text-sm font-medium text-white hover:bg-black/90"
          >
            Apply
          </button>
        </form>
      </section>

      {/* Summary cards */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">Pending</div>
          <div className="mt-1 text-2xl font-semibold">{totalPending}</div>
          <div className="mt-1 text-sm text-slate-600">Awaiting review / training</div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">Active</div>
          <div className="mt-1 text-2xl font-semibold">{totalActive}</div>
          <div className="mt-1 text-sm text-slate-600">Live and available</div>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500">Total</div>
          <div className="mt-1 text-2xl font-semibold">{totalAll}</div>
          <div className="mt-1 text-sm text-slate-600">All clinicians in system</div>
        </div>
      </section>

      {/* Pending */}
      {(view === 'all' || view === 'pending') && (
        <CliniciansSectionClient
          title="Pending clinicians"
          mode="pending"
          demo={useDemo}
          rows={pendingRows}
          total={totalPending}
          page={pendingPage}
          pageSize={pageSize}
          pageKey={view === 'all' ? 'pp' : 'page'}
          baseParams={{
            ...baseParams,
            view: view !== 'all' ? view : undefined,
            pp: view === 'all' ? String(pp) : undefined,
            ap: view === 'all' ? String(ap) : undefined,
            page: view !== 'all' ? String(page) : undefined,
          }}
          sort={sort}
          dir={dir}
        />
      )}

      {/* Active */}
      {(view === 'all' || view === 'active') && (
        <CliniciansSectionClient
          title="Active clinicians"
          mode="active"
          demo={useDemo}
          rows={activeRows}
          total={totalActive}
          page={activePage}
          pageSize={pageSize}
          pageKey={view === 'all' ? 'ap' : 'page'}
          baseParams={{
            ...baseParams,
            view: view !== 'all' ? view : undefined,
            pp: view === 'all' ? String(pp) : undefined,
            ap: view === 'all' ? String(ap) : undefined,
            page: view !== 'all' ? String(page) : undefined,
          }}
          sort={sort}
          dir={dir}
        />
      )}

      <div className="text-xs text-slate-500">
        Times shown in your local timezone. {useDemo ? 'Demo actions are disabled.' : null}
      </div>
    </main>
  );
}
