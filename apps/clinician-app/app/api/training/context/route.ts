//apps/clinician-app/app/api/training/context/route.ts
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

function safeParse(s?: string | null) {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function envInt(name: string, fallback: number) {
  const v = process.env[name];
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function paymentProvider(): 'mock' | 'stripe' | 'paystack' | 'ozow' | 'unknown' {
  const v = (process.env.TRAINING_PAYMENT_PROVIDER || '').toLowerCase();
  if (v === 'stripe' || v === 'paystack' || v === 'ozow' || v === 'mock') return v;
  return 'mock'; // safest dev default
}

export async function GET(req: NextRequest) {
  try {
    const clinicianId = req.nextUrl.searchParams.get('clinicianId') || '';
    if (!clinicianId) return json({ ok: false, error: 'clinicianId_required' }, 400);

    // Load clinicianProfile
    const clinician = await prisma.clinicianProfile
      .findFirst({
        where: { OR: [{ id: clinicianId }, { userId: clinicianId }] },
        include: { metadata: true },
      })
      .catch(() => null);

    if (!clinician) {
      return json({ ok: false, error: 'clinician_not_found' }, 404);
    }

    // Attempt to load "real" onboarding/training/dispatch models if they exist.
    // (We use prisma as any so this compiles even if those models aren’t in your schema yet.)
    const db: any = prisma;

    const onboarding =
      (await db.clinicianOnboarding
        ?.findFirst?.({ where: { clinicianId: clinician.id } })
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

    // Fallback from metadata.rawProfileJson (works even without extra tables)
    const raw = safeParse((clinician as any)?.metadata?.rawProfileJson) || {};
    const metaTraining = raw?.training || null;
    const metaOnboarding = raw?.onboarding || null;
    const metaDispatch = raw?.dispatch || null;

    const feeCents = envInt('TRAINING_FEE_CENTS', envInt('NEXT_PUBLIC_TRAINING_FEE_CENTS', 150000)); // default R1500
    const currency = process.env.TRAINING_CURRENCY || 'ZAR';

    const out = {
      ok: true,
      clinician: {
        id: clinician.id,
        name: (clinician as any).displayName ?? null,
        email: (raw?.email as string) || (clinician as any).userId || null,
        phone: (raw?.phone as string) || null,
        specialty: (clinician as any).specialty ?? null,
        status: (clinician as any).status ?? null,
      },
      onboarding: onboarding
        ? { id: onboarding.id, stage: onboarding.stage, notes: onboarding.notes ?? null }
        : metaOnboarding
        ? { stage: metaOnboarding.stage, notes: metaOnboarding.notes ?? null }
        : null,
      training: trainingSlot
        ? {
            id: trainingSlot.id,
            status: trainingSlot.status,
            startAt: trainingSlot.startAt ? new Date(trainingSlot.startAt).toISOString() : null,
            endAt: trainingSlot.endAt ? new Date(trainingSlot.endAt).toISOString() : null,
            mode: trainingSlot.mode,
            joinUrl: trainingSlot.joinUrl ?? null,
            paid: trainingSlot.paid ?? trainingSlot.paymentStatus === 'paid' ?? null,
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
            shippedAt: dispatch.shippedAt ? new Date(dispatch.shippedAt).toISOString() : null,
            deliveredAt: dispatch.deliveredAt ? new Date(dispatch.deliveredAt).toISOString() : null,
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
    return json({ ok: false, error: e?.message || 'server_error' }, 500);
  }
}
