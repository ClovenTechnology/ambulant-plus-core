'use client';

// apps/medreach/app/phleb/[phlebId]/dashboard/page.tsx
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
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


type Job = {
  id: string;
  drawId?: string;
  jobId?: string;
  orderId?: string;
  status?: string;
  scheduledAt?: string | null;
  assignedAt?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
  labId?: string | null;
  partnerId?: string | null;
  lab?: {
    id?: string;
    name?: string;
  } | null;
  bundle?: {
    id?: string;
    status?: string;
    specimens?: any[];
    custody?: any[];
  } | null;
  bundleStatus?: string | null;
  finance?: {
    currency?: string;
    phlebGrossCents?: number;
    phlebNetCents?: number;
    platformFeeCents?: number;
  } | null;
};

type MetricsResponse = {
  ok?: boolean;
  error?: string;
  scope?: string;
  phlebId?: string;
  summary?: {
    jobsToday?: number;
    jobsThisWeek?: number;
    jobsThisMonth?: number;
    activeJobs?: number;
  };
  earnings?: {
    todayZAR?: number;
    thisWeekZAR?: number;
    thisMonthZAR?: number;
    allTimeZAR?: number;
  };
  registry?: Record<string, number>;
  marketplace?: Record<string, any>;
  specimens?: Record<string, any>;
  finance?: Record<string, number>;
  operations?: Record<string, number>;
  data?: {
    registry?: Record<string, number>;
    marketplace?: Record<string, any>;
    specimens?: Record<string, any>;
    finance?: Record<string, number>;
    operations?: Record<string, number>;
  };
};

type WindowDays = '7' | '30' | '90';

function n(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function moneyFromCents(cents: unknown, currency = 'ZAR') {
  return `${currency} ${(n(cents) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function moneyFromZar(value: unknown) {
  return `ZAR ${n(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function asArray(value: any): any[] {
  if (Array.isArray(value?.data)) return value.data;
  if (Array.isArray(value?.jobs)) return value.jobs;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value)) return value;

  return [];
}

function normalizeJob(raw: any): Job {
  const draw = raw?.draw || raw;

  return {
    id: String(raw?.id || raw?.jobId || raw?.drawId || draw?.id || raw?.orderId || '').trim(),
    drawId: raw?.drawId || draw?.id || raw?.id,
    jobId: raw?.jobId || raw?.id || draw?.id,
    orderId: raw?.orderId || draw?.orderId,
    status: String(raw?.status || draw?.status || 'ASSIGNED'),
    scheduledAt: raw?.scheduledAt || draw?.scheduledAt || null,
    assignedAt: raw?.assignedAt || draw?.assignedAt || null,
    updatedAt: raw?.updatedAt || draw?.updatedAt || null,
    createdAt: raw?.createdAt || draw?.createdAt || null,
    labId: raw?.labId || raw?.partnerId || draw?.partnerId || raw?.lab?.id || null,
    partnerId: raw?.partnerId || draw?.partnerId || raw?.labId || null,
    lab: raw?.lab || null,
    bundle: raw?.bundle || raw?.specimenBundle || null,
    bundleStatus: raw?.bundleStatus || raw?.bundle?.status || null,
    finance: raw?.finance || null,
  };
}

function payload(metrics: MetricsResponse | null) {
  return metrics?.data || metrics || {};
}

function statusTone(status?: string | null) {
  const s = String(status || '').toUpperCase();

  if (['DELIVERED_TO_LAB', 'COMPLETED', 'ACCEPTED'].includes(s)) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (['PHLEB_EN_ROUTE_TO_PATIENT', 'PHLEB_EN_ROUTE_TO_LAB', 'IN_TRANSIT'].includes(s)) {
    return 'border-blue-200 bg-blue-50 text-blue-700';
  }

  if (['PHLEB_ARRIVED', 'SAMPLING_IN_PROGRESS', 'COLLECTED', 'SEALED'].includes(s)) {
    return 'border-indigo-200 bg-indigo-50 text-indigo-700';
  }

  if (['REJECTED', 'FAILED', 'CANCELLED'].includes(s)) {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }

  return 'border-amber-200 bg-amber-50 text-amber-700';
}

function fmtDate(value?: string | null) {
  if (!value) return '-';

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';

  return d.toLocaleString();
}

function statusRows(counts: Record<string, any> | undefined) {
  return Object.entries(counts || {}).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
}

function Card({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-950">{value}</div>
      {hint ? <div className="mt-1 text-[11px] text-gray-500">{hint}</div> : null}
    </div>
  );
}

export default function PhlebDashboardPage() {
  const params = useParams<{ phlebId: string }>();
  const phlebId = params.phlebId;

  const [days, setDays] = useState<WindowDays>('30');
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const name =
    phlebId
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const [metricsRes, jobsRes] = await Promise.all([
        fetch(`/api/metrics?scope=phleb&id=${encodeURIComponent(phlebId)}&days=${days}`, {
          cache: 'no-store',
        }),
        fetch(
          `/api/phleb-jobs?phlebId=${encodeURIComponent(phlebId)}&includeCompleted=true&limit=200`,
          { cache: 'no-store' },
        ),
      ]);

      const metricsJson = await metricsRes.json().catch(() => null);
      const jobsJson = await jobsRes.json().catch(() => null);

      if (!metricsRes.ok || metricsJson?.ok === false) {
        throw new Error(metricsJson?.error || `Metrics HTTP ${metricsRes.status}`);
      }

      if (!jobsRes.ok || jobsJson?.ok === false) {
        throw new Error(jobsJson?.error || `Jobs HTTP ${jobsRes.status}`);
      }

      setMetrics(metricsJson);
      setJobs(asArray(jobsJson).map(normalizeJob));
    } catch (e: any) {
      setErr(e?.message || 'Unable to load phleb dashboard');
      setMetrics(null);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phlebId, days]);

  const p = payload(metrics);
  const marketplace = p.marketplace || {};
  const specimens = p.specimens || {};
  const finance = p.finance || {};
  const operations = p.operations || {};
  const drawStatusCounts = marketplace.drawStatusCounts || {};
  const bundleStatusCounts = specimens.bundleStatusCounts || {};

  const activeJobs = useMemo(
    () =>
      jobs.filter(
        (job) =>
          !['DELIVERED_TO_LAB', 'COMPLETED', 'CANCELLED', 'REJECTED', 'FAILED'].includes(
            String(job.status || '').toUpperCase(),
          ),
      ),
    [jobs],
  );

  const localGrossCents = jobs.reduce(
    (sum, job) => sum + n(job.finance?.phlebGrossCents),
    0,
  );

  const localNetCents = jobs.reduce(
    (sum, job) => sum + n(job.finance?.phlebNetCents),
    0,
  );

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-950">
            {name} — Phleb Operations Dashboard
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            Field workload, active journey state, specimen custody progress and payout
            visibility for this MedReach phlebotomist.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <Link
            href={`/phleb/${encodeURIComponent(phlebId)}`}
            className="rounded-full border bg-white px-3 py-1 hover:bg-gray-50"
          >
            Field console
          </Link>
          <Link
            href={`/phleb/${encodeURIComponent(phlebId)}/profile`}
            className="rounded-full border bg-white px-3 py-1 hover:bg-gray-50"
          >
            Profile
          </Link>
          <Link
            href={`/phleb/${encodeURIComponent(phlebId)}/payouts`}
            className="rounded-full border bg-white px-3 py-1 hover:bg-gray-50"
          >
            Payouts
          </Link>
        </div>
      </header>

      <section className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-gray-500">Window:</span>
        {(['7', '30', '90'] as WindowDays[]).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setDays(option)}
            className={`rounded-full border px-3 py-1 ${
              days === option
                ? 'border-gray-900 bg-gray-900 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Last {option} days
          </button>
        ))}
        <button
          type="button"
          onClick={load}
          className="rounded-full border bg-white px-3 py-1 text-gray-700 hover:bg-gray-50"
        >
          Refresh
        </button>
      </section>

      {err ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-semibold">Unable to load live phleb dashboard</div>
          <div className="mt-1">{humanErrorMessage(err, "Unable to complete this request. Please try again.")}</div>
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card label="Jobs loaded" value={loading ? '...' : jobs.length} />
        <Card label="Active jobs" value={loading ? '...' : activeJobs.length} />
        <Card
          label="Specimen bundles"
          value={loading ? '...' : jobs.filter((job) => job.bundle?.id).length}
          hint={`${n(specimens.bundles)} gateway bundle rows`}
        />
        <Card
          label="Location pings"
          value={loading ? '...' : n(operations.locationPings)}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card
          label="Gateway phleb gross"
          value={
            loading
              ? '...'
              : n(finance.phlebGrossCents)
                ? moneyFromCents(finance.phlebGrossCents)
                : moneyFromCents(localGrossCents)
          }
        />
        <Card
          label="Gateway phleb net"
          value={
            loading
              ? '...'
              : n(finance.phlebNetCents)
                ? moneyFromCents(finance.phlebNetCents)
                : moneyFromCents(localNetCents)
          }
        />
        <Card
          label="Today earnings"
          value={loading ? '...' : moneyFromZar(metrics?.earnings?.todayZAR)}
        />
        <Card
          label="Month earnings"
          value={loading ? '...' : moneyFromZar(metrics?.earnings?.thisMonthZAR)}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-950">Draw status distribution</h2>
          <div className="mt-4 space-y-2 text-xs">
            {statusRows(drawStatusCounts).length === 0 ? (
              <div className="text-gray-500">No draw status distribution returned.</div>
            ) : (
              statusRows(drawStatusCounts).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between border-b pb-2">
                  <span className="font-mono text-gray-700">{status}</span>
                  <span className="font-semibold">{String(count)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-950">
            Specimen bundle distribution
          </h2>
          <div className="mt-4 space-y-2 text-xs">
            {statusRows(bundleStatusCounts).length === 0 ? (
              <div className="text-gray-500">No specimen bundle statuses returned.</div>
            ) : (
              statusRows(bundleStatusCounts).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between border-b pb-2">
                  <span className="font-mono text-gray-700">{status}</span>
                  <span className="font-semibold">{String(count)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-950">Recent jobs</h2>

        <div className="mt-4 space-y-3">
          {loading ? (
            <div className="text-sm text-gray-500">Loading jobs...</div>
          ) : jobs.length === 0 ? (
            <div className="text-sm text-gray-500">
              No jobs returned for this phleb in the selected gateway payload.
            </div>
          ) : (
            jobs.slice(0, 12).map((job) => {
              const id = job.drawId || job.jobId || job.id || job.orderId || '';

              return (
                <article key={`${id}:${job.updatedAt || job.createdAt || ''}`} className="rounded-xl border p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-gray-950">
                          {job.orderId || id}
                        </div>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusTone(
                            job.status,
                          )}`}
                        >
                          {job.status || 'ASSIGNED'}
                        </span>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusTone(
                            job.bundleStatus || job.bundle?.status,
                          )}`}
                        >
                          Bundle: {job.bundleStatus || job.bundle?.status || 'not created'}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        Lab: {job.lab?.name || job.labId || job.partnerId || '-'} / Scheduled:{' '}
                        {fmtDate(job.scheduledAt)}
                      </div>
                    </div>

                    <Link
                      href={`/phleb/${encodeURIComponent(phlebId)}/orders/${encodeURIComponent(
                        job.orderId || id,
                      )}/label`}
                      className="rounded border bg-white px-3 py-1 text-xs hover:bg-gray-50"
                    >
                      Label
                    </Link>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}