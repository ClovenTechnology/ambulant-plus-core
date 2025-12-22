// apps/admin-dashboard/app/api/analytics/overview/route.ts
import { NextResponse } from 'next/server';

/* ---------- Types (aligned with AnalyticsOverviewPage) ---------- */

type Kpi = { label: string; value: string | number; sub?: string };

type RevenuePoint = {
  label: string;      // e.g. "Jan"
  total: number;
  careport: number;
  medreach: number;
  rx: number;
};

type MixItem = { label: string; value: number };

type GeoRow = {
  province: string;
  revenueZAR: number;
  patients: number;
  consults: number;
};

type CohortRow = {
  label: string;
  patients: number;
  sharePct: number;
};

type EntityRow = {
  label: string;
  kind: 'Pharmacy' | 'Lab' | 'Clinician';
  revenueZAR: number;
  orders: number;
  location?: string;
};

type OverviewPayload = {
  kpis: Kpi[];
  revenueSeries: RevenuePoint[];
  productMix: MixItem[];
  geo: GeoRow[];
  cohorts: CohortRow[];
  topEntities: EntityRow[];
};

/* ---------- Base snapshot (single source of truth) ---------- */

const BASE_OVERVIEW: OverviewPayload = {
  kpis: [
    { label: 'Total Revenue (LTM)', value: 'R 1,240,000', sub: '+12% vs prior 12m' },
    { label: 'Active Patients', value: 18_240, sub: '+4% MoM' },
    { label: 'Active Clinicians', value: 1_260, sub: 'A: 420 • B: 620 • C: 220' },
    { label: 'IoMT Devices', value: 9, sub: '7 streaming in last 24h' },
    { label: 'Rx Revenue', value: 'R 310,500', sub: 'eRx + renewals' },
    { label: 'Total Payout', value: 'R 870,000', sub: 'Clinicians + riders + phlebs' },
    { label: 'CarePort Revenue', value: 'R 182,400', sub: 'incl. riders' },
    { label: 'MedReach Revenue', value: 'R 226,900', sub: 'draws + lab rev share' },
    { label: '# Rider Payouts (CarePort)', value: 742, sub: 'avg R122/job' },
    { label: '# Phleb Payouts (MedReach)', value: 311, sub: 'avg R141/draw' },
    { label: 'Ambulant+ Earnings (net)', value: 'R 344,800', sub: 'after all payouts' },
    { label: 'Total Refunds', value: 'R 12,600', sub: '0.9% of GMV' },
  ],
  revenueSeries: [
    { label: 'Jan', total: 80, careport: 28, medreach: 22, rx: 30 },
    { label: 'Feb', total: 86, careport: 30, medreach: 24, rx: 32 },
    { label: 'Mar', total: 94, careport: 32, medreach: 26, rx: 36 },
    { label: 'Apr', total: 100, careport: 34, medreach: 28, rx: 38 },
    { label: 'May', total: 112, careport: 39, medreach: 32, rx: 41 },
    { label: 'Jun', total: 118, careport: 42, medreach: 34, rx: 42 },
    { label: 'Jul', total: 124, careport: 44, medreach: 36, rx: 44 },
    { label: 'Aug', total: 131, careport: 46, medreach: 38, rx: 47 },
    { label: 'Sep', total: 138, careport: 48, medreach: 40, rx: 50 },
    { label: 'Oct', total: 142, careport: 49, medreach: 42, rx: 51 },
    { label: 'Nov', total: 148, careport: 51, medreach: 44, rx: 53 },
    { label: 'Dec', total: 155, careport: 54, medreach: 46, rx: 55 },
  ],
  productMix: [
    { label: 'Rx & Consult', value: 38 },
    { label: 'CarePort (pharmacy)', value: 27 },
    { label: 'MedReach (lab)', value: 24 },
    { label: 'Other services', value: 11 },
  ],
  geo: [
    { province: 'Gauteng',       revenueZAR: 520_000, patients: 8_400, consults: 11_200 },
    { province: 'Western Cape',  revenueZAR: 280_000, patients: 4_200, consults:  6_700 },
    { province: 'KZN',           revenueZAR: 170_000, patients: 2_900, consults:  4_100 },
    { province: 'Eastern Cape',  revenueZAR:  80_000, patients: 1_400, consults:  1_900 },
    { province: 'Other provinces', revenueZAR: 190_000, patients: 3_340, consults: 4_600 },
  ],
  cohorts: [
    { label: '0–17 (Paeds)',      patients: 2_100, sharePct: 12 },
    { label: '18–39 (Young adult)', patients: 7_900, sharePct: 43 },
    { label: '40–64 (Adult)',     patients: 5_800, sharePct: 32 },
    { label: '65+ (Senior)',      patients: 2_440, sharePct: 13 },
  ],
  topEntities: [
    {
      label: 'MedExpress — Sandton',
      kind: 'Pharmacy',
      revenueZAR: 142_300,
      orders: 980,
      location: 'Gauteng',
    },
    {
      label: 'Ambulant Labs — Cape Town',
      kind: 'Lab',
      revenueZAR: 126_900,
      orders: 610,
      location: 'Western Cape',
    },
    {
      label: 'Dr Naidoo (GP)',
      kind: 'Clinician',
      revenueZAR: 94_500,
      orders: 440,
      location: 'Gauteng',
    },
    {
      label: 'PathCare Sandton',
      kind: 'Lab',
      revenueZAR: 88_200,
      orders: 390,
      location: 'Gauteng',
    },
    {
      label: 'Dr Mbele (Physician)',
      kind: 'Clinician',
      revenueZAR: 82_700,
      orders: 360,
      location: 'KZN',
    },
    {
      label: 'CityMeds — CBD',
      kind: 'Pharmacy',
      revenueZAR: 76_100,
      orders: 340,
      location: 'Western Cape',
    },
  ],
};

/* ---------- Small helpers for scaling/filters ---------- */

function parseCurrencyToNumber(v: string): number {
  // Expect formats like "R 1,240,000"
  const cleaned = v.replace(/[^\d.]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function formatCurrency(n: number): string {
  return `R ${Math.round(n).toLocaleString('en-ZA')}`;
}

// Apply a factor to a KPI's value, preserving currency formatting when present.
function scaleKpiValue(value: string | number, factor: number): string | number {
  if (typeof value === 'number') {
    return Math.round(value * factor);
  }
  if (value.startsWith('R')) {
    const base = parseCurrencyToNumber(value);
    return formatCurrency(base * factor);
  }
  // default: return as-is
  return value;
}

function clampFactor(f: number): number {
  if (!Number.isFinite(f)) return 1;
  if (f <= 0) return 0.2; // don't fully zero out
  if (f > 3) return 3;
  return f;
}

/* ---------- GET handler ---------- */

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sp = url.searchParams;

  const range = (sp.get('range') || '30d') as '7d' | '30d' | '90d' | '12m';
  const province = sp.get('province') || 'All';
  const gender = sp.get('gender') || 'All';
  const ageBand = sp.get('ageBand') || 'All';
  const from = sp.get('from') || '';
  const to = sp.get('to') || '';
  const q = (sp.get('q') || '').toLowerCase().trim();

  // Deep clone so we can mutate safely without touching BASE_OVERVIEW
  const payload: OverviewPayload = JSON.parse(
    JSON.stringify(BASE_OVERVIEW),
  );

  /* ---------- Range filter: trim revenueSeries to a sensible window ---------- */

  const fullSeries = [...payload.revenueSeries];
  if (range === '7d' || range === '30d') {
    // last 1 point (pretend it's a "current month" view)
    payload.revenueSeries = fullSeries.slice(-1);
  } else if (range === '90d') {
    payload.revenueSeries = fullSeries.slice(-3);
  } else {
    // 12m: full series
    payload.revenueSeries = fullSeries;
  }

  /* ---------- Province filter: adjust geo + entities + KPI scale ---------- */

  const baseGeoTotal = BASE_OVERVIEW.geo.reduce(
    (acc, g) => acc + g.revenueZAR,
    0,
  );

  let geoFiltered = BASE_OVERVIEW.geo;
  if (province && province !== 'All') {
    geoFiltered = BASE_OVERVIEW.geo.filter((g) =>
      g.province.toLowerCase().includes(province.toLowerCase()),
    );
    if (geoFiltered.length === 0) {
      // ensure we always return something
      geoFiltered = BASE_OVERVIEW.geo;
    }
  }

  payload.geo = JSON.parse(JSON.stringify(geoFiltered));

  const filteredGeoTotal = payload.geo.reduce(
    (acc, g) => acc + g.revenueZAR,
    0,
  );
  let geoFactor =
    baseGeoTotal > 0 ? filteredGeoTotal / baseGeoTotal : 1;
  geoFactor = clampFactor(geoFactor);

  /* ---------- Gender / ageBand "cohort" factor ---------- */

  let cohortFactor = 1;
  if (gender !== 'All') cohortFactor *= 0.55;
  if (ageBand !== 'All') cohortFactor *= 0.65;
  if (from || to) cohortFactor *= 0.9; // slightly down when date range is constrained

  cohortFactor = clampFactor(cohortFactor);

  const globalFactor = clampFactor(geoFactor * cohortFactor);

  /* ---------- Scale KPIs + cohorts to reflect filtered view ---------- */

  payload.kpis = payload.kpis.map((k) => {
    // We only scale "volume" / "revenue-like" metrics
    const isRevenue =
      typeof k.value === 'string' &&
      (k.value.startsWith('R') ||
        k.label.toLowerCase().includes('revenue') ||
        k.label.toLowerCase().includes('payout') ||
        k.label.toLowerCase().includes('earnings'));
    const isVolume =
      typeof k.value === 'number' ||
      k.label.toLowerCase().includes('patients') ||
      k.label.toLowerCase().includes('clinicians');

    if (!isRevenue && !isVolume) return k;

    return {
      ...k,
      value: scaleKpiValue(k.value, globalFactor),
    };
  });

  // scale cohort patient counts but keep sharePct normalized
  payload.cohorts = payload.cohorts.map((c) => ({
    ...c,
    patients: Math.round(c.patients * cohortFactor),
  }));
  const totalPatients = payload.cohorts.reduce(
    (acc, c) => acc + c.patients,
    0,
  );
  payload.cohorts = payload.cohorts.map((c) => ({
    ...c,
    sharePct:
      totalPatients > 0
        ? Math.round((c.patients / totalPatients) * 100)
        : c.sharePct,
  }));

  /* ---------- Top entities filtered by province + search ---------- */

  let entities = [...BASE_OVERVIEW.topEntities];

  if (province && province !== 'All') {
    entities = entities.filter((e) =>
      (e.location || '')
        .toLowerCase()
        .includes(province.toLowerCase()),
    );
    if (!entities.length) {
      entities = [...BASE_OVERVIEW.topEntities];
    }
  }

  if (q) {
    entities = entities.filter(
      (e) =>
        e.label.toLowerCase().includes(q) ||
        (e.location || '').toLowerCase().includes(q),
    );
  }

  // scale their revenue a bit using same factor to stay coherent
  payload.topEntities = entities.map((e) => ({
    ...e,
    revenueZAR: Math.round(e.revenueZAR * geoFactor),
    orders: Math.round(e.orders * cohortFactor),
  }));

  /* ---------- Return ---------- */
  return NextResponse.json(payload);
}
