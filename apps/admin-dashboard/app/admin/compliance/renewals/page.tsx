'use client';

import { useEffect, useMemo, useState } from 'react';

type RenewalGroup = 'ALL' | 'CLINICIAN' | 'CAREPORT' | 'MEDREACH' | 'CLIENT' | 'PATIENT' | 'STAFF' | 'CORPORATE';
type DueFilter = 'month' | 'week' | 'today' | 'overdue' | 'missing' | 'range' | 'all';

type RenewalItem = {
  key: string;
  source: string;
  group: Exclude<RenewalGroup, 'ALL'>;
  holderType: string;
  holderSubtype: string | null;
  holderId: string;
  holderName: string;
  holderEmail: string | null;
  credentialType: string;
  credentialLabel: string;
  credentialNumber: string | null;
  issuingAuthority: string | null;
  authorityClass: string;
  enforcementClass: string;
  enforcementPoint: string;
  enforcementScope: string | null;
  state: string;
  expiresAt: string | null;
  daysUntilExpiry: number | null;
  dueBucket: string;
  autoRemindersEnabled: boolean;
  lastReminderAt: string | null;
};

type RenewalResponse = {
  ok: boolean;
  generatedAt: string;
  today: string;
  timeZone: string;
  designPrinciple: string;
  enforcementMode: string;
  stats: {
    total: number;
    dueThisMonth: number;
    dueThisWeek: number;
    dueToday: number;
    overdue: number;
    missingExpiry: number;
  };
  categories: string[];
  items: RenewalItem[];
  error?: string;
};

const GROUPS: Array<{ id: RenewalGroup; label: string; note?: string }> = [
  { id: 'ALL', label: 'All' },
  { id: 'CLINICIAN', label: 'Clinicians', note: 'Doctors / Class A, nurses, pharmacists / Class B, Class C' },
  { id: 'CAREPORT', label: 'CarePort', note: 'Pharmacies and riders' },
  { id: 'MEDREACH', label: 'MedReach', note: 'Laboratories and phlebotomists / collectors' },
  { id: 'CLIENT', label: 'Clients' },
  { id: 'PATIENT', label: 'Patients', note: 'Identity/passport and medical-aid evidence as those adapters are added' },
  { id: 'STAFF', label: 'Staff / Admin' },
  { id: 'CORPORATE', label: 'Ambulant+ Corporate', note: 'Cyber, PI/malpractice and corporate renewable cover' },
];

function pretty(value: string | null | undefined) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function shortDate(value: string | null) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-ZA', { dateStyle: 'medium' }).format(date);
}

function dueLabel(item: RenewalItem) {
  const days = item.daysUntilExpiry;
  if (days == null) return 'Expiry missing';
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`;
  if (days === 0) return 'Expires today';
  if (days === 1) return '1 day left';
  return `${days} days left`;
}

function dueClass(item: RenewalItem) {
  const days = item.daysUntilExpiry;
  if (days == null) return 'bg-slate-100 text-slate-700';
  if (days < 0) return 'bg-rose-100 text-rose-800';
  if (days === 0) return 'bg-rose-100 text-rose-800';
  if (days <= 7) return 'bg-amber-100 text-amber-800';
  if (days <= 30) return 'bg-blue-100 text-blue-800';
  return 'bg-emerald-100 text-emerald-800';
}

export default function ComplianceRenewalsPage() {
  const [group, setGroup] = useState<RenewalGroup>('ALL');
  const [due, setDue] = useState<DueFilter>('month');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<RenewalResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const params = useMemo(() => {
    const search = new URLSearchParams({ group, due });
    if (q.trim()) search.set('q', q.trim());
    if (due === 'range' && from) search.set('from', from);
    if (due === 'range' && to) search.set('to', to);
    return search.toString();
  }, [group, due, q, from, to]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/compliance/renewals?${params}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => null)) as RenewalResponse | null;
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || `HTTP ${response.status}`);
      }
      setData(payload);
      setSelected((current) => {
        const allowed = new Set(payload.items.map((item) => item.key));
        return new Set(Array.from(current).filter((key) => allowed.has(key)));
      });
    } catch (err: any) {
      setError(err?.message || 'Unable to load compliance renewals.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 180);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  function toggle(key: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAll() {
    if (!data?.items.length) return;
    const visible = data.items.filter((item) => Boolean(item.expiresAt));
    const allSelected = visible.every((item) => selected.has(item.key));
    setSelected(allSelected ? new Set() : new Set(visible.map((item) => item.key)));
  }

  async function send(keys: string[]) {
    if (!keys.length) return;
    setSending(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch('/api/admin/compliance/renewals', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'SEND_REMINDERS', keys }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || `HTTP ${response.status}`);
      }
      const result = payload.result || {};
      setNotice(
        `Processed ${result.matched ?? keys.length} renewal reminder${(result.matched ?? keys.length) === 1 ? '' : 's'}: ${result.sent ?? 0} emailed, ${result.adminOnly ?? 0} admin-only, ${result.skipped ?? 0} skipped, ${result.failed ?? 0} failed.`,
      );
      setSelected(new Set());
      await load();
    } catch (err: any) {
      setError(err?.message || 'Unable to send renewal reminder.');
    } finally {
      setSending(false);
    }
  }

  const cards = data
    ? [
        { label: 'Due this month', value: data.stats.dueThisMonth, filter: 'month' as DueFilter },
        { label: 'Due this week', value: data.stats.dueThisWeek, filter: 'week' as DueFilter },
        { label: 'Due today', value: data.stats.dueToday, filter: 'today' as DueFilter },
        { label: 'Overdue', value: data.stats.overdue, filter: 'overdue' as DueFilter },
        { label: 'Missing expiry', value: data.stats.missingExpiry, filter: 'missing' as DueFilter },
      ]
    : [];

  return (
    <main className="mx-auto max-w-[1500px] space-y-5 p-4 md:p-6">
      <header className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">People &amp; Governance</div>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Compliance Renewals</h1>
          <p className="mt-2 max-w-4xl text-sm text-slate-600">
            Platform-wide expiry surveillance and renewal reminders. This foundation is visibility/reminder-first:
            it does not introduce new signup blocks or automatically suspend existing accounts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/settings/insurance" className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Platform insurance
          </a>
          <button onClick={() => void load()} disabled={loading} className="rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

      <section className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-950">
        <strong>Progressive assurance:</strong> requirements should block the smallest relevant regulated capability — for example
        dispensing, cold-chain transport or payout — rather than preventing account creation where that is unnecessary.
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <button
            key={card.label}
            onClick={() => setDue(card.filter)}
            className={`rounded-2xl border p-4 text-left shadow-sm transition ${due === card.filter ? 'border-slate-950 bg-slate-950 text-white' : 'bg-white hover:border-slate-300'}`}
          >
            <div className={`text-xs ${due === card.filter ? 'text-slate-300' : 'text-slate-500'}`}>{card.label}</div>
            <div className="mt-1 text-2xl font-bold">{card.value}</div>
          </button>
        ))}
      </section>

      <section className="rounded-2xl border bg-white shadow-sm">
        <div className="overflow-x-auto border-b px-3 pt-3">
          <div className="flex min-w-max gap-1">
            {GROUPS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setGroup(tab.id)}
                title={tab.note}
                className={`rounded-t-xl px-3 py-2 text-sm font-semibold ${group === tab.id ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 border-b p-3 md:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_180px_160px_160px_auto]">
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder="Search name, business, credential, issuer, number…"
            className="rounded-xl border px-3 py-2 text-sm"
          />
          <select value={due} onChange={(event) => setDue(event.target.value as DueFilter)} className="rounded-xl border px-3 py-2 text-sm">
            <option value="month">Due this month</option>
            <option value="week">Due this week</option>
            <option value="today">Due today</option>
            <option value="overdue">Overdue</option>
            <option value="missing">Missing expiry</option>
            <option value="range">Date range</option>
            <option value="all">All</option>
          </select>
          <input type="date" disabled={due !== 'range'} value={from} onChange={(event) => setFrom(event.target.value)} className="rounded-xl border px-3 py-2 text-sm disabled:bg-slate-50" />
          <input type="date" disabled={due !== 'range'} value={to} onChange={(event) => setTo(event.target.value)} className="rounded-xl border px-3 py-2 text-sm disabled:bg-slate-50" />
          <button
            disabled={!selected.size || sending}
            onClick={() => void send(Array.from(selected))}
            className="rounded-xl border border-slate-950 bg-slate-950 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {sending ? 'Sending…' : `Send reminders${selected.size ? ` (${selected.size})` : ''}`}
          </button>
        </div>

        {notice ? <div className="border-b bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div> : null}
        {error ? <div className="border-b bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div> : null}

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3">
                  <input type="checkbox" aria-label="Select all visible" onChange={toggleAll} checked={Boolean(data?.items.length) && data!.items.filter((item) => Boolean(item.expiresAt)).every((item) => selected.has(item.key))} />
                </th>
                <th className="px-3 py-3">Holder</th>
                <th className="px-3 py-3">Credential</th>
                <th className="px-3 py-3">Issuer</th>
                <th className="px-3 py-3">Expiry</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Impact</th>
                <th className="px-3 py-3">Last reminder</th>
                <th className="px-3 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-500">Loading compliance renewals…</td></tr>
              ) : !data?.items.length ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-500">No matching renewable credentials.</td></tr>
              ) : (
                data.items.map((item) => (
                  <tr key={item.key} className="align-top hover:bg-slate-50/70">
                    <td className="px-3 py-4">
                      <input type="checkbox" disabled={!item.expiresAt} checked={selected.has(item.key)} onChange={() => toggle(item.key)} aria-label={`Select ${item.holderName}`} />
                    </td>
                    <td className="px-3 py-4">
                      <div className="font-semibold text-slate-900">{item.holderName}</div>
                      <div className="mt-1 text-xs text-slate-500">{pretty(item.group)}{item.holderSubtype ? ` · ${pretty(item.holderSubtype)}` : ''}</div>
                      {item.holderEmail ? <div className="mt-1 text-xs text-slate-400">{item.holderEmail}</div> : null}
                    </td>
                    <td className="px-3 py-4">
                      <div className="font-medium text-slate-800">{item.credentialLabel}</div>
                      {item.credentialNumber ? <div className="mt-1 text-xs text-slate-500">{item.credentialNumber}</div> : null}
                      <div className="mt-1 text-[11px] text-slate-400">{pretty(item.source)}</div>
                    </td>
                    <td className="px-3 py-4 text-slate-600">{item.issuingAuthority || '—'}</td>
                    <td className="px-3 py-4">
                      <div className="font-medium text-slate-800">{shortDate(item.expiresAt)}</div>
                      <div className="mt-1 text-xs text-slate-500">{dueLabel(item)}</div>
                    </td>
                    <td className="px-3 py-4">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${dueClass(item)}`}>{dueLabel(item)}</span>
                      {item.state !== 'VALID' ? <div className="mt-1 text-[11px] text-slate-500">{pretty(item.state)}</div> : null}
                    </td>
                    <td className="px-3 py-4">
                      <div className="text-xs font-semibold text-slate-700">{pretty(item.enforcementPoint)}</div>
                      <div className="mt-1 max-w-[220px] text-xs text-slate-500">{item.enforcementScope ? pretty(item.enforcementScope) : 'Review only'}</div>
                      <div className="mt-1 text-[11px] text-slate-400">{pretty(item.enforcementClass)}</div>
                    </td>
                    <td className="px-3 py-4 text-xs text-slate-500">{shortDate(item.lastReminderAt)}</td>
                    <td className="px-3 py-4">
                      <button
                        disabled={!item.expiresAt || sending}
                        onClick={() => void send([item.key])}
                        className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                      >
                        Send reminder
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="text-xs text-slate-500">
        Automatic scan cadence is designed for 30 / 14 / 7 / 1 days and expiry day. Category-specific automatic suspension/reinstatement is deliberately deferred until each compliance rule has been mapped and approved.
      </footer>
    </main>
  );
}
