import { NextRequest } from 'next/server';
import { jsonErr, jsonOk, mapLadyDayLog, resolveLadyPatientContext } from '@/app/api/lady-center/_lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function asNullableBool(v: unknown): boolean | null {
  return typeof v === 'boolean' ? v : null;
}

function asNullableInt(v: unknown, min = 0, max = 10): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export async function GET(req: NextRequest) {
  const ctx = await resolveLadyPatientContext(req);
  if (!ctx.ok) return jsonErr(ctx.error, ctx.status);

  const from = req.nextUrl.searchParams.get('from');
  const to = req.nextUrl.searchParams.get('to');

  const where: any = { patientId: ctx.patientId };
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = new Date(`${from}T00:00:00.000Z`);
    if (to) where.date.lte = new Date(`${to}T00:00:00.000Z`);
  }

  const rows = await ctx.prisma.ladyCenterDayLog.findMany({
    where,
    orderBy: { date: 'asc' },
  });

  return jsonOk({ items: rows.map(mapLadyDayLog) });
}

export async function POST(req: NextRequest) {
  const ctx = await resolveLadyPatientContext(req);
  if (!ctx.ok) return jsonErr(ctx.error, ctx.status);

  const body = await req.json().catch(() => null);
  const log = body?.log;

  if (!log?.date) {
    return jsonErr('Missing log.date.', 400, 'missing_date');
  }

  const row = await ctx.prisma.ladyCenterDayLog.upsert({
    where: {
      patientId_date: {
        patientId: ctx.patientId,
        date: new Date(`${log.date}T00:00:00.000Z`),
      },
    },
    update: {
      period: !!log.period,
      ovulation: !!log.ovulation,
      pregnancyTestPositive: !!log.pregnancyTestPositive,
      meds: log.meds || null,
      notes: log.notes || null,
      symptoms: Array.isArray(log.symptoms) ? log.symptoms.map(String) : [],

      sexualEncounter: !!log.sexualEncounter,
      protectedSex: asNullableBool(log.protectedSex),
      withdrawalUsed: asNullableBool(log.withdrawalUsed),
      emergencyContraception: !!log.emergencyContraception,
      tryingToConceive: asNullableBool(log.tryingToConceive),
      contraceptionMethod: log.contraceptionMethod || null,
      contraceptionAdherence: log.contraceptionAdherence || null,
      cycleModifiers: Array.isArray(log.cycleModifiers) ? log.cycleModifiers.map(String) : [],

      flowIntensity: asNullableInt(log.flowIntensity, 0, 5),
      painScore: asNullableInt(log.painScore, 0, 10),
      cervicalMucus: log.cervicalMucus || null,

      overnightHrPromptedAt: log.overnightHrPromptedAt ? new Date(log.overnightHrPromptedAt) : null,
      overnightHrPromptStatus: log.overnightHrPromptStatus || null,
    },
    create: {
      patientId: ctx.patientId,
      date: new Date(`${log.date}T00:00:00.000Z`),

      period: !!log.period,
      ovulation: !!log.ovulation,
      pregnancyTestPositive: !!log.pregnancyTestPositive,
      meds: log.meds || null,
      notes: log.notes || null,
      symptoms: Array.isArray(log.symptoms) ? log.symptoms.map(String) : [],

      sexualEncounter: !!log.sexualEncounter,
      protectedSex: asNullableBool(log.protectedSex),
      withdrawalUsed: asNullableBool(log.withdrawalUsed),
      emergencyContraception: !!log.emergencyContraception,
      tryingToConceive: asNullableBool(log.tryingToConceive),
      contraceptionMethod: log.contraceptionMethod || null,
      contraceptionAdherence: log.contraceptionAdherence || null,
      cycleModifiers: Array.isArray(log.cycleModifiers) ? log.cycleModifiers.map(String) : [],

      flowIntensity: asNullableInt(log.flowIntensity, 0, 5),
      painScore: asNullableInt(log.painScore, 0, 10),
      cervicalMucus: log.cervicalMucus || null,

      overnightHrPromptedAt: log.overnightHrPromptedAt ? new Date(log.overnightHrPromptedAt) : null,
      overnightHrPromptStatus: log.overnightHrPromptStatus || null,
    },
  });

  return jsonOk({ item: mapLadyDayLog(row) });
}