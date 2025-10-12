// Minimal, deterministic slot generator used by API routes.
// Replace with your fuller engine if you already have one.

export type SlotGenInput = {
  dateISO: string;             // YYYY-MM-DD of the clinician's local day
  workStartMin: number;        // minutes from 00:00 (e.g., 8*60)
  workEndMin: number;          // minutes from 00:00 (exclusive)
  durationMin: number;         // session length
  bufferAfterMin: number;      // admin-controlled
  minAdvanceMinutes: number;   // clinician-controlled
  maxAdvanceDays: number;      // clinician-controlled
  exceptions: Array<{ fromISO: string; toISO: string }>; // ISO ranges to block
  holidayDates: string[];      // YYYY-MM-DD
  now?: Date;
};

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

export function generateSlotsForDate(cfg: SlotGenInput): string[] {
  const day = new Date(cfg.dateISO + 'T00:00:00Z');
  const tzOffsetMin = 0; // If you need local TZ, adjust here (or pass pre-shifted mins)
  const dayStart = day.getTime() - tzOffsetMin * 60000;

  if (cfg.holidayDates.includes(cfg.dateISO)) return [];

  const now = cfg.now ?? new Date();
  const slots: string[] = [];
  const step = cfg.durationMin + cfg.bufferAfterMin;
  for (let tMin = cfg.workStartMin; tMin + cfg.durationMin <= cfg.workEndMin; tMin += step) {
    const slotStart = dayStart + tMin * 60000;
    const slotEnd   = slotStart + cfg.durationMin * 60000;

    // booking window
    const minMs = now.getTime() + cfg.minAdvanceMinutes * 60000;
    const maxMs = now.getTime() + cfg.maxAdvanceDays * 86400000;
    if (slotStart < minMs || slotStart > maxMs) continue;

    // exceptions
    const blocked = cfg.exceptions.some(ex => {
      const exS = new Date(ex.fromISO).getTime();
      const exE = new Date(ex.toISO).getTime();
      return overlaps(slotStart, slotEnd, exS, exE);
    });
    if (blocked) continue;

    const iso = new Date(slotStart).toISOString();
    slots.push(iso);
  }
  return slots;
}
