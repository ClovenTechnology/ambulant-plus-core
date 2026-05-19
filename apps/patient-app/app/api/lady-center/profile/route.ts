import { NextRequest } from 'next/server';
import { jsonErr, jsonOk, mapLadyProfile, resolveLadyPatientContext } from '@/app/api/lady-center/_lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).map((x) => x.trim()).filter(Boolean) : [];
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

export async function GET(req: NextRequest) {
  const ctx = await resolveLadyPatientContext(req);
  if (!ctx.ok) return jsonErr(ctx.error, ctx.status);

  const row = await ctx.prisma.ladyCenterProfile.findUnique({
    where: { patientId: ctx.patientId },
  });

  return jsonOk({ profile: mapLadyProfile(row) });
}

export async function PUT(req: NextRequest) {
  const ctx = await resolveLadyPatientContext(req);
  if (!ctx.ok) return jsonErr(ctx.error, ctx.status);

  const body = await req.json().catch(() => null);
  const profile = body?.profile;

  if (profile === null) {
    await ctx.prisma.ladyCenterProfile.deleteMany({
      where: { patientId: ctx.patientId },
    });
    return jsonOk({ profile: null });
  }

  if (!profile || typeof profile !== 'object') {
    return jsonErr('Missing profile payload.', 400, 'bad_profile');
  }

  const row = await ctx.prisma.ladyCenterProfile.upsert({
    where: { patientId: ctx.patientId },
    update: profileWriteData(profile, ctx.userId),
    create: {
      patientId: ctx.patientId,
      ...profileWriteData(profile, ctx.userId),
      createdAtISO: profile.createdAtISO ? new Date(profile.createdAtISO) : new Date(),
    },
  });

  return jsonOk({ profile: mapLadyProfile(row) });
}