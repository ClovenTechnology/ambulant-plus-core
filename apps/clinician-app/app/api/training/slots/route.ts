// apps/clinician-app/app/api/training/slots/route.ts
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
  return h;
}

async function localTrainingSlots() {
  const now = new Date();

  const slots = await prisma.clinicianTrainingSlot.findMany({
    where: {
      startsAt: { gte: now },
    },
    orderBy: { startsAt: 'asc' },
    take: 50,
  });

  return json({
    ok: true,
    slots: slots
      .filter((slot) => Math.max(0, Number(slot.capacity || 0) - Number(slot.usedCount || 0)) > 0)
      .map((slot) => ({
        id: slot.id,
        startAt: slot.startsAt.toISOString(),
        endAt: slot.endsAt.toISOString(),
        seatsLeft: Math.max(0, Number(slot.capacity || 0) - Number(slot.usedCount || 0)),
        mode: slot.mode ?? 'virtual',
      })),
  });
}

export async function GET(req: NextRequest) {
  const incoming = new URL(req.url);
  const clinicianId = String(incoming.searchParams.get('clinicianId') || '').trim();

  try {
    const gw = gatewayBase();

    if (gw) {
      const gwUrl = new URL(`${gw}/api/clinicians/me/training/slots`);

      for (const [k, v] of incoming.searchParams.entries()) {
        gwUrl.searchParams.set(k, v);
      }

      const upstream = await fetch(gwUrl.toString(), {
        method: 'GET',
        headers: forwardHeaders(req),
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

    if (!clinicianId) {
      return json({ ok: false, error: 'clinicianId_required' }, 400);
    }

    // Signup-success onboarding flow: limited public-by-clinicianId slot lookup.
    return localTrainingSlots();
  } catch (err: any) {
    console.error('[clinician-app][training/slots][GET] error', err);
    return json({ ok: false, error: String(err?.message || 'training_slots_failed') }, 502);
  }
}
