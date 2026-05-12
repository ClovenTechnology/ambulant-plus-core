// apps/api-gateway/app/api/encounters/[id]/auto-close/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

export const dynamic = 'force-dynamic';

const OPEN_APPOINTMENT_STATUSES: string[] = ['scheduled', 'in_progress'];
const OPEN_ORDER_STATUSES: string[] = ['pending', 'in_progress'];

function orderDelegates() {
  return [
    (prisma as any).order,
    (prisma as any).medicationOrder,
    (prisma as any).labOrder,
    (prisma as any).erxOrder,
  ].filter(Boolean);
}

async function countOpenOrders(encounterId: string) {
  let total = 0;

  for (const delegate of orderDelegates()) {
    if (!delegate?.count) continue;

    try {
      const count = await delegate.count({
        where: {
          encounterId,
          status: { in: OPEN_ORDER_STATUSES },
        },
      });

      total += Number(count || 0);
    } catch {
      // Some order-like tables may not have encounterId/status in the same shape.
      // Ignore and continue to the next available delegate.
    }
  }

  return total;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const encId = params.id;
    const now = new Date();

    if (!encId) {
      return NextResponse.json(
        { ok: false, error: 'encounter_id_required' },
        { status: 400 },
      );
    }

    const futureAppts = await prisma.appointment.count({
      where: {
        encounterId: encId,
        startsAt: { gt: now },
        status: { in: OPEN_APPOINTMENT_STATUSES },
      },
    });

    const openOrders = await countOpenOrders(encId);

    if (futureAppts === 0 && openOrders === 0) {
      await prisma.encounter.update({
        where: { id: encId },
        data: { status: 'closed' },
      });
    }

    const encounter = await prisma.encounter.findUnique({
      where: { id: encId },
    });

    return NextResponse.json(encounter, {
      headers: { 'access-control-allow-origin': '*' },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: err?.message || 'auto_close_failed',
      },
      { status: 500 },
    );
  }
}