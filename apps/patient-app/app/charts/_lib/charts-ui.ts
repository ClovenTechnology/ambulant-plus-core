export type RangeKey = '20' | '7d' | '30d' | '90d' | '1y' | 'custom';
export type OverlayKey = 'sleep' | 'activity' | 'meds' | 'symptoms' | 'cycle';

export type Point = { t: string; v: number | null };

export type Series = {
  key: string;
  label: string;
  unit: string;
  kind: 'line';
  sensitive?: boolean;
  points: Point[];
  comparePoints?: Point[];
};

export type ChartsApiResponse = {
  ok: boolean;
  range: RangeKey;
  startISO?: string;
  endISO?: string;
  series: Record<string, Series>;
  coverage?: Record<string, number>;
  anomalies?: Array<{ seriesKey: string; at: string; note?: string }>;
};

export type ChartsQueryState = {
  range: RangeKey;
  startISO?: string;
  endISO?: string;
  compare: boolean;
  overlay: OverlayKey[];
};

export type PrivacyState = {
  discreet: boolean;
  hideSensitive: boolean;
};

export type PaneKey = 'overview' | 'trends' | 'live' | 'activity' | 'sleep';

export const PANES_LS = 'charts.panes.v3';
export const LS_DISCREET = 'vitals:discreet';
export const LS_HIDE_SENSITIVE = 'vitals:hideSensitive';

export const RANGE_ORDER: RangeKey[] = ['20', '7d', '30d', '90d', '1y', 'custom'];
export const DEFAULT_RANGE: RangeKey = '30d';

export type ChartDef = {
  seriesKey: string;
  title: string;
  subtitle?: string;
  unitHint?: string;
  sensitive?: boolean;
  premium?: boolean;
};

export const CHART_DEFS: ChartDef[] = [
  { seriesKey: 'hr', title: 'Heart Rate', subtitle: 'Trend', unitHint: 'bpm' },
  { seriesKey: 'spo2', title: 'SpO₂', subtitle: 'Trend', unitHint: '%' },
  { seriesKey: 'rr', title: 'Respiratory Rate', subtitle: 'Trend', unitHint: 'rpm' },
  { seriesKey: 'temp', title: 'Temperature', subtitle: 'Trend', unitHint: '°C' },
  { seriesKey: 'sys', title: 'Blood Pressure (SYS)', subtitle: 'Trend', unitHint: 'mmHg', sensitive: true },
  { seriesKey: 'dia', title: 'Blood Pressure (DIA)', subtitle: 'Trend', unitHint: 'mmHg', sensitive: true },
  { seriesKey: 'glucose', title: 'Glucose', subtitle: 'Trend', unitHint: 'mg/dL', sensitive: true },
  { seriesKey: 'steps', title: 'Steps', subtitle: 'Trend', unitHint: 'steps', premium: true },
  { seriesKey: 'sleep.total', title: 'Sleep', subtitle: 'Duration (trend)', unitHint: 'h', premium: true },
];

export function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

export function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export function isISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

export function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function addDaysISO(iso: string, deltaDays: number) {
  const [y, m, d] = iso.split('-').map((n) => Number(n));
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + deltaDays);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function defaultCustomWindow() {
  const endISO = todayISO();
  const startISO = addDaysISO(endISO, -30);
  return { startISO, endISO };
}

export function safeNum(v: any): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function fmt(n: number) {
  const x = Math.round(n * 10) / 10;
  return String(x);
}

export function fmtInt(n: number) {
  return String(Math.round(n));
}

export function prettyTs(t?: string) {
  if (!t) return '—';
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return t;
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function normalizeSearchParams(s: string) {
  const sp = new URLSearchParams(s);
  const entries = Array.from(sp.entries());
  entries.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));
  const out = new URLSearchParams();
  for (const [k, v] of entries) out.append(k, v);
  return out.toString();
}

export function isSensitiveSeriesKey(key: string) {
  const k = String(key || '').toLowerCase();
  return (
    k.includes('blood') ||
    k.includes('bp') ||
    k.includes('sys') ||
    k.includes('dia') ||
    k.includes('glucose')
  );
}

export function isRangeKey(x: string | null | undefined): x is RangeKey {
  return !!x && (RANGE_ORDER as string[]).includes(x);
}

export function parseCSV(x: string | null) {
  return (x || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function deriveStateFromSearchParams(sp: URLSearchParams): ChartsQueryState {
  const rawRange = sp.get('range');
  const range: RangeKey = isRangeKey(rawRange) ? rawRange : DEFAULT_RANGE;

  const compare = sp.get('compare') === '1';

  const overlay = parseCSV(sp.get('overlay')).filter(
    (k): k is OverlayKey =>
      (['sleep', 'activity', 'meds', 'symptoms', 'cycle'] as string[]).includes(k),
  );

  let startISO = sp.get('start') || undefined;
  let endISO = sp.get('end') || undefined;

  if (range === 'custom') {
    if (!startISO || !isISODate(startISO) || !endISO || !isISODate(endISO)) {
      const def = defaultCustomWindow();
      startISO = def.startISO;
      endISO = def.endISO;
    }
  } else {
    startISO = undefined;
    endISO = undefined;
  }

  return { range, startISO, endISO, compare, overlay };
}

export function toCanonicalSearchParams(state: ChartsQueryState) {
  const sp = new URLSearchParams();
  sp.set('range', state.range);

  if (state.range === 'custom') {
    const def = defaultCustomWindow();
    sp.set('start', state.startISO && isISODate(state.startISO) ? state.startISO : def.startISO);
    sp.set('end', state.endISO && isISODate(state.endISO) ? state.endISO : def.endISO);
  }

  if (state.compare) sp.set('compare', '1');
  if (state.overlay.length) sp.set('overlay', state.overlay.join(','));

  return sp;
}

export function buildChartsApiUrl(q: ChartsQueryState) {
  const sp = new URLSearchParams();
  sp.set('range', q.range);
  if (q.range === 'custom') {
    if (q.startISO) sp.set('start', q.startISO);
    if (q.endISO) sp.set('end', q.endISO);
  }
  if (q.compare) sp.set('compare', '1');
  if (q.overlay.length) sp.set('overlay', q.overlay.join(','));
  return `/api/charts?${sp.toString()}`;
}

export function rangeSubtitle(q: ChartsQueryState) {
  if (q.range === 'custom') return `Custom · ${q.startISO || '—'} → ${q.endISO || '—'}`;
  return q.range === '20' ? 'Last 20 readings' : `${q.range.toUpperCase()} window`;
}

export function hasAnyData(s: Series) {
  return s.points.some((p) => p.v != null) || (s.comparePoints?.some((p) => p.v != null) ?? false);
}

export function countNonNull(points: Point[]) {
  return points.reduce((acc, p) => (p?.v == null ? acc : acc + 1), 0);
}

export function buildCsvExport(args: {
  q: ChartsQueryState;
  privacy: PrivacyState;
  series: Record<string, Series>;
}) {
  const { q, privacy, series } = args;

  const lines: string[] = [];
  lines.push(`# Ambulant+ Charts Export`);
  lines.push(`# Range: ${q.range}${q.range === 'custom' ? ` (${q.startISO} → ${q.endISO})` : ''}`);
  lines.push(`# Compare: ${q.compare ? '1' : '0'}`);
  lines.push(`# Discreet: ${privacy.discreet ? '1' : '0'}`);
  lines.push(`# HideSensitive: ${privacy.hideSensitive ? '1' : '0'}`);
  lines.push('');

  for (const s of Object.values(series)) {
    const sensitive = !!s.sensitive || isSensitiveSeriesKey(s.key);
    if (privacy.hideSensitive && sensitive) continue;

    lines.push(`## ${s.label} (${s.key})`);
    lines.push(`t,value,unit${q.compare ? ',compare_value' : ''}`);

    const n = s.points.length;
    for (let i = 0; i < n; i++) {
      const t = s.points[i]?.t ?? '';
      const v = s.points[i]?.v ?? null;
      const cv = q.compare ? (s.comparePoints?.[i]?.v ?? null) : null;

      const outV = privacy.discreet ? '' : v == null ? '' : String(v);
      const outCV = q.compare ? (privacy.discreet ? '' : cv == null ? '' : String(cv)) : undefined;

      lines.push([t, outV, s.unit, ...(q.compare ? [outCV || ''] : [])].join(','));
    }

    lines.push('');
  }

  return lines.join('\n');
}