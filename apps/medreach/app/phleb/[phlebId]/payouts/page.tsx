// apps/medreach/app/phleb/[phlebId]/payouts/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

type Job = {
  id: string;
  drawId?: string;
  jobId?: string;
  orderId?: string;
  status?: string;
  scheduledAt?: string | null;
  deliveredAt?: string | null;
  receivedByLabAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  lab?: {
    id?: string;
    name?: string;
  } | null;
  labId?: string | null;
  partnerId?: string | null;
  finance?: {
    currency?: string;
    phlebGrossCents?: number;
    phlebNetCents?: number;
    platformFeeCents?: number;
    logisticsFeeCents?: number;
    coldChainSurchargeCents?: number;
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
  finance?: Record<string, number>;
  data?: {
    finance?: Record<string, number>;
  };
};

type ProfileResponse = {
  data?: any;
  profile?: any;
  payoutAccountMasked?: string | null;
  commissionKind?: string | null;
  commissionValue?: number | null;
  currency?: string | null;
};

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

function fmtDate(value?: string | null) {
  if (!value) return '-';

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';

  return d.toLocaleString();
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
    deliveredAt: raw?.deliveredAt || draw?.receivedByLabAt || raw?.receivedByLabAt || null,
    receivedByLabAt: raw?.receivedByLabAt || draw?.receivedByLabAt || null,
    createdAt: raw?.createdAt || draw?.createdAt || null,
    updatedAt: raw?.updatedAt || draw?.updatedAt || null,
    lab: raw?.lab || null,
    labId: raw?.labId || raw?.partnerId || draw?.partnerId || raw?.lab?.id || null,
    partnerId: raw?.partnerId || draw?.partnerId || raw?.labId || null,
    finance: raw?.finance || null,
  };
}

function profileOf(raw: ProfileResponse | null) {
  return raw?.data || raw?.profile || raw || {};
}

function financeOf(metrics: MetricsResponse | null) {
  return metrics?.data?.finance || metrics?.finance || {};
}

function statusTone(status?: string | null) {
  const s = String(status || '').toUpperCase();

  if (['DELIVERED_TO_LAB', 'COMPLETED', 'ACCEPTED'].includes(s)) {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (['REJECTED', 'FAILED', 'CANCELLED'].includes(s)) {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }

  return 'border-gray-200 bg-gray-50 text-gray-700';
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

export default function PhlebPayoutsPage() {
  const params = useParams<{ phlebId: string }>();
  const phlebId = params.phlebId;

  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
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
      const [metricsRes, profileRes, jobsRes] = await Promise.all([
        fetch(`/api/metrics?scope=phleb&id=${encodeURIComponent(phlebId)}&days=90`, {
          cache: 'no-store',
        }),
        fetch(`/api/phlebs/profile?phlebId=${encodeURIComponent(phlebId)}`, {
          cache: 'no-store',
        }),
        fetch(
          `/api/phleb-jobs?phlebId=${encodeURIComponent(phlebId)}&includeCompleted=true&limit=300`,
          { cache: 'no-store' },
        ),
      ]);

      const metricsJson = await metricsRes.json().catch(() => null);
      const profileJson = await profileRes.json().catch(() => null);
      const jobsJson = await jobsRes.json().catch(() => null);

      if (!metricsRes.ok || metricsJson?.ok === false) {
        throw new Error(metricsJson?.error || `Metrics HTTP ${metricsRes.status}`);
      }

      if (!profileRes.ok || profileJson?.ok === false) {
        throw new Error(profileJson?.error || `Profile HTTP ${profileRes.status}`);
      }

      if (!jobsRes.ok || jobsJson?.ok === false) {
        throw new Error(jobsJson?.error || `Jobs HTTP ${jobsRes.status}`);
      }

      setMetrics(metricsJson);
      setProfile(profileJson);
      setJobs(asArray(jobsJson).map(normalizeJob));
    } catch (e: any) {
      setErr(e?.message || 'Unable to load payouts');
      setMetrics(null);
      setProfile(null);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phlebId]);

  const profilePayload = profileOf(profile);
  const finance = financeOf(metrics);
  const currency = profilePayload.currency || jobs[0]?.finance?.currency || 'ZAR';

  const totals = useMemo(() => {
    return jobs.reduce(
      (acc, job) => {
        acc.gross += n(job.finance?.phlebGrossCents);
        acc.net += n(job.finance?.phlebNetCents);
        acc.platform += n(job.finance?.platformFeeCents);
        acc.logistics += n(job.finance?.logisticsFeeCents);
        acc.coldChain += n(job.finance?.coldChainSurchargeCents);

        if (String(job.status || '').toUpperCase() === 'DELIVERED_TO_LAB') {
          acc.delivered += 1;
        }

        return acc;
      },
      {
        gross: 0,
        net: 0,
        platform: 0,
        logistics: 0,
        coldChain: 0,
        delivered: 0,
      },
    );
  }, [jobs]);

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-950">
            {name} — Payouts
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-600">
            Gateway-backed phleb earnings, settlement visibility and payout-readiness state.
            Actual disbursement remains governed by finance/admin settlement controls.
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
            href={`/phleb/${encodeURIComponent(phlebId)}/dashboard`}
            className="rounded-full border bg-white px-3 py-1 hover:bg-gray-50"
          >
            Dashboard
          </Link>
          <Link
            href={`/phleb/${encodeURIComponent(phlebId)}/profile`}
            className="rounded-full border bg-white px-3 py-1 hover:bg-gray-50"
          >
            Profile
          </Link>
        </div>
      </header>

      {err ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-semibold">Unable to load live payout data</div>
          <div className="mt-1">{err}</div>
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card
          label="Payout account"
          value={loading ? '...' : profilePayload.payoutAccountMasked || '-'}
          hint="Masked account from phleb profile"
        />
        <Card
          label="Gateway gross"
          value={
            loading
              ? '...'
              : n(finance.phlebGrossCents)
                ? moneyFromCents(finance.phlebGrossCents, currency)
                : moneyFromCents(totals.gross, currency)
          }
        />
        <Card
          label="Gateway net"
          value={
            loading
              ? '...'
              : n(finance.phlebNetCents)
                ? moneyFromCents(finance.phlebNetCents, currency)
                : moneyFromCents(totals.net, currency)
          }
        />
        <Card
          label="Month earnings"
          value={loading ? '...' : moneyFromZar(metrics?.earnings?.thisMonthZAR)}
        />
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card label="Jobs in view" value={loading ? '...' : jobs.length} />
        <Card label="Delivered jobs" value={loading ? '...' : totals.delivered} />
        <Card
          label="Logistics fees"
          value={loading ? '...' : moneyFromCents(totals.logistics, currency)}
        />
        <Card
          label="Cold-chain surcharges"
          value={loading ? '...' : moneyFromCents(totals.coldChain, currency)}
        />
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-950">Settlement readiness</h2>

        <div className="mt-4 grid grid-cols-1 gap-3 text-xs md:grid-cols-4">
          <div className="rounded-lg border bg-gray-50 p-3">
            <div className="text-gray-500">Approval status</div>
            <div className="font-semibold">
              {profilePayload.approvalStatus || profilePayload.status || 'PENDING'}
            </div>
          </div>
          <div className="rounded-lg border bg-gray-50 p-3">
            <div className="text-gray-500">Commission</div>
            <div className="font-semibold">
              {profilePayload.commissionKind || '-'}{' '}
              {profilePayload.commissionValue == null
                ? ''
                : String(profilePayload.commissionValue)}
            </div>
          </div>
          <div className="rounded-lg border bg-gray-50 p-3">
            <div className="text-gray-500">Currency</div>
            <div className="font-semibold">{currency}</div>
          </div>
          <div className="rounded-lg border bg-gray-50 p-3">
            <div className="text-gray-500">Payout configured</div>
            <div className="font-semibold">
              {profilePayload.payoutAccountMasked ? 'Yes' : 'No'}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-950">Job-level payout lines</h2>

        <div className="mt-4 overflow-x-auto">
          {loading ? (
            <div className="text-sm text-gray-500">Loading payout lines...</div>
          ) : jobs.length === 0 ? (
            <div className="text-sm text-gray-500">
              No job-level payout rows were returned for this phleb.
            </div>
          ) : (
            <table className="min-w-full text-left text-xs">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="py-2 pr-4 font-medium">Order</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Lab</th>
                  <th className="py-2 pr-4 font-medium">Delivered</th>
                  <th className="py-2 pr-4 font-medium">Gross</th>
                  <th className="py-2 pr-4 font-medium">Net</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const id = job.drawId || job.jobId || job.id || job.orderId || '';

                  return (
                    <tr key={`${id}:${job.updatedAt || job.createdAt || ''}`} className="border-b">
                      <td className="py-3 pr-4 font-mono">
                        {job.orderId || id}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusTone(
                            job.status,
                          )}`}
                        >
                          {job.status || 'ASSIGNED'}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        {job.lab?.name || job.labId || job.partnerId || '-'}
                      </td>
                      <td className="py-3 pr-4">
                        {fmtDate(job.receivedByLabAt || job.deliveredAt)}
                      </td>
                      <td className="py-3 pr-4 font-semibold">
                        {moneyFromCents(job.finance?.phlebGrossCents, currency)}
                      </td>
                      <td className="py-3 pr-4 font-semibold">
                        {moneyFromCents(job.finance?.phlebNetCents, currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </main>
  );
}