'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

function humanErrorMessage(value: unknown, fallback = "Unable to complete this request. Please try again.") {
  if (typeof value === "string") {
    const text = value.trim();
    if (text && text !== "[object Object]") return text;
  }

  if (value instanceof Error) {
    const text = value.message.trim();
    if (text && text !== "[object Object]") return text;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;

    for (const key of ["message", "error", "detail", "reason", "statusText", "code"]) {
      const candidate = record[key];

      if (typeof candidate === "string") {
        const text = candidate.trim();
        if (text && text !== "[object Object]") return text;
      }

      if (candidate && typeof candidate === "object") {
        const nested = candidate as Record<string, unknown>;

        for (const nestedKey of ["message", "error", "detail", "reason", "statusText", "code"]) {
          const nestedCandidate = nested[nestedKey];

          if (typeof nestedCandidate === "string") {
            const text = nestedCandidate.trim();
            if (text && text !== "[object Object]") return text;
          }
        }
      }
    }
  }

  if (value != null) {
    const text = String(value).trim();
    if (text && text !== "[object Object]") return text;
  }

  return fallback;
}

type Phleb = {
  id: string;
  userId?: string;
  active?: boolean;
  approvalStatus?: string;
  country?: string;
  currency?: string;
  payoutAccountMasked?: string | null;
  commissionKind?: string;
  commissionValue?: number;
  defaultLabId?: string | null;
  defaultLab?: {
    id: string;
    name: string;
    active?: boolean;
    status?: string;
  } | null;
  ratingAvg?: number | null;
  ratingCount?: number;
  completedJobsCount?: number;
  cancelledJobsCount?: number;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
};

function asArray(value: any): Phleb[] {
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.phlebs)) return value.phlebs;
  if (Array.isArray(value)) return value;

  return [];
}

function displayName(phleb: Phleb) {
  return phleb.userId || phleb.id;
}

function ready(phleb: Phleb) {
  return {
    approved: phleb.approvalStatus === 'ACTIVE' || phleb.approvalStatus === 'APPROVED',
    active: phleb.active !== false,
    defaultLab: Boolean(phleb.defaultLabId || phleb.defaultLab?.id),
    payout: Boolean(phleb.payoutAccountMasked),
    performance: Number(phleb.completedJobsCount || 0) > 0 || Number(phleb.ratingCount || 0) > 0,
  };
}

function readinessScore(phleb: Phleb) {
  const r = ready(phleb);
  return [r.approved, r.active, r.defaultLab, r.payout, r.performance].filter(Boolean).length;
}

function pill(text: string, ok: boolean) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${
        ok
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-amber-200 bg-amber-50 text-amber-700'
      }`}
    >
      {text}
    </span>
  );
}

export default function MedReachPhlebsPage() {
  const [phlebs, setPhlebs] = useState<Phleb[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showOnlyActive, setShowOnlyActive] = useState(false);
  const [q, setQ] = useState('');

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const params = new URLSearchParams({ limit: '200' });
      if (q.trim()) params.set('q', q.trim());
      if (showOnlyActive) params.set('active', 'true');

      const res = await fetch(`/api/phlebs?${params.toString()}`, {
        cache: 'no-store',
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || json?.ok === false) {
        throw new Error(humanErrorMessage(json?.error, `HTTP ${res.status}`));
      }

      setPhlebs(asArray(json));
    } catch (e: any) {
      setErr(e?.message || 'Unable to load phlebotomists');
      setPhlebs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showOnlyActive]);

  const summary = useMemo(() => {
    return {
      total: phlebs.length,
      active: phlebs.filter((p) => p.active !== false).length,
      approved: phlebs.filter((p) => ready(p).approved).length,
      defaultLab: phlebs.filter((p) => ready(p).defaultLab).length,
    };
  }, [phlebs]);

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-950">
            MedReach Phleb Registry
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            Enterprise phlebotomist operating view: approval readiness, active state,
            default lab routing, payout status, performance and job console access.
          </p>
        </div>

        <Link
          href="/"
          className="rounded-full border bg-white px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
        >
          Back to command centre
        </Link>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-gray-500">Registered phlebs</div>
          <div className="mt-1 text-2xl font-semibold">{loading ? '...' : summary.total}</div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-gray-500">Active</div>
          <div className="mt-1 text-2xl font-semibold">{loading ? '...' : summary.active}</div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-gray-500">Approved</div>
          <div className="mt-1 text-2xl font-semibold">{loading ? '...' : summary.approved}</div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-gray-500">Default lab linked</div>
          <div className="mt-1 text-2xl font-semibold">{loading ? '...' : summary.defaultLab}</div>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search phleb id, user id, payout mask"
            className="w-full rounded border px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={load}
            className="rounded border bg-gray-900 px-4 py-2 text-sm text-white hover:bg-black"
          >
            Search
          </button>
        </div>

        <label className="inline-flex items-center gap-2 text-xs text-gray-700">
          <input
            type="checkbox"
            checked={showOnlyActive}
            onChange={(e) => setShowOnlyActive(e.target.checked)}
          />
          Show only active
        </label>
      </section>

      {err ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-semibold">Unable to load phleb registry</div>
          <div className="mt-1">{humanErrorMessage(err, "Unable to complete this request. Please try again.")}</div>
        </section>
      ) : null}

      {loading ? (
        <section className="rounded-xl border bg-white p-6 text-sm text-gray-500">
          Loading phleb registry...
        </section>
      ) : phlebs.length === 0 ? (
        <section className="rounded-xl border bg-white p-6 text-sm text-gray-600">
          No phlebotomists are available from the gateway. Complete phleb onboarding,
          KYI/identity verification, payout setup and admin approval before live operations.
        </section>
      ) : (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {phlebs.map((phleb) => {
            const r = ready(phleb);
            const score = readinessScore(phleb);
            const name = displayName(phleb);

            return (
              <article key={phleb.id} className="rounded-2xl border bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-gray-950">{name}</div>
                    <div className="mt-1 text-xs text-gray-500">
                      {phleb.country || 'ZA'} / {phleb.currency || 'ZAR'} / profile {phleb.id}
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                        r.approved
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-amber-200 bg-amber-50 text-amber-700'
                      }`}
                    >
                      {phleb.approvalStatus || 'PENDING'}
                    </div>
                    <div className="mt-1 text-[11px] text-gray-500">
                      Readiness {score}/5
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {pill('Approved', r.approved)}
                  {pill('Active', r.active)}
                  {pill('Default lab', r.defaultLab)}
                  {pill('Payout configured', r.payout)}
                  {pill('Performance history', r.performance)}
                </div>

                {phleb.rejectedAt ? (
                  <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                    Rejected: {phleb.rejectionReason || 'No reason supplied'}
                  </div>
                ) : null}

                <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-gray-700 md:grid-cols-4">
                  <div>
                    <div className="text-gray-500">Completed</div>
                    <div className="font-semibold">{phleb.completedJobsCount || 0}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Cancelled</div>
                    <div className="font-semibold">{phleb.cancelledJobsCount || 0}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Rating</div>
                    <div className="font-semibold">
                      {phleb.ratingAvg == null ? '-' : Number(phleb.ratingAvg).toFixed(1)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Default lab</div>
                    <div className="truncate font-semibold">
                      {phleb.defaultLab?.name || phleb.defaultLabId || '-'}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <Link
                    href={`/phleb/${encodeURIComponent(phleb.userId || phleb.id)}`}
                    className="rounded border bg-gray-900 px-3 py-1 text-white hover:bg-black"
                  >
                    Jobs
                  </Link>
                  <Link
                    href={`/phleb/${encodeURIComponent(phleb.userId || phleb.id)}/dashboard`}
                    className="rounded border bg-white px-3 py-1 hover:bg-gray-50"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href={`/phleb/${encodeURIComponent(phleb.userId || phleb.id)}/profile`}
                    className="rounded border bg-white px-3 py-1 hover:bg-gray-50"
                  >
                    Profile
                  </Link>
                  <Link
                    href={`/phleb/${encodeURIComponent(phleb.userId || phleb.id)}/payouts`}
                    className="rounded border bg-white px-3 py-1 hover:bg-gray-50"
                  >
                    Payouts
                  </Link>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}