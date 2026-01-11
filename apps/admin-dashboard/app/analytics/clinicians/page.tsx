// apps/admin-dashboard/app/analytics/clinicians/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  Clock,
  Download,
  Filter,
  Hourglass,
  RefreshCcw,
  Search,
  Shield,
  Timer,
  TrendingUp,
  UserPlus,
  Users,
  Wifi,
  Zap,
  Laptop,
  Coins,
  CreditCard,
  Percent,
  Boxes,
} from 'lucide-react';

type RangeKey = '7d' | '30d' | '90d' | '12m';

type ClinicianKpis = {
  totalClinicians: number;
  activeClinicians: number;
  newClinicians: number;
  onboardingInProgress: number;

  avgTimeToFirstConsultDays: number;
  avgClinicianOnTimeJoinRatePct: number;
  avgPatientOnTimeJoinRatePct: number;
  avgOverrunRatePct: number;
  churnRatePct: number;

  totalAppointmentsBooked: number;
  totalConsultsCompleted: number;
  totalConsultationMinutes: number;

  // New backend metrics (preferred)
  onlineNow: number;
  activeSeen7d: number;
  activeSeen30d: number;
  medianTrainingHours: number | null;
  noShowRatePct: number;

  grossRevenueCents: number;
  platformFeesCents: number;
  clinicianTakeCents: number;

  deviceAdoptionRatePct: number;

  // Back-compat (older UI/mock)
  deviceCliniciansWithDevice?: number;
  deviceTotalDevices?: number;
  deviceAdoptionPct?: number;
};

type BucketRow = {
  label: string;
  sessions: number;
  sharePct: number;
};

type OnboardingStageRow = {
  stage:
    | 'applied'
    | 'screened'
    | 'approved'
    | 'training_scheduled'
    | 'training_completed'
    | 'live';
  label: string;
  clinicians: number;
  sharePct: number;
  medianHoursToStage?: number | null;
};

type PlanRow = {
  planId: string;
  label: string;
  clinicians: number;
  activeClinicians: number;
  sharePct: number;
  monthlyChangePct: number;
};

type DeactivationReasonRow = {
  reasonKey: 'death' | 'disciplinary' | 'suspended' | 'unsubscribed' | 'dormant' | 'other';
  label: string;
  accounts: number;
  sharePct: number;
};

type LateClinicianRow = {
  clinicianId: string;
  name: string;
  classLabel?: string | null;
  status: 'active' | 'suspended' | 'deactivated';
  sessionsAnalysed: number;
  clinicianOnTimeJoinRatePct: number;
  avgClinicianJoinDelayMin: number;
  overrunRatePct: number;
};

// Backend shape (route.ts)
type PaymentMixRow = {
  status: string; // Payment.status
  count: number;
  sharePct: number;
  grossRevenueCents: number;
  platformFeesCents: number;
};

type DeviceMixRow = {
  deviceKey: string;
  devices: number;
  cliniciansWithDevice: number;
  shareCliniciansPct: number;
};

type ClinicianAnalyticsCompare = {
  key: 'prev';
  startISO: string;
  endISO: string;
  kpis: ClinicianKpis;
};

type TrendsPayload = {
  labels: string[];
  series: Record<string, number[]>;
};

type ClinicianAnalyticsPayload = {
  range?: { key: RangeKey; startISO: string; endISO: string };
  compare?: ClinicianAnalyticsCompare | null;

  kpis: ClinicianKpis;

  punctualityBucketsClinician: BucketRow[];
  punctualityBucketsPatient: BucketRow[];
  overrunBuckets: BucketRow[];
  onboardingStages: OnboardingStageRow[];
  plans: PlanRow[];
  deactivations: DeactivationReasonRow[];
  lateClinicians: LateClinicianRow[];

  paymentMix?: PaymentMixRow[];
  deviceMix?: DeviceMixRow[];

  trends?: TrendsPayload;

  meta?: { ok: true; partial: boolean; warnings: string[] };
};

/* ---------- Local mock (fallback) ---------- */
/* NOTE: updated to match the new backend keys */
const MOCK_CLINICIANS_ANALYTICS: ClinicianAnalyticsPayload = {
  range: { key: '30d', startISO: new Date(Date.now() - 30 * 864e5).toISOString(), endISO: new Date().toISOString() },
  kpis: {
    totalClinicians: 120,
    activeClinicians: 98,
    newClinicians: 8,
    onboardingInProgress: 14,
    avgTimeToFirstConsultDays: 5.6,
    avgClinicianOnTimeJoinRatePct: 84,
    avgPatientOnTimeJoinRatePct: 79,
    avgOverrunRatePct: 21,
    churnRatePct: 3.5,
    totalAppointmentsBooked: 1820,
    totalConsultsCompleted: 1530,
    totalConsultationMinutes: 29840,

    onlineNow: 27,
    activeSeen7d: 72,
    activeSeen30d: 94,
    medianTrainingHours: 10.5,
    noShowRatePct: 6.8,
    grossRevenueCents: 8_250_000,
    platformFeesCents: 1_320_000,
    clinicianTakeCents: 6_410_000,
    deviceAdoptionRatePct: 62.2,
  },
  compare: {
    key: 'prev',
    startISO: new Date(Date.now() - 60 * 864e5).toISOString(),
    endISO: new Date(Date.now() - 30 * 864e5).toISOString(),
    kpis: {
      totalClinicians: 118,
      activeClinicians: 95,
      newClinicians: 6,
      onboardingInProgress: 16,
      avgTimeToFirstConsultDays: 6.2,
      avgClinicianOnTimeJoinRatePct: 82.1,
      avgPatientOnTimeJoinRatePct: 78.6,
      avgOverrunRatePct: 23.0,
      churnRatePct: 4.1,
      totalAppointmentsBooked: 1710,
      totalConsultsCompleted: 1420,
      totalConsultationMinutes: 27910,

      onlineNow: 24,
      activeSeen7d: 68,
      activeSeen30d: 90,
      medianTrainingHours: 12.0,
      noShowRatePct: 7.6,
      grossRevenueCents: 7_980_000,
      platformFeesCents: 1_240_000,
      clinicianTakeCents: 6_120_000,
      deviceAdoptionRatePct: 59.0,
    },
  },
  trends: {
    labels: ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 't10', 't11', 't12'],
    series: {
      totalAppointmentsBooked: [1400, 1480, 1520, 1600, 1660, 1705, 1750, 1710, 1765, 1788, 1806, 1820],
      totalConsultsCompleted: [1180, 1210, 1240, 1300, 1330, 1360, 1395, 1402, 1450, 1480, 1510, 1530],
      avgClinicianOnTimeJoinRatePct: [80, 81, 82, 83, 82, 84, 85, 83, 84, 85, 84, 84],
      avgOverrunRatePct: [26, 25, 24, 23, 22, 22, 21, 22, 21, 21, 21, 21],
      noShowRatePct: [8.4, 8.0, 7.8, 7.4, 7.2, 7.0, 7.1, 6.9, 6.8, 6.9, 6.8, 6.8],
      grossRevenueCents: [6_700_000, 6_950_000, 7_120_000, 7_340_000, 7_560_000, 7_700_000, 7_860_000, 7_980_000, 8_050_000, 8_110_000, 8_190_000, 8_250_000],
      platformFeesCents: [900_000, 980_000, 1_020_000, 1_080_000, 1_120_000, 1_150_000, 1_190_000, 1_240_000, 1_260_000, 1_280_000, 1_300_000, 1_320_000],
      clinicianTakeCents: [5_800_000, 5_970_000, 6_100_000, 6_260_000, 6_420_000, 6_550_000, 6_670_000, 6_740_000, 6_790_000, 6_830_000, 6_890_000, 6_410_000],
      deviceAdoptionRatePct: [52, 54, 55, 56, 58, 58, 59, 60, 61, 61, 62, 62.2],
      activeSeen7d: [60, 62, 64, 65, 66, 68, 69, 70, 71, 71, 72, 72],
      activeSeen30d: [86, 87, 88, 89, 90, 90, 91, 92, 92, 93, 94, 94],
      onlineNow: [18, 20, 22, 23, 21, 24, 25, 26, 24, 25, 26, 27],
      medianTrainingHours: [12.4, 12.1, 11.8, 11.5, 11.2, 11.0, 10.8, 10.7, 10.6, 10.6, 10.5, 10.5],
      churnRatePct: [4.4, 4.2, 4.0, 3.9, 3.8, 3.7, 3.7, 3.6, 3.6, 3.5, 3.5, 3.5],
      avgTimeToFirstConsultDays: [6.5, 6.4, 6.3, 6.2, 6.1, 6.0, 5.9, 5.8, 5.8, 5.7, 5.7, 5.6],
      totalConsultationMinutes: [25000, 25800, 26500, 27200, 27800, 28300, 28750, 27910, 28800, 29200, 29500, 29840],
      newClinicians: [4, 5, 6, 6, 7, 7, 8, 6, 7, 7, 8, 8],
    },
  },

  punctualityBucketsClinician: [
    { label: 'On time (≤ grace)', sessions: 1420, sharePct: 78 },
    { label: '0–5 min late', sessions: 260, sharePct: 14 },
    { label: '5–10 min late', sessions: 90, sharePct: 5 },
    { label: '>10 min late', sessions: 50, sharePct: 3 },
  ],
  punctualityBucketsPatient: [
    { label: 'On time (≤ grace)', sessions: 1350, sharePct: 74 },
    { label: '0–5 min late', sessions: 290, sharePct: 16 },
    { label: '5–10 min late', sessions: 120, sharePct: 7 },
    { label: '>10 min late', sessions: 60, sharePct: 3 },
  ],
  overrunBuckets: [
    { label: 'On time / early', sessions: 980, sharePct: 54 },
    { label: '0–25% over', sessions: 520, sharePct: 29 },
    { label: '25–50% over', sessions: 210, sharePct: 12 },
    { label: '>50% over', sessions: 110, sharePct: 6 },
  ],
  onboardingStages: [
    { stage: 'applied', label: 'Applied', clinicians: 40, sharePct: 100, medianHoursToStage: null },
    { stage: 'screened', label: 'Screened', clinicians: 32, sharePct: 80, medianHoursToStage: 24 },
    { stage: 'approved', label: 'Approved', clinicians: 24, sharePct: 60, medianHoursToStage: 52 },
    { stage: 'training_scheduled', label: 'Training scheduled', clinicians: 20, sharePct: 50, medianHoursToStage: 72 },
    { stage: 'training_completed', label: 'Training completed', clinicians: 18, sharePct: 45, medianHoursToStage: 96 },
    { stage: 'live', label: 'Live on platform', clinicians: 16, sharePct: 40, medianHoursToStage: 130 },
  ],
  plans: [
    { planId: 'starter', label: 'Starter', clinicians: 40, activeClinicians: 36, sharePct: 36, monthlyChangePct: 4.5 },
    { planId: 'pro', label: 'Pro', clinicians: 50, activeClinicians: 44, sharePct: 42, monthlyChangePct: 7.3 },
    { planId: 'enterprise', label: 'Enterprise', clinicians: 30, activeClinicians: 18, sharePct: 22, monthlyChangePct: -2.1 },
  ],
  deactivations: [
    { reasonKey: 'unsubscribed', label: 'Unsubscribed / left', accounts: 6, sharePct: 46 },
    { reasonKey: 'dormant', label: 'Dormant', accounts: 4, sharePct: 31 },
    { reasonKey: 'disciplinary', label: 'Disciplinary', accounts: 2, sharePct: 15 },
    { reasonKey: 'suspended', label: 'Suspended', accounts: 1, sharePct: 8 },
  ],
  lateClinicians: [
    {
      clinicianId: 'cln-001',
      name: 'Dr. Naidoo',
      classLabel: 'Class A — Doctors',
      status: 'active',
      sessionsAnalysed: 62,
      clinicianOnTimeJoinRatePct: 61,
      avgClinicianJoinDelayMin: 4.8,
      overrunRatePct: 38,
    },
    {
      clinicianId: 'cln-017',
      name: 'Physio Mbele',
      classLabel: 'Class B — Allied',
      status: 'active',
      sessionsAnalysed: 34,
      clinicianOnTimeJoinRatePct: 64,
      avgClinicianJoinDelayMin: 4.2,
      overrunRatePct: 32,
    },
    {
      clinicianId: 'cln-023',
      name: 'Coach Smith',
      classLabel: 'Class C — Wellness',
      status: 'suspended',
      sessionsAnalysed: 20,
      clinicianOnTimeJoinRatePct: 40,
      avgClinicianJoinDelayMin: 7.1,
      overrunRatePct: 55,
    },
  ],
  paymentMix: [
    { status: 'captured', count: 1480, sharePct: 96, grossRevenueCents: 7_930_000, platformFeesCents: 1_260_000 },
    { status: 'refunded', count: 32, sharePct: 3, grossRevenueCents: 210_000, platformFeesCents: 40_000 },
    { status: 'failed', count: 18, sharePct: 1, grossRevenueCents: 110_000, platformFeesCents: 20_000 },
  ],
  deviceMix: [
    { deviceKey: 'nexring', devices: 46, cliniciansWithDevice: 34, shareCliniciansPct: 34.7 },
    { deviceKey: 'health-monitor-6in1', devices: 33, cliniciansWithDevice: 25, shareCliniciansPct: 25.5 },
    { deviceKey: 'digital-stethoscope', devices: 18, cliniciansWithDevice: 12, shareCliniciansPct: 12.2 },
    { deviceKey: 'hd-otoscope', devices: 7, cliniciansWithDevice: 5, shareCliniciansPct: 5.1 },
  ],
  meta: { ok: true, partial: false, warnings: [] },
};

/* ---------- Formatting helpers ---------- */

const nf0 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function pct(n: number, digits = 1) {
  const v = Number.isFinite(n) ? n : 0;
  return (digits === 0 ? nf0 : digits === 2 ? nf2 : nf1).format(v) + '%';
}

function fmtHrs(hours: number) {
  const v = Number.isFinite(hours) ? hours : 0;
  return nf1.format(v) + ' h';
}

function fmtMin(min: number) {
  const v = Number.isFinite(min) ? min : 0;
  return nf1.format(v) + ' min';
}

function fmtMoneyZarFromCents(cents?: number) {
  const v = Number.isFinite(cents as number) ? (cents as number) : 0;
  const zar = v / 100;
  try {
    return zar.toLocaleString(undefined, { style: 'currency', currency: 'ZAR', maximumFractionDigits: 0 });
  } catch {
    return `R ${nf0.format(zar)}`;
  }
}

function humanTs(d: Date) {
  try {
    return d.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(d);
  }
}

function downloadCsv(filename: string, rows: Record<string, any>[]) {
  const keys = Array.from(
    rows.reduce((s, r) => {
      Object.keys(r || {}).forEach((k) => s.add(k));
      return s;
    }, new Set<string>()),
  );

  const esc = (v: any) => {
    const s = v == null ? '' : String(v);
    const needs = /[,"\n]/.test(s);
    const out = s.replace(/"/g, '""');
    return needs ? `"${out}"` : out;
  };

  const header = keys.map(esc).join(',');
  const lines = rows.map((r) => keys.map((k) => esc(r?.[k])).join(','));
  const csv = [header, ...lines].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function paymentStatusLabel(status: string) {
  const s = String(status || '').toLowerCase();
  if (s.includes('captur') || s === 'paid' || s === 'success') return 'Captured';
  if (s.includes('refund')) return 'Refunded';
  if (s.includes('fail')) return 'Failed';
  if (s.includes('pend') || s.includes('hold')) return 'Pending';
  if (s.includes('cancel')) return 'Cancelled';
  return status || 'Unknown';
}

/* ---------- UI atoms (NO sheen/grid on non-KPI cards) ---------- */

function Card({
  title,
  subtitle,
  right,
  children,
  className = '',
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={[
        'relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white/85 shadow-sm backdrop-blur',
        'ring-1 ring-white/60',
        className,
      ].join(' ')}
    >
      {(title || subtitle || right) && (
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="min-w-0">
            {title && <div className="text-sm font-semibold text-slate-900">{title}</div>}
            {subtitle && <div className="mt-0.5 text-[12px] leading-5 text-slate-500">{subtitle}</div>}
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </div>
      )}
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'info';
  children: ReactNode;
}) {
  const cls =
    tone === 'good'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : tone === 'warn'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : tone === 'bad'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : tone === 'info'
      ? 'border-sky-200 bg-sky-50 text-sky-700'
      : 'border-slate-200 bg-slate-50 text-slate-700';
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] ${cls}`}>{children}</span>;
}

function SoftButton({
  onClick,
  icon,
  children,
  disabled,
  title,
}: {
  onClick?: () => void;
  icon?: ReactNode;
  children: ReactNode;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={[
        'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[12px] font-medium',
        'bg-white/85 hover:bg-white shadow-sm',
        'border-slate-200 text-slate-800',
        'disabled:cursor-not-allowed disabled:opacity-60',
      ].join(' ')}
    >
      {icon}
      {children}
    </button>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  helper,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  helper?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="group inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/85 px-3 py-2 text-left text-[12px] shadow-sm hover:bg-white"
      aria-pressed={checked}
      title={helper}
    >
      <span
        className={[
          'relative inline-flex h-5 w-9 items-center rounded-full border transition',
          checked ? 'border-slate-900 bg-slate-900' : 'border-slate-300 bg-slate-200',
        ].join(' ')}
      >
        <span
          className={[
            'inline-block h-4 w-4 rounded-full bg-white shadow-sm transition',
            checked ? 'translate-x-4' : 'translate-x-0.5',
          ].join(' ')}
        />
      </span>
      <span className="min-w-0">
        <span className="font-medium text-slate-800">{label}</span>
        {helper ? <span className="ml-2 hidden text-slate-500 sm:inline">{helper}</span> : null}
      </span>
    </button>
  );
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-200/70 ${className}`} />;
}

/* ---------- Mini sparkline ---------- */

function MiniSparkline({
  values,
  tone = 'neutral',
}: {
  values: number[];
  tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'info';
}) {
  const w = 84;
  const h = 26;
  const pad = 2;

  const { pts, min, max } = useMemo(() => {
    const v = (values || []).filter((x) => Number.isFinite(x));
    if (!v.length) return { pts: '', min: 0, max: 0 };
    const mn = Math.min(...v);
    const mx = Math.max(...v);
    const span = mx - mn || 1;

    const p = v
      .map((x, i) => {
        const px = pad + (i * (w - pad * 2)) / Math.max(v.length - 1, 1);
        const py = h - pad - ((x - mn) * (h - pad * 2)) / span;
        return `${px.toFixed(1)},${py.toFixed(1)}`;
      })
      .join(' ');
    return { pts: p, min: mn, max: mx };
  }, [values]);

  const stroke =
    tone === 'good'
      ? 'stroke-emerald-600'
      : tone === 'warn'
      ? 'stroke-amber-600'
      : tone === 'bad'
      ? 'stroke-rose-600'
      : tone === 'info'
      ? 'stroke-sky-600'
      : 'stroke-slate-800';

  return (
    <div className="flex items-center gap-2">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
        <defs>
          <linearGradient id="sparkFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="currentColor" stopOpacity="0.18" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path d={`M${pad},${h - pad} H${w - pad}`} className="stroke-slate-200" strokeWidth="1" fill="none" />

        {pts ? (
          <>
            <polyline
              points={pts}
              className={`${stroke}`}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d={`M ${pts} L ${w - pad},${h - pad} L ${pad},${h - pad} Z`}
              fill="url(#sparkFill)"
              className="text-slate-900"
            />
          </>
        ) : null}
      </svg>

      <div className="hidden text-[10px] text-slate-500 md:block">
        {Number.isFinite(min) && Number.isFinite(max) && min !== max ? (
          <>
            <div>min {nf1.format(min)}</div>
            <div>max {nf1.format(max)}</div>
          </>
        ) : (
          <div className="mt-3">—</div>
        )}
      </div>
    </div>
  );
}

/* ---------- KPI tile (ONLY place with visual “grid/dots”) ---------- */

function StatTile({
  icon,
  label,
  value,
  helper,
  tone,
  trend,
  deltaNode,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  helper?: ReactNode;
  tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'info';
  trend?: number[];
  deltaNode?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white/85 p-4 shadow-sm backdrop-blur">
      {/* KPI-only dot texture */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            'radial-gradient(rgba(15,23,42,0.14) 1px, transparent 1px), radial-gradient(rgba(2,132,199,0.12) 1px, transparent 1px)',
          backgroundSize: '18px 18px, 22px 22px',
          backgroundPosition: '0 0, 6px 8px',
        }}
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-800">
            {icon}
          </div>
          <div className="flex items-center gap-2">
            {deltaNode}
            {tone ? (
              <Badge tone={tone}>
                {tone === 'good'
                  ? 'Healthy'
                  : tone === 'warn'
                  ? 'Watch'
                  : tone === 'bad'
                  ? 'Risk'
                  : tone === 'info'
                  ? 'Info'
                  : '—'}
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="mt-3 text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
        <div className="mt-1 text-xl font-semibold text-slate-900">{value}</div>

        <div className="mt-2 flex items-center justify-between gap-3">
          {trend?.length ? <MiniSparkline values={trend} tone={tone || 'neutral'} /> : <div className="h-[26px]" />}
          <div className="min-w-0 text-right">{helper ? <div className="text-[12px] leading-5 text-slate-500">{helper}</div> : null}</div>
        </div>
      </div>
    </div>
  );
}

function SegmentedRange({ value, onChange }: { value: RangeKey; onChange: (v: RangeKey) => void }) {
  const options: { key: RangeKey; label: string; short: string }[] = [
    { key: '7d', label: 'Last 7 days', short: '7d' },
    { key: '30d', label: 'Last 30 days', short: '30d' },
    { key: '90d', label: 'Last 90 days', short: '90d' },
    { key: '12m', label: 'Last 12 months', short: '12m' },
  ];

  return (
    <div className="inline-flex rounded-full border border-slate-200 bg-white/85 p-1 shadow-sm backdrop-blur">
      {options.map((o) => {
        const active = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={[
              'rounded-full px-3 py-1.5 text-[12px] font-medium transition',
              active ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100',
            ].join(' ')}
            title={o.label}
          >
            <span className="hidden sm:inline">{o.label}</span>
            <span className="sm:hidden">{o.short}</span>
          </button>
        );
      })}
    </div>
  );
}

function BarRow({
  label,
  right,
  pctValue,
  tone,
}: {
  label: ReactNode;
  right: ReactNode;
  pctValue: number;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
}) {
  const bar =
    tone === 'good'
      ? 'bg-emerald-600'
      : tone === 'warn'
      ? 'bg-amber-600'
      : tone === 'bad'
      ? 'bg-rose-600'
      : 'bg-slate-900';

  return (
    <div className="grid grid-cols-12 items-center gap-3 py-2">
      <div className="col-span-12 md:col-span-4">
        <div className="text-[12px] font-medium text-slate-800">{label}</div>
      </div>
      <div className="col-span-12 md:col-span-6">
        <div className="h-2.5 w-full rounded-full bg-slate-100">
          <div className={`h-2.5 rounded-full ${bar}`} style={{ width: `${clamp(pctValue, 0, 100)}%` }} />
        </div>
      </div>
      <div className="col-span-12 md:col-span-2 text-right">
        <div className="text-[12px] text-slate-600">{right}</div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: LateClinicianRow['status'] }) {
  const tone = status === 'active' ? 'good' : status === 'suspended' ? 'warn' : 'bad';
  return <Badge tone={tone}>{status}</Badge>;
}

function DeltaBadge({
  current,
  prev,
  kind,
  goodWhenUp = true,
}: {
  current: number;
  prev: number;
  kind: 'count' | 'pct' | 'money' | 'duration';
  goodWhenUp?: boolean;
}) {
  const safePrev = Number.isFinite(prev) ? prev : 0;
  const safeCur = Number.isFinite(current) ? current : 0;
  const delta = safeCur - safePrev;

  const isUp = delta > 0;
  const isDown = delta < 0;

  // Determine "good" based on direction preference
  const improved = goodWhenUp ? delta > 0 : delta < 0;

  const tone: 'good' | 'bad' | 'neutral' = delta === 0 ? 'neutral' : improved ? 'good' : 'bad';

  const cls =
    tone === 'good'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : tone === 'bad'
      ? 'border-rose-200 bg-rose-50 text-rose-700'
      : 'border-slate-200 bg-slate-50 text-slate-700';

  let text = '—';
  if (kind === 'pct') {
    text = `${delta >= 0 ? '+' : ''}${nf1.format(delta)} pp`;
  } else if (kind === 'money') {
    text = `${delta >= 0 ? '+' : ''}${fmtMoneyZarFromCents(delta)}`;
  } else if (kind === 'duration') {
    text = `${delta >= 0 ? '+' : ''}${nf1.format(delta)} h`;
  } else {
    const basePct = safePrev ? (delta / safePrev) * 100 : 0;
    text = `${delta >= 0 ? '+' : ''}${nf0.format(delta)} (${delta >= 0 ? '+' : ''}${nf1.format(basePct)}%)`;
  }

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-medium ${cls}`}>
      {isUp ? <ArrowUpRight className="h-3.5 w-3.5" /> : isDown ? <ArrowDownRight className="h-3.5 w-3.5" /> : null}
      {text}
    </span>
  );
}

/* ---------- Page ---------- */

type KpiKey = keyof ClinicianKpis;

function getKpi(payload: ClinicianAnalyticsPayload, key: KpiKey): number {
  const v = payload.kpis?.[key];
  if (v == null) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  return 0;
}

function getPrevKpi(payload: ClinicianAnalyticsPayload, key: KpiKey): number {
  const v = payload.compare?.kpis?.[key];
  if (v == null) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  return 0;
}

function stableTrendFromValue(seedStr: string, value: number, points = 12) {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;

  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };

  const base = Number.isFinite(value) ? value : 0;
  const out: number[] = [];
  const drift = (rand() - 0.45) * 0.12;
  let cur = base * (0.85 + rand() * 0.1);

  for (let i = 0; i < points; i++) {
    const noise = (rand() - 0.5) * 0.08;
    cur = cur * (1 + drift / points + noise / points);
    out.push(cur);
  }

  const scale = base ? base / out[out.length - 1] : 1;
  return out.map((x) => x * scale);
}

function goodWhenUpFor(key: KpiKey): boolean {
  // rates where LOWER is better
  const lowerIsBetter: KpiKey[] = [
    'avgOverrunRatePct',
    'noShowRatePct',
    'churnRatePct',
    'avgTimeToFirstConsultDays',
    'medianTrainingHours',
  ];
  return !lowerIsBetter.includes(key);
}

export default function ClinicianAnalyticsPage() {
  const [range, setRange] = useState<RangeKey>('30d');
  const [compareMode, setCompareMode] = useState(false);

  const [data, setData] = useState<ClinicianAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  // UI controls for the “flagged clinicians” table
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | LateClinicianRow['status']>('all');
  const [sort, setSort] = useState<'onTimeAsc' | 'overrunDesc' | 'delayDesc' | 'sessionsDesc'>('onTimeAsc');

  const abortRef = useRef<AbortController | null>(null);

  async function load(rangeKey: RangeKey, withCompare: boolean) {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    setErr(null);
    try {
      const url = `/api/analytics/clinicians?range=${encodeURIComponent(rangeKey)}${withCompare ? '&compare=prev' : ''}`;
      const res = await fetch(url, { cache: 'no-store', signal: ac.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const js = (await res.json().catch(() => null)) as ClinicianAnalyticsPayload | null;

      setData(js || MOCK_CLINICIANS_ANALYTICS);
      setLastUpdatedAt(new Date());
    } catch (e: any) {
      if (String(e?.name || '').toLowerCase() === 'aborterror') return;
      console.error('Clinician analytics fetch error', e);
      setErr(e?.message || 'Failed to load clinician analytics; showing local snapshot.');
      setData(MOCK_CLINICIANS_ANALYTICS);
      setLastUpdatedAt(new Date());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(range, compareMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, compareMode]);

  const payload = data || MOCK_CLINICIANS_ANALYTICS;
  const kpis = payload.kpis;

  const apiWarnings = payload.meta?.warnings || [];
  const partial = Boolean(payload.meta?.partial);

  const totalConsultHours = (kpis.totalConsultationMinutes || 0) / 60;

  const completionRatePct = useMemo(() => {
    const denom = kpis.totalAppointmentsBooked || 0;
    if (!denom) return 0;
    return (kpis.totalConsultsCompleted / denom) * 100;
  }, [kpis.totalAppointmentsBooked, kpis.totalConsultsCompleted]);

  const avgConsultMin = useMemo(() => {
    const denom = kpis.totalConsultsCompleted || 0;
    if (!denom) return 0;
    return kpis.totalConsultationMinutes / denom;
  }, [kpis.totalConsultsCompleted, kpis.totalConsultationMinutes]);

  const activeSharePct = useMemo(() => {
    const denom = kpis.totalClinicians || 0;
    if (!denom) return 0;
    return (kpis.activeClinicians / denom) * 100;
  }, [kpis.activeClinicians, kpis.totalClinicians]);

  const totalDeactivations = useMemo(
    () => payload.deactivations.reduce((sum, r) => sum + r.accounts, 0),
    [payload.deactivations],
  );

  const overallHealthTone: 'good' | 'warn' | 'bad' = useMemo(() => {
    const lateRisk =
      (100 - (kpis.avgClinicianOnTimeJoinRatePct || 0)) * 0.7 +
      (kpis.avgOverrunRatePct || 0) * 0.6 +
      (kpis.churnRatePct || 0) * 1.2 +
      (kpis.noShowRatePct || 0) * 0.9;
    if (lateRisk < 38) return 'good';
    if (lateRisk < 62) return 'warn';
    return 'bad';
  }, [kpis.avgClinicianOnTimeJoinRatePct, kpis.avgOverrunRatePct, kpis.churnRatePct, kpis.noShowRatePct]);

  const insightCallouts = useMemo(() => {
    const out: { tone: 'info' | 'warn' | 'bad' | 'good'; title: string; body: string }[] = [];

    if (completionRatePct > 0 && completionRatePct < 80) {
      out.push({
        tone: 'warn',
        title: 'Completion rate is slipping',
        body: `Only ${pct(completionRatePct)} of booked appointments were completed in this range. Check cancellations/no-shows and clinician capacity.`,
      });
    } else if (completionRatePct >= 90) {
      out.push({
        tone: 'good',
        title: 'Strong completion rate',
        body: `Great follow-through: ${pct(completionRatePct)} of booked appointments were completed in this range.`,
      });
    }

    if ((kpis.noShowRatePct || 0) >= 8) {
      out.push({
        tone: 'warn',
        title: 'No-show rate is elevated',
        body: `No-show rate is ${pct(kpis.noShowRatePct || 0)}. Consider reminders, tighter buffers, and proactive follow-ups.`,
      });
    }

    if ((kpis.avgOverrunRatePct || 0) >= 30) {
      out.push({
        tone: 'warn',
        title: 'Overruns are high',
        body: `Average overrun rate is ${pct(kpis.avgOverrunRatePct || 0)}. Consider adjusting consult policy buffers and coaching repeat offenders.`,
      });
    }

    if ((kpis.churnRatePct || 0) >= 6) {
      out.push({
        tone: 'bad',
        title: 'Churn risk',
        body: `Churn is ${pct(kpis.churnRatePct || 0)}. Consider exit surveys + retention on dormant clinicians and plan/value alignment.`,
      });
    }

    if (!out.length) {
      out.push({
        tone: 'info',
        title: 'Stable window',
        body: 'No critical anomalies detected. Use flagged clinicians for targeted coaching and schedule optimization.',
      });
    }

    return out.slice(0, 3);
  }, [completionRatePct, kpis.avgOverrunRatePct, kpis.churnRatePct, kpis.noShowRatePct]);

  const filteredLateClinicians = useMemo(() => {
    const qn = q.trim().toLowerCase();
    let rows = payload.lateClinicians.slice();

    if (statusFilter !== 'all') rows = rows.filter((r) => r.status === statusFilter);

    if (qn) {
      rows = rows.filter((r) => {
        const hay = `${r.name || ''} ${r.clinicianId} ${r.classLabel || ''}`.toLowerCase();
        return hay.includes(qn);
      });
    }

    const cmp = {
      onTimeAsc: (a: LateClinicianRow, b: LateClinicianRow) => a.clinicianOnTimeJoinRatePct - b.clinicianOnTimeJoinRatePct,
      overrunDesc: (a: LateClinicianRow, b: LateClinicianRow) => b.overrunRatePct - a.overrunRatePct,
      delayDesc: (a: LateClinicianRow, b: LateClinicianRow) => b.avgClinicianJoinDelayMin - a.avgClinicianJoinDelayMin,
      sessionsDesc: (a: LateClinicianRow, b: LateClinicianRow) => b.sessionsAnalysed - a.sessionsAnalysed,
    }[sort];

    rows.sort(cmp);
    return rows;
  }, [payload.lateClinicians, q, sort, statusFilter]);

  const flaggedCount = filteredLateClinicians.length;

  // Trends: prefer backend (payload.trends.series) and deterministically backfill missing keys.
  const trends = useMemo(() => {
    const series = payload.trends?.series || {};
    const ensure = (key: KpiKey, points = 12) => {
      const got = series[String(key)];
      if (Array.isArray(got) && got.length >= 6) return got;
      return stableTrendFromValue(`${range}:${String(key)}`, getKpi(payload, key), points);
    };

    return {
      totalAppointmentsBooked: ensure('totalAppointmentsBooked'),
      totalConsultsCompleted: ensure('totalConsultsCompleted'),
      totalConsultationMinutes: ensure('totalConsultationMinutes'),
      newClinicians: ensure('newClinicians'),
      avgTimeToFirstConsultDays: ensure('avgTimeToFirstConsultDays'),
      avgClinicianOnTimeJoinRatePct: ensure('avgClinicianOnTimeJoinRatePct'),
      avgOverrunRatePct: ensure('avgOverrunRatePct'),
      churnRatePct: ensure('churnRatePct'),
      onlineNow: ensure('onlineNow'),
      activeSeen7d: ensure('activeSeen7d'),
      activeSeen30d: ensure('activeSeen30d'),
      medianTrainingHours: ensure('medianTrainingHours'),
      noShowRatePct: ensure('noShowRatePct'),
      grossRevenueCents: ensure('grossRevenueCents'),
      platformFeesCents: ensure('platformFeesCents'),
      clinicianTakeCents: ensure('clinicianTakeCents'),
      deviceAdoptionRatePct: ensure('deviceAdoptionRatePct'),
    } satisfies Record<string, number[]>;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload, range]);

  const deviceAdoptionRatePct = Number.isFinite(kpis.deviceAdoptionRatePct)
    ? kpis.deviceAdoptionRatePct
    : Number.isFinite(kpis.deviceAdoptionPct as number)
    ? (kpis.deviceAdoptionPct as number)
    : 0;

  const deviceSummary = useMemo(() => {
    // NOTE: deviceMix overlaps across devices; totals are "device rows" not unique clinicians.
    const rows = payload.deviceMix || [];
    const top = rows.slice().sort((a, b) => b.cliniciansWithDevice - a.cliniciansWithDevice);
    const devices = rows.reduce((s, r) => s + (Number.isFinite(r.devices) ? r.devices : 0), 0);
    const maxCliniciansWithAny = top.length ? top[0].cliniciansWithDevice : 0;
    return { devices, maxCliniciansWithAny };
  }, [payload.deviceMix]);

  return (
    <main className="relative">
      {/* Background wash */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[360px] bg-gradient-to-b from-slate-50 via-white to-white" />
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[280px] opacity-70 [background:radial-gradient(85%_65%_at_50%_0%,rgba(2,132,199,0.12),transparent_60%)]" />

      <div className="mx-auto max-w-6xl space-y-6 p-6">
        {/* Header */}
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
              <Link href="/analytics" className="hover:text-slate-800">
                Analytics
              </Link>
              <span className="text-slate-300">/</span>
              <span className="text-slate-700">Clinicians</span>

              <span className="ml-2 hidden sm:inline-flex">
                <Badge tone={overallHealthTone}>
                  <span className="inline-flex items-center gap-1">
                    <Shield className="h-3.5 w-3.5" />
                    Platform health: {overallHealthTone === 'good' ? 'Healthy' : overallHealthTone === 'warn' ? 'Watch' : 'Risk'}
                  </span>
                </Badge>
              </span>

              {partial ? (
                <span className="ml-1 hidden sm:inline-flex">
                  <Badge tone="warn">
                    <span className="inline-flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" /> Partial aggregates
                    </span>
                  </Badge>
                </span>
              ) : null}
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">Clinician performance &amp; onboarding</h1>
            <p className="mt-1 max-w-2xl text-[13px] leading-6 text-slate-600">
              Punctuality, overruns, onboarding funnel, no-shows, revenue mix, device adoption — plus drill-down on chronically late clinicians.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="neutral">
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> Total: {nf0.format(kpis.totalClinicians)}
                </span>
              </Badge>
              <Badge tone="good">
                <span className="inline-flex items-center gap-1">
                  <BadgeCheck className="h-3.5 w-3.5" /> Active: {nf0.format(kpis.activeClinicians)} ({pct(activeSharePct, 0)})
                </span>
              </Badge>
              <Badge tone="info">
                <span className="inline-flex items-center gap-1">
                  <Hourglass className="h-3.5 w-3.5" /> Onboarding: {nf0.format(kpis.onboardingInProgress)}
                </span>
              </Badge>
              <Badge tone="info">
                <span className="inline-flex items-center gap-1">
                  <Wifi className="h-3.5 w-3.5" /> Online now: {nf0.format(kpis.onlineNow || 0)}
                </span>
              </Badge>
              {lastUpdatedAt ? (
                <Badge tone="neutral">
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock className="h-3.5 w-3.5" /> Updated: {humanTs(lastUpdatedAt)}
                  </span>
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col items-start gap-2 md:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <SegmentedRange value={range} onChange={setRange} />
              <Toggle checked={compareMode} onChange={setCompareMode} label="Cohort compare" helper="This range vs previous range" />
              <SoftButton
                title="Refresh"
                onClick={() => load(range, compareMode)}
                disabled={loading}
                icon={<RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />}
              >
                Refresh
              </SoftButton>
              <SoftButton
                title="Export flagged clinicians CSV"
                onClick={() =>
                  downloadCsv(
                    `flagged-clinicians-${range}.csv`,
                    filteredLateClinicians.map((c) => ({
                      clinicianId: c.clinicianId,
                      name: c.name,
                      classLabel: c.classLabel || '',
                      status: c.status,
                      sessionsAnalysed: c.sessionsAnalysed,
                      clinicianOnTimeJoinRatePct: c.clinicianOnTimeJoinRatePct,
                      avgClinicianJoinDelayMin: c.avgClinicianJoinDelayMin,
                      overrunRatePct: c.overrunRatePct,
                    })),
                  )
                }
                icon={<Download className="h-4 w-4" />}
              >
                Export CSV
              </SoftButton>
            </div>

            {err ? (
              <div className="flex max-w-xl items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium">Using fallback snapshot</div>
                  <div className="text-amber-800/90">{err}</div>
                </div>
              </div>
            ) : null}

            {!err && apiWarnings.length ? (
              <div className="max-w-xl rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[12px] text-slate-700">
                <div className="font-medium">Notes</div>
                <ul className="mt-1 list-disc pl-5 text-slate-600">
                  {apiWarnings.slice(0, 3).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </header>

        {/* KPI tiles */}
        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {loading && !data ? (
            <>
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="rounded-3xl border border-slate-200/70 bg-white/80 p-4 shadow-sm">
                  <Skeleton className="h-10 w-10 rounded-2xl" />
                  <Skeleton className="mt-4 h-3 w-32" />
                  <Skeleton className="mt-2 h-6 w-24" />
                  <Skeleton className="mt-3 h-3 w-40" />
                </div>
              ))}
            </>
          ) : (
            <>
              {/* Appointments */}
              <StatTile
                icon={<Activity className="h-5 w-5" />}
                label="Appointments booked"
                value={nf0.format(kpis.totalAppointmentsBooked)}
                helper="All booked slots in this window."
                tone="info"
                trend={trends.totalAppointmentsBooked}
                deltaNode={
                  compareMode && payload.compare ? (
                    <DeltaBadge
                      kind="count"
                      current={getKpi(payload, 'totalAppointmentsBooked')}
                      prev={getPrevKpi(payload, 'totalAppointmentsBooked')}
                      goodWhenUp={goodWhenUpFor('totalAppointmentsBooked')}
                    />
                  ) : null
                }
              />

              {/* Completion */}
              <StatTile
                icon={<CheckCircle2 className="h-5 w-5" />}
                label="Consults completed"
                value={nf0.format(kpis.totalConsultsCompleted)}
                helper={`Completion: ${pct(completionRatePct)}`}
                tone={completionRatePct >= 90 ? 'good' : completionRatePct >= 80 ? 'warn' : 'bad'}
                trend={trends.totalConsultsCompleted}
                deltaNode={
                  compareMode && payload.compare ? (
                    <DeltaBadge
                      kind="count"
                      current={getKpi(payload, 'totalConsultsCompleted')}
                      prev={getPrevKpi(payload, 'totalConsultsCompleted')}
                      goodWhenUp={goodWhenUpFor('totalConsultsCompleted')}
                    />
                  ) : null
                }
              />

              {/* Time */}
              <StatTile
                icon={<Clock className="h-5 w-5" />}
                label="Recorded consult time"
                value={fmtHrs(totalConsultHours)}
                helper={`${nf0.format(kpis.totalConsultationMinutes)} min • Avg: ${fmtMin(avgConsultMin)}`}
                tone="neutral"
                trend={trends.totalConsultationMinutes}
                deltaNode={
                  compareMode && payload.compare ? (
                    <DeltaBadge
                      kind="count"
                      current={getKpi(payload, 'totalConsultationMinutes')}
                      prev={getPrevKpi(payload, 'totalConsultationMinutes')}
                      goodWhenUp={goodWhenUpFor('totalConsultationMinutes')}
                    />
                  ) : null
                }
              />

              {/* New clinicians */}
              <StatTile
                icon={<UserPlus className="h-5 w-5" />}
                label="New clinicians"
                value={nf0.format(kpis.newClinicians)}
                helper="Approved within this window."
                tone="info"
                trend={trends.newClinicians}
                deltaNode={
                  compareMode && payload.compare ? (
                    <DeltaBadge
                      kind="count"
                      current={getKpi(payload, 'newClinicians')}
                      prev={getPrevKpi(payload, 'newClinicians')}
                      goodWhenUp={goodWhenUpFor('newClinicians')}
                    />
                  ) : null
                }
              />

              {/* Online now */}
              <StatTile
                icon={<Wifi className="h-5 w-5" />}
                label="Online clinicians now"
                value={nf0.format(kpis.onlineNow || 0)}
                helper="ClinicianProfile.online = true"
                tone="info"
                trend={trends.onlineNow}
                deltaNode={
                  compareMode && payload.compare ? (
                    <DeltaBadge
                      kind="count"
                      current={getKpi(payload, 'onlineNow')}
                      prev={getPrevKpi(payload, 'onlineNow')}
                      goodWhenUp={goodWhenUpFor('onlineNow')}
                    />
                  ) : null
                }
              />

              {/* Active seen 7d */}
              <StatTile
                icon={<Zap className="h-5 w-5" />}
                label="Active clinicians (last 7d)"
                value={nf0.format(kpis.activeSeen7d || 0)}
                helper="By lastSeenAt recency."
                tone="neutral"
                trend={trends.activeSeen7d}
                deltaNode={
                  compareMode && payload.compare ? (
                    <DeltaBadge
                      kind="count"
                      current={getKpi(payload, 'activeSeen7d')}
                      prev={getPrevKpi(payload, 'activeSeen7d')}
                      goodWhenUp={goodWhenUpFor('activeSeen7d')}
                    />
                  ) : null
                }
              />

              {/* Active seen 30d */}
              <StatTile
                icon={<Laptop className="h-5 w-5" />}
                label="Active clinicians (last 30d)"
                value={nf0.format(kpis.activeSeen30d || 0)}
                helper="By lastSeenAt recency."
                tone="neutral"
                trend={trends.activeSeen30d}
                deltaNode={
                  compareMode && payload.compare ? (
                    <DeltaBadge
                      kind="count"
                      current={getKpi(payload, 'activeSeen30d')}
                      prev={getPrevKpi(payload, 'activeSeen30d')}
                      goodWhenUp={goodWhenUpFor('activeSeen30d')}
                    />
                  ) : null
                }
              />

              {/* Training */}
              <StatTile
                icon={<Timer className="h-5 w-5" />}
                label="Median training time"
                value={`${nf1.format(kpis.medianTrainingHours ?? 0)} h`}
                helper="Onboarding → training completed."
                tone={(kpis.medianTrainingHours ?? 0) <= 8 ? 'good' : (kpis.medianTrainingHours ?? 0) <= 14 ? 'warn' : 'bad'}
                trend={trends.medianTrainingHours}
                deltaNode={
                  compareMode && payload.compare ? (
                    <DeltaBadge
                      kind="duration"
                      current={getKpi(payload, 'medianTrainingHours')}
                      prev={getPrevKpi(payload, 'medianTrainingHours')}
                      goodWhenUp={goodWhenUpFor('medianTrainingHours')}
                    />
                  ) : null
                }
              />

              {/* No-show */}
              <StatTile
                icon={<AlertTriangle className="h-5 w-5" />}
                label="No-show rate"
                value={pct(kpis.noShowRatePct || 0)}
                helper="Appointments that were no-shows."
                tone={(kpis.noShowRatePct || 0) <= 5 ? 'good' : (kpis.noShowRatePct || 0) <= 8 ? 'warn' : 'bad'}
                trend={trends.noShowRatePct}
                deltaNode={
                  compareMode && payload.compare ? (
                    <DeltaBadge
                      kind="pct"
                      current={getKpi(payload, 'noShowRatePct')}
                      prev={getPrevKpi(payload, 'noShowRatePct')}
                      goodWhenUp={goodWhenUpFor('noShowRatePct')}
                    />
                  ) : null
                }
              />

              {/* Revenue (gross) */}
              <StatTile
                icon={<Coins className="h-5 w-5" />}
                label="Gross revenue"
                value={fmtMoneyZarFromCents(kpis.grossRevenueCents || 0)}
                helper="Sum of payments in this window."
                tone="info"
                trend={trends.grossRevenueCents}
                deltaNode={
                  compareMode && payload.compare ? (
                    <DeltaBadge
                      kind="money"
                      current={getKpi(payload, 'grossRevenueCents')}
                      prev={getPrevKpi(payload, 'grossRevenueCents')}
                      goodWhenUp={goodWhenUpFor('grossRevenueCents')}
                    />
                  ) : null
                }
              />

              {/* Platform fees */}
              <StatTile
                icon={<CreditCard className="h-5 w-5" />}
                label="Platform fees"
                value={fmtMoneyZarFromCents(kpis.platformFeesCents || 0)}
                helper="Sum of platform fees."
                tone="neutral"
                trend={trends.platformFeesCents}
                deltaNode={
                  compareMode && payload.compare ? (
                    <DeltaBadge
                      kind="money"
                      current={getKpi(payload, 'platformFeesCents')}
                      prev={getPrevKpi(payload, 'platformFeesCents')}
                      goodWhenUp={goodWhenUpFor('platformFeesCents')}
                    />
                  ) : null
                }
              />

              {/* Device adoption */}
              <StatTile
                icon={<Boxes className="h-5 w-5" />}
                label="Device adoption"
                value={pct(deviceAdoptionRatePct, 0)}
                helper={deviceSummary.devices ? `${nf0.format(deviceSummary.devices)} devices (counts overlap)` : 'Across clinician cohort.'}
                tone={deviceAdoptionRatePct >= 60 ? 'good' : deviceAdoptionRatePct >= 40 ? 'warn' : 'bad'}
                trend={trends.deviceAdoptionRatePct}
                deltaNode={
                  compareMode && payload.compare ? (
                    <DeltaBadge
                      kind="pct"
                      current={deviceAdoptionRatePct}
                      prev={getPrevKpi(payload, 'deviceAdoptionRatePct')}
                      goodWhenUp={goodWhenUpFor('deviceAdoptionRatePct')}
                    />
                  ) : null
                }
              />
            </>
          )}
        </section>

        {/* Insight callouts */}
        <section className="grid gap-4 lg:grid-cols-3">
          {insightCallouts.map((c, idx) => (
            <Card
              key={idx}
              title={
                <span className="inline-flex items-center gap-2">
                  {c.tone === 'good' ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                  ) : c.tone === 'warn' ? (
                    <AlertTriangle className="h-4 w-4 text-amber-700" />
                  ) : c.tone === 'bad' ? (
                    <AlertTriangle className="h-4 w-4 text-rose-700" />
                  ) : (
                    <Activity className="h-4 w-4 text-sky-700" />
                  )}
                  {c.title}
                </span>
              }
              className="h-full"
            >
              <p className="text-[13px] leading-6 text-slate-600">{c.body}</p>
            </Card>
          ))}
        </section>

        {/* Distributions */}
        <section className="grid gap-4 md:grid-cols-2">
          <DistributionCard
            title="Clinician join punctuality"
            subtitle="Share of televisits by clinician arrival bucket vs scheduled start."
            rows={payload.punctualityBucketsClinician}
            toneRule={(label) => (String(label).includes('On time') ? 'good' : String(label).includes('>10') ? 'bad' : 'warn')}
          />
          <DistributionCard
            title="Patient join punctuality"
            subtitle="Share of televisits by patient arrival bucket vs scheduled start."
            rows={payload.punctualityBucketsPatient}
            toneRule={(label) => (String(label).includes('On time') ? 'good' : String(label).includes('>10') ? 'bad' : 'warn')}
          />
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <DistributionCard
            title="Slot overruns"
            subtitle="How often actual consult length exceeded booked minutes."
            rows={payload.overrunBuckets}
            toneRule={(label) => (String(label).includes('On time') ? 'good' : String(label).includes('>50') ? 'bad' : 'warn')}
          />

          {/* Onboarding */}
          <Card
            title="Onboarding funnel"
            subtitle="From application to live consults (counts + share + median time to stage)."
            right={<Badge tone="neutral">Stages: {payload.onboardingStages.length}</Badge>}
          >
            <OnboardingFunnel stages={payload.onboardingStages} />
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-[12px]">
                <thead className="text-slate-600">
                  <tr className="border-b border-slate-100">
                    <th className="px-2 py-2 text-left font-medium">Stage</th>
                    <th className="px-2 py-2 text-right font-medium">Clinicians</th>
                    <th className="px-2 py-2 text-right font-medium">Funnel share</th>
                    <th className="px-2 py-2 text-right font-medium">Median hours</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.onboardingStages.map((s) => (
                    <tr key={s.stage} className="border-b border-slate-50 hover:bg-slate-50/60">
                      <td className="px-2 py-2">
                        <div className="font-medium text-slate-900">{s.label}</div>
                        <div className="text-[11px] text-slate-500">{s.stage}</div>
                      </td>
                      <td className="px-2 py-2 text-right text-slate-700">{nf0.format(s.clinicians)}</td>
                      <td className="px-2 py-2 text-right text-slate-700">{pct(s.sharePct)}</td>
                      <td className="px-2 py-2 text-right text-slate-700">
                        {s.medianHoursToStage != null ? `${nf1.format(s.medianHoursToStage)} h` : '—'}
                      </td>
                    </tr>
                  ))}
                  {!payload.onboardingStages.length && (
                    <tr>
                      <td colSpan={4} className="px-2 py-6 text-center text-[12px] text-slate-500">
                        No onboarding activity in this range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </section>

        {/* Revenue + Devices */}
        <section className="grid gap-4 lg:grid-cols-2">
          <Card
            title="Revenue mix"
            subtitle="Payment status mix + fee split (safe aggregates)."
            right={
              <Badge tone="neutral">
                <span className="inline-flex items-center gap-1">
                  <Coins className="h-3.5 w-3.5" /> {fmtMoneyZarFromCents(kpis.grossRevenueCents || 0)}
                </span>
              </Badge>
            }
          >
            <div className="grid gap-3">
              <div className="grid gap-2 rounded-2xl border border-slate-200/70 bg-white/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-2 text-[12px] font-medium text-slate-800">
                    <Percent className="h-4 w-4 text-slate-600" />
                    Fee split
                  </div>
                  <div className="text-[12px] text-slate-600">
                    Platform {fmtMoneyZarFromCents(kpis.platformFeesCents || 0)} • Clinicians {fmtMoneyZarFromCents(kpis.clinicianTakeCents || 0)}
                  </div>
                </div>

                {(() => {
                  const gross = (kpis.platformFeesCents || 0) + (kpis.clinicianTakeCents || 0);
                  const pf = gross ? ((kpis.platformFeesCents || 0) / gross) * 100 : 0;
                  const ct = gross ? ((kpis.clinicianTakeCents || 0) / gross) * 100 : 0;
                  return (
                    <div className="space-y-2">
                      <BarRow
                        label={
                          <span className="inline-flex items-center gap-2">
                            <Badge tone="info">Platform</Badge>
                            <span className="text-slate-700">{pct(pf, 0)}</span>
                          </span>
                        }
                        right={<span>{fmtMoneyZarFromCents(kpis.platformFeesCents || 0)}</span>}
                        pctValue={pf}
                        tone="neutral"
                      />
                      <BarRow
                        label={
                          <span className="inline-flex items-center gap-2">
                            <Badge tone="neutral">Clinicians</Badge>
                            <span className="text-slate-700">{pct(ct, 0)}</span>
                          </span>
                        }
                        right={<span>{fmtMoneyZarFromCents(kpis.clinicianTakeCents || 0)}</span>}
                        pctValue={ct}
                        tone="good"
                      />
                    </div>
                  );
                })()}
              </div>

              <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-3">
                <div className="mb-2 inline-flex items-center gap-2 text-[12px] font-medium text-slate-800">
                  <CreditCard className="h-4 w-4 text-slate-600" />
                  Payment status distribution
                </div>

                {(payload.paymentMix || []).length ? (
                  <div className="space-y-1">
                    {(payload.paymentMix || []).map((r) => {
                      const label = paymentStatusLabel(r.status);
                      const tone = label === 'Captured' ? 'good' : label === 'Refunded' ? 'warn' : label === 'Failed' ? 'bad' : 'neutral';
                      return (
                        <BarRow
                          key={r.status}
                          label={
                            <span className="inline-flex items-center gap-2">
                              <Badge tone={tone as any}>{label}</Badge>
                              <span className="text-slate-600">{nf0.format(r.count)} tx</span>
                            </span>
                          }
                          right={<span className="text-slate-700">{fmtMoneyZarFromCents(r.grossRevenueCents)}</span>}
                          pctValue={r.sharePct}
                          tone={tone as any}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-6 text-center text-[12px] text-slate-500">No payment mix data yet.</div>
                )}
              </div>
            </div>
          </Card>

          <Card
            title="Device adoption"
            subtitle="Clinician-owned devices (UserDevice) aggregated by device key."
            right={<Badge tone={deviceAdoptionRatePct >= 60 ? 'good' : deviceAdoptionRatePct >= 40 ? 'warn' : 'bad'}>{pct(deviceAdoptionRatePct, 0)}</Badge>}
          >
            <div className="grid gap-3">
              <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-2 text-[12px] font-medium text-slate-800">
                    <Boxes className="h-4 w-4 text-slate-600" />
                    Adoption summary
                  </div>
                  <div className="text-[12px] text-slate-600">
                    {pct(deviceAdoptionRatePct, 0)} adoption • {nf0.format(deviceSummary.devices)} devices
                  </div>
                </div>

                <div className="mt-2 h-2.5 w-full rounded-full bg-slate-100">
                  <div className="h-2.5 rounded-full bg-slate-900" style={{ width: `${clamp(deviceAdoptionRatePct, 0, 100)}%` }} />
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200/70 bg-white/70 p-3">
                <div className="mb-2 inline-flex items-center gap-2 text-[12px] font-medium text-slate-800">
                  <Boxes className="h-4 w-4 text-slate-600" />
                  Top devices (by clinicians with device)
                </div>

                {(payload.deviceMix || []).length ? (
                  <div className="space-y-1">
                    {(payload.deviceMix || [])
                      .slice()
                      .sort((a, b) => b.cliniciansWithDevice - a.cliniciansWithDevice)
                      .map((r) => (
                        <BarRow
                          key={r.deviceKey}
                          label={
                            <span className="inline-flex items-center gap-2">
                              <Badge tone="neutral">{r.deviceKey}</Badge>
                              <span className="text-slate-600">{nf0.format(r.cliniciansWithDevice)} clinicians</span>
                            </span>
                          }
                          right={<span className="text-slate-700">{nf0.format(r.devices)} devices</span>}
                          pctValue={r.shareCliniciansPct}
                          tone="neutral"
                        />
                      ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-[12px] text-slate-500">No device mix data yet.</div>
                )}
              </div>
            </div>
          </Card>
        </section>

        {/* Plans + deactivations */}
        <section className="grid gap-4 lg:grid-cols-2">
          <Card title="Plan mix" subtitle="Distribution by subscription / practice plan. (MoM = change within the plan cohort.)">
            <div className="overflow-x-auto">
              <table className="min-w-full text-[12px]">
                <thead className="text-slate-600">
                  <tr className="border-b border-slate-100">
                    <th className="px-2 py-2 text-left font-medium">Plan</th>
                    <th className="px-2 py-2 text-right font-medium">Clinicians</th>
                    <th className="px-2 py-2 text-right font-medium">Active</th>
                    <th className="px-2 py-2 text-right font-medium">Mix</th>
                    <th className="px-2 py-2 text-right font-medium">MoM</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.plans.map((p) => {
                    const activePct = p.clinicians ? (p.activeClinicians / p.clinicians) * 100 : 0;
                    return (
                      <tr key={p.planId} className="border-b border-slate-50 hover:bg-slate-50/60">
                        <td className="px-2 py-2">
                          <div className="font-medium text-slate-900">{p.label}</div>
                          <div className="text-[11px] text-slate-500">{p.planId}</div>
                        </td>
                        <td className="px-2 py-2 text-right text-slate-700">{nf0.format(p.clinicians)}</td>
                        <td className="px-2 py-2 text-right text-slate-700">
                          {nf0.format(p.activeClinicians)} <span className="ml-1 text-[11px] text-slate-500">({pct(activePct, 0)})</span>
                        </td>
                        <td className="px-2 py-2 text-right text-slate-700">{pct(p.sharePct)}</td>
                        <td className="px-2 py-2 text-right">
                          <span
                            className={[
                              'inline-flex items-center justify-end gap-1 rounded-full border px-2 py-1 text-[11px] font-medium',
                              p.monthlyChangePct > 0
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                : p.monthlyChangePct < 0
                                ? 'border-rose-200 bg-rose-50 text-rose-700'
                                : 'border-slate-200 bg-slate-50 text-slate-700',
                            ].join(' ')}
                          >
                            {p.monthlyChangePct > 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : p.monthlyChangePct < 0 ? <ArrowDownRight className="h-3.5 w-3.5" /> : null}
                            {p.monthlyChangePct >= 0 ? '+' : ''}
                            {nf1.format(p.monthlyChangePct)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {!payload.plans.length && (
                    <tr>
                      <td colSpan={5} className="px-2 py-6 text-center text-[12px] text-slate-500">
                        No plan data for this range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card
            title="Account deactivations & churn reasons"
            subtitle="Why clinicians left or were suspended in this window."
            right={<Badge tone="neutral">{nf0.format(totalDeactivations)} accounts</Badge>}
          >
            <div className="space-y-2">
              {payload.deactivations.map((d) => (
                <div key={d.reasonKey} className="rounded-2xl border border-slate-200/70 bg-slate-50/70 px-3 py-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <ReasonBadge reasonKey={d.reasonKey} label={d.label} />
                        <div className="truncate text-[12px] font-medium text-slate-900">{d.label}</div>
                      </div>
                      <div className="mt-2">
                        <div className="h-2.5 w-full rounded-full bg-white">
                          <div className="h-2.5 rounded-full bg-slate-900" style={{ width: `${clamp(d.sharePct, 0, 100)}%` }} />
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[12px] font-semibold text-slate-900">{nf0.format(d.accounts)}</div>
                      <div className="text-[11px] text-slate-500">{pct(d.sharePct)}</div>
                    </div>
                  </div>
                </div>
              ))}
              {!payload.deactivations.length && (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-[12px] text-slate-500">
                  No deactivations recorded in this range.
                </div>
              )}
            </div>
          </Card>
        </section>

        {/* Flagged clinicians */}
        <Card
          title="Flagged clinicians (lateness / overruns)"
          subtitle="Sorted + filterable. Click through for clinician timeline & session context."
          right={<Badge tone={flaggedCount ? 'warn' : 'good'}>{nf0.format(flaggedCount)} in view</Badge>}
        >
          {/* Controls */}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <div className="relative w-full md:w-[360px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search clinician, id, class…"
                  className="w-full rounded-2xl border border-slate-200 bg-white/90 py-2 pl-9 pr-3 text-[12px] text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-slate-300"
                />
              </div>

              <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-[12px] shadow-sm">
                <Filter className="h-4 w-4 text-slate-500" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="bg-transparent text-[12px] text-slate-800 outline-none"
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="deactivated">Deactivated</option>
                </select>
              </div>

              <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-[12px] shadow-sm">
                <TrendingUp className="h-4 w-4 text-slate-500" />
                <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="bg-transparent text-[12px] text-slate-800 outline-none">
                  <option value="onTimeAsc">Sort: lowest on-time</option>
                  <option value="overrunDesc">Sort: highest overrun</option>
                  <option value="delayDesc">Sort: highest join delay</option>
                  <option value="sessionsDesc">Sort: most sessions</option>
                </select>
              </div>
            </div>

            <div className="text-[12px] text-slate-500">Tip: export CSV after applying filters.</div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-[12px]">
              <thead className="sticky top-0 z-10 bg-white/95 text-slate-600 backdrop-blur">
                <tr className="border-b border-slate-100">
                  <th className="px-2 py-2 text-left font-medium">Clinician</th>
                  <th className="px-2 py-2 text-left font-medium">Class</th>
                  <th className="px-2 py-2 text-left font-medium">Status</th>
                  <th className="px-2 py-2 text-right font-medium">Sessions</th>
                  <th className="px-2 py-2 text-right font-medium">On-time</th>
                  <th className="px-2 py-2 text-right font-medium">Join delay</th>
                  <th className="px-2 py-2 text-right font-medium">Overrun</th>
                  <th className="px-2 py-2 text-right font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredLateClinicians.map((c) => {
                  const onTimeTone = c.clinicianOnTimeJoinRatePct >= 85 ? 'good' : c.clinicianOnTimeJoinRatePct >= 70 ? 'warn' : 'bad';
                  const overrunTone = c.overrunRatePct <= 15 ? 'good' : c.overrunRatePct <= 30 ? 'warn' : 'bad';
                  return (
                    <tr key={c.clinicianId} className="border-b border-slate-50 hover:bg-slate-50/60">
                      <td className="px-2 py-2">
                        <div className="font-medium text-slate-900">{c.name || c.clinicianId}</div>
                        <div className="font-mono text-[10px] text-slate-500">{c.clinicianId}</div>
                      </td>
                      <td className="px-2 py-2 text-slate-600">{c.classLabel || '—'}</td>
                      <td className="px-2 py-2">
                        <StatusPill status={c.status} />
                      </td>
                      <td className="px-2 py-2 text-right text-slate-700">{nf0.format(c.sessionsAnalysed)}</td>
                      <td className="px-2 py-2 text-right">
                        <Badge tone={onTimeTone === 'good' ? 'good' : onTimeTone === 'warn' ? 'warn' : 'bad'}>{pct(c.clinicianOnTimeJoinRatePct)}</Badge>
                      </td>
                      <td className="px-2 py-2 text-right text-slate-700">{fmtMin(c.avgClinicianJoinDelayMin)}</td>
                      <td className="px-2 py-2 text-right">
                        <Badge tone={overrunTone === 'good' ? 'good' : overrunTone === 'warn' ? 'warn' : 'bad'}>{pct(c.overrunRatePct)}</Badge>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <Link
                          href={`/analytics/clinicians/${encodeURIComponent(c.clinicianId)}`}
                          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-medium text-slate-800 shadow-sm hover:bg-slate-50"
                        >
                          View
                          <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {!filteredLateClinicians.length && (
                  <tr>
                    <td colSpan={8} className="px-2 py-8 text-center text-[12px] text-slate-500">
                      No clinicians match your filters in this range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Footer note (updated) */}
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-start gap-2">
              <div className="mt-0.5 rounded-xl border border-slate-200 bg-white p-2 text-slate-800">
                <Shield className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[12px] font-semibold text-slate-900">Cohort compare + trends</div>
                <div className="mt-1 text-[12px] leading-6 text-slate-600">
                  When <span className="font-mono">compare=prev</span> is enabled, KPI deltas show against the previous window. Trend sparklines come from{' '}
                  <span className="font-mono">trends.series</span> (bucketed by range).
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </main>
  );
}

/* ---------- Polished section components ---------- */

function DistributionCard({
  title,
  subtitle,
  rows,
  toneRule,
}: {
  title: string;
  subtitle?: string;
  rows: BucketRow[];
  toneRule?: (label: string) => 'neutral' | 'good' | 'warn' | 'bad';
}) {
  const total = rows.reduce((sum, r) => sum + r.sessions, 0);

  return (
    <Card
      title={title}
      subtitle={subtitle}
      right={
        <Badge tone="neutral">
          <span className="inline-flex items-center gap-1">
            <Activity className="h-3.5 w-3.5" /> {nf0.format(total)} sessions
          </span>
        </Badge>
      }
    >
      <div className="space-y-1">
        {rows.map((r) => {
          const tone = toneRule?.(r.label) ?? 'neutral';
          return (
            <BarRow
              key={r.label}
              label={
                <span className="inline-flex items-center gap-2">
                  <span className="truncate">{r.label}</span>
                  <Badge tone={tone}>{pct(r.sharePct, 0)}</Badge>
                </span>
              }
              right={<span className="text-slate-600">{nf0.format(r.sessions)}</span>}
              pctValue={r.sharePct}
              tone={tone === 'neutral' ? 'neutral' : tone}
            />
          );
        })}
        {!rows.length && <div className="py-6 text-center text-[12px] text-slate-500">No data in this range.</div>}
      </div>
    </Card>
  );
}

function OnboardingFunnel({ stages }: { stages: OnboardingStageRow[] }) {
  if (!stages.length) return null;

  const max = Math.max(...stages.map((s) => s.clinicians || 0), 1);

  return (
    <div className="grid gap-2">
      {stages.map((s) => {
        const w = (s.clinicians / max) * 100;
        const tone =
          s.stage === 'live'
            ? 'good'
            : s.stage === 'training_completed'
            ? 'info'
            : s.stage === 'training_scheduled'
            ? 'warn'
            : 'neutral';

        return (
          <div key={s.stage} className="rounded-2xl border border-slate-200/70 bg-white/85 px-3 py-3 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="text-[12px] font-semibold text-slate-900">{s.label}</div>
                  <Badge tone={tone as any}>{pct(s.sharePct, 0)}</Badge>
                </div>
                <div className="mt-0.5 text-[11px] text-slate-500">
                  {s.medianHoursToStage != null ? `Median: ${nf1.format(s.medianHoursToStage)} h` : 'Median: —'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[12px] font-semibold text-slate-900">{nf0.format(s.clinicians)}</div>
                <div className="text-[11px] text-slate-500">{s.stage}</div>
              </div>
            </div>
            <div className="mt-2 h-2.5 w-full rounded-full bg-slate-100">
              <div className="h-2.5 rounded-full bg-slate-900" style={{ width: `${clamp(w, 0, 100)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Badges ---------- */

function ReasonBadge({ reasonKey, label }: { reasonKey: DeactivationReasonRow['reasonKey']; label: string }) {
  let classes = 'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium';
  switch (reasonKey) {
    case 'death':
      classes += ' border-rose-200 bg-rose-50 text-rose-700';
      break;
    case 'disciplinary':
      classes += ' border-amber-200 bg-amber-50 text-amber-800';
      break;
    case 'suspended':
      classes += ' border-amber-200 bg-amber-50 text-amber-800';
      break;
    case 'unsubscribed':
      classes += ' border-slate-200 bg-slate-50 text-slate-700';
      break;
    case 'dormant':
      classes += ' border-slate-200 bg-slate-50 text-slate-600';
      break;
    default:
      classes += ' border-slate-200 bg-slate-50 text-slate-700';
  }
  return <span className={classes}>{label}</span>;
}
