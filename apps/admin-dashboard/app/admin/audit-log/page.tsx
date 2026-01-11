// apps/admin-dashboard/app/admin/audit-log/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import {
  deriveScopeFromAuditAction,
  DANGER_SCOPES,
} from '../../../lib/authz/scopeCatalog';

type RangeKey = '24h' | '7d' | '30d' | '90d';

type AuditActorType =
  | 'PATIENT'
  | 'CLINICIAN'
  | 'PHLEB'
  | 'RIDER'
  | 'SHOPPER'
  | 'ADMIN'
  | 'CLINICIAN_STAFF_MEDICAL'
  | 'CLINICIAN_STAFF_NON_MEDICAL'
  | 'SYSTEM';

type AuditLogRow = {
  id: string;
  createdAt: string;

  actorUserId?: string | null;
  actorType: AuditActorType;
  actorRefId?: string | null;

  app: string;
  sessionId?: string | null;

  action: string;
  entityType?: string | null;
  entityId?: string | null;
  description?: string | null;

  ip?: string | null;
  ipCountry?: string | null;
  ipCity?: string | null;
};

type AuditLogSummary = {
  totalInRange: number;
  uniqueActors: number;
  uniqueEntities: number;
};

type AuditLogResponse = {
  ok: boolean;
  items: AuditLogRow[];
  summary: AuditLogSummary;
  nextCursor?: string | null;
};

function labelActorType(t: AuditActorType) {
  switch (t) {
    case 'PATIENT':
      return 'Patient';
    case 'CLINICIAN':
      return 'Clinician';
    case 'PHLEB':
      return 'Phleb';
    case 'RIDER':
      return 'Rider';
    case 'SHOPPER':
      return 'Shopper';
    case 'ADMIN':
      return 'Admin';
    case 'CLINICIAN_STAFF_MEDICAL':
      return 'Clinician staff (medical)';
    case 'CLINICIAN_STAFF_NON_MEDICAL':
      return 'Clinician staff (non-medical)';
    case 'SYSTEM':
      return 'System';
    default:
      return t;
  }
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function MetricCard(props: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="text-xs text-gray-500">{props.label}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">
        {props.value}
      </div>
      {props.sub && (
        <div className="mt-1 text-[11px] text-gray-400">{props.sub}</div>
      )}
    </div>
  );
}

function ScopeBadge({ scope }: { scope: string | null }) {
  if (!scope) return <span className="text-[10px] text-gray-400">—</span>;
  const danger = DANGER_SCOPES.has(scope);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] ${
        danger
          ? 'bg-amber-50 border-amber-200 text-amber-900'
          : 'bg-gray-50 border-gray-200 text-gray-700'
      }`}
      title={danger ? 'Privileged scope' : 'Standard scope'}
    >
      {scope}
    </span>
  );
}

const RANGE_OPTIONS: RangeKey[] = ['24h', '7d', '30d', '90d'];

export default function AdminAuditLogPage() {
  const [range, setRange] = useState<RangeKey>('24h');
  const [actorType, setActorType] = useState<'all' | AuditActorType>('all');
  const [app, setApp] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [summary, setSummary] = useState<AuditLogSummary | null>(null);

  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // local derived stats on the currently loaded page
  const localUniqueApps = useMemo(() => {
    const s = new Set(rows.map((r) => r.app));
    return s.size;
  }, [rows]);

  const localUniqueUsers = useMemo(() => {
    const s = new Set(rows.map((r) => r.actorUserId).filter(Boolean));
    return s.size;
  }, [rows]);

  async function loadPage(opts?: { cursor?: string | null; replace?: boolean }) {
    const c = opts?.cursor ?? null;
    const replace = opts?.replace ?? false;

    setLoading(true);
    setErr(null);

    try {
      const params = new URLSearchParams();
      params.set('range', range);
      if (actorType !== 'all') params.set('actorType', actorType);
      if (app !== 'all') params.set('app', app);
      if (search.trim()) params.set('q', search.trim());
      if (actionFilter.trim()) params.set('action', actionFilter.trim());
      if (c) params.set('cursor', c);

      const res = await fetch(`/api/admin/audit-log?${params.toString()}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as AuditLogResponse;

      if (!json.ok) {
        throw new Error('API returned ok = false');
      }

      setRows((prev) => (replace ? json.items : [...prev, ...json.items]));
      setSummary(json.summary);
      setCursor(json.nextCursor ?? null);
      setHasMore(Boolean(json.nextCursor));
    } catch (e: any) {
      console.error('audit log fetch failed', e);
      setErr(e?.message || 'Failed to load audit log.');
      if (opts?.replace) {
        setRows([]);
        setSummary(null);
        setCursor(null);
        setHasMore(false);
      }
    } finally {
      setLoading(false);
    }
  }

  // reload when filters change
  useEffect(() => {
    setCursor(null);
    loadPage({ cursor: null, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, actorType, app, actionFilter]);

  function resetFilters() {
    setRange('24h');
    setActorType('all');
    setApp('all');
    setSearch('');
    setActionFilter('');
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      {/* HEADER */}
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Audit trail</h1>
          <p className="mt-1 text-sm text-gray-500">
            Cross-app activity log for Ambulant+ — who did what, where and when.
            Filter by role, app, time range or free text to investigate issues
            and satisfy audit / compliance checks.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 text-xs">
          <div className="inline-flex overflow-hidden rounded-full border bg-white">
            <Link
              href="/admin/analytics/online"
              className="border-r px-3 py-1.5 hover:bg-gray-50"
            >
              Online presence
            </Link>
            <Link
              href="/admin/audit-log"
              className="bg-gray-900 px-3 py-1.5 text-white"
            >
              Audit log
            </Link>
          </div>
          {loading && (
            <div className="text-[11px] text-gray-400">
              Loading audit entries…
            </div>
          )}
        </div>
      </header>

      {err && (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {err}
        </div>
      )}

      {/* KPI STRIP */}
      <section className="grid gap-3 md:grid-cols-4">
        <MetricCard
          label="Events in range"
          value={
            summary
              ? summary.totalInRange.toLocaleString()
              : rows.length
              ? rows.length.toLocaleString()
              : '—'
          }
          sub={summary ? 'Across all matching filters' : 'Current page only'}
        />
        <MetricCard
          label="Unique users"
          value={
            summary
              ? summary.uniqueActors.toLocaleString()
              : localUniqueUsers.toString()
          }
          sub="Distinct actorUserId values"
        />
        <MetricCard
          label="Unique entities"
          value={summary ? summary.uniqueEntities.toLocaleString() : '—'}
          sub="Distinct entityType / entityId pairs"
        />
        <MetricCard
          label="Apps in this view"
          value={localUniqueApps.toString()}
          sub="Based on currently loaded rows"
        />
      </section>

      {/* FILTER BAR */}
      <section className="space-y-3 rounded-2xl border bg-white p-4 shadow-sm text-xs">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-gray-500">Range:</span>
            <div className="inline-flex overflow-hidden rounded-full border bg-white">
              {RANGE_OPTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRange(r)}
                  className={`px-3 py-1.5 border-r last:border-r-0 ${
                    range === r
                      ? 'bg-gray-900 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {r === '24h'
                    ? 'Last 24h'
                    : r === '7d'
                    ? 'Last 7d'
                    : r === '30d'
                    ? 'Last 30d'
                    : 'Last 90d'}
                </button>
              ))}
            </div>

            <span className="ml-3 text-gray-500">Role:</span>
            <select
              className="rounded border px-2 py-1"
              value={actorType}
              onChange={(e) =>
                setActorType(e.target.value as 'all' | AuditActorType)
              }
            >
              <option value="all">All roles</option>
              <option value="PATIENT">Patients</option>
              <option value="CLINICIAN">Clinicians</option>
              <option value="PHLEB">Phlebs</option>
              <option value="RIDER">Riders</option>
              <option value="SHOPPER">Shoppers</option>
              <option value="ADMIN">Admins</option>
              <option value="CLINICIAN_STAFF_MEDICAL">
                Clinician staff (medical)
              </option>
              <option value="CLINICIAN_STAFF_NON_MEDICAL">
                Clinician staff (non-medical)
              </option>
              <option value="SYSTEM">System</option>
            </select>

            <span className="ml-3 text-gray-500">App:</span>
            <select
              className="rounded border px-2 py-1"
              value={app}
              onChange={(e) => setApp(e.target.value)}
            >
              <option value="all">All apps</option>
              <option value="patient-app">patient-app</option>
              <option value="clinician-app">clinician-app</option>
              <option value="phleb-app">phleb-app</option>
              <option value="rider-app">rider-app</option>
              <option value="shopper-app">shopper-app</option>
              <option value="admin-dashboard">admin-dashboard</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              className="w-52 rounded border px-2 py-1"
              placeholder="Search description / entity / IP"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setCursor(null);
                  loadPage({ cursor: null, replace: true });
                }
              }}
            />
            <input
              className="w-40 rounded border px-2 py-1"
              placeholder="Filter by action (e.g. LOGIN)"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            />
            <button
              type="button"
              onClick={resetFilters}
              className="rounded border px-2.5 py-1 text-gray-600 hover:bg-gray-50"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => loadPage({ cursor: null, replace: true })}
              className="rounded border bg-white px-3 py-1 text-gray-700 hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>
        </div>
      </section>

      {/* TABLE */}
      <section className="rounded-2xl border bg-white p-4 shadow-sm text-xs">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-900">Audit events</h2>
          <span className="text-[11px] text-gray-500">
            Sorted by newest first • up to {rows.length.toLocaleString()} rows
            loaded in this view
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="border-b px-2 py-1 text-left">Time</th>
                <th className="border-b px-2 py-1 text-left">Actor</th>
                <th className="border-b px-2 py-1 text-left">App</th>
                <th className="border-b px-2 py-1 text-left">Action</th>
                <th className="border-b px-2 py-1 text-left">Scope</th>
                <th className="border-b px-2 py-1 text-left">Entity</th>
                <th className="border-b px-2 py-1 text-left">Description</th>
                <th className="border-b px-2 py-1 text-left">IP / Location</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-4 text-center text-xs text-gray-500"
                  >
                    No audit events match this filter set.
                  </td>
                </tr>
              )}

              {rows.map((r) => {
                const derivedScope = deriveScopeFromAuditAction(r.action);

                return (
                  <tr
                    key={r.id}
                    className="border-t text-[11px] hover:bg-gray-50"
                  >
                    <td className="px-2 py-1 align-top whitespace-nowrap">
                      {fmtDateTime(r.createdAt)}
                    </td>

                    <td className="px-2 py-1 align-top">
                      <div className="text-gray-900">
                        {labelActorType(r.actorType)}
                      </div>
                      <div className="font-mono text-[10px] text-gray-500">
                        {r.actorUserId || '—'}
                      </div>
                      {r.actorRefId && (
                        <div className="font-mono text-[10px] text-gray-400">
                          ref: {r.actorRefId}
                        </div>
                      )}
                    </td>

                    <td className="px-2 py-1 align-top">
                      <div className="text-gray-900">{r.app}</div>
                      {r.sessionId && (
                        <div className="font-mono text-[10px] text-gray-400">
                          sess: {r.sessionId}
                        </div>
                      )}
                    </td>

                    <td className="px-2 py-1 align-top">
                      <div className="font-mono text-[10px] text-gray-900">
                        {r.action}
                      </div>
                    </td>

                    <td className="px-2 py-1 align-top">
                      <ScopeBadge scope={derivedScope} />
                    </td>

                    <td className="px-2 py-1 align-top">
                      {r.entityType ? (
                        <>
                          <div className="text-gray-900">{r.entityType}</div>
                          {r.entityId && (
                            <div className="font-mono text-[10px] text-gray-500">
                              {r.entityId}
                            </div>
                          )}
                        </>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>

                    <td className="px-2 py-1 align-top max-w-xs">
                      {r.description ? (
                        <span className="text-gray-800">{r.description}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>

                    <td className="px-2 py-1 align-top">
                      <div className="text-gray-800">
                        {r.ip || <span className="text-gray-400">—</span>}
                      </div>
                      {(r.ipCity || r.ipCountry) && (
                        <div className="text-[10px] text-gray-500">
                          {r.ipCity
                            ? `${r.ipCity}${r.ipCountry ? ', ' : ''}`
                            : ''}
                          {r.ipCountry || ''}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {hasMore && (
          <div className="mt-3 flex justify-center">
            <button
              type="button"
              disabled={loading}
              onClick={() => loadPage({ cursor, replace: false })}
              className="rounded border bg-white px-4 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Loading…' : 'Load more events'}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}
