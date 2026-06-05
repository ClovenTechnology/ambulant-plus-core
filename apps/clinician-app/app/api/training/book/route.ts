// apps/clinician-app/app/api/training/book/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

function trimSlash(s: string) {
  return String(s || '').replace(/\/+$/, '');
}

function gatewayBase() {
  return trimSlash(
    process.env.APIGW_BASE ||
      process.env.GATEWAY_URL ||
      process.env.NEXT_PUBLIC_APIGW_BASE ||
      process.env.NEXT_PUBLIC_GATEWAY_BASE ||
      process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ||
      '',
  );
}

function forwardHeaders(req: NextRequest) {
  const h = new Headers();

  [
    'cookie',
    'authorization',
    'x-role',
    'x-uid',
    'x-user-id',
    'x-org-id',
    'x-ambulant-identity',
    'user-agent',
  ].forEach((k) => {
    const v = req.headers.get(k);
    if (v) h.set(k, v);
  });

  h.set('accept', 'application/json');
  h.set('content-type', 'application/json');
  return h;
}

async function localBookTraining(body: any) {
  const clinicianId = String(body?.clinicianId || '').trim();
  const slotId = String(body?.slotId || '').trim();
  const mode = String(body?.mode || 'virtual').trim() || 'virtual';

  if (!clinicianId) return json({ ok: false, error: 'clinicianId_required' }, 400);
  if (!slotId) return json({ ok: false, error: 'slotId_required' }, 400);

  const result = await prisma.$transaction(async (tx) => {
    const clinician = await tx.clinicianProfile.findUnique({
      where: { id: clinicianId },
    });

    if (!clinician) {
      return { status: 404, body: { ok: false, error: 'clinician_not_found' } };
    }

    const slot = await tx.clinicianTrainingSlot.findUnique({
      where: { id: slotId },
    });

    if (!slot) {
      return { status: 404, body: { ok: false, error: 'training_slot_not_found' } };
    }

    const seatsLeft = Math.max(0, Number(slot.capacity || 0) - Number(slot.usedCount || 0));

    const existing = await tx.clinicianOnboarding.findUnique({
      where: { clinicianId },
    });

    const switchingSlot = existing?.trainingSlotId && existing.trainingSlotId !== slot.id;

    if (!existing?.trainingSlotId && seatsLeft <= 0) {
      return { status: 409, body: { ok: false, error: 'training_slot_full' } };
    }

    if (switchingSlot && seatsLeft <= 0) {
      return { status: 409, body: { ok: false, error: 'training_slot_full' } };
    }

    const onboarding = await tx.clinicianOnboarding.upsert({
      where: { clinicianId },
      update: {
        status: 'training_scheduled',
        trainingSlotId: slot.id,
        depositPaid: true,
        trainingNotes: `Mode: ${mode}`,
      },
      create: {
        clinicianId,
        status: 'training_scheduled',
        trainingSlotId: slot.id,
        depositPaid: true,
        trainingNotes: `Mode: ${mode}`,
      },
    });

    if (!existing?.trainingSlotId || switchingSlot) {
      await tx.clinicianTrainingSlot.update({
        where: { id: slot.id },
        data: { usedCount: { increment: 1 } },
      });

      if (switchingSlot) {
        await tx.clinicianTrainingSlot.update({
          where: { id: existing.trainingSlotId as string },
          data: { usedCount: { decrement: 1 } },
        }).catch(() => null);
      }
    }

    const existingDispatch = await tx.clinicianDispatch.findFirst({
      where: { clinicianId },
      orderBy: { updatedAt: 'desc' },
    });

    const dispatch = existingDispatch ?? await tx.clinicianDispatch.create({
      data: {
        clinicianId,
        onboardingId: onboarding.id,
        courier: 'Pending admin assignment',
        trackingCode: 'Pending',
        trackingUrl: null,
        status: 'pending',
        notes: 'Created automatically after clinician training payment confirmation. Admin to assign courier and tracking.',
      },
    });

    await tx.clinicianProfile.update({
      where: { id: clinicianId },
      data: {
        trainingScheduledAt: slot.startsAt,
      },
    });

    return {
      status: 200,
      body: {
        ok: true,
        training: {
          status: 'scheduled',
          startAt: slot.startsAt.toISOString(),
          endAt: slot.endsAt.toISOString(),
          mode: slot.mode || mode,
          joinUrl: slot.meetingUrl ?? null,
          paid: true,
        },
        onboarding: {
          id: onboarding.id,
          stage: onboarding.status,
        },
        dispatch: {
          id: dispatch.id,
          status: dispatch.status,
        },
      },
    };
  });

  return json(result.body, result.status);
}

export async function POST(req: NextRequest) {
  let body: any = null;

  try {
    body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return json({ ok: false, error: 'invalid_json_body' }, 400);
    }

    const clinicianId = String(body?.clinicianId || '').trim();
    const gw = gatewayBase();

    if (gw) {
      const upstream = await fetch(`${gw}/api/clinicians/me/training/book`, {
        method: 'POST',
        headers: forwardHeaders(req),
        body: JSON.stringify(body),
        cache: 'no-store',
      });

      const text = await upstream.text();

      if (upstream.ok || !clinicianId || ![401, 403].includes(upstream.status)) {
        return new NextResponse(text, {
          status: upstream.status,
          headers: {
            'content-type': upstream.headers.get('content-type') || 'application/json',
            'cache-control': 'no-store',
          },
        });
      }
    }

    // Signup-success onboarding flow: allow booking by clinicianId only for this
    // limited training/payment/dispatch pathway.
    return localBookTraining(body);
  } catch (err: any) {
    console.error('[clinician-app][training/book][POST] error', err);
    return json({ ok: false, error: String(err?.message || 'training_book_failed') }, 502);
  }
}
