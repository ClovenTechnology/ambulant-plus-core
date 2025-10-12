import { NextRequest, NextResponse } from 'next/server';
import { getAdminPolicy, getClinicianConsult } from '@/src/store/consult';
import { generateSlotsForDate } from '@/src/lib/slotgen';

// TODO: swap with your real work-hours + exceptions + holidays fetchers
async function getWorkHours(clinicianId: string, dateISO: string) {
  // Example: 08:00–17:00
  return { startMin: 8 * 60, endMin: 17 * 60 };
}
async function getExceptions(clinicianId: string, dateISO: string) {
  return [] as Array<{ fromISO: string; toISO: string }>;
}
async function getHolidayDatesForRange(country: string, startISO: string, days: number) {
  return [] as string[];
}

export async function GET(req: NextRequest) {
  const clinicianId = String(req.nextUrl.searchParams.get('clinician_id') || '');
  const dateISO = String(req.nextUrl.searchParams.get('date') || '');
  const kind = String(req.nextUrl.searchParams.get('kind') || 'standard'); // 'standard' | 'followup'
  if (!clinicianId || !dateISO) return NextResponse.json({ error: 'missing_params' }, { status: 400 });

  const [admin, clin, hours, excs, holidays] = await Promise.all([
    getAdminPolicy(), getClinicianConsult(clinicianId),
    getWorkHours(clinicianId, dateISO),
    getExceptions(clinicianId, dateISO),
    getHolidayDatesForRange('ZA', dateISO, 1),
  ]);

  const durationMin = Math.max(
    kind === 'followup' ? clin.defaultFollowupMin : clin.defaultStandardMin,
    kind === 'followup' ? admin.minFollowupMinutes : admin.minStandardMinutes,
  );

  const slots = generateSlotsForDate({
    dateISO,
    workStartMin: hours.startMin,
    workEndMin: hours.endMin,
    durationMin,
    bufferAfterMin: admin.bufferAfterMinutes,
    minAdvanceMinutes: clin.minAdvanceMinutes,
    maxAdvanceDays: clin.maxAdvanceDays,
    exceptions: excs,
    holidayDates: holidays,
  });

  return NextResponse.json({ date: dateISO, slots });
}
