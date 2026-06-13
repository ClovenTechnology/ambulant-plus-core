import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function allowedAdminKeys() {
  return [
    process.env.TRAINING_RECORDING_ADMIN_KEY,
    process.env.ADMIN_API_KEY,
    process.env.CLINICIAN_OPS_SEED_KEY,
    process.env.ORG_SEED_ADMIN_KEY,
  ]
    .map((v) => String(v || '').trim())
    .filter(Boolean);
}

function requireAdminKey(req: NextRequest) {
  const supplied =
    req.headers.get('x-admin-key') ||
    req.headers.get('x-seed-key') ||
    req.nextUrl.searchParams.get('key') ||
    '';

  const allowed = allowedAdminKeys();

  if (!allowed.length) {
    return { ok: false, status: 500, error: 'missing_admin_key_env' };
  }

  if (!allowed.includes(String(supplied).trim())) {
    return { ok: false, status: 403, error: 'forbidden_admin_key' };
  }

  return { ok: true, status: 200, error: null };
}

function clinicianTrainingBaseUrl() {
  return String(
    process.env.CLINICIAN_APP_URL ||
      process.env.NEXT_PUBLIC_CLINICIAN_APP_URL ||
      process.env.CLINICIAN_APP_ORIGIN ||
      'https://clinician.ambulantplus.co.za',
  ).replace(/\/+$/, '');
}

function trainingRoomIdForSlot(slotId: string) {
  const clean = String(slotId || '').trim();
  return clean.startsWith('training-slot-') ? clean : `training-slot-${clean}`;
}

function buildTrainingJoinUrl(slotId: string) {
  const roomId = trainingRoomIdForSlot(slotId);
  const url = new URL(`/training/room/${encodeURIComponent(roomId)}`, clinicianTrainingBaseUrl());
  url.searchParams.set('trainingSlotId', slotId);
  return url.toString();
}

export async function POST(req: NextRequest) {
  const access = requireAdminKey(req);

  if (!access.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: access.error,
      },
      { status: access.status },
    );
  }

  try {
    const db: any = prisma;

    const slots = await db.clinicianTrainingSlot.findMany({
      where: {
        mode: 'virtual',
        OR: [{ meetingUrl: null }, { meetingUrl: '' }],
      },
      select: {
        id: true,
        startsAt: true,
        endsAt: true,
        mode: true,
        meetingUrl: true,
      },
      orderBy: { startsAt: 'asc' },
    });

    const updatedSlots: Array<{ id: string; joinUrl: string }> = [];

    for (const slot of slots) {
      const joinUrl = buildTrainingJoinUrl(String(slot.id));

      await db.clinicianTrainingSlot.update({
        where: { id: slot.id },
        data: { meetingUrl: joinUrl },
      });

      updatedSlots.push({
        id: String(slot.id),
        joinUrl,
      });
    }

    const onboardingRowsLinked = updatedSlots.length
      ? await db.clinicianOnboarding.count({
          where: {
            trainingSlotId: {
              in: updatedSlots.map((x) => x.id),
            },
          },
        })
      : 0;

    return NextResponse.json(
      {
        ok: true,
        scanned: slots.length,
        updated: updatedSlots.length,
        onboardingRowsLinked,
        updatedSlots,
      },
      {
        headers: {
          'cache-control': 'no-store',
        },
      },
    );
  } catch (err: any) {
    console.error('[api-gateway][admin][training][backfill-join-urls] error', err);

    return NextResponse.json(
      {
        ok: false,
        error: err?.message || 'backfill_join_urls_failed',
      },
      { status: 500 },
    );
  }
}
