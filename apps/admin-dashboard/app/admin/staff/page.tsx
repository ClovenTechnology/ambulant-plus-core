'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { BadgeCheck, RefreshCw, Search, UsersRound } from 'lucide-react';

export const dynamic = 'force-dynamic';

type Option = { id: string; name: string };
type StaffRow = {
  kind: 'staff' | 'pending';
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  staffIdentifier?: string | null;
  photoUrl?: string | null;
  department?: Option | null;
  designation?: Option | null;
  roles: Array<{ id: string; name: string }>;
  lifecycleState: 'PENDING' | 'ACTIVE' | 'LEAVE' | 'SUSPENDED' | 'ARCHIVED';
  presence: 'AVAILABLE' | 'BUSY' | 'IN_MEETING' | 'DO_NOT_DISTURB' | 'OFFLINE';
  lastActivityAt?: string | null;
};

type Payload = {
  ok: boolean;
  items: StaffRow[];
  total: number;
  page: number;
  pageSize: number;
  counts: Record<string, number>;
  filters: { departments: Option[]; designations: Option[]; roles: Option[] };
  error?: string;
};

function tone(state: string) {
  if (state === 'ACTIVE' || state === 'AVAILABLE') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (state === 'PENDING' || state === 'LEAVE' || state === 'BUSY') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (state === 'SUSPENDED' || state === 'DO_NOT_DISTURB') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (state === 'IN_MEETING') return 'border-blue-200 bg-blue-50 text-blue-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

function label(value: string) {
  return value.toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function Pill({ value }: { value: string }) {
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone(value)}`}>{label(value)}</span>;
}

function displayLastActive(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border bg-white p-4 shadow-sm"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-2 text-3xl font-semibold text-slate-950">{value}</div></div>;
}

export default function AdminStaffDirectoryPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [state, setState] = useState('');
  const [department, setDepartment] = useState('');
  const [designation, setDesignation] = useState('');
  const [role, setRole] = useState('');
  const [presence, setPresence] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  async function load() {
    setBusy(true);
    setError('');
    try {
      const sp = new URLSearchParams({ page: String(page), pageSize: String(pageSize), sort: 'name', dir: 'asc' });
      if (q.trim()) sp.set('q', q.trim());
      if (state) sp.set('state', state);
      if (department) sp.set('department', department);
      if (designation) sp.set('designation', designation);
      if (role) sp.set('role', role);
      if (presence) sp.set('presence', presence);
      const response = await fetch(`/api/admin/staff?${sp.toString()}`, { cache: 'no-store' });
      const json = await response.json().catch(() => null);
      if (!response.ok || !json?.ok) throw new Error(json?.error || 'Unable to load staff directory');
      setData(json);
    } catch (err: any) {
      setError(err?.message || 'Unable to load staff directory');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [state, department, designation, role, presence, page]);
  const maxPage = Math.max(1, Math.ceil((data?.total || 0) / pageSize));
  const counts = data?.counts || {};
  const options = data?.filters;
  const hasFilters = useMemo(() => Boolean(q || state || department || designation || role || presence), [q, state, department, designation, role, presence]);

  return (
    <main className="space-y-6 p-4 lg:p-6">
      <header className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">Ambulant+ People</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Staff Directory</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">Manage staff profiles, roles, departments, availability and employment status from one directory.</p>
        </div>
        <div className="flex flex-wrap gap-2"><Link href="/admin/staff/id-template" className="inline-flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-medium"><BadgeCheck className="h-4 w-4" />Staff ID template</Link><button type="button" onClick={load} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />Refresh</button></div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Active" value={counts.active || 0} />
        <Stat label="Pending" value={counts.pending || 0} />
        <Stat label="Leave" value={counts.leave || 0} />
        <Stat label="Suspended" value={counts.suspended || 0} />
        <Stat label="Archived" value={counts.archived || 0} />
      </section>

      <section className="rounded-3xl border bg-white p-4 shadow-sm">
        <form className="grid gap-3 xl:grid-cols-[minmax(280px,2fr)_repeat(5,minmax(140px,1fr))_auto]" onSubmit={(event) => { event.preventDefault(); setPage(1); load(); }}>
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Name, email, mobile, staff ID, department..." className="w-full rounded-xl border px-9 py-2.5 text-sm" /></div>
          <select value={state} onChange={(e) => { setPage(1); setState(e.target.value); }} className="rounded-xl border px-3 py-2.5 text-sm"><option value="">All states</option>{['ACTIVE','PENDING','LEAVE','SUSPENDED','ARCHIVED'].map((x) => <option key={x} value={x}>{label(x)}</option>)}</select>
          <select value={department} onChange={(e) => { setPage(1); setDepartment(e.target.value); }} className="rounded-xl border px-3 py-2.5 text-sm"><option value="">All departments</option>{options?.departments.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
          <select value={designation} onChange={(e) => { setPage(1); setDesignation(e.target.value); }} className="rounded-xl border px-3 py-2.5 text-sm"><option value="">All designations</option>{options?.designations.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
          <select value={role} onChange={(e) => { setPage(1); setRole(e.target.value); }} className="rounded-xl border px-3 py-2.5 text-sm"><option value="">All roles</option>{options?.roles.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
          <select value={presence} onChange={(e) => { setPage(1); setPresence(e.target.value); }} className="rounded-xl border px-3 py-2.5 text-sm"><option value="">All presence</option>{['AVAILABLE','BUSY','IN_MEETING','DO_NOT_DISTURB','OFFLINE'].map((x) => <option key={x} value={x}>{label(x)}</option>)}</select>
          <button className="rounded-xl border bg-slate-50 px-4 py-2.5 text-sm font-medium hover:bg-slate-100">Search</button>
        </form>
        {hasFilters && <button type="button" onClick={() => { setQ(''); setState(''); setDepartment(''); setDesignation(''); setRole(''); setPresence(''); setPage(1); }} className="mt-3 text-xs font-medium text-slate-500 underline">Clear filters</button>}
      </section>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

      <section className="overflow-hidden rounded-3xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Staff</th><th className="px-4 py-3">Organisation</th><th className="px-4 py-3">Roles</th><th className="px-4 py-3">State</th><th className="px-4 py-3">Presence</th><th className="px-4 py-3">Last active</th><th className="px-4 py-3"></th></tr></thead>
            <tbody className="divide-y">
              {(data?.items || []).map((row) => <tr key={`${row.kind}:${row.id}`} className="align-top">
                <td className="px-4 py-4"><div className="flex items-start gap-3">{row.photoUrl ? <img src={row.photoUrl} alt="" className="h-10 w-10 rounded-xl object-cover ring-1 ring-slate-200" /> : <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">{String(row.name || row.email || '?').trim().slice(0, 1).toUpperCase()}</div>}<div><div className="font-medium text-slate-950">{row.name}</div><div className="mt-1 text-xs text-slate-500">{row.email}</div>{row.phone && <div className="text-xs text-slate-500">{row.phone}</div>}{row.staffIdentifier && <div className="mt-1 text-[11px] font-medium text-slate-400">{row.staffIdentifier}</div>}</div></div></td>
                <td className="px-4 py-4"><div>{row.department?.name || '—'}</div><div className="mt-1 text-xs text-slate-500">{row.designation?.name || '—'}</div></td>
                <td className="px-4 py-4"><div className="flex max-w-sm flex-wrap gap-1">{row.roles.length ? row.roles.map((item) => <span key={item.id} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-700">{item.name}</span>) : <span className="text-slate-400">—</span>}</div></td>
                <td className="px-4 py-4"><Pill value={row.lifecycleState} /></td>
                <td className="px-4 py-4"><Pill value={row.presence} /></td>
                <td className="whitespace-nowrap px-4 py-4 text-xs text-slate-500">{displayLastActive(row.lastActivityAt)}</td>
                <td className="px-4 py-4 text-right"><Link href={`/admin/staff/${encodeURIComponent(row.id)}`} className="rounded-xl border px-3 py-2 text-xs font-medium hover:bg-slate-50">Open profile</Link></td>
              </tr>)}
              {!busy && !(data?.items || []).length && <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500"><UsersRound className="mx-auto mb-3 h-7 w-7" />No staff match the current filters.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-slate-500"><span>{data?.total || 0} matching staff</span><div className="flex items-center gap-2"><button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Previous</button><span>Page {page} of {maxPage}</span><button disabled={page >= maxPage} onClick={() => setPage((value) => Math.min(maxPage, value + 1))} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Next</button></div></div>
      </section>
    </main>
  );
}
