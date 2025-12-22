// apps/patient-app/components/charts/useLiveVitals.ts
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

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
    updatedAt: number;
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

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const rnd = (sd = 1) => (Math.random() - 0.5) * sd * 2;
const round1 = (x: number) => Math.round(x * 10) / 10;

function mkPoint(v: number): Point {
  return { t: Date.now(), v };
}

function broadcastVitals(latest: DataShape['latest']) {
  const payload = {
    type: 'vitals',
    vitals: {
      ts: Date.now(),
      hr: latest.hr,
      spo2: latest.spo2,
      sys: latest.sys,
      dia: latest.dia,
      map: latest.map,
      rr: latest.rr,
      tempC: latest.temp,
      glucose: latest.glucose,
    },
  };
  try {
    window.postMessage(payload, '*');
  } catch {}
  try {
    window.top && window.top !== window && window.top.postMessage(payload, '*');
  } catch {}
  try {
    window.parent && window.parent !== window && window.parent.postMessage(payload, '*');
  } catch {}
  try {
    window.opener && window.opener.postMessage(payload, '*');
  } catch {}
  try {
    const bc = new BroadcastChannel('ambulant-iomt');
    bc.postMessage(payload);
    setTimeout(() => bc.close(), 50);
  } catch {}
}

function buildTimes(now: number, windowPoints: number, secondsPerPoint: number) {
  const period = secondsPerPoint * 1000;
  const times: number[] = [];
  // oldest -> newest
  for (let i = windowPoints; i > 0; i--) {
    times.push(now - i * period);
  }
  return times;
}

function fmtLabel(t: number) {
  // keep it compact and consistent
  return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function useLiveVitals(windowPoints = 120, secondsPerPoint = 1) {
  const [live, setLive] = useState(true);

  // pre-seed series
  const [data, setData] = useState<DataShape>(() => {
    const now = Date.now();
    const times = buildTimes(now, windowPoints, secondsPerPoint);
    const labels = times.map(fmtLabel);

    const seed = (fn: () => number): Series => times.map((t) => ({ t, v: fn() }));

    // SA baselines (resting adult)
    const hr = seed(() => round1(72 + rnd(2)));
    const spo2 = seed(() => round1(97 + rnd(0.4)));
    const sys = seed(() => round1(116 + rnd(4)));
    const dia = seed(() => round1(74 + rnd(3)));

    // MAP should correspond point-by-point to SYS/DIA (not one constant)
    const map = times.map((t, i) => ({
      t,
      v: Math.round(((sys[i]?.v ?? 116) + 2 * (dia[i]?.v ?? 74)) / 3),
    }));

    const rr = seed(() => round1(16 + rnd(1)));
    const temp = seed(() => round1(36.8 + rnd(0.1)));
    const glucose = seed(() => Math.round(94 + rnd(3)));

    const steps = seed(() => Math.max(0, Math.round(6000 + rnd(600))));
    const calories = seed(() => Math.max(0, Math.round(1800 + rnd(150))));
    const distance = seed(() => Math.max(0, round1(5.2 + rnd(0.6))));

    const latest = {
      hr: hr.at(-1)!.v,
      spo2: spo2.at(-1)!.v,
      sys: sys.at(-1)!.v,
      dia: dia.at(-1)!.v,
      map: map.at(-1)!.v,
      rr: rr.at(-1)!.v,
      temp: temp.at(-1)!.v,
      glucose: glucose.at(-1)!.v,
      steps: steps.at(-1)!.v,
      calories: calories.at(-1)!.v,
      distance: distance.at(-1)!.v,
    };

    return {
      labels,
      hr,
      spo2,
      sys,
      dia,
      map,
      rr,
      temp,
      glucose,
      steps,
      calories,
      distance,
      latest,
      sleep: {
        totalHours: 6.8,
        stages: { light: 3.4, deep: 1.6, rem: 1.8 },
        updatedAt: now,
      },
    };
  });

  // ring buffer push
  const push = (series: Series, v: number) => {
    const next = [...series, mkPoint(v)];
    if (next.length > windowPoints) next.shift();
    return next;
  };

  // cadence timer
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!live) return;

    const period = secondsPerPoint * 1000;

    timerRef.current = setInterval(() => {
      setData((d) => {
        const next = { ...d };

        // random-walk targets
        const hr = clamp(d.latest.hr + rnd(1.5), 58, 135);
        const spo2 = clamp(d.latest.spo2 + rnd(0.25), 93, 100);
        const sys = clamp(d.latest.sys + rnd(2.5), 90, 180);
        const dia = clamp(d.latest.dia + rnd(1.8), 55, 110);
        const mapv = Math.round((sys + 2 * dia) / 3);
        const rr = clamp(d.latest.rr + rnd(0.8), 8, 32);
        const temp = clamp(d.latest.temp + rnd(0.05), 35.0, 39.8);
        const glu = clamp(d.latest.glucose + rnd(2.2), 60, 190);

        const steps = Math.max(0, (d.latest.steps ?? 6000) + Math.round(rnd(50)));
        const calories = Math.max(0, (d.latest.calories ?? 1800) + Math.round(rnd(10)));
        const distance = Math.max(0, round1((d.latest.distance ?? 5.2) + rnd(0.03)));

        next.hr = push(d.hr, round1(hr));
        next.spo2 = push(d.spo2, round1(spo2));
        next.sys = push(d.sys, round1(sys));
        next.dia = push(d.dia, round1(dia));
        next.map = push(d.map, round1(mapv));
        next.rr = push(d.rr, round1(rr));
        next.temp = push(d.temp, round1(temp));
        next.glucose = push(d.glucose, Math.round(glu));

        next.steps = push(d.steps, steps);
        next.calories = push(d.calories, calories);
        next.distance = push(d.distance, distance);

        // labels MUST stay aligned to windowPoints
        const t = Date.now();
        const labels = [...d.labels, fmtLabel(t)];
        if (labels.length > windowPoints) labels.shift();
        next.labels = labels;

        next.latest = {
          hr: next.hr.at(-1)!.v,
          spo2: next.spo2.at(-1)!.v,
          sys: next.sys.at(-1)!.v,
          dia: next.dia.at(-1)!.v,
          map: next.map.at(-1)!.v,
          rr: next.rr.at(-1)!.v,
          temp: next.temp.at(-1)!.v,
          glucose: next.glucose.at(-1)!.v,
          steps: next.steps.at(-1)!.v,
          calories: next.calories.at(-1)!.v,
          distance: next.distance.at(-1)!.v,
        };

        broadcastVitals(next.latest);
        return next;
      });
    }, period);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [live, secondsPerPoint, windowPoints]);

  // flags
  const flags: Flags = useMemo(() => {
    const v = data.latest;
    return {
      HR_LOW: v.hr < 50,
      HR_HIGH: v.hr > 120,
      RR_LOW: v.rr < 10,
      RR_HIGH: v.rr > 28,
      TEMP_LOW: v.temp < 35.5,
      TEMP_HIGH: v.temp > 38.5,
      BP_HIGH: v.sys > 140 || v.dia > 90,
      GLU_LOW: v.glucose < 70,
      GLU_HIGH: v.glucose > 160,
    };
  }, [data.latest]);

  return { data, live, setLive, flags };
}
