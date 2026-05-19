// apps/patient-app/app/vitals/_lib/vitals-ui.ts

export type Status = 'normal' | 'warning' | 'critical' | 'unknown';

export type Vital = {
  id: string;
  ts: string;
  device?: string;
  hr?: number;
  sys?: number;
  dia?: number;
  spo2?: number;
  temp_c?: number;
  bmi?: number;
  glucose_mg_dl?: number;
  __annotations?: { ts: string; text: string }[];
};

export type VitalsRange = '20' | '7d' | '30d' | '90d' | '1y' | 'custom';

export function statusForHr(hr?: number): Status {
  if (hr == null) return 'unknown';
  if (hr < 50 || hr > 120) return 'critical';
  if (hr < 60 || hr > 100) return 'warning';
  return 'normal';
}

export function statusForBp(sys?: number, dia?: number): Status {
  if (sys == null || dia == null) return 'unknown';
  if (sys >= 180 || dia >= 120) return 'critical';
  if (sys >= 140 || dia >= 90) return 'warning';
  return 'normal';
}

export function statusForSpo2(spo2?: number): Status {
  if (spo2 == null) return 'unknown';
  if (spo2 < 90) return 'critical';
  if (spo2 < 94) return 'warning';
  return 'normal';
}

export function statusForTemp(temp_c?: number): Status {
  if (temp_c == null) return 'unknown';
  if (temp_c >= 40 || temp_c < 34) return 'critical';
  if (temp_c >= 38 || temp_c < 36) return 'warning';
  return 'normal';
}

export function statusForGlucose(gl?: number): Status {
  if (gl == null) return 'unknown';
  if (gl < 70 || gl > 180) return 'critical';
  if (gl < 90 || gl > 140) return 'warning';
  return 'normal';
}

export function badgeProps(status: Status) {
  switch (status) {
    case 'normal':
      return { text: 'OK', className: 'bg-green-100 text-green-800' };
    case 'warning':
      return { text: 'Watch', className: 'bg-yellow-100 text-yellow-800' };
    case 'critical':
      return { text: 'High', className: 'bg-red-100 text-red-800' };
    default:
      return { text: '-', className: 'bg-gray-100 text-gray-700' };
  }
}

export function prettyDevice(device?: string) {
  if (!device) return 'Unknown';
  if (/nexring/i.test(device)) return 'NexRing';
  if (/health/i.test(device)) return 'Health Monitor';
  if (/manual/i.test(device)) return 'Manual';
  return device;
}

export function worstStatus(statuses: Status[]): Status {
  const known = statuses.filter((s) => s !== 'unknown');
  if (!known.length) return 'unknown';
  if (known.includes('critical')) return 'critical';
  if (known.includes('warning')) return 'warning';
  if (known.includes('normal')) return 'normal';
  return 'unknown';
}

export function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yday = new Date();
  yday.setDate(yday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yday.toDateString()) return 'Yesterday';

  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatTimeAgo(ts?: string): string {
  if (!ts) return '';
  const t = new Date(ts).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - t);
  const sec = Math.floor(diff / 1000);

  if (sec < 10) return 'just now';
  if (sec < 60) return `${sec}s ago`;

  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min${min > 1 ? 's' : ''} ago`;

  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr > 1 ? 's' : ''} ago`;

  const d = Math.floor(hr / 24);
  return `${d} day${d > 1 ? 's' : ''} ago`;
}

export function safeNum(v?: number) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function isSensitiveMetric(
  metric: 'bp' | 'glucose' | 'hr' | 'spo2' | 'temp' | 'steps',
) {
  return metric === 'bp' || metric === 'glucose';
}

export function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function todayDateStr() {
  return isoDate(new Date());
}

export function includesToday(range: VitalsRange, customEnd?: string) {
  if (range !== 'custom') return true;
  const end = (customEnd || '').trim();
  const t = todayDateStr();
  if (!end) return true;
  return end >= t;
}

export function redactRows(
  rows: Vital[],
  discreet: boolean,
  hideSensitive: boolean,
): Vital[] {
  return rows.map((r) => {
    const out: Vital = { ...r };

    if (discreet || hideSensitive) out.__annotations = [];

    if (discreet) {
      out.hr = undefined;
      out.sys = undefined;
      out.dia = undefined;
      out.spo2 = undefined;
      out.temp_c = undefined;
      out.glucose_mg_dl = undefined;
      out.bmi = undefined;
      return out;
    }

    if (hideSensitive) {
      out.sys = undefined;
      out.dia = undefined;
      out.glucose_mg_dl = undefined;
      return out;
    }

    return out;
  });
}

export function vitalsRangeQuery(
  range: VitalsRange,
  customStart?: string,
  customEnd?: string,
) {
  const q = new URLSearchParams();
  q.set('range', range);

  if (range === 'custom') {
    if (customStart?.trim()) q.set('start', customStart.trim());
    if (customEnd?.trim()) q.set('end', customEnd.trim());
  }

  return q;
}