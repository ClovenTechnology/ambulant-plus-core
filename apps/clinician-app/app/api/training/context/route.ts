// apps/clinician-app/app/api/training/context/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_STARTER_KIT = [
  'DueCare 6-in-1 Health Monitor (IoMT)',
  'NexRing (IoMT)',
  'Digital Stethoscope (IoMT)',
  'HD Otoscope (IoMT)',
  'Clinician Handbook',
  'Consumables pack',
  'Ambulant+ formal shirt (Black)',
  'Ambulant+ formal shirt (White)',
  'Ambulant+ Mug',
  'Ambulant+ Thermo Bottle',
  'Smart ID + card holder + lanyard',
];

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

function parseObject(value: unknown): Record<string, any> {
  if (!value) return {};

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, any>;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);

      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, any>)
        : {};
    } catch {
      return {};
    }
  }

  return {};
}

function getProfileJson(clinician: any): Record<string, any> {
  const meta = parseObject(clinician?.meta);

  if (meta.rawProfile && typeof meta.rawProfile === 'object') {
    return meta.rawProfile as Record<string, any>;
  }

  if (typeof meta.rawProfileJson === 'string') {
    return parseObject(meta.rawProfileJson);
  }

  return meta;
}

function envInt(name: string, fallback: number) {
  const v = process.env[name];
  const n = v ? Number(v) : NaN;

  return Number.isFinite(n) ? n : fallback;
}

function paymentProvider(): 'mock' | 'stripe' | 'paystack' | 'ozow' | 'unknown' {
  const v = (process.env.TRAINING_PAYMENT_PROVIDER || '').toLowerCase();

  if (v === 'stripe' || v === 'paystack' || v === 'ozow' || v === 'mock') {
    return v;
  }

  return 'mock';
}

export async function GET(req: NextRequest) {
  try {
    const clinicianId = req.nextUrl.searchParams.get('clinicianId') || '';

    if (!clinicianId) {
      return json({ ok: false, error: 'clinicianId_required' }, 400);
    }

    const clinician = await prisma.clinicianProfile
      .findFirst({
        where: {
          OR: [{ id: clinicianId }, { userId: clinicianId }],
        },
      })
      .catch(() => null);

    if (!clinician) {
      return json({ ok: false, error: 'clinician_not_found' }, 404);
    }

    const db: any = prisma;

    const onboarding =
      (await db.clinicianOnboarding
        ?.findFirst?.({
          where: { clinicianId: clinician.id },
        })
        .catch(() => null)) || null;

    const trainingSlot =
      (await db.clinicianTrainingSlot
        ?.findFirst?.({
          where: { clinicianId: clinician.id },
          orderBy: { startAt: 'desc' },
        })
        .catch(() => null)) || null;

    const dispatch =
      (await db.clinicianDispatch
        ?.findFirst?.({
          where: { clinicianId: clinician.id },
          orderBy: { createdAt: 'desc' },
        })
        .catch(() => null)) || null;

    const raw = getProfileJson(clinician);

    const metaTraining = raw.training || null;
    const metaOnboarding = raw.onboarding || null;
    const metaDispatch = raw.dispatch || null;

    const feeCents = envInt(
      'TRAINING_FEE_CENTS',
      envInt('NEXT_PUBLIC_TRAINING_FEE_CENTS', 150000),
    );

    const currency = process.env.TRAINING_CURRENCY || 'ZAR';

    const out = {
      ok: true,
      clinician: {
        id: clinician.id,
        name: (clinician as any).displayName ?? null,
        email: typeof raw.email === 'string' && raw.email.trim()
          ? raw.email.trim()
          : (clinician as any).userId || null,
        phone: typeof raw.phone === 'string' && raw.phone.trim()
          ? raw.phone.trim()
          : null,
        specialty: (clinician as any).specialty ?? null,
        status: (clinician as any).status ?? null,
      },
      onboarding: onboarding
        ? {
            id: onboarding.id,
            stage: onboarding.stage ?? onboarding.status ?? null,
            status: onboarding.status ?? onboarding.stage ?? null,
            notes: onboarding.notes ?? null,
          }
        : metaOnboarding
          ? {
              stage: metaOnboarding.stage ?? metaOnboarding.status ?? null,
              status: metaOnboarding.status ?? metaOnboarding.stage ?? null,
              notes: metaOnboarding.notes ?? null,
            }
          : null,
      training: trainingSlot
        ? {
            id: trainingSlot.id,
            status: trainingSlot.status,
            startAt: trainingSlot.startAt
              ? new Date(trainingSlot.startAt).toISOString()
              : null,
            endAt: trainingSlot.endAt
              ? new Date(trainingSlot.endAt).toISOString()
              : null,
            mode: trainingSlot.mode,
            joinUrl: trainingSlot.joinUrl ?? null,
            paid:
              typeof trainingSlot.paid === 'boolean'
                ? trainingSlot.paid
                : trainingSlot.paymentStatus === 'paid',
            currency: trainingSlot.currency ?? currency,
            feeCents: trainingSlot.feeCents ?? feeCents,
          }
        : metaTraining
          ? metaTraining
          : null,
      dispatch: dispatch
        ? {
            id: dispatch.id,
            status: dispatch.status,
            courierName: dispatch.courierName ?? null,
            trackingCode: dispatch.trackingCode ?? null,
            trackingUrl: dispatch.trackingUrl ?? null,
            shippedAt: dispatch.shippedAt
              ? new Date(dispatch.shippedAt).toISOString()
              : null,
            deliveredAt: dispatch.deliveredAt
              ? new Date(dispatch.deliveredAt).toISOString()
              : null,
          }
        : metaDispatch
          ? metaDispatch
          : null,
      pricing: {
        currency,
        trainingFeeCents: feeCents,
        paymentProvider: paymentProvider(),
      },
      starterKitItems: DEFAULT_STARTER_KIT,
    };

    return json(out);
  } catch (e: any) {
    console.error('GET /api/training/context error', e);

    return json(
      {
        ok: false,
        error: e?.message || 'server_error',
      },
      500,
    );
  }
}