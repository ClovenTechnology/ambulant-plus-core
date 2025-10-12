// Slot generator with holidays + exceptions
import Holidays from 'date-holidays';

export type DayKey = 'mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun';
export type SlotRange = { start: string; end: string };
export type DayTemplate = { enabled: boolean; ranges: SlotRange[] };
export type ScheduleConfig = {
  country: string;
  timezone: string;
  template: Record<DayKey, DayTemplate>;
  exceptions: { date: string }[];
};
export type ConsultSettings = {
  defaultMinutes: number;
  bufferMinutes: number;
  minAdvanceMinutes: number;
  maxAdvanceDays: number;
};

const DAYIDX: Record<DayKey, number> = { sun:0, mon:1, tue:2, wed:3, thu:4, fri:5, sat:6 };

function parseHM(s:string){ const [h,m]=s.split(':').map(Number); return h*60 + m; }
function toHM(mins:number){ const h=Math.floor(mins/60), m=mins%60; return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`; }

export function isException(dateISO:string, cfg:ScheduleConfig){
  return !!cfg.exceptions.find(e => e.date === dateISO);
}

export function isHoliday(date: Date, country: string){
  try {
    const hd = new Holidays(country || 'ZA');
    return !!hd.isHoliday(date);
  } catch { return false; }
}

export function generateSlotsForDate(dateISO: string, cfg: ScheduleConfig, consult: ConsultSettings): string[] {
  const d = new Date(`${dateISO}T00:00:00`);
  const weekday = d.getDay(); // 0..6
  const dk = (['sun','mon','tue','wed','thu','fri','sat'] as DayKey[])[weekday];

  // exceptions first
  if (isException(dateISO, cfg)) return [];

  // holidays (skip); change if you want to allow holidays
  if (isHoliday(d, cfg.country)) return [];

  const day = cfg.template[dk];
  if (!day || !day.enabled) return [];

  const len = Math.max(5, Math.min(180, consult.defaultMinutes|0));
  const buf = Math.max(0, Math.min(60, consult.bufferMinutes|0));

  const out: string[] = [];
  for (const r of day.ranges) {
    const start = parseHM(r.start);
    const end   = parseHM(r.end);
    let t = start;
    while (t + len <= end) {
      out.push(toHM(t));
      t += len + buf;
    }
  }
  return out;
}
