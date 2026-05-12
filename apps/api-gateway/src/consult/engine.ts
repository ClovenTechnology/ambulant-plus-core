// apps/api-gateway/src/consult/engine.ts

export type EffectiveConsultConfig = {
  slotMinutes: number; // e.g. 30
  startHour: number; // working day start hour (0-23)
  endHour: number; // working day end hour (0-24)
  timeZone?: string; // e.g. "Africa/Johannesburg"
};

export type GeneratedSlot = {
  start: Date;
  end: Date;
  label?: string;
  booked?: boolean;
  status?: string;
};

/**
 * Effective config = admin defaults + clinician overrides (eventually).
 * For now it's a stub, but it matches your route usage: await getEffectiveConsultConfig(clinicianId)
 */
export async function getEffectiveConsultConfig(
  clinicianId?: string,
): Promise<EffectiveConsultConfig> {
  void clinicianId;

  return {
    slotMinutes: 30,
    startHour: 8,
    endHour: 17,
    timeZone: process.env.DEFAULT_TIMEZONE || 'Africa/Johannesburg',
  };
}

/**
 * IMPORTANT:
 * `dayStartUtc` should be the UTC instant that corresponds to "local midnight"
 * in the clinician timezone (your batch route constructs this).
 * Then adding hours/minutes in UTC preserves intended wall-clock schedule.
 */
export function generateSlotsForDate(
  dayStartUtc: Date,
  cfg: EffectiveConsultConfig,
): GeneratedSlot[] {
  const slotMin = Math.max(5, Math.min(240, Math.floor(cfg.slotMinutes || 30)));
  const startHour = Math.max(0, Math.min(23, Math.floor(cfg.startHour || 0)));
  const endHour = Math.max(0, Math.min(24, Math.floor(cfg.endHour || 24)));

  const startMs = dayStartUtc.getTime() + startHour * 60 * 60000;
  const endMs = dayStartUtc.getTime() + endHour * 60 * 60000;

  const out: GeneratedSlot[] = [];
  for (let t = startMs; t + slotMin * 60000 <= endMs; t += slotMin * 60000) {
    const s = new Date(t);
    const e = new Date(t + slotMin * 60000);
    out.push({ start: s, end: e, label: 'Available', booked: false });
  }
  return out;
}