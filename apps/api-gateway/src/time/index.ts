// apps/api-gateway/src/time/index.ts
export type WeekStartsOn = 'monday' | 'sunday';

export function nowIso() {
  return new Date().toISOString();
}

export function toDate(input: string | number | Date) {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${String(input)}`);
  return d;
}

export function addMinutes(d: Date, minutes: number) {
  return new Date(d.getTime() + minutes * 60_000);
}

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function clampDate(d: Date, min: Date, max: Date) {
  const t = d.getTime();
  return new Date(Math.min(max.getTime(), Math.max(min.getTime(), t)));
}

/**
 * Best-effort timezone label for display only.
 * (We don't do heavy TZ math here to keep dependencies light.)
 */
export function getOrgTimezone() {
  return process.env.TZ || process.env.ORG_TIMEZONE || 'Africa/Johannesburg';
}
