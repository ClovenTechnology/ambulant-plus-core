// apps/patient-app/components/charts/sleepSeed.ts
//
// Minimal sleep seed that mimics your NexRing screenshot,
// including TWO sessions on the same day.
// Times are in Africa/Johannesburg (SAST).

export type SleepStage = 'awake' | 'rem' | 'light' | 'deep';

export type SleepBand = {
  /** ms since epoch */
  start: number;
  end: number;
  stage: SleepStage;
};

export type SleepSession = {
  startISO: string;
  endISO: string;
  /** efficiency as 0..1 */
  efficiency: number;
  /** total minutes in each stage */
  minutes: {
    awake: number;
    rem: number;
    light: number;
    deep: number;
  };
  /** strip/bands for the stage timeline */
  bands: SleepBand[];
};

export type SleepDay = {
  dateISO: string; // yyyy-mm-dd
  sessions: SleepSession[];
  totals: {
    durationMin: number;
    efficiency: number; // 0..1, crude aggregate
    awake: number;
    rem: number;
    light: number;
    deep: number;
  };
};

function atLocal(date: Date, h: number, m: number) {
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

/**
 * Create a NexRing-style seed with two sleep sessions:
 * - 18:52–00:50 (≈5h58) 99% efficiency
 * - 11:31–12:41 (≈1h10) 100% efficiency
 */
export function getSleepSeed(day: Date = new Date()): SleepDay {
  // force to local midnight for stable “date” label
  const base = new Date(day);
  base.setHours(0, 0, 0, 0);

  // Session 1: 18:52–00:50 (crosses midnight => end on next day)
  const s1Start = atLocal(base, 18, 52);
  const s1End = new Date(atLocal(base, 0, 50).getTime() + 24 * 3600 * 1000);

  // Session 2: 11:31–12:41
  const s2Start = atLocal(base, 11, 31);
  const s2End = atLocal(base, 12, 41);

  // helper to build a banded strip (simple alternating blocks)
  const makeBands = (start: Date, end: Date, pattern: SleepStage[]): SleepBand[] => {
    const total = end.getTime() - start.getTime();
    const seg = Math.max(4, pattern.length);
    const bandLen = Math.floor(total / seg);
    const bands: SleepBand[] = [];
    let t = start.getTime();
    for (let i = 0; i < seg; i++) {
      const next = i === seg - 1 ? end.getTime() : t + bandLen;
      bands.push({ start: t, end: next, stage: pattern[i % pattern.length] });
      t = next;
    }
    return bands;
  };

  // Rough splits to reflect your screenshot’s legend
  const s1 = {
    startISO: s1Start.toISOString(),
    endISO: s1End.toISOString(),
    efficiency: 0.99,
    minutes: {
      awake: 5,   // ~1%
      rem: 26,    // ~7%
      light: 292, // ~82%
      deep: 35,   // ~10%
    },
    bands: makeBands(s1Start, s1End, ['light', 'rem', 'light', 'deep', 'light', 'light', 'rem', 'light', 'deep']),
  } satisfies SleepSession;

  const s2 = {
    startISO: s2Start.toISOString(),
    endISO: s2End.toISOString(),
    efficiency: 1.0,
    minutes: {
      awake: 0,
      rem: 12,
      light: 46,
      deep: 12,
    },
    bands: makeBands(s2Start, s2End, ['light', 'deep', 'light', 'rem']),
  } satisfies SleepSession;

  const totals = {
    durationMin:
      (new Date(s1.endISO).getTime() - new Date(s1.startISO).getTime()) / 60000 +
      (new Date(s2.endISO).getTime() - new Date(s2.startISO).getTime()) / 60000,
    efficiency: 0.99, // simple aggregate
    awake: s1.minutes.awake + s2.minutes.awake,
    rem: s1.minutes.rem + s2.minutes.rem,
    light: s1.minutes.light + s2.minutes.light,
    deep: s1.minutes.deep + s2.minutes.deep,
  };

  return {
    dateISO: base.toISOString().slice(0, 10),
    sessions: [s1, s2],
    totals,
  };
}
