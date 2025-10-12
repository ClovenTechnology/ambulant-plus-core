// apps/api-gateway/app/api/encounters/[id]/auto-close/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const encId = params.id;
  const now = new Date();

  const futureAppts = await prisma.appointment.count({
    where: { encounterId: encId, startsAt: { gt: now }, status: { in: ['scheduled','in_progress'] } }
  });
  const openOrders = await prisma.order.count({
    where: { encounterId: encId, status: { in: ['pending','in_progress'] } }
  }).catch(()=>0); // if you modeled orders separately per type, adapt this

  if (futureAppts === 0 && openOrders === 0) {
    await prisma.encounter.update({ where: { id: encId }, data: { status: 'closed' } });
  }
  const e = await prisma.encounter.findUnique({ where: { id: encId } });
  return NextResponse.json(e, { headers: { 'access-control-allow-origin': '*' } });
}
