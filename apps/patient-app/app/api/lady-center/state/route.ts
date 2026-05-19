import { NextRequest } from 'next/server';
import {
  buildLadyState,
  jsonErr,
  jsonOk,
  mapLadyProfile,
  resolveLadyPatientContext,
  tagToEnum,
  inferNextDueISO,
  computeScreeningStatus,
} from '@/app/api/lady-center/_lib/server';

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

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).map((x) => x.trim()).filter(Boolean) : [];
}

function asNullableDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeSexAtBirth(value: unknown) {
  const raw = String(value || '').trim().toLowerCase();
  return raw === 'female' || raw === 'male' || raw === 'intersex' ? raw : 'unknown';
}

function profileWriteData(profile: any, userId?: string | null) {
  return {
    mode: profile.mode,
    trackCycle: !!profile.trackCycle,
    trackSymptoms: !!profile.trackSymptoms,
    trackVitals: !!profile.trackVitals,
    remindScreening: !!profile.remindScreening,
    sexAtBirth: normalizeSexAtBirth(profile.sexAtBirth),
    contraceptiveMethod: profile.contraceptiveMethod ? String(profile.contraceptiveMethod) : null,
    tryingToConceive: !!profile.tryingToConceive,
    knownConditions: asStringArray(profile.knownConditions),
    userId: userId || undefined,
  };
}

function dayLogWriteData(patientId: string, log: any) {
  return {
    patientId,
    date: new Date(`${log.date}T00:00:00.000Z`),
    period: !!log.period,
    ovulation: !!log.ovulation,
    pregnancyTestPositive: !!log.pregnancyTestPositive,
    meds: log.meds || null,
    notes: log.notes || null,
    symptoms: asStringArray(log.symptoms),

    sexualEncounter: !!log.sexualEncounter,
    protectedSex: asNullableBool(log.protectedSex),
    withdrawalUsed: asNullableBool(log.withdrawalUsed),
    emergencyContraception: !!log.emergencyContraception,
    tryingToConceive: asNullableBool(log.tryingToConceive),
    contraceptionMethod: log.contraceptionMethod || null,
    contraceptionAdherence: log.contraceptionAdherence || null,
    cycleModifiers: asStringArray(log.cycleModifiers),

    flowIntensity: asNullableInt(log.flowIntensity, 0, 5),
    painScore: asNullableInt(log.painScore, 0, 10),
    cervicalMucus: log.cervicalMucus || null,

    overnightHrPromptedAt: asNullableDate(log.overnightHrPromptedAt),
    overnightHrPromptStatus: log.overnightHrPromptStatus || null,
  };
}

export async function GET(req: NextRequest) {
  const ctx = await resolveLadyPatientContext(req);
  if (!ctx.ok) return jsonErr(ctx.error, ctx.status);

  const { prisma, patientId } = ctx;

  const [profile, docs, notes, screenings, dayLogs] = await Promise.all([
    prisma.ladyCenterProfile.findUnique({ where: { patientId } }),
    prisma.ladyCenterDocument.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.ladyCenterNote.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    prisma.ladyCenterScreening.findMany({
      where: { patientId },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.ladyCenterDayLog.findMany({
      where: { patientId },
      orderBy: { date: 'asc' },
      take: 400,
    }),
  ]);

  const updatedAtISO =
    [
      profile?.updatedAt,
      ...docs.map((x: any) => x.updatedAt),
      ...notes.map((x: any) => x.updatedAt),
      ...screenings.map((x: any) => x.updatedAt),
      ...dayLogs.map((x: any) => x.updatedAt),
    ]
      .filter(Boolean)
      .map((d: Date) => d.toISOString())
      .sort()
      .at(-1) || null;

  return jsonOk(
    buildLadyState({
      profile,
      docs,
      notes,
      screenings,
      dayLogs,
      updatedAtISO,
    }),
  );
}

export async function PUT(req: NextRequest) {
  const ctx = await resolveLadyPatientContext(req);
  if (!ctx.ok) return jsonErr(ctx.error, ctx.status);

  const { prisma, patientId, userId } = ctx;
  const body = await req.json().catch(() => null);

  if (!body || typeof body !== 'object') {
    return jsonErr('Invalid JSON body.', 400, 'bad_json');
  }

  const profile = body.profile ?? null;
  const docs = Array.isArray(body.docs) ? body.docs : [];
  const notes = Array.isArray(body.notes) ? body.notes : [];
  const screeningObj = body.screening && typeof body.screening === 'object' ? body.screening : {};
  const dayLogsObj = body.dayLogs && typeof body.dayLogs === 'object' ? body.dayLogs : {};

  await prisma.$transaction(async (tx: any) => {
    if (profile) {
      await tx.ladyCenterProfile.upsert({
        where: { patientId },
        update: profileWriteData(profile, userId),
        create: {
          patientId,
          ...profileWriteData(profile, userId),
          createdAtISO: profile.createdAtISO ? new Date(profile.createdAtISO) : new Date(),
        },
      });
    } else {
      await tx.ladyCenterProfile.deleteMany({ where: { patientId } });
    }

    await tx.ladyCenterDocument.deleteMany({ where: { patientId } });
    if (docs.length) {
      await tx.ladyCenterDocument.createMany({
        data: docs.map((d: any) => ({
          patientId,
          id: d.id,
          title: d.title,
          tag: tagToEnum(d.tag),
          fileName: d.fileName || null,
          createdISO: d.createdISO ? new Date(d.createdISO) : new Date(),
        })),
        skipDuplicates: true,
      });
    }

    await tx.ladyCenterNote.deleteMany({ where: { patientId } });
    if (notes.length) {
      await tx.ladyCenterNote.createMany({
        data: notes.map((n: any) => ({
          patientId,
          id: n.id,
          text: String(n.text || ''),
          createdISO: n.createdISO ? new Date(n.createdISO) : new Date(),
        })),
        skipDuplicates: true,
      });
    }

    await tx.ladyCenterScreening.deleteMany({ where: { patientId } });
    const screeningEntries = Object.entries(screeningObj as Record<string, any>);
    if (screeningEntries.length) {
      await tx.ladyCenterScreening.createMany({
        data: screeningEntries.map(([key, value]) => {
          const lastDoneISO = value?.lastDoneISO ? new Date(value.lastDoneISO) : null;
          const nextDueISO = inferNextDueISO(key, value?.lastDoneISO || null);
          return {
            patientId,
            key,
            lastDoneISO,
            nextDueISO: nextDueISO ? new Date(nextDueISO) : null,
            status: computeScreeningStatus(nextDueISO),
          };
        }),
        skipDuplicates: true,
      });
    }

    await tx.ladyCenterDayLog.deleteMany({ where: { patientId } });
    const dayLogs = Object.values(dayLogsObj as Record<string, any>);
    if (dayLogs.length) {
      await tx.ladyCenterDayLog.createMany({
        data: dayLogs.map((log: any) => dayLogWriteData(patientId, log)),
        skipDuplicates: true,
      });
    }
  });

  const savedProfile = await prisma.ladyCenterProfile.findUnique({ where: { patientId } });
  return jsonOk({
    ok: true,
    profile: mapLadyProfile(savedProfile),
    updatedAtISO: new Date().toISOString(),
  });
}