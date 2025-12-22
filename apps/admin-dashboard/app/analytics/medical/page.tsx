// apps/admin-dashboard/app/analytics/medical/page.tsx
'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import Link from 'next/link';

/* ---------- Types aligned with /api/analytics/medical ---------- */

type RangeKey = '7d' | '30d' | '90d' | '12m';
type GeoLevel = 'country' | 'province' | 'city' | 'postalCode';
type AgeBand = 'All' | '0–17' | '18–39' | '40–64' | '65+';
type Gender = 'All' | 'Male' | 'Female' | 'Other';

/**
 * SyndromeKey mirrors the clinical “Syndrome” buckets used in:
 *  - Icd10SyndromeMap.syndrome
 *  - EncounterDiagnosis.syndrome
 *  - InsightCore heatmaps / outbreak signals
 * plus an 'all' pseudo-key for filters.
 */
type SyndromeKey =
  | 'all'
  | 'respiratory'
  | 'gi'
  | 'feverRash'
  | 'neuro'
  | 'cardio'
  | 'utiRenal'
  | 'metabolic'
  | 'obgyn'
  | 'derm'
  | 'mskTrauma'
  | 'mental'
  | 'systemicSepsis'
  | 'general'
  | 'other';

type MedicalKpis = {
  totalCases: number;
  newCases: number;
  testPositivityPct: number;
  suspectedOutbreaks: number;
  paedsSharePct: number;
  highRiskPatientsPct7d: number;
  avgTimeToFirstConsultHours: number;
};

type SyndromePoint = {
  bucket: string; // e.g. "2025-11-30"
  totalCases: number;
  respiratory: number;
  gi: number;
  feverRash: number;
  neuro: number;
  other: number;
};

type IcdTopRow = {
  code: string; // e.g. "J06.9"
  description: string; // e.g. "Acute upper respiratory infection, unspecified"
  cases: number;
  patients: number;
  sharePct: number;
  ageBandBreakdown: { band: AgeBand | string; cases: number }[];
};

type GeoIncidenceRow = {
  geoLevel: GeoLevel;
  name: string; // e.g. "Gauteng"
  code: string; // e.g. "ZA-GP"
  totalCases: number;
  incidencePer100k: number;
  growthRatePct: number; // vs previous period
  suspectedCluster: boolean;
  dominantSyndrome?: SyndromeKey;
};

type MovementRow = {
  fromName: string;
  fromCode: string;
  toName: string;
  toCode: string;
  patients: number;
  suspectedCases: number;
};

type DemographyRow = {
  ageBand: AgeBand | string;
  gender: Exclude<Gender, 'All'>;
  patients: number;
  cases: number;
  incidencePer100k: number;
  sharePct: number;
  topIcd10: { code: string; description: string; cases: number }[];
};

type MedRow = {
  atcCode?: string | null;
  name: string; // "Amoxicillin 500mg"
  prescriptions: number;
  patients: number;
  sharePct: number;
  demographicSkew?: string; // "Paeds-heavy", "Elderly female", etc.
};

type LabRow = {
  loincCode?: string | null;
  name: string; // "COVID PCR", "CRP"
  orders: number;
  positives: number;
  positivityPct: number;
  topIcd10: { code: string; description: string; cases: number }[];
};

type OutbreakSignal = {
  id: string;
  syndrome: SyndromeKey;
  label: string; // "Respiratory spike • Soweto"
  geoLevel: GeoLevel;
  locationName: string;
  signalScore: number; // 0–1
  baselineMultiplier: number; // e.g. 2.3x baseline
  rEstimate?: number | null;
  status: 'watch' | 'investigate' | 'incident';
  window: { from: string; to: string };
};

type PaediatricSlice = {
  totalCases: number;
  sharePct: number;
  hospitalisationRatePer1000: number;
  topDiagnoses: { code: string; description: string; cases: number }[];
  topAgeBands: { band: string; cases: number }[];
};

type MedicalAnalyticsPayload = {
  kpis: MedicalKpis;
  topSyndromes: { key: SyndromeKey; label: string; cases: number; sharePct: number }[];
  timeSeries: SyndromePoint[];
  topIcd10: IcdTopRow[];
  geoIncidence: GeoIncidenceRow[];
  movement: MovementRow[];
  demography: DemographyRow[];
  meds: {
    overall: MedRow[];
    paeds: MedRow[];
    adults: MedRow[];
    seniors: MedRow[];
  };
  labs: LabRow[];
  outbreakSignals: OutbreakSignal[];
  paediatrics: PaediatricSlice;
};

/* ---------- Mock payload for local dev / fallback ---------- */

const MOCK_MEDICAL: MedicalAnalyticsPayload = {
  kpis: {
    totalCases: 12430,
    newCases: 820,
    testPositivityPct: 14.2,
    suspectedOutbreaks: 3,
    paedsSharePct: 18,
    highRiskPatientsPct7d: 7,
    avgTimeToFirstConsultHours: 5.3,
  },
  topSyndromes: [
    { key: 'respiratory', label: 'Respiratory', cases: 5100, sharePct: 41 },
    { key: 'gi', label: 'GI / diarrhoeal', cases: 2900, sharePct: 23 },
    { key: 'feverRash', label: 'Fever / rash', cases: 1800, sharePct: 15 },
    { key: 'neuro', label: 'Neuro', cases: 900, sharePct: 7 },
    { key: 'other', label: 'Other', cases: 1730, sharePct: 14 },
  ],
  timeSeries: Array.from({ length: 14 }).map((_, i) => {
    const base = 400 + i * 15;
    return {
      bucket: new Date(Date.now() - (13 - i) * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10),
      totalCases: base,
      respiratory: Math.round(base * 0.42),
      gi: Math.round(base * 0.22),
      feverRash: Math.round(base * 0.16),
      neuro: Math.round(base * 0.08),
      other: Math.round(base * 0.12),
    };
  }),
  topIcd10: [
    {
      code: 'J06.9',
      description: 'Acute upper respiratory infection, unspecified',
      cases: 2150,
      patients: 1920,
      sharePct: 17,
      ageBandBreakdown: [
        { band: '0–17', cases: 650 },
        { band: '18–39', cases: 780 },
        { band: '40–64', cases: 540 },
        { band: '65+', cases: 180 },
      ],
    },
    {
      code: 'K52.9',
      description: 'Noninfective gastroenteritis and colitis, unspecified',
      cases: 1280,
      patients: 1140,
      sharePct: 10,
      ageBandBreakdown: [
        { band: '0–17', cases: 380 },
        { band: '18–39', cases: 460 },
        { band: '40–64', cases: 320 },
        { band: '65+', cases: 120 },
      ],
    },
    {
      code: 'U07.1',
      description: 'COVID-19, virus identified',
      cases: 860,
      patients: 820,
      sharePct: 7,
      ageBandBreakdown: [
        { band: '0–17', cases: 90 },
        { band: '18–39', cases: 360 },
        { band: '40–64', cases: 290 },
        { band: '65+', cases: 120 },
      ],
    },
  ],
  geoIncidence: [
    {
      geoLevel: 'province',
      name: 'Gauteng',
      code: 'ZA-GP',
      totalCases: 5200,
      incidencePer100k: 92,
      growthRatePct: 18,
      suspectedCluster: true,
      dominantSyndrome: 'respiratory',
    },
    {
      geoLevel: 'province',
      name: 'Western Cape',
      code: 'ZA-WC',
      totalCases: 3100,
      incidencePer100k: 79,
      growthRatePct: 6,
      suspectedCluster: false,
      dominantSyndrome: 'gi',
    },
    {
      geoLevel: 'province',
      name: 'KZN',
      code: 'ZA-KZN',
      totalCases: 2100,
      incidencePer100k: 64,
      growthRatePct: 12,
      suspectedCluster: false,
      dominantSyndrome: 'respiratory',
    },
    {
      geoLevel: 'province',
      name: 'Eastern Cape',
      code: 'ZA-EC',
      totalCases: 1030,
      incidencePer100k: 51,
      growthRatePct: 4,
      suspectedCluster: false,
      dominantSyndrome: 'other',
    },
  ],
  movement: [
    {
      fromName: 'Soweto',
      fromCode: 'SOW',
      toName: 'Johannesburg CBD',
      toCode: 'JHB-CBD',
      patients: 74,
      suspectedCases: 34,
    },
    {
      fromName: 'Khayelitsha',
      fromCode: 'KHA',
      toName: 'Cape Town CBD',
      toCode: 'CPT-CBD',
      patients: 51,
      suspectedCases: 21,
    },
  ],
  demography: [
    {
      ageBand: '0–17',
      gender: 'Female',
      patients: 820,
      cases: 1040,
      incidencePer100k: 88,
      sharePct: 9,
      topIcd10: [
        { code: 'J06.9', description: 'Acute URI', cases: 210 },
        { code: 'K52.9', description: 'GI / diarrhoeal', cases: 130 },
      ],
    },
    {
      ageBand: '0–17',
      gender: 'Male',
      patients: 910,
      cases: 1120,
      incidencePer100k: 94,
      sharePct: 9,
      topIcd10: [
        { code: 'J06.9', description: 'Acute URI', cases: 240 },
        { code: 'J45.9', description: 'Asthma, unspecified', cases: 110 },
      ],
    },
    {
      ageBand: '65+',
      gender: 'Female',
      patients: 460,
      cases: 530,
      incidencePer100k: 132,
      sharePct: 6,
      topIcd10: [
        { code: 'I10', description: 'Hypertension', cases: 160 },
        { code: 'J18.9', description: 'Pneumonia, unspecified', cases: 90 },
      ],
    },
  ],
  meds: {
    overall: [
      {
        atcCode: 'J01CA04',
        name: 'Amoxicillin 500mg',
        prescriptions: 1640,
        patients: 1420,
        sharePct: 11,
        demographicSkew: 'Paeds + young adults',
      },
      {
        atcCode: 'N02BE01',
        name: 'Paracetamol 500mg',
        prescriptions: 2900,
        patients: 2100,
        sharePct: 19,
        demographicSkew: 'All ages',
      },
    ],
    paeds: [
      {
        atcCode: 'J01CR02',
        name: 'Amoxicillin/clavulanic acid syrup',
        prescriptions: 420,
        patients: 360,
        sharePct: 22,
        demographicSkew: '0–11 yrs',
      },
    ],
    adults: [
      {
        atcCode: 'J01CA04',
        name: 'Amoxicillin 500mg',
        prescriptions: 960,
        patients: 860,
        sharePct: 14,
      },
    ],
    seniors: [
      {
        atcCode: 'C09AA05',
        name: 'Ramipril',
        prescriptions: 320,
        patients: 290,
        sharePct: 9,
      },
    ],
  },
  labs: [
    {
      loincCode: '94309-2',
      name: 'SARS-CoV-2 RNA panel',
      orders: 620,
      positives: 82,
      positivityPct: 13.2,
      topIcd10: [
        { code: 'U07.1', description: 'COVID-19, virus identified', cases: 78 },
      ],
    },
    {
      loincCode: '1988-5',
      name: 'C-reactive protein (CRP)',
      orders: 910,
      positives: 340,
      positivityPct: 37.4,
      topIcd10: [
        { code: 'J18.9', description: 'Pneumonia, unspecified', cases: 96 },
      ],
    },
  ],
  outbreakSignals: [
    {
      id: 'sig-1',
      syndrome: 'respiratory',
      label: 'Respiratory spike • Soweto',
      geoLevel: 'city',
      locationName: 'Soweto',
      signalScore: 0.86,
      baselineMultiplier: 2.4,
      rEstimate: 1.4,
      status: 'investigate',
      window: {
        from: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
        to: new Date().toISOString(),
      },
    },
    {
      id: 'sig-2',
      syndrome: 'gi',
      label: 'GI cluster • Khayelitsha',
      geoLevel: 'city',
      locationName: 'Khayelitsha',
      signalScore: 0.71,
      baselineMultiplier: 1.9,
      rEstimate: 1.2,
      status: 'watch',
      window: {
        from: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        to: new Date().toISOString(),
      },
    },
  ],
  paediatrics: {
    totalCases: 2200,
    sharePct: 18,
    hospitalisationRatePer1000: 14.2,
    topDiagnoses: [
      { code: 'J06.9', description: 'Acute URI', cases: 430 },
      { code: 'A09', description: 'Infectious gastroenteritis', cases: 320 },
      { code: 'J45.9', description: 'Asthma, unspecified', cases: 190 },
    ],
    topAgeBands: [
      { band: '0–4', cases: 980 },
      { band: '5–11', cases: 780 },
      { band: '12–17', cases: 440 },
    ],
  },
};

/* ---------- Small UI bits ---------- */

function MetricCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      {sub && <div className="mt-1 text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

/* Simple multi-series line chart for syndromes, using canvas like the overview page */
function drawSyndromeChart(canvas: HTMLCanvasElement, points: SyndromePoint[]) {
  const ctx = canvas.getContext('2d');
  if (!ctx || !points.length) return;

  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth || 600;
  const cssHeight = 260;
  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const w = cssWidth;
  const h = cssHeight;
  const padLeft = 40;
  const padRight = 16;
  const padTop = 24;
  const padBottom = 32;

  ctx.clearRect(0, 0, w, h);

  const allVals = points.flatMap((p) => [
    p.totalCases,
    p.respiratory,
    p.gi,
    p.feverRash,
    p.neuro,
    p.other,
  ]);
  const maxVal = Math.max(...allVals, 1);
  const stepX = points.length === 1 ? 0 : (w - padLeft - padRight) / (points.length - 1);

  // Axes
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padLeft, h - padBottom);
  ctx.lineTo(w - padRight, h - padBottom);
  ctx.stroke();

  ctx.fillStyle = '#9ca3af';
  ctx.font = '10px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
  [0, 0.5, 1].forEach((f) => {
    const y = h - padBottom - f * (h - padTop - padBottom);
    const val = Math.round(maxVal * f);
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(w - padRight, y);
    ctx.strokeStyle = f === 0 ? '#e5e7eb' : '#f3f4f6';
    ctx.stroke();
    ctx.fillText(String(val), 4, y + 3);
  });

  function lineFor(extract: (p: SyndromePoint) => number, color: string) {
    ctx.beginPath();
    points.forEach((p, idx) => {
      const x = padLeft + idx * stepX;
      const y = h - padBottom - (extract(p) / maxVal) * (h - padTop - padBottom);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Total + key syndromes; colors chosen to be distinct & accessible
  lineFor((p) => p.totalCases, '#111827'); // total
  lineFor((p) => p.respiratory, '#4f46e5'); // resp
  lineFor((p) => p.gi, '#0f766e'); // GI
  lineFor((p) => p.feverRash, '#f97316'); // fever/rash

  ctx.fillStyle = '#9ca3af';
  ctx.textAlign = 'center';
  points.forEach((p, idx) => {
    const x = padLeft + idx * stepX;
    const y = h - padBottom + 14;
    ctx.fillText(p.bucket.slice(5), x, y);
  });
}

function SyndromeChart({ points }: { points: SyndromePoint[] }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (ref.current && points.length) {
      drawSyndromeChart(ref.current, points);
    }
  }, [points]);
  return <canvas ref={ref} className="h-[260px] w-full" />;
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">
      {children}
    </span>
  );
}

/* ---------- Page ---------- */

const GEO_LEVELS: GeoLevel[] = ['country', 'province', 'city', 'postalCode'];
const AGE_BANDS: AgeBand[] = ['All', '0–17', '18–39', '40–64', '65+'];
const GENDERS: Gender[] = ['All', 'Male', 'Female', 'Other'];

const SYNDROMES: { key: SyndromeKey; label: string }[] = [
  { key: 'all',             label: 'All syndromes' },
  { key: 'respiratory',     label: 'Respiratory' },
  { key: 'gi',              label: 'GI / diarrhoeal' },
  { key: 'feverRash',       label: 'Fever / rash' },
  { key: 'neuro',           label: 'Neurologic' },
  { key: 'cardio',          label: 'Cardio / chest pain' },
  { key: 'utiRenal',        label: 'UTI / renal' },
  { key: 'metabolic',       label: 'Metabolic / endocrine' },
  { key: 'obgyn',           label: 'OBGYN' },
  { key: 'derm',            label: 'Dermatologic' },
  { key: 'mskTrauma',       label: 'MSK / trauma' },
  { key: 'mental',          label: 'Mental & behavioural' },
  { key: 'systemicSepsis',  label: 'Systemic sepsis / shock' },
  { key: 'general',         label: 'General / constitutional' },
  { key: 'other',           label: 'Other' },
];

export default function MedicalAnalyticsPage() {
  const [range, setRange] = useState<RangeKey>('7d');
  const [geoLevel, setGeoLevel] = useState<GeoLevel>('province');
  const [province, setProvince] = useState<string>('All');
  const [ageBand, setAgeBand] = useState<AgeBand>('All');
  const [gender, setGender] = useState<Gender>('All');
  const [syndrome, setSyndrome] = useState<SyndromeKey>('all');
  const [searchCode, setSearchCode] = useState('');

  const [data, setData] = useState<MedicalAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [usingMock, setUsingMock] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const params = new URLSearchParams();
        params.set('range', range);
        params.set('geoLevel', geoLevel);
        if (province !== 'All') params.set('province', province);
        if (ageBand !== 'All') params.set('ageBand', ageBand);
        if (gender !== 'All') params.set('gender', gender);
        if (syndrome !== 'all') params.set('syndrome', syndrome);
        if (searchCode.trim()) params.set('icd', searchCode.trim());

        const url = '/api/analytics/medical?' + params.toString();
        const res = await fetch(url, { cache: 'no-store' });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as MedicalAnalyticsPayload;
        if (cancelled) return;
        setData(json);
        setUsingMock(false);
        setLastUpdated(new Date());
      } catch (e: any) {
        console.error('medical analytics error', e);
        if (!cancelled) {
          setErr(
            e?.message ||
              'Using mock medical analytics snapshot until /api/analytics/medical is reachable.',
          );
          setData(MOCK_MEDICAL);
          setUsingMock(true);
          setLastUpdated(new Date());
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [range, geoLevel, province, ageBand, gender, syndrome, searchCode]);

  const d = data ?? MOCK_MEDICAL;

  const maxGeoIncidence = useMemo(
    () => Math.max(...d.geoIncidence.map((g) => g.incidencePer100k), 1),
    [d.geoIncidence],
  );

  const filteredIcd = useMemo(() => {
    if (!searchCode.trim()) return d.topIcd10;
    const q = searchCode.trim().toLowerCase();
    return d.topIcd10.filter(
      (r) =>
        r.code.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q),
    );
  }, [d.topIcd10, searchCode]);

  function resetFilters() {
    setRange('7d');
    setGeoLevel('province');
    setProvince('All');
    setAgeBand('All');
    setGender('All');
    setSyndrome('all');
    setSearchCode('');
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-6">
      {/* HEADER */}
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            Analytics — Medical &amp; Syndromic
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Near real-time view of symptoms, diagnoses, labs and InsightCore
            risk alerts across the Ambulant+ network.
          </p>
          {lastUpdated && (
            <p className="mt-1 text-[11px] text-gray-400">
              Last updated {lastUpdated.toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 text-xs">
          <div className="inline-flex overflow-hidden rounded-full border bg-white">
            <Link
              href="/analytics"
              className="border-r px-3 py-1.5 hover:bg-gray-50"
            >
              Overview
            </Link>
            <Link
              href="/analytics/medical"
              className="bg-gray-900 px-3 py-1.5 text-white"
            >
              Medical
            </Link>
            <Link
              href="/analytics/clinician-payouts"
              className="border-l px-3 py-1.5 hover:bg-gray-50"
            >
              Payouts
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>
              Source: ICD-10, labs, meds, vitals, InsightCore alerts
            </Badge>
            <Badge>Outbreak signals are indicative, not diagnostic</Badge>
            <Badge>
              Mode:{' '}
              <span className={usingMock ? 'text-amber-700' : 'text-emerald-700'}>
                {usingMock ? 'Mock snapshot' : 'Live API'}
              </span>
            </Badge>
          </div>
        </div>
      </header>

      {err && (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {err}
        </div>
      )}
      {loading && (
        <div className="text-xs text-gray-500">
          Loading medical analytics…
        </div>
      )}

      {/* FILTER BAR */}
      <section className="space-y-3 rounded-2xl border bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-gray-500">Range:</span>
            <div className="inline-flex overflow-hidden rounded-full border bg-white">
              {(['7d', '30d', '90d', '12m'] as RangeKey[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`border-r px-3 py-1 last:border-r-0 ${
                    range === r
                      ? 'bg-gray-900 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {r === '7d'
                    ? 'Last 7d'
                    : r === '30d'
                    ? 'Last 30d'
                    : r === '90d'
                    ? 'Last 90d'
                    : 'Last 12m'}
                </button>
              ))}
            </div>
            <span className="ml-3 text-gray-500">Geo level:</span>
            <select
              className="rounded border px-2 py-1 text-xs"
              value={geoLevel}
              onChange={(e) => setGeoLevel(e.target.value as GeoLevel)}
            >
              {GEO_LEVELS.map((g) => (
                <option key={g} value={g}>
                  {g === 'country'
                    ? 'Country'
                    : g === 'province'
                    ? 'Province'
                    : g === 'city'
                    ? 'City / town'
                    : 'Postal / zip'}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <input
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              placeholder="Filter diagnosis (ICD-10 code or text)"
              className="w-60 rounded border px-2 py-1"
            />
            <button
              type="button"
              onClick={resetFilters}
              className="rounded border px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50"
            >
              Reset filters
            </button>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-4">
          <select
            className="rounded border px-2 py-1 text-xs"
            value={province}
            onChange={(e) => setProvince(e.target.value)}
          >
            <option value="All">All regions</option>
            <option value="Gauteng">Gauteng</option>
            <option value="Western Cape">Western Cape</option>
            <option value="KZN">KwaZulu-Natal</option>
            <option value="Eastern Cape">Eastern Cape</option>
            <option value="Other">Other</option>
          </select>
          <select
            className="rounded border px-2 py-1 text-xs"
            value={ageBand}
            onChange={(e) => setAgeBand(e.target.value as AgeBand)}
          >
            {AGE_BANDS.map((a) => (
              <option key={a} value={a}>
                Age: {a}
              </option>
            ))}
          </select>
          <select
            className="rounded border px-2 py-1 text-xs"
            value={gender}
            onChange={(e) => setGender(e.target.value as Gender)}
          >
            {GENDERS.map((g) => (
              <option key={g} value={g}>
                Gender: {g}
              </option>
            ))}
          </select>
          <select
            className="rounded border px-2 py-1 text-xs"
            value={syndrome}
            onChange={(e) => setSyndrome(e.target.value as SyndromeKey)}
          >
            {SYNDROMES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* KPI STRIP */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6">
        <MetricCard
          label="New clinical cases (range)"
          value={d.kpis.newCases}
          sub={`${d.kpis.totalCases.toLocaleString()} total diagnoses in selected window`}
        />
        <MetricCard
          label="% paediatric"
          value={`${d.kpis.paedsSharePct.toFixed(1)}%`}
          sub={`${d.paediatrics.totalCases.toLocaleString()} paeds diagnoses (0–17 yrs)`}
        />
        <MetricCard
          label="Test positivity"
          value={`${d.kpis.testPositivityPct.toFixed(1)}%`}
          sub="Positive lab results / tests run"
        />
        <MetricCard
          label="Suspected outbreak signals"
          value={d.kpis.suspectedOutbreaks}
          sub={`Top: ${d.outbreakSignals[0]?.label ?? 'No active signals'}`}
        />
        <MetricCard
          label="Patients ≥ moderate risk (7d)"
          value={`${d.kpis.highRiskPatientsPct7d.toFixed(1)}%`}
          sub="Based on InsightCore risk alerts (moderate / high)"
        />
        <MetricCard
          label="Avg time to first coded diagnosis"
          value={`${d.kpis.avgTimeToFirstConsultHours.toFixed(1)}h`}
          sub="Encounter opened → first diagnosis code"
        />
      </section>

      {/* SYNDROMIC TREND + TOP SYNDROMES */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-2 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-medium text-gray-900">
                Syndromic trend
              </h2>
              <p className="text-[11px] text-gray-500">
                Total diagnosed cases by day, split into key syndromes.
              </p>
            </div>
            <div className="hidden text-[11px] text-gray-500 sm:flex sm:flex-col sm:items-end">
              <span>Lines: Total • Respiratory • GI • Fever / rash</span>
            </div>
          </div>
          {d.timeSeries.length ? (
            <SyndromeChart points={d.timeSeries} />
          ) : (
            <div className="flex h-[260px] items-center justify-center text-xs text-gray-400">
              No syndromic data for this view.
            </div>
          )}
        </div>

        <div className="space-y-3 rounded-2xl border bg-white p-4 shadow-sm">
          <h2 className="text-sm font-medium text-gray-900">
            Top syndromes (range)
          </h2>
          <p className="text-[11px] text-gray-500">
            Share of all diagnoses mapped into high-level syndrome buckets.
          </p>
          <ul className="space-y-2 text-xs">
            {d.topSyndromes.length === 0 && (
              <li className="text-gray-500">
                No syndrome distribution available for this view.
              </li>
            )}
            {d.topSyndromes.map((s) => (
              <li
                key={s.key}
                className="flex items-center justify-between gap-2"
              >
                <button
                  type="button"
                  onClick={() => setSyndrome(s.key)}
                  className="flex items-center gap-2 text-left hover:opacity-80"
                >
                  <span className="inline-block h-1.5 w-10 rounded-full bg-gray-900" />
                  <span className="text-gray-800">{s.label}</span>
                </button>
                <div className="flex items-center gap-3">
                  <span className="tabular-nums text-gray-600">
                    {s.cases.toLocaleString()} cases
                  </span>
                  <span className="tabular-nums text-gray-500">
                    {s.sharePct}%
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* TOP DIAGNOSES & GEO SPREAD */}
      <section className="grid gap-4 lg:grid-cols-3">
        {/* Top ICD10 */}
        <div className="lg:col-span-2 space-y-3 rounded-2xl border bg-white p-4 shadow-sm">
          <h2 className="text-sm font-medium text-gray-900">
            Top diagnoses (ICD-10)
          </h2>
          <p className="text-[11px] text-gray-500">
            Leading ICD-10 codes for this view with age-band breakdown.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b bg-gray-50 text-gray-500">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Code</th>
                  <th className="px-3 py-2 font-medium">Description</th>
                  <th className="px-3 py-2 text-right font-medium">Cases</th>
                  <th className="px-3 py-2 text-right font-medium">
                    Patients
                  </th>
                  <th className="px-3 py-2 text-right font-medium">Share</th>
                  <th className="px-3 py-2 font-medium">By age band</th>
                </tr>
              </thead>
              <tbody>
                {filteredIcd.length ? (
                  filteredIcd.map((r) => (
                    <tr key={r.code} className="border-b last:border-0">
                      <td className="px-3 py-2 font-mono text-[11px] text-gray-800">
                        {r.code}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-900">
                        {r.description}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-gray-800 tabular-nums">
                        {r.cases.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-gray-800 tabular-nums">
                        {r.patients.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-gray-600 tabular-nums">
                        {r.sharePct}%
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-700">
                        <div className="flex flex-wrap gap-1">
                          {r.ageBandBreakdown.map((b) => (
                            <span
                              key={b.band}
                              className="inline-flex items-center rounded-full bg-gray-50 px-2 py-0.5 text-[11px]"
                            >
                              <span className="mr-1 text-gray-500">
                                {b.band}:
                              </span>
                              <span className="tabular-nums text-gray-800">
                                {b.cases}
                              </span>
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-4 text-center text-xs text-gray-500"
                    >
                      No diagnoses for this view.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Geo spread */}
        <div className="space-y-3 rounded-2xl border bg-white p-4 shadow-sm">
          <h2 className="text-sm font-medium text-gray-900">
            Geospatial spread
          </h2>
          <p className="text-[11px] text-gray-500">
            Incidence per 100k and trend vs previous period by{' '}
            {geoLevel === 'province'
              ? 'province'
              : geoLevel === 'city'
              ? 'city / town'
              : geoLevel === 'postalCode'
              ? 'postal / zip'
              : 'country'}{' '}
            bucket.
          </p>
          {d.geoIncidence.length === 0 ? (
            <div className="text-xs text-gray-500">
              No geospatial signal for this filter set.
            </div>
          ) : (
            <div className="space-y-3">
              {d.geoIncidence.map((g) => {
                const pct = (g.incidencePer100k / maxGeoIncidence) * 100;
                return (
                  <div key={g.code} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-gray-800">
                        {g.name}
                      </span>
                      <span className="tabular-nums text-gray-500">
                        {g.incidencePer100k.toFixed(1)} / 100k
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-100">
                      <div
                        className={`h-2 rounded-full ${
                          g.suspectedCluster ? 'bg-red-500' : 'bg-gray-900'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-gray-500">
                      <span>
                        {g.totalCases.toLocaleString()} cases •{' '}
                        {g.dominantSyndrome
                          ? `Dominant: ${
                              SYNDROMES.find(
                                (s) => s.key === g.dominantSyndrome,
                              )?.label ?? g.dominantSyndrome
                            }`
                          : 'Mixed'}
                      </span>
                      <span
                        className={
                          g.growthRatePct >= 15
                            ? 'text-red-600'
                            : g.growthRatePct >= 5
                            ? 'text-amber-600'
                            : 'text-emerald-600'
                        }
                      >
                        {g.growthRatePct >= 0 ? '+' : ''}
                        {g.growthRatePct.toFixed(1)}% vs prior
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* DEMOGRAPHY & OUTBREAK SIGNALS */}
      <section className="grid gap-4 lg:grid-cols-3">
        {/* Demography */}
        <div className="lg:col-span-2 space-y-3 rounded-2xl border bg-white p-4 shadow-sm">
          <h2 className="text-sm font-medium text-gray-900">
            Demography &amp; risk
          </h2>
          <p className="text-[11px] text-gray-500">
            Incidence by age-band and gender with top diagnoses per segment.
          </p>
          {d.demography.length === 0 ? (
            <div className="text-xs text-gray-500">
              No demographic distribution for this view.
            </div>
          ) : (
            <div className="space-y-2 text-xs">
              {d.demography.map((row, idx) => (
                <div
                  key={`${row.ageBand}-${row.gender}-${idx}`}
                  className="flex items-start justify-between gap-3 border-b pb-2 last:border-0 last:pb-0"
                >
                  <div>
                    <div className="font-medium text-gray-900">
                      {row.ageBand} • {row.gender}
                    </div>
                    <div className="text-gray-500">
                      {row.patients.toLocaleString()} pts •{' '}
                      {row.cases.toLocaleString()} cases
                    </div>
                    <div className="mt-1 text-[11px] text-gray-500">
                      Top ICD-10:{' '}
                      {row.topIcd10.slice(0, 3).map((icd, i) => (
                        <span key={icd.code}>
                          {i > 0 && ', '}
                          <span className="font-mono text-[10px]">
                            {icd.code}
                          </span>{' '}
                          ({icd.cases})
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="tabular-nums text-gray-900">
                      {row.incidencePer100k.toFixed(1)} / 100k
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {row.sharePct.toFixed(1)}% of cases
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Outbreak signals summary */}
        <div className="space-y-3 rounded-2xl border bg-white p-4 shadow-sm">
          <h2 className="text-sm font-medium text-gray-900">
            Outbreak signals
          </h2>
          <p className="text-[11px] text-gray-500">
            Statistically unusual spikes by syndrome and location — use for early
            warning and manual review.
          </p>
          <ul className="space-y-2 text-xs">
            {d.outbreakSignals.length === 0 ? (
              <li className="text-gray-500">
                No active outbreak signals for this view.
              </li>
            ) : (
              d.outbreakSignals.map((s) => (
                <li
                  key={s.id}
                  className="flex items-start justify-between gap-3 rounded-xl border bg-gray-50 px-3 py-2"
                >
                  <div>
                    <div className="font-medium text-gray-900">
                      {s.label}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {SYNDROMES.find((x) => x.key === s.syndrome)?.label ??
                        s.syndrome}{' '}
                      • {s.locationName}
                    </div>
                    <div className="mt-1 text-[11px] text-gray-500">
                      Window:{' '}
                      {new Date(s.window.from).toLocaleDateString()} –{' '}
                      {new Date(s.window.to).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-gray-500">
                      Status:
                      <span
                        className={`ml-1 inline-flex items-center rounded-full px-1.5 py-0.5 ${
                          s.status === 'incident'
                            ? 'bg-red-100 text-red-700'
                            : s.status === 'investigate'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-sky-100 text-sky-700'
                        }`}
                      >
                        {s.status}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-gray-500">
                      Signal score:{' '}
                      <span className="tabular-nums text-gray-900">
                        {s.signalScore.toFixed(2)}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-gray-500">
                      {s.baselineMultiplier.toFixed(1)}x baseline
                      {s.rEstimate != null && (
                        <> • R≈{s.rEstimate.toFixed(2)}</>
                      )}
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
          <div className="text-[10px] text-gray-400">
            Note: outbreak detection uses population-normalised stats and
            InsightCore scores; it does not confirm specific pathogens.
            Always confirm with labs and public health partners.
          </div>
        </div>
      </section>

      {/* MEDS, LABS & PAEDS */}
      <section className="grid gap-4 lg:grid-cols-3">
        {/* Medications */}
        <div className="space-y-3 rounded-2xl border bg-white p-4 shadow-sm">
          <h2 className="text-sm font-medium text-gray-900">
            Highest prescribed medications
          </h2>
          <p className="text-[11px] text-gray-500">
            Top medicines for this view. Watch for antibacterial overuse and
            age-specific patterns.
          </p>
          {d.meds.overall.length === 0 ? (
            <div className="text-xs text-gray-500">
              No prescriptions for this view.
            </div>
          ) : (
            <div className="space-y-2 text-xs">
              {d.meds.overall.slice(0, 6).map((m) => (
                <div
                  key={m.name}
                  className="flex items-start justify-between gap-3 border-b pb-2 last:border-0 last:pb-0"
                >
                  <div>
                    <div className="font-medium text-gray-900">
                      {m.name}
                    </div>
                    {m.atcCode && (
                      <div className="font-mono text-[10px] text-gray-500">
                        {m.atcCode}
                      </div>
                    )}
                    {m.demographicSkew && (
                      <div className="text-[11px] text-gray-500">
                        {m.demographicSkew}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="tabular-nums text-gray-900">
                      {m.prescriptions.toLocaleString()}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {m.sharePct.toFixed(1)}% of scripts
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Labs */}
        <div className="space-y-3 rounded-2xl border bg-white p-4 shadow-sm">
          <h2 className="text-sm font-medium text-gray-900">
            Lab utilisation &amp; positivity
          </h2>
          <p className="text-[11px] text-gray-500">
            High-volume tests and their positivity rates for this cohort.
          </p>
          {d.labs.length === 0 ? (
            <div className="text-xs text-gray-500">
              No lab results for this view.
            </div>
          ) : (
            <div className="space-y-2 text-xs">
              {d.labs.map((l) => (
                <div
                  key={l.name}
                  className="flex items-start justify-between gap-3 border-b pb-2 last:border-0 last:pb-0"
                >
                  <div>
                    <div className="font-medium text-gray-900">
                      {l.name}
                    </div>
                    {l.loincCode && (
                      <div className="font-mono text-[10px] text-gray-500">
                        {l.loincCode}
                      </div>
                    )}
                    <div className="mt-1 text-[11px] text-gray-500">
                      Linked ICD-10:{' '}
                      {l.topIcd10.slice(0, 2).map((icd, i) => (
                        <span key={icd.code}>
                          {i > 0 && ', '}
                          <span className="font-mono text-[10px]">
                            {icd.code}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="tabular-nums text-gray-900">
                      {l.orders.toLocaleString()} orders
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {l.positivityPct.toFixed(1)}% positive
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Paeds slice */}
        <div className="space-y-3 rounded-2xl border bg-white p-4 shadow-sm">
          <h2 className="text-sm font-medium text-gray-900">
            Paediatric view
          </h2>
          <p className="text-[11px] text-gray-500">
            Paediatric share, severe alert rate and common diagnoses (0–17 yrs).
          </p>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">
                Paeds diagnoses (0–17 yrs)
              </span>
              <span className="tabular-nums text-gray-900">
                {d.paediatrics.totalCases.toLocaleString()} (
                {d.paediatrics.sharePct.toFixed(1)}%)
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">
                Severe alert rate (proxy for hospitalisation)
              </span>
              <span className="tabular-nums text-gray-900">
                {d.paediatrics.hospitalisationRatePer1000.toFixed(1)} / 1000
              </span>
            </div>
            <div className="mt-2">
              <div className="text-[11px] font-medium text-gray-700">
                Top diagnoses
              </div>
              <ul className="mt-1 space-y-1">
                {d.paediatrics.topDiagnoses.map((dx) => (
                  <li
                    key={dx.code}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="flex-1 text-gray-800">
                      <span className="mr-1 font-mono text-[10px]">
                        {dx.code}
                      </span>
                      {dx.description}
                    </span>
                    <span className="tabular-nums text-gray-600">
                      {dx.cases}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-2">
              <div className="text-[11px] font-medium text-gray-700">
                Cases by paeds age-band
              </div>
              <div className="mt-1 space-y-1">
                {d.paediatrics.topAgeBands.map((b) => (
                  <div
                    key={b.band}
                    className="flex items-center justify-between text-[11px]"
                  >
                    <span className="text-gray-700">{b.band}</span>
                    <span className="tabular-nums text-gray-600">
                      {b.cases}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
