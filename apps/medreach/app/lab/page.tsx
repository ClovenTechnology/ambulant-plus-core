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

type Lab = {
  id: string;
  name: string;
  contact?: string | null;
  active?: boolean;
  status?: string | null;
  onboardingStatus?: string | null;
  country?: string | null;
  currency?: string | null;
  canManageStaff?: boolean;
  canPublishResults?: boolean;
  ownerUserId?: string | null;
  payoutAccountMasked?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  counts?: {
    offeredTests?: number;
    panels?: number;
    staffMembers?: number;
    eligibleOrders?: number;
  };
};

function asArray(value: any): Lab[] {
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.labs)) return value.labs;
  if (Array.isArray(value)) return value;

  return [];
}

function ready(lab: Lab) {
  return {
    activeApproved: lab.active !== false && lab.status === 'ACTIVE',
    hasStaff: Number(lab.counts?.staffMembers || 0) > 0,
    hasTests: Number(lab.counts?.offeredTests || 0) > 0,
    canPublish: lab.canPublishResults !== false,
    payout: Boolean(lab.payoutAccountMasked),
  };
}

function readinessScore(lab: Lab) {
  const r = ready(lab);
  return [r.activeApproved, r.hasStaff, r.hasTests, r.canPublish, r.payout].filter(Boolean).length;
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

export default function MedReachLabsPage() {
  const [labs, setLabs] = useState<Lab[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [showAll, setShowAll] = useState(false);

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const params = new URLSearchParams({
        limit: '200',
      });

      if (q.trim()) params.set('q', q.trim());
      if (showAll) params.set('active', '');

      const res = await fetch(`/api/labs?${params.toString()}`, {
        cache: 'no-store',
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || json?.ok === false) {
        throw new Error(humanErrorMessage(json?.error, `HTTP ${res.status}`));
      }

      setLabs(asArray(json));
    } catch (e: any) {
      setErr(e?.message || 'Unable to load labs');
      setLabs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showAll]);

  const summary = useMemo(() => {
    return {
      total: labs.length,
      active: labs.filter((lab) => lab.status === 'ACTIVE' && lab.active !== false).length,
      withTests: labs.filter((lab) => Number(lab.counts?.offeredTests || 0) > 0).length,
      withStaff: labs.filter((lab) => Number(lab.counts?.staffMembers || 0) > 0).length,
    };
  }, [labs]);

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-950">MedReach Lab Registry</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            Enterprise lab operating view: approval state, onboarding readiness, staff capacity,
            test inventory, panels, result-publishing rights and workspace access.
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
          <div className="text-xs text-gray-500">Registered labs</div>
          <div className="mt-1 text-2xl font-semibold">{loading ? '...' : summary.total}</div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-gray-500">Active approved</div>
          <div className="mt-1 text-2xl font-semibold">{loading ? '...' : summary.active}</div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-gray-500">With test inventory</div>
          <div className="mt-1 text-2xl font-semibold">{loading ? '...' : summary.withTests}</div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-gray-500">With staff</div>
          <div className="mt-1 text-2xl font-semibold">{loading ? '...' : summary.withStaff}</div>
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search lab name or contact"
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
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
          />
          Include inactive/pending where permitted
        </label>
      </section>

      {err ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-semibold">Unable to load lab registry</div>
          <div className="mt-1">{humanErrorMessage(err, "Unable to complete this request. Please try again.")}</div>
        </section>
      ) : null}

      {loading ? (
        <section className="rounded-xl border bg-white p-6 text-sm text-gray-500">
          Loading lab registry...
        </section>
      ) : labs.length === 0 ? (
        <section className="rounded-xl border bg-white p-6 text-sm text-gray-600">
          No labs are available from the gateway. Create and approve lab partners in the
          admin onboarding flow before live MedReach operations.
        </section>
      ) : (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {labs.map((lab) => {
            const r = ready(lab);
            const score = readinessScore(lab);

            return (
              <article key={lab.id} className="rounded-2xl border bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-gray-950">{lab.name}</div>
                    <div className="mt-1 text-xs text-gray-500">
                      {lab.country || 'ZA'} / {lab.currency || 'ZAR'} / {lab.contact || 'No contact'}
                    </div>
                  </div>

                  <div className="text-right">
                    <div
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                        r.activeApproved
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-amber-200 bg-amber-50 text-amber-700'
                      }`}
                    >
                      {lab.status || 'PENDING'}
                    </div>
                    <div className="mt-1 text-[11px] text-gray-500">
                      Readiness {score}/5
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {pill('Approved/live', r.activeApproved)}
                  {pill('Staff configured', r.hasStaff)}
                  {pill('Tests published', r.hasTests)}
                  {pill('Can publish results', r.canPublish)}
                  {pill('Payout configured', r.payout)}
                </div>

                {lab.rejectedAt ? (
                  <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                    Rejected: {lab.rejectionReason || 'No reason supplied'}
                  </div>
                ) : null}

                <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-gray-700 md:grid-cols-4">
                  <div>
                    <div className="text-gray-500">Tests</div>
                    <div className="font-semibold">{lab.counts?.offeredTests || 0}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Panels</div>
                    <div className="font-semibold">{lab.counts?.panels || 0}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Staff</div>
                    <div className="font-semibold">{lab.counts?.staffMembers || 0}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Eligible orders</div>
                    <div className="font-semibold">{lab.counts?.eligibleOrders || 0}</div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <Link
                    href={`/lab/${encodeURIComponent(lab.id)}`}
                    className="rounded border bg-gray-900 px-3 py-1 text-white hover:bg-black"
                  >
                    Workspace
                  </Link>
                  <Link
                    href={`/lab/${encodeURIComponent(lab.id)}/dashboard`}
                    className="rounded border bg-white px-3 py-1 hover:bg-gray-50"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href={`/lab/${encodeURIComponent(lab.id)}/tests`}
                    className="rounded border bg-white px-3 py-1 hover:bg-gray-50"
                  >
                    Tests
                  </Link>
                  <Link
                    href={`/lab/${encodeURIComponent(lab.id)}/settings`}
                    className="rounded border bg-white px-3 py-1 hover:bg-gray-50"
                  >
                    Settings
                  </Link>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <section className="rounded-3xl border border-emerald-100 bg-emerald-50/70 p-5 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">
              Network command
            </p>
            <h2 className="mt-2 text-lg font-semibold text-gray-950">
              Lab HQ, branch and franchise management
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-600">
              Manage multi-branch lab groups, franchise networks, HQ visibility,
              branch attachment and network-level staff governance.
            </p>
          </div>

          <a
            href="/lab-networks"
            className="inline-flex w-fit items-center justify-center rounded-xl bg-gray-950 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-black"
          >
            Open network command
          </a>
        </div>
      </section>
    </main>
  );
}