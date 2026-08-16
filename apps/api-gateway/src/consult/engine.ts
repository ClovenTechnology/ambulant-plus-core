// apps/api-gateway/src/consult/engine.ts
import { prisma } from '@/src/lib/db';
import { getSchedule, type DayKey, type ScheduleConfig } from '@/src/store/schedule';
import { getAdminPolicy, getClinicianConsult } from '@/src/store/consult';

export type EffectiveConsultConfig = {
  slotMinutes: number;
  bufferMinutes: number;
  minAdvanceMinutes: number;
  maxAdvanceDays: number;
  timeZone?: string;
  schedule: ScheduleConfig;
  clinicianId?: string;
  clinicianUserId?: string;
};

export type GeneratedSlot = {
  start: Date;
  end: Date;
  label?: string;
  booked?: boolean;
  status?: string;
};

const DAY_KEYS: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function parseObject(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function profileJson(clinician: any): Record<string, any> {
  const meta = parseObject(clinician?.meta);
  if (meta.rawProfile && typeof meta.rawProfile === 'object') return meta.rawProfile;
  if (typeof meta.rawProfileJson === 'string') return parseObject(meta.rawProfileJson);
  return meta;
}

function num(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function hhmmToMinutes(value: unknown, fallback: number) {
  const s = String(value ?? '').trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return fallback;
  const hh = Math.max(0, Math.min(23, Number(m[1])));
  const mm = Math.max(0, Math.min(59, Number(m[2])));
  return hh * 60 + mm;
}

async function resolveClinician(identifier?: string) {
  const raw = String(identifier || '').trim();
  if (!raw) return null;

  return (prisma as any).clinicianProfile.findFirst({
    where: {
      OR: [
        { id: raw },
        { userId: raw },
        { email: raw },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getEffectiveConsultConfig(
  clinicianId?: string,
): Promise<EffectiveConsultConfig> {
  const clinician = await resolveClinician(clinicianId);
  const clinicianUserId = String(clinician?.userId || clinicianId || '').trim();

  // Canonical clinician-owned settings key:
  // ClinicianSchedule and ClinicianConsultSettings are persisted by ClinicianProfile.userId.
  // Profile id/email remain lookup aliases and must not take precedence for settings reads.
  const clinicianSettingsKey = String(
    clinician?.userId || clinicianUserId || clinicianId || clinician?.id || '',
  ).trim();

  const [schedule, consult, admin] = await Promise.all([
    getSchedule(clinicianSettingsKey),
    getClinicianConsult(clinicianSettingsKey),
    getAdminPolicy(),
  ]);

  const profile = profileJson(clinician);
  const storedConsult = parseObject(profile.consultSettings);
  const bufferMinutes = Math.max(
    0,
    Math.round(num(storedConsult.bufferMinutes ?? profile.bufferMinutes, admin.bufferAfterMinutes)),
  );

  return {
    slotMinutes: Math.max(5, Math.min(240, Math.round(num(consult.defaultStandardMin, 30)))),
    bufferMinutes,
    minAdvanceMinutes: Math.max(0, Math.round(num(consult.minAdvanceMinutes, 30))),
    maxAdvanceDays: Math.max(1, Math.round(num(consult.maxAdvanceDays, 30))),
    timeZone: schedule.timezone || process.env.DEFAULT_TIMEZONE || 'Africa/Johannesburg',
    schedule,
    clinicianId: clinician?.id || clinicianId,
    clinicianUserId,
  };
}

export function generateSlotsForDate(
  dayStartUtc: Date,
  cfg: EffectiveConsultConfig,
): GeneratedSlot[] {
  const dateKey = dayStartUtc.toISOString().slice(0, 10);
  if ((cfg.schedule.exceptions || []).some((ex) => ex.date === dateKey)) {
    return [];
  }

  const dayKey = DAY_KEYS[dayStartUtc.getUTCDay()];
  const dayTemplate = cfg.schedule.template?.[dayKey];

  if (!dayTemplate?.enabled || !Array.isArray(dayTemplate.ranges) || dayTemplate.ranges.length === 0) {
    return [];
  }

  const slotMin = Math.max(5, Math.min(240, Math.floor(cfg.slotMinutes || 30)));
  const bufferMin = Math.max(0, Math.min(240, Math.floor(cfg.bufferMinutes || 0)));
  const stepMin = Math.max(5, slotMin + bufferMin);
  const dayBaseMs = Date.UTC(
    dayStartUtc.getUTCFullYear(),
    dayStartUtc.getUTCMonth(),
    dayStartUtc.getUTCDate(),
    0,
    0,
    0,
    0,
  );

  const out: GeneratedSlot[] = [];

  for (const range of dayTemplate.ranges) {
    const startMin = hhmmToMinutes(range.start, 9 * 60);
    let endMin = hhmmToMinutes(range.end, 17 * 60);

    if (endMin <= startMin) {
      endMin += 24 * 60;
    }

    for (let t = startMin; t + slotMin <= endMin; t += stepMin) {
      const s = new Date(dayBaseMs + t * 60000);
      const e = new Date(s.getTime() + slotMin * 60000);
      out.push({ start: s, end: e, label: 'Available', booked: false, status: 'available' });
    }
  }

  return out;
}
