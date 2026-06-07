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

function humanSlotsError(value: unknown) {
  const raw =
    typeof value === 'string'
      ? value
      : value && typeof value === 'object'
        ? String((value as any).error || (value as any).message || '')
        : '';

  if (raw === 'clinicianId_required') {
    return 'We could not identify your clinician profile. Please sign in again or use the training link from your signup email.';
  }

  if (raw.includes('DATABASE_URL') || raw.toLowerCase().includes('prisma')) {
    return 'Training slots are temporarily unavailable while the database connection is being restored. Please try again shortly.';
  }

  return raw && raw.length < 180
    ? raw.replace(/_/g, ' ')
    : 'Unable to load available training slots right now.';
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

function parseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const incoming = new URL(req.url);
  const clinicianId = String(incoming.searchParams.get('clinicianId') || '').trim();

  if (!clinicianId) {
    return json({ ok: false, error: 'clinicianId_required' }, 400);
  }

  try {
    const gw = gatewayBase();

    if (gw) {
      try {
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

        if (upstream.ok) {
          return new NextResponse(text, {
            status: upstream.status,
            headers: {
              'content-type': upstream.headers.get('content-type') || 'application/json',
              'cache-control': 'no-store',
            },
          });
        }

        // Launch-safe behaviour:
        // If gateway route is missing/misconfigured, do NOT show 404 to clinicians.
        // Fall back to clinician-app DB slots.
        console.warn('[clinician-app][training/slots] gateway failed; falling back locally', {
          status: upstream.status,
          error: humanSlotsError(parseJson(text) || text),
        });

        return localTrainingSlots();
      } catch (gatewayErr: any) {
        console.warn('[clinician-app][training/slots] gateway unreachable; falling back locally', gatewayErr);
        return localTrainingSlots();
      }
    }

    return localTrainingSlots();
  } catch (err: any) {
    console.error('[clinician-app][training/slots][GET] error', err);
    return json({ ok: false, error: humanSlotsError(err) }, 502);
  }
}
