import { prisma } from '@/src/lib/db';

export type DayKey = 'mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun';
export type SlotRange = { start: string; end: string };
export type DayTemplate = { enabled: boolean; ranges: SlotRange[] };
export type Exception = { date: string; reason?: string };
export type ScheduleConfig = {
  country: string;
  timezone: string;
  template: Record<DayKey, DayTemplate>;
  exceptions: Exception[];
};

const DEFAULT: ScheduleConfig = {
  country: 'ZA',
  timezone: 'Africa/Johannesburg',
  template: {
    mon:{enabled:true, ranges:[{start:'09:00',end:'12:00'},{start:'13:00',end:'17:00'}]},
    tue:{enabled:true, ranges:[{start:'09:00',end:'12:00'},{start:'13:00',end:'17:00'}]},
    wed:{enabled:true, ranges:[{start:'09:00',end:'12:00'},{start:'13:00',end:'17:00'}]},
    thu:{enabled:true, ranges:[{start:'09:00',end:'12:00'},{start:'13:00',end:'17:00'}]},
    fri:{enabled:true, ranges:[{start:'09:00',end:'12:00'},{start:'13:00',end:'17:00'}]},
    sat:{enabled:false, ranges:[{start:'09:00',end:'12:00'}]},
    sun:{enabled:false, ranges:[]},
  },
  exceptions: [],
};

export async function getSchedule(userId: string): Promise<ScheduleConfig> {
  const row = await prisma.clinicianSchedule.findUnique({ where: { userId } });
  if (!row) return DEFAULT;
  let template: ScheduleConfig['template'] = DEFAULT.template;
  let exceptions: ScheduleConfig['exceptions'] = [];
  try { template = JSON.parse(row.template); } catch {}
  try { exceptions = JSON.parse(row.exceptions); } catch {}
  return {
    country: row.country || 'ZA',
    timezone: row.timezone || 'Africa/Johannesburg',
    template, exceptions,
  };
}

export async function setSchedule(userId: string, cfg: ScheduleConfig) {
  const payload = {
    userId,
    country: cfg.country || 'ZA',
    timezone: cfg.timezone || 'Africa/Johannesburg',
    template: JSON.stringify(cfg.template || DEFAULT.template),
    exceptions: JSON.stringify(cfg.exceptions || []),
  };
  await prisma.clinicianSchedule.upsert({
    where: { userId },
    update: payload,
    create: payload,
  });
}
