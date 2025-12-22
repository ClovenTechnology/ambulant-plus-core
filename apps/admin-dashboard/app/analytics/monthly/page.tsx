// apps/admin-dashboard/app/analytics/monthly/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

/* ---------- Types ---------- */

type RatingEntity =
  | 'clinician'
  | 'phleb'
  | 'admin'
  | 'rider'
  | 'lab'
  | 'pharmacy';

type RatingSnapshot = {
  entity: RatingEntity;
  min: number; // lowest rating in this month
  max: number; // highest rating in this month
  avg: number;
};

type DailyPoint = {
  date: string; // yyyy-mm-dd
  revenueZAR: number;
  consultations: number;
  deliveries: number;
  draws: number;
};

type TopPartner = {
  kind: 'lab' | 'pharmacy' | 'network' | 'other';
  name: string;
  revenueZAR: number;
};

type ConsultationPayments = {
  card: number; // # of consults paid by card
  medicalAid: number; // # of consults paid by medical aid
  voucher: number; // # of consults paid by voucher
};

type MonthlyPayload = {
  month: string; // e.g. "2025-08"
  revenueZAR: number;
  deliveries: number;
  labTests: number;
  consultations: number;

  // Extended counts (optional, but used when present)
  rxPharmCount?: number; // total pharmacy prescriptions
  rxLabCount?: number; // total lab orders
  sickNotes?: number;
  fitnessCerts?: number;
  referralsInternal?: number;
  referralsExternal?: number;
  followUps?: number;
  appointments?: number;
  closedCases?: number;
  erxFulfilledCareport?: number;
  erxFulfilledMedreach?: number;

  // New: payment breakdown for consults
  consultationPayments?: ConsultationPayments;

  ratings?: RatingSnapshot[];
  daily?: DailyPoint[];
  topPartners?: TopPartner[];
};

type HistoryPoint = {
  label: string; // "Jan", "Feb", …
  revenue: number;
  deliveries: number;
};

type MixItem = {
  label: string;
  value: number;
};

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/* ---------- Fallback snapshot ---------- */

const FALLBACK_MONTHLY: MonthlyPayload = {
  month: '2025-08',
  revenueZAR: 512_000,
  deliveries: 842,
  labTests: 391,
  consultations: 1_260,

  // Extended metrics for richer UX when backend not wired yet
  rxPharmCount: 1_020,
  rxLabCount: 420,
  sickNotes: 210,
  fitnessCerts: 58,
  referralsInternal: 230,
  referralsExternal: 64,
  followUps: 320,
  appointments: 780,
  closedCases: 960,
  erxFulfilledCareport: 840,
  erxFulfilledMedreach: 395,

  // New: consultation payment split
  consultationPayments: {
    card: 520,
    medicalAid: 610,
    voucher: 130,
  },

  ratings: [
    { entity: 'clinician', min: 3.9, max: 4.9, avg: 4.6 },
    { entity: 'phleb', min: 4.1, max: 5.0, avg: 4.7 },
    { entity: 'admin', min: 3.7, max: 4.8, avg: 4.3 },
    { entity: 'rider', min: 3.8, max: 4.9, avg: 4.5 },
    { entity: 'lab', min: 4.0, max: 4.9, avg: 4.6 },
    { entity: 'pharmacy', min: 3.8, max: 4.8, avg: 4.4 },
  ],

  daily: Array.from({ length: 30 }, (_, idx): DailyPoint => {
    const day = idx + 1;
    const factor = 0.75 + 0.4 * Math.sin((idx / 30) * Math.PI * 2);
    const revenueZAR = Math.round((512_000 / 30) * factor);
    const consultations = Math.round((1_260 / 30) * factor);
    const deliveries = Math.round((842 / 30) * factor);
    const draws = Math.round(391 / 30 * (0.6 + 0.3 * factor));
    const date = `2025-08-${String(day).padStart(2, '0')}`;
    return { date, revenueZAR, consultations, deliveries, draws };
  }),

  topPartners: [
    {
      kind: 'pharmacy',
      name: 'Ambulant Pharmacy Network',
      revenueZAR: 182_400,
    },
    {
      kind: 'lab',
      name: 'Ambulant Labs — Cape Town',
      revenueZAR: 126_900,
    },
    {
      kind: 'lab',
      name: 'Ambulant Labs — Johannesburg',
      revenueZAR: 98_500,
    },
    {
      kind: 'network',
      name: 'Ambulant+ External Network',
      revenueZAR: 52_200,
    },
  ],
};

/* ---------- Helpers ---------- */

function formatMonthLabel(ym: string) {
  const [yearStr, monthStr] = ym.split('-');
  const year = Number(yearStr) || new Date().getFullYear();
  const monthIndex = (Number(monthStr) || 1) - 1;
  const name = MONTH_LABELS[monthIndex] ?? ym;
  return `${name} ${year}`;
}

function daysInMonth(ym: string): number {
  const [yearStr, monthStr] = ym.split('-');
  const year = Number(yearStr) || new Date().getFullYear();
  const month = Number(monthStr) || 1;
  return new Date(year, month, 0).getDate();
}

// Build a synthetic 12-month history anchored on the current month’s values
function buildHistory(current: MonthlyPayload): HistoryPoint[] {
  const { month, revenueZAR, deliveries } = current;
  const baseRev = Math.max(revenueZAR, 1);
  const baseDel = Math.max(deliveries, 1);

  const baseMonthIndex = Math.min(
    Math.max(parseInt(month.split('-')[1] || '1', 10) - 1, 0),
    11,
  );

  const multipliers = [
    0.72, 0.8, 0.86, 0.92, 0.97, 1.0, 1.03, 1.06, 1.09, 1.13, 1.17, 1.2,
  ];
  const baseMultiplier = multipliers[baseMonthIndex] || 1;

  return MONTH_LABELS.map((label, i) => {
    const m = multipliers[i] || 1;
    const factor = m / baseMultiplier;
    return {
      label,
      revenue: Math.round(baseRev * factor),
      deliveries: Math.round(baseDel * factor),
    };
  });
}

function safeRatio(
  numerator: number | undefined,
  denominator: number | undefined,
) {
  if (!numerator || !denominator) return 0;
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return 0;
  return numerator / denominator;
}

function currentMonthString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/* ---------- Tiny chart primitives ---------- */

function SparkLine({
  points,
  metric,
  label,
}: {
  points: HistoryPoint[];
  metric: 'revenue' | 'deliveries';
  label: string;
}) {
  if (!points.length) return null;
  const w = 340;
  const h = 140;
  const pad = 24;
  const vals = points.map((p) =>
    metric === 'revenue' ? p.revenue : p.deliveries,
  );
  const max = Math.max(...vals, 1);
  const stepX =
    points.length === 1 ? 0 : (w - pad * 2) / (points.length - 1);

  const path = points
    .map((p, i) => {
      const x = pad + i * stepX;
      const v = metric === 'revenue' ? p.revenue : p.deliveries;
      const y = h - pad - (v / max) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[150px]">
      <polyline
        points={`${pad},${h - pad} ${w - pad},${h - pad}`}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth={1}
      />
      <polyline
        points={path}
        fill="none"
        stroke={metric === 'revenue' ? '#111827' : '#0f766e'}
        strokeWidth={2}
      />
      {points.map((p, i) => {
        const x = pad + i * stepX;
        const v = metric === 'revenue' ? p.revenue : p.deliveries;
        const y = h - pad - (v / max) * (h - pad * 2);
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={2}
            fill={metric === 'revenue' ? '#111827' : '#0f766e'}
          />
        );
      })}
      <title>
        {label}:{' '}
        {points
          .map((p) =>
            `${p.label} ${
              metric === 'revenue' ? `R${p.revenue}` : p.deliveries
            }`,
          )
          .join(' • ')}
      </title>
    </svg>
  );
}

function MixBar({ item, total }: { item: MixItem; total: number }) {
  const pct = total ? Math.round((item.value / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-700">{item.label}</span>
        <span className="text-gray-500">{pct}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-100">
        <div
          className="h-2 rounded-full bg-indigo-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">
      {children}
    </span>
  );
}

/* ---------- Page ---------- */

export default function Monthly() {
  const [data, setData] = useState<MonthlyPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [requestedMonth, setRequestedMonth] = useState<string | null>(
    null,
  );

  // Derived history based on whatever month payload we have
  const history = useMemo(
    () => (data ? buildHistory(data) : []),
    [data],
  );
  const latestHistory = history.length ? history[history.length - 1] : null;

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const monthParam = requestedMonth ?? currentMonthString();
        const url = new URL(
          '/api/analytics/monthly',
          window.location.origin,
        );
        url.searchParams.set('month', monthParam);

        const res = await fetch(url.toString(), { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as MonthlyPayload;
        if (!mounted) return;
        setData(json);
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message || 'Using fallback monthly snapshot.');
        setData(FALLBACK_MONTHLY);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [requestedMonth]);

  if (!data) {
    return (
      <main className="p-6 text-sm text-gray-500">
        Loading monthly summary…
      </main>
    );
  }

  const effectiveMonth =
    data.month || requestedMonth || currentMonthString();
  const monthLabel = formatMonthLabel(effectiveMonth);
  const days = daysInMonth(effectiveMonth);

  const revenuePerDay = safeRatio(data.revenueZAR, days);
  const revenuePerDelivery = safeRatio(
    data.revenueZAR,
    data.deliveries,
  );
  const revenuePerConsult = safeRatio(
    data.revenueZAR,
    data.consultations,
  );
  const testsPerConsult = safeRatio(
    data.labTests,
    data.consultations,
  );

  const rxPharmCount = data.rxPharmCount ?? 0;
  const rxLabCount = data.rxLabCount ?? 0;
  const sickNotes = data.sickNotes ?? 0;
  const fitnessCerts = data.fitnessCerts ?? 0;
  const referralsInternal = data.referralsInternal ?? 0;
  const referralsExternal = data.referralsExternal ?? 0;
  const followUps = data.followUps ?? 0;
  const appointments = data.appointments ?? 0;
  const closedCases = data.closedCases ?? 0;
  const erxFulfilledCareport = data.erxFulfilledCareport ?? 0;
  const erxFulfilledMedreach = data.erxFulfilledMedreach ?? 0;

  // New: payment breakdown
  const payments: ConsultationPayments = data.consultationPayments ?? {
    card: 0,
    medicalAid: 0,
    voucher: 0,
  };

  const totalErx = rxPharmCount + rxLabCount;
  const erxCareportPct =
    safeRatio(erxFulfilledCareport, totalErx) * 100;
  const erxMedreachPct =
    safeRatio(erxFulfilledMedreach, totalErx) * 100;

  const avgRxPharmPerConsult = safeRatio(
    rxPharmCount,
    data.consultations,
  );
  const avgRxLabPerConsult = safeRatio(
    rxLabCount,
    data.consultations,
  );
  const avgSickNotePerConsult = safeRatio(
    sickNotes,
    data.consultations,
  );
  const avgFitnessPerConsult = safeRatio(
    fitnessCerts,
    data.consultations,
  );
  const avgRefInternalPerConsult = safeRatio(
    referralsInternal,
    data.consultations,
  );
  const avgRefExternalPerConsult = safeRatio(
    referralsExternal,
    data.consultations,
  );
  const avgFollowUpPerConsult = safeRatio(
    followUps,
    data.consultations,
  );
  const avgAppointmentPerConsult = safeRatio(
    appointments,
    data.consultations,
  );
  const avgClosedCasesPerConsult = safeRatio(
    closedCases,
    data.consultations,
  );

  // Payment stats
  const cardPerDay = safeRatio(payments.card, days);
  const medicalAidPerDay = safeRatio(payments.medicalAid, days);
  const voucherPerDay = safeRatio(payments.voucher, days);

  const cardPctConsult =
    safeRatio(payments.card, data.consultations) * 100;
  const medAidPctConsult =
    safeRatio(payments.medicalAid, data.consultations) * 100;
  const voucherPctConsult =
    safeRatio(payments.voucher, data.consultations) * 100;

  const daily = data.daily ?? [];
  const topPartners = data.topPartners ?? [];

  // Daily extremes (revenue / consultations / deliveries / draws)
  const highestRevenueDay = daily.reduce<DailyPoint | null>(
    (acc, d) =>
      !acc || d.revenueZAR > acc.revenueZAR ? d : acc,
    null,
  );
  const lowestRevenueDay = daily.reduce<DailyPoint | null>(
    (acc, d) =>
      !acc || d.revenueZAR < acc.revenueZAR ? d : acc,
    null,
  );
  const highestConsultDay = daily.reduce<DailyPoint | null>(
    (acc, d) =>
      !acc || d.consultations > acc.consultations ? d : acc,
    null,
  );
  const highestDeliveryDay = daily.reduce<DailyPoint | null>(
    (acc, d) =>
      !acc || d.deliveries > acc.deliveries ? d : acc,
    null,
  );
  const highestDrawDay = daily.reduce<DailyPoint | null>(
    (acc, d) => (!acc || d.draws > acc.draws ? d : acc),
    null,
  );

  // Simple revenue mix breakdown (backend can override later)
  const rxRev = Math.round(data.revenueZAR * 0.34);
  const careportRev = Math.round(data.revenueZAR * 0.33);
  const medreachRev = Math.round(data.revenueZAR * 0.26);
  const otherRev = Math.max(
    data.revenueZAR - (rxRev + careportRev + medreachRev),
    0,
  );

  const mix: MixItem[] = [
    { label: 'Rx & Consults', value: rxRev },
    { label: 'CarePort (pharmacy)', value: careportRev },
    { label: 'MedReach (lab)', value: medreachRev },
    { label: 'Other services', value: otherRev },
  ].filter((m) => m.value > 0);

  const totalMix = mix.reduce((acc, m) => acc + m.value, 0);

  const ratings = data.ratings ?? [];

  return (
    <main className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Monthly Summary</h1>
          <p className="text-sm text-gray-500 mt-1">
            High-level performance snapshot for{' '}
            <span className="font-medium text-gray-700">
              {monthLabel}
            </span>{' '}
            across revenue, logistics, clinical activity, payments and
            ratings.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {/* Harmonised analytics nav */}
          <div className="inline-flex rounded-full border bg-white overflow-hidden text-xs">
            <Link
              href="/analytics"
              className="px-3 py-1.5 border-r hover:bg-gray-50"
            >
              Overview
            </Link>
            <Link
              href="/analytics/monthly"
              className="px-3 py-1.5 border-r bg-gray-900 text-white"
            >
              Monthly
            </Link>
            <Link
              href="/analytics/daily"
              className="px-3 py-1.5 border-r hover:bg-gray-50"
            >
              Daily
            </Link>
            <Link
              href="/analytics/clinician-payouts"
              className="px-3 py-1.5 hover:bg-gray-50"
            >
              Clinician payouts
            </Link>
          </div>

          {/* Deep links into product analytics */}
          <div className="flex flex-wrap gap-2 text-[11px]">
            <Link
              href="/orders/analytics"
              className="rounded border bg-white px-2.5 py-1 hover:bg-gray-50"
            >
              Orders analytics
            </Link>
            <Link
              href="/careport/analytics"
              className="rounded border bg-white px-2.5 py-1 hover:bg-gray-50"
            >
              CarePort analytics
            </Link>
            <Link
              href="/medreach/analytics"
              className="rounded border bg-white px-2.5 py-1 hover:bg-gray-50"
            >
              MedReach analytics
            </Link>
          </div>

          {/* Month badge + loading hint */}
          <div className="flex items-center justify-end gap-2 text-xs">
            <div className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5">
              <span className="text-gray-500">Month</span>
              <span className="font-medium text-gray-900">
                {monthLabel}
              </span>
            </div>
            {loading && (
              <div className="text-[11px] text-gray-400">
                Refreshing monthly metrics…
              </div>
            )}
          </div>
        </div>
      </header>

      {err && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2 rounded">
          {err}
        </div>
      )}

      {/* Primary KPIs */}
      <section className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-gray-500">Total Revenue</div>
          <div className="text-2xl font-semibold">
            R {data.revenueZAR.toLocaleString()}
          </div>
          <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-gray-500">
            <Badge>
              ~R {Math.round(revenuePerDay).toLocaleString()} / day
            </Badge>
            <Badge>
              ~R{' '}
              {Math.round(revenuePerConsult).toLocaleString()} / consult
            </Badge>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-gray-500">Consultations</div>
          <div className="text-2xl font-semibold">
            {data.consultations.toLocaleString()}
          </div>
          <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-gray-500">
            <Badge>
              {testsPerConsult.toFixed(2)} lab tests / consult
            </Badge>
            <Badge>
              {avgRxPharmPerConsult.toFixed(2)} Rx (pharm) / consult
            </Badge>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-gray-500">
            Deliveries & Draws
          </div>
          <div className="text-2xl font-semibold">
            {data.deliveries.toLocaleString()}{' '}
            <span className="text-sm text-gray-400 font-normal">
              deliveries
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-gray-500">
            <Badge>
              ~R{' '}
              {Math.round(revenuePerDelivery).toLocaleString()} / delivery
            </Badge>
            {data.labTests > 0 && (
              <Badge>{data.labTests.toLocaleString()} lab tests</Badge>
            )}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-gray-500">eRx Pipeline</div>
          <div className="text-2xl font-semibold">
            {totalErx.toLocaleString()}
            <span className="text-sm text-gray-400 font-normal">
              {' '}
              total eRx
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-gray-500">
            <Badge>
              CarePort:{' '}
              {erxFulfilledCareport.toLocaleString()} (
              {erxCareportPct.toFixed(1)}%)
            </Badge>
            <Badge>
              MedReach:{' '}
              {erxFulfilledMedreach.toLocaleString()} (
              {erxMedreachPct.toFixed(1)}%)
            </Badge>
          </div>
        </div>
      </section>

      {/* Consultation Payments */}
      <section className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">
            Consultation Payments — Card / Medical Aid / Voucher
          </h2>
          <span className="text-[11px] text-gray-500">
            Totals, daily averages and share of consultations.
          </span>
        </div>
        <div className="grid sm:grid-cols-3 gap-3 text-sm">
          <PaymentStat
            label="Card"
            total={payments.card}
            perDay={cardPerDay}
            pctOfConsult={cardPctConsult}
          />
          <PaymentStat
            label="Medical aid"
            total={payments.medicalAid}
            perDay={medicalAidPerDay}
            pctOfConsult={medAidPctConsult}
          />
          <PaymentStat
            label="Voucher"
            total={payments.voucher}
            perDay={voucherPerDay}
            pctOfConsult={voucherPctConsult}
          />
        </div>
      </section>

      {/* Care journey per consultation */}
      <section className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">
            Care Journey — Monthly & Daily, Per Consultation
          </h2>
          <span className="text-[11px] text-gray-500">
            Monthly totals, daily averages and per-consultation rates
            across key care events.
          </span>
        </div>
        <div className="grid sm:grid-cols-3 lg:grid-cols-4 gap-3 text-sm">
          <JourneyStat
            label="Pharmacy prescriptions"
            total={rxPharmCount}
            perConsult={avgRxPharmPerConsult}
            perDay={safeRatio(rxPharmCount, days)}
          />
          <JourneyStat
            label="Lab orders"
            total={rxLabCount}
            perConsult={avgRxLabPerConsult}
            perDay={safeRatio(rxLabCount, days)}
          />
          <JourneyStat
            label="Sick notes"
            total={sickNotes}
            perConsult={avgSickNotePerConsult}
            perDay={safeRatio(sickNotes, days)}
          />
          <JourneyStat
            label="Fitness certificates"
            total={fitnessCerts}
            perConsult={avgFitnessPerConsult}
            perDay={safeRatio(fitnessCerts, days)}
          />
          <JourneyStat
            label="Referrals (Ambulant+ network)"
            total={referralsInternal}
            perConsult={avgRefInternalPerConsult}
            perDay={safeRatio(referralsInternal, days)}
          />
          <JourneyStat
            label="Referrals (external)"
            total={referralsExternal}
            perConsult={avgRefExternalPerConsult}
            perDay={safeRatio(referralsExternal, days)}
          />
          <JourneyStat
            label="Follow-ups booked"
            total={followUps}
            perConsult={avgFollowUpPerConsult}
            perDay={safeRatio(followUps, days)}
          />
          <JourneyStat
            label="Appointments booked"
            total={appointments}
            perConsult={avgAppointmentPerConsult}
            perDay={safeRatio(appointments, days)}
          />
          <JourneyStat
            label="Cases closed"
            total={closedCases}
            perConsult={avgClosedCasesPerConsult}
            perDay={safeRatio(closedCases, days)}
          />
        </div>
      </section>

      {/* Trend + mix */}
      <section className="grid gap-4 lg:grid-cols-3">
        {/* Revenue / deliveries trend */}
        <div className="lg:col-span-2 rounded-2xl border bg-white p-4 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium">
                Revenue & Deliveries — Last 12 Months
              </h2>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Synthetic trailing series anchored on the current month
                for at-a-glance trajectory. Wire to backend series when
                ready.
              </p>
            </div>
            {latestHistory && (
              <div className="flex flex-col items-end text-[11px] text-gray-500">
                <span>
                  Latest{' '}
                  <span className="font-medium text-gray-800">
                    {latestHistory.label}
                  </span>
                  : R{' '}
                  {latestHistory.revenue.toLocaleString()} •{' '}
                  {latestHistory.deliveries.toLocaleString()}{' '}
                  deliveries
                </span>
              </div>
            )}
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="rounded-xl border bg-gray-50 p-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-600">Revenue</span>
                <span className="text-gray-500">R (relative)</span>
              </div>
              <SparkLine
                points={history}
                metric="revenue"
                label="Monthly revenue"
              />
            </div>
            <div className="rounded-xl border bg-gray-50 p-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-600">Deliveries</span>
                <span className="text-gray-500"># jobs</span>
              </div>
              <SparkLine
                points={history}
                metric="deliveries"
                label="Monthly deliveries"
              />
            </div>
          </div>
        </div>

        {/* Mix breakdown */}
        <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-4">
          <h2 className="text-sm font-medium">
            Revenue Mix — {monthLabel}
          </h2>
          <p className="text-[11px] text-gray-500">
            Approximate split of this month&apos;s revenue across core
            product lines (Rx & consults, CarePort, MedReach). Replace
            with backend mix when available.
          </p>
          <div className="space-y-3">
            {mix.map((m) => (
              <MixBar key={m.label} item={m} total={totalMix} />
            ))}
          </div>
          <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-[11px] text-gray-600">
            Total: R {totalMix.toLocaleString()} • Deliveries per
            consult:{' '}
            {safeRatio(
              data.deliveries,
              data.consultations,
            ).toFixed(2)}
          </div>
        </div>
      </section>

      {/* Daily extremes + top partners */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-3 lg:col-span-2">
          <h2 className="text-sm font-medium">Daily Extremes</h2>
          <p className="text-[11px] text-gray-500">
            Highest and lowest performing days across revenue,
            consultations, deliveries and lab draws.
          </p>
          {daily.length === 0 ? (
            <div className="text-xs text-gray-500">
              No daily breakdown provided for this month.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
              <ExtremeCard
                label="Revenue"
                highest={highestRevenueDay}
                lowest={lowestRevenueDay}
                format={(v) => `R ${v.toLocaleString()}`}
              />
              <ExtremeCard
                label="Consultations"
                highest={highestConsultDay}
                lowest={null}
                format={(v) => v.toLocaleString()}
              />
              <ExtremeCard
                label="Deliveries"
                highest={highestDeliveryDay}
                lowest={null}
                format={(v) => v.toLocaleString()}
              />
              <ExtremeCard
                label="Lab draws"
                highest={highestDrawDay}
                lowest={null}
                format={(v) => v.toLocaleString()}
              />
            </div>
          )}
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-medium">Top Earning Partners</h2>
          <p className="text-[11px] text-gray-500">
            Highest grossing partners on the platform for this month.
          </p>
          {topPartners.length === 0 ? (
            <div className="text-xs text-gray-500">
              No partner breakdown for this month.
            </div>
          ) : (
            <ul className="space-y-2 text-sm">
              {topPartners.map((p) => (
                <li
                  key={`${p.kind}-${p.name}`}
                  className="flex items-center justify-between"
                >
                  <div className="flex flex-col">
                    <span className="font-medium text-gray-800">
                      {p.name}
                    </span>
                    <span className="text-[11px] text-gray-500">
                      {p.kind === 'pharmacy'
                        ? 'Pharmacy'
                        : p.kind === 'lab'
                        ? 'Lab'
                        : p.kind === 'network'
                        ? 'Ambulant+ network'
                        : 'Other'}
                    </span>
                  </div>
                  <span className="text-sm text-gray-800">
                    R {p.revenueZAR.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Ratings snapshot */}
      <section className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
        <h2 className="text-sm font-medium">
          Experience & Ratings
        </h2>
        <p className="text-[11px] text-gray-500">
          Min / max / average star ratings recorded this month across
          key roles. Plug in your CSAT / NPS sources once wired.
        </p>
        {ratings.length === 0 ? (
          <div className="text-xs text-gray-500">
            No ratings captured for this month.
          </div>
        ) : (
          <div className="grid sm:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
            {ratings.map((r) => (
              <div
                key={r.entity}
                className="rounded-xl border bg-gray-50 p-3 space-y-1"
              >
                <div className="text-[11px] uppercase tracking-wide text-gray-500">
                  {labelForRatingEntity(r.entity)}
                </div>
                <div className="text-base font-semibold text-gray-900">
                  {r.avg.toFixed(1)}★
                </div>
                <div className="text-[11px] text-gray-500">
                  Range {r.min.toFixed(1)}–{r.max.toFixed(1)}★
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Narrative summary */}
      <section className="rounded-2xl border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-medium mb-2">Operator Summary</h2>
        <p className="text-sm text-gray-700">
          In{' '}
          <span className="font-medium">{monthLabel}</span>, the
          platform generated{' '}
          <span className="font-semibold">
            R {data.revenueZAR.toLocaleString()}
          </span>{' '}
          in revenue across{' '}
          <span className="font-semibold">
            {data.consultations.toLocaleString()}
          </span>{' '}
          consultations and{' '}
          <span className="font-semibold">
            {data.deliveries.toLocaleString()}
          </span>{' '}
          deliveries. Each consultation generated on average{' '}
          <span className="font-semibold">
            R {Math.round(revenuePerConsult).toLocaleString()}
          </span>{' '}
          and drove approximately{' '}
          <span className="font-semibold">
            {avgRxPharmPerConsult.toFixed(2)} pharmacy Rx
          </span>{' '}
          and{' '}
          <span className="font-semibold">
            {avgRxLabPerConsult.toFixed(2)} lab orders
          </span>
          , with{' '}
          <span className="font-semibold">
            {testsPerConsult.toFixed(2)} lab tests
          </span>{' '}
          processed per consultation.
        </p>
        <p className="text-sm text-gray-700 mt-2">
          Payment-wise, about{' '}
          <span className="font-semibold">
            {cardPctConsult.toFixed(0)}% card
          </span>
          ,{' '}
          <span className="font-semibold">
            {medAidPctConsult.toFixed(0)}% medical aid
          </span>{' '}
          and{' '}
          <span className="font-semibold">
            {voucherPctConsult.toFixed(0)}% voucher
          </span>{' '}
          consultations were recorded, with clear levers to tune
          pricing, benefits and campaigns per payer mix.
        </p>
        <p className="text-sm text-gray-700 mt-2">
          Clinicians, phlebs, riders, labs and pharmacies maintained
          average experience scores in the{' '}
          <span className="font-semibold">
            {ratings.length
              ? `${(
                  ratings.reduce((a, r) => a + r.avg, 0) /
                  ratings.length
                ).toFixed(1)}★`
              : '4–5★'}
          </span>{' '}
          band. Daily extremes highlight which days were most
          productive; the top partner list surfaces which labs and
          pharmacies are driving share of wallet this month, ready for
          account reviews or incentives.
        </p>
      </section>
    </main>
  );
}

/* ---------- Small components ---------- */

function JourneyStat({
  label,
  total,
  perConsult,
  perDay,
}: {
  label: string;
  total: number;
  perConsult: number;
  perDay: number;
}) {
  return (
    <div className="rounded-xl border bg-gray-50 p-3 space-y-1">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className="text-base font-semibold text-gray-900">
        {total.toLocaleString()}
      </div>
      <div className="text-[11px] text-gray-500 space-y-0.5">
        <div>~{perDay.toFixed(2)} per day</div>
        {perConsult ? (
          <div>{perConsult.toFixed(2)} per consult</div>
        ) : (
          <div className="text-gray-400">No activity recorded</div>
        )}
      </div>
    </div>
  );
}

function PaymentStat({
  label,
  total,
  perDay,
  pctOfConsult,
}: {
  label: string;
  total: number;
  perDay: number;
  pctOfConsult: number;
}) {
  return (
    <div className="rounded-xl border bg-gray-50 p-3 space-y-1">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className="text-base font-semibold text-gray-900">
        {total.toLocaleString()} consults
      </div>
      <div className="text-[11px] text-gray-500 space-y-0.5">
        <div>~{perDay.toFixed(2)} per day</div>
        <div>{pctOfConsult.toFixed(1)}% of all consults</div>
      </div>
    </div>
  );
}

function ExtremeCard({
  label,
  highest,
  lowest,
  format,
}: {
  label: string;
  highest: DailyPoint | null;
  lowest: DailyPoint | null;
  format: (v: number) => string;
}) {
  return (
    <div className="rounded-xl border bg-gray-50 p-3 space-y-1">
      <div className="text-[11px] text-gray-500">{label}</div>
      {highest ? (
        <div className="text-xs text-gray-700">
          <span className="font-medium">Peak</span>{' '}
          {format(
            label === 'Revenue'
              ? highest.revenueZAR
              : label === 'Consultations'
              ? highest.consultations
              : label === 'Deliveries'
              ? highest.deliveries
              : highest.draws,
          )}{' '}
          <span className="text-[11px] text-gray-500">
            on {highest.date}
          </span>
        </div>
      ) : (
        <div className="text-xs text-gray-400">
          No data for this metric.
        </div>
      )}
      {lowest && label === 'Revenue' && (
        <div className="text-xs text-gray-500">
          <span className="font-medium">Lowest</span>{' '}
          {format(lowest.revenueZAR)} on {lowest.date}
        </div>
      )}
    </div>
  );
}

function labelForRatingEntity(e: RatingEntity) {
  switch (e) {
    case 'clinician':
      return 'Clinicians';
    case 'phleb':
      return 'Phlebs';
    case 'admin':
      return 'Admin staff';
    case 'rider':
      return 'Riders';
    case 'lab':
      return 'Labs';
    case 'pharmacy':
      return 'Pharmacies';
    default:
      return e;
  }
}
