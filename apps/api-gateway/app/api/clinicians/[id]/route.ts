// apps/api-gateway/app/api/clinicians/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { computeClinicianOperationalState } from '@/src/lib/clinician-operational-state';
import { loadClinicianComplianceChecks } from '@/src/lib/credentialing/loadChecks';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_POLICY = {
  within24hPercent: 50,
  noShowPercent: 0,
  clinicianMissPercent: 100,
  networkProrate: true,
};

function cleanStr(v: unknown, max = 240): string | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

function safeParseJson(v: unknown): any {
  if (!v) return {};
  if (typeof v === 'object') return v;
  try {
    return JSON.parse(String(v));
  } catch {
    return {};
  }
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id;

    const clinician = await prisma.clinicianProfile.findFirst({
      where: { OR: [{ userId: id }, { id }] },
    });

    if (!clinician) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    }

    const rawProfile =
      safeParseJson((clinician as any)?.meta?.rawProfile) ||
      safeParseJson((clinician as any)?.meta?.rawProfileJson) ||
      safeParseJson((clinician as any)?.metadata?.rawProfile) ||
      safeParseJson((clinician as any)?.metadata?.rawProfileJson);

    const onboarding = await prisma.clinicianOnboarding.findFirst({
      where: { clinicianId: clinician.id },
      orderBy: { createdAt: 'desc' },
    });

    const trainingSlot =
      onboarding?.trainingSlotId
        ? await prisma.clinicianTrainingSlot.findUnique({
            where: { id: onboarding.trainingSlotId },
          })
        : null;

    const dispatch = await prisma.clinicianDispatch.findFirst({
      where: { clinicianId: clinician.id },
      orderBy: { createdAt: 'desc' },
    });

    const checks = await loadClinicianComplianceChecks({
      clinicianId: clinician.id,
      orgId: 'org-default',
    });

    const operational = computeClinicianOperationalState({
      clinician,
      onboarding,
      trainingSlot,
      dispatch,
      checks,
    });

    const feeCents = Number(
      (rawProfile?.consultationCents ??
        (clinician as any)?.feeCents ??
        (clinician as any)?.consultFeeCents ??
        0) || 0,
    );

    const ratingAvg = Number((clinician as any)?.ratingAvg ?? 0);
    const ratingCount = Number((clinician as any)?.ratingCount ?? 0);
    const ratingSum = Number((clinician as any)?.ratingSum ?? 0);

    const location =
      cleanStr(rawProfile?.location, 240) ||
      [(clinician as any)?.city, (clinician as any)?.province].filter(Boolean).join(', ') ||
      'Johannesburg';

    return NextResponse.json(
      {
        id: String((clinician as any)?.userId || clinician.id || id),
        name: (clinician as any)?.displayName || (clinician as any)?.fullName || id,
        cls:
          operational.patientCategory === 'wellness'
            ? 'Wellness'
            : ['gp', 'specialist', 'dentist'].includes(String(operational.professionKey || ''))
              ? 'Doctor'
              : 'Allied Health',
        specialty: (clinician as any)?.specialty || rawProfile?.specialty || 'General Practice',
        location,

        rating: Number.isFinite(ratingAvg) ? ratingAvg : 0,
        ratingAvg: Number.isFinite(ratingAvg) ? ratingAvg : 0,
        ratingCount: Number.isFinite(ratingCount) ? ratingCount : 0,
        ratingSum: Number.isFinite(ratingSum) ? ratingSum : 0,

        priceZAR: Math.max(0, Number.isFinite(feeCents) ? feeCents : 0) / 100,
        online: Boolean((clinician as any)?.online ?? (clinician as any)?.isOnline ?? false),

        email: (clinician as any)?.email ?? null,
        hpcsaRegNo:
          (clinician as any)?.regulatorRegistration ??
          operational.credentialing.regulatorRegistration ??
          null,
        photoUrl: (clinician as any)?.photoUrl ?? null,

        policy: DEFAULT_POLICY,

        operational,
      },
      {
        headers: {
          'cache-control': 'no-store',
          'access-control-allow-origin': '*',
        },
      },
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'failed' }, { status: 500 });
  }
}