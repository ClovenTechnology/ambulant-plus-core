// apps/patient-app/components/charts/useLiveVitals.ts
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type Point = { t: number; v: number };
type Series = Point[];

type DataShape = {
  labels: string[];

  hr: Series;
  spo2: Series;
  sys: Series;
  dia: Series;
  map: Series;
  rr: Series;
  temp: Series;
  glucose: Series;

  steps: Series;
  calories: Series;
  distance: Series;

  latest: {
    hr: number;
    spo2: number;
    sys: number;
    dia: number;
    map: number;
    rr: number;
    temp: number;
    glucose: number;
    steps?: number;
    calories?: number;
    distance?: number;
  };

  sleep: {
    totalHours: number;
    stages: { light: number; deep: number; rem: number };
    sessions?: unknown[];
    updatedAt: number | null;
  };
};

type Flags = {
  HR_LOW?: boolean;
  HR_HIGH?: boolean;
  RR_LOW?: boolean;
  RR_HIGH?: boolean;
  TEMP_LOW?: boolean;
  TEMP_HIGH?: boolean;
  BP_HIGH?: boolean;
  GLU_LOW?: boolean;
  GLU_HIGH?: boolean;
};

type ReportsVitalsResponse = {
  ok?: boolean;
  latest?: {
    ts?: string | null;
    hr?: number | string | null;
    spo2?: number | string | null;
    temp_c?: number | string | null;
    glucose?: number | string | null;
    sys?: number | string | null;
    dia?: number | string | null;
  } | null;
  trend?: Array<{
    ts?: string | null;
    hr?: number | string | null;
    spo2?: number | string | null;
    temp_c?: number | string | null;
    temp?: number | string | null;
    glucose?: number | string | null;
    sys?: number | string | null;
    dia?: number | string | null;
    rr?: number | string | null;
    steps?: number | string | null;
    calories?: number | string | null;
    distance?: number | string | null;
  }>;
};

const EMPTY_DATA: DataShape = {
  labels: [],
  hr: [],
  spo2: [],
  sys: [],
  dia: [],
  map: [],
  rr: [],
  temp: [],
  glucose: [],
  steps: [],
  calories: [],
  distance: [],
  latest: {
    hr: 0,
    spo2: 0,
    sys: 0,
    dia: 0,
    map: 0,
    rr: 0,
    temp: 0,
    glucose: 0,
    steps: 0,
    calories: 0,
    distance: 0,
  },
  sleep: {
    totalHours: 0,
    stages: { light: 0, deep: 0, rem: 0 },
    sessions: [],
    updatedAt: null,
  },
};

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function toTimestamp(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function fmtLabel(t: number) {
  return new Date(t).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function pushPoint(series: Series, t: number, value: unknown) {
  const n = toNumber(value);
  if (n === null) return;
  series.push({ t, v: n });
}

function bounded(series: Series, limit: number) {
  return series
    .filter((point) => Number.isFinite(point.t) && Number.isFinite(point.v))
    .sort((a, b) => a.t - b.t)
    .slice(-limit);
}

function latestValue(series: Series) {
  return series.length ? series[series.length - 1]?.v ?? 0 : 0;
}

function buildMapSeries(sys: Series, dia: Series) {
  const diaByTime = new Map(dia.map((point) => [point.t, point.v]));
  return sys
    .map((s) => {
      const d = diaByTime.get(s.t);
      if (typeof d !== 'number') return null;
      return { t: s.t, v: Math.round((s.v + 2 * d) / 3) };
    })
    .filter((point): point is Point => Boolean(point));
}

function normalizeReportsVitals(payload: ReportsVitalsResponse | null, limit: number): DataShape {
  if (!payload || payload.ok === false) return EMPTY_DATA;

  const hr: Series = [];
  const spo2: Series = [];
  const sys: Series = [];
  const dia: Series = [];
  const rr: Series = [];
  const temp: Series = [];
  const glucose: Series = [];
  const steps: Series = [];
  const calories: Series = [];
  const distance: Series = [];

  for (const point of payload.trend ?? []) {
    const t = toTimestamp(point?.ts);
    if (t === null) continue;

    pushPoint(hr, t, point.hr);
    pushPoint(spo2, t, point.spo2);
    pushPoint(sys, t, point.sys);
    pushPoint(dia, t, point.dia);
    pushPoint(rr, t, point.rr);
    pushPoint(temp, t, point.temp_c ?? point.temp);
    pushPoint(glucose, t, point.glucose);
    pushPoint(steps, t, point.steps);
    pushPoint(calories, t, point.calories);
    pushPoint(distance, t, point.distance);
  }

  const latestTs = toTimestamp(payload.latest?.ts);
  if (latestTs !== null) {
    pushPoint(hr, latestTs, payload.latest?.hr);
    pushPoint(spo2, latestTs, payload.latest?.spo2);
    pushPoint(sys, latestTs, payload.latest?.sys);
    pushPoint(dia, latestTs, payload.latest?.dia);
    pushPoint(temp, latestTs, payload.latest?.temp_c);
    pushPoint(glucose, latestTs, payload.latest?.glucose);
  }

  const nextHr = bounded(hr, limit);
  const nextSpo2 = bounded(spo2, limit);
  const nextSys = bounded(sys, limit);
  const nextDia = bounded(dia, limit);
  const nextRr = bounded(rr, limit);
  const nextTemp = bounded(temp, limit);
  const nextGlucose = bounded(glucose, limit);
  const nextSteps = bounded(steps, limit);
  const nextCalories = bounded(calories, limit);
  const nextDistance = bounded(distance, limit);
  const nextMap = bounded(buildMapSeries(nextSys, nextDia), limit);

  const timeline = Array.from(
    new Set(
      [
        ...nextHr,
        ...nextSpo2,
        ...nextSys,
        ...nextDia,
        ...nextRr,
        ...nextTemp,
        ...nextGlucose,
        ...nextSteps,
        ...nextCalories,
        ...nextDistance,
      ].map((point) => point.t),
    ),
  )
    .sort((a, b) => a - b)
    .slice(-limit);

  return {
    labels: timeline.map(fmtLabel),
    hr: nextHr,
    spo2: nextSpo2,
    sys: nextSys,
    dia: nextDia,
    map: nextMap,
    rr: nextRr,
    temp: nextTemp,
    glucose: nextGlucose,
    steps: nextSteps,
    calories: nextCalories,
    distance: nextDistance,
    latest: {
      hr: latestValue(nextHr),
      spo2: latestValue(nextSpo2),
      sys: latestValue(nextSys),
      dia: latestValue(nextDia),
      map: latestValue(nextMap),
      rr: latestValue(nextRr),
      temp: latestValue(nextTemp),
      glucose: latestValue(nextGlucose),
      steps: latestValue(nextSteps),
      calories: latestValue(nextCalories),
      distance: latestValue(nextDistance),
    },
    sleep: EMPTY_DATA.sleep,
  };
}

function hasAnyVitals(data: DataShape) {
  return (
    data.hr.length > 0 ||
    data.spo2.length > 0 ||
    data.sys.length > 0 ||
    data.dia.length > 0 ||
    data.temp.length > 0 ||
    data.glucose.length > 0 ||
    data.rr.length > 0
  );
}

function buildFlags(data: DataShape): Flags {
  if (!hasAnyVitals(data)) return {};

  const flags: Flags = {};
  const v = data.latest;

  if (data.hr.length > 0) {
    flags.HR_LOW = v.hr < 50;
    flags.HR_HIGH = v.hr > 120;
  }

  if (data.rr.length > 0) {
    flags.RR_LOW = v.rr < 10;
    flags.RR_HIGH = v.rr > 28;
  }

  if (data.temp.length > 0) {
    flags.TEMP_LOW = v.temp < 35.5;
    flags.TEMP_HIGH = v.temp > 38.5;
  }

  if (data.sys.length > 0 || data.dia.length > 0) {
    flags.BP_HIGH = v.sys > 140 || v.dia > 90;
  }

  if (data.glucose.length > 0) {
    flags.GLU_LOW = v.glucose < 70;
    flags.GLU_HIGH = v.glucose > 160;
  }

  return flags;
}

async function fetchReportsVitals(signal: AbortSignal) {
  const res = await fetch('/api/reports/vitals?range=30d', {
    cache: 'no-store',
    signal,
    headers: { Accept: 'application/json' },
  });

  const data = (await res.json().catch(() => null)) as ReportsVitalsResponse | null;

  if (!res.ok || data?.ok === false) {
    throw new Error(
      String((data as any)?.message || (data as any)?.error || `Vitals request failed (${res.status})`),
    );
  }

  return data;
}

export default function useLiveVitals(windowPoints = 120, secondsPerPoint = 15) {
  const [enabled, setEnabled] = useState(true);
  const [data, setData] = useState<DataShape>(EMPTY_DATA);
  const [lastError, setLastError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    const ctrl = new AbortController();

    try {
      const payload = await fetchReportsVitals(ctrl.signal);
      if (!mountedRef.current) return;
      setData(normalizeReportsVitals(payload, windowPoints));
      setLastError(null);
    } catch (error) {
      if (!mountedRef.current) return;
      setData(EMPTY_DATA);
      setLastError(error instanceof Error ? error.message : 'Vitals feed unavailable');
    }

    return () => ctrl.abort();
  }, [windowPoints]);

  useEffect(() => {
    mountedRef.current = true;

    void refresh();

    return () => {
      mountedRef.current = false;
    };
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return;

    const period = Math.max(10, secondsPerPoint) * 1000;
    const timer = window.setInterval(() => {
      void refresh();
    }, period);

    return () => window.clearInterval(timer);
  }, [enabled, refresh, secondsPerPoint]);

  const flags = useMemo(() => buildFlags(data), [data]);
  const live = enabled && hasAnyVitals(data) && !lastError;

  return {
    data,
    live,
    setLive: setEnabled,
    flags,
    error: lastError,
    refresh,
  };
}
