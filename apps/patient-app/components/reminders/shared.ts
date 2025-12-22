// components/reminders/shared.ts
import type { ReminderShape } from '@/components/ReminderList';

export type ApiReminder = {
  id: string;
  name: string;
  dose?: string | null;
  time?: string | null;
  status: 'Pending' | 'Taken' | 'Missed';
  snoozedUntil?: string | null;
  source?: string | null;
  medicationId?: string | null;
  meta?: any;
  createdAt?: string;
};

export type TabId =
  | 'overview'
  | 'pills'
  | 'hydration'
  | 'exercise'
  | 'meditation'
  | 'sleep';

export type ReminderCategory =
  | 'pill'
  | 'hydration'
  | 'exercise'
  | 'sleep'
  | 'meditation'
  | 'other';

export type Stats = {
  pending: number;
  taken: number;
  missed: number;
  pct: number;
};

/**
 * NexRing data stubs
 */
export type NexRingExerciseMetrics = {
  sessionId: string;
  steps: number;
  avgHeartRate: number;
  peakHeartRate?: number;
  distanceKm?: number;
  calories?: number;
  startTimeIso?: string;
  endTimeIso?: string;
};

export type NexRingSleepMetrics = {
  nightId: string;
  sleepScore: number;
  totalSleepMinutes: number;
  deepMinutes?: number;
  remMinutes?: number;
  efficiencyPct?: number;
  inBedStartIso?: string;
  inBedEndIso?: string;
};

export type NexRingMetrics = {
  exercise?: NexRingExerciseMetrics;
  sleep?: NexRingSleepMetrics;
};

// Soft fallback data if API fails or returns nothing
export const MOCK_REMINDERS: ApiReminder[] = [
  {
    id: 'mock-1',
    name: 'Morning antihypertensive',
    dose: '10 mg',
    time: '08:00',
    status: 'Pending',
    source: 'medication',
  },
  {
    id: 'mock-2',
    name: 'Metformin',
    dose: '500 mg',
    time: '20:00',
    status: 'Pending',
    source: 'medication',
  },
  {
    id: 'mock-3',
    name: 'Hydration reminder',
    dose: '250 ml',
    time: '11:00',
    status: 'Pending',
    source: 'hydration',
  },
  {
    id: 'mock-4',
    name: 'Evening walk',
    dose: null,
    time: '18:30',
    status: 'Taken',
    source: 'exercise',
    meta: {
      type: 'exercise',
      nexRing: {
        exercise: {
          sessionId: 'demo-walk-1',
          steps: 3200,
          avgHeartRate: 104,
          peakHeartRate: 121,
          distanceKm: 2.3,
          calories: 145,
          startTimeIso: new Date().toISOString(),
        },
      } satisfies NexRingMetrics,
    },
  },
  {
    id: 'mock-5',
    name: 'Bedtime routine',
    dose: '8h goal',
    time: '22:30',
    status: 'Pending',
    source: 'sleep',
    meta: {
      type: 'sleep',
      nexRing: {
        sleep: {
          nightId: 'demo-night-1',
          sleepScore: 84,
          totalSleepMinutes: 7.25 * 60, // 7h 15m
          deepMinutes: 80,
          remMinutes: 95,
          efficiencyPct: 91,
          inBedStartIso: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
          inBedEndIso: new Date().toISOString(),
        },
      } satisfies NexRingMetrics,
    },
  },
];

export const MOCK_ADHERENCE_TREND = [80, 85, 88, 90, 92, 95, 93];

export function nowHHMM() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function timeToIsoToday(time: string) {
  const d = new Date();
  const [hh, mm] = time.split(':').map((x) => parseInt(x, 10));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return d.toISOString();
  d.setHours(hh, mm, 0, 0);
  return d.toISOString();
}

export function computeWakeTime(bedTime: string, hoursStr: string): string {
  if (!bedTime || !hoursStr) return '';
  const [hh, mm] = bedTime.split(':').map((v) => parseInt(v, 10));
  const hours = parseFloat(hoursStr);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || !Number.isFinite(hours)) {
    return '';
  }
  const d = new Date();
  d.setHours(hh, mm, 0, 0);
  d.setHours(d.getHours() + hours);
  const wh = String(d.getHours()).padStart(2, '0');
  const wm = String(d.getMinutes()).padStart(2, '0');
  return `${wh}:${wm}`;
}

export function getReminderType(r: ApiReminder): ReminderCategory {
  if (r.source === 'medication') return 'pill';
  if (r.source === 'hydration') return 'hydration';
  if (r.source === 'exercise') return 'exercise';
  if (r.source === 'sleep') return 'sleep';
  if (r.source === 'meditation') return 'meditation';

  const metaType = r.meta?.type || r.meta?.category;
  if (metaType === 'pill' || metaType === 'medication') return 'pill';
  if (metaType === 'hydration') return 'hydration';
  if (metaType === 'exercise') return 'exercise';
  if (metaType === 'sleep') return 'sleep';
  if (
    metaType === 'meditation' ||
    metaType === 'mindfulness' ||
    metaType === 'breathing'
  ) {
    return 'meditation';
  }

  return 'other';
}

export function computeStats(arr: ApiReminder[]): Stats {
  const pending = arr.filter((r) => r.status === 'Pending').length;
  const taken = arr.filter((r) => r.status === 'Taken').length;
  const missed = arr.filter((r) => r.status === 'Missed').length;
  const denom = taken + missed;
  const pct = denom === 0 ? 100 : Math.round((taken / denom) * 100);
  return { pending, taken, missed, pct };
}

// Consistent icons for categories
export function getCategoryIcon(category: ReminderCategory): string {
  switch (category) {
    case 'pill':
      return '⚕️';
    case 'hydration':
      return '💧';
    case 'exercise':
      return '🏋️';
    case 'sleep':
      return '🌙';
    case 'meditation':
      return '🧘';
    default:
      return '⏰';
  }
}

export function getTabIcon(tab: TabId): string {
  switch (tab) {
    case 'overview':
      return '📋';
    case 'pills':
      return '⚕️';
    case 'hydration':
      return '💧';
    case 'exercise':
      return '🏋️';
    case 'meditation':
      return '🧘';
    case 'sleep':
      return '🌙';
    default:
      return '';
  }
}

export const tabs: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'pills', label: 'Pills' },
  { id: 'hydration', label: 'Hydration' },
  { id: 'exercise', label: 'Exercise' },
  { id: 'meditation', label: 'Meditation' },
  { id: 'sleep', label: 'Sleep' },
];

export function hasNotificationSupport(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}
