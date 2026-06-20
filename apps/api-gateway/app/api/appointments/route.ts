// apps/api-gateway/app/api/appointments/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

export const dynamic = 'force-dynamic';

function isSimulationAppointment(item: any) {
  return [item?.id, item?.encounterId, item?.patientId]
    .filter(Boolean)
    .some((v) => String(v).startsWith('sim-'));
}

// GET /api/appointments?patientId=... | clinicianId=... | excludeSimulation=1
export async function GET(req: NextRequest) {
  try {
    const u = new URL(req.url);
    const patientId = u.searchParams.get('patientId') || undefined;
    const clinicianId = u.searchParams.get('clinicianId') || undefined;
    const excludeSimulation =
      u.searchParams.get('excludeSimulation') === '1' ||
      u.searchParams.get('production') === '1';

    const where: any = {};
    if (patientId) where.patientId = patientId;
    if (clinicianId) where.clinicianId = clinicianId;

    const rawItems = await prisma.appointment.findMany({
      where,
      orderBy: { startsAt: 'desc' },
      take: 200,
    });

    const items = excludeSimulation
      ? rawItems.filter((item) => !isSimulationAppointment(item))
      : rawItems;

    return NextResponse.json(
      {
        ok: true,
        appointments: items,
        items,
        total: items.length,
      },
      { headers: { 'access-control-allow-origin': '*' } },
    );
  } catch (e: any) {
    console.error('[appointments.list] error', e);

    return NextResponse.json(
      { ok: false, error: 'failed' },
      {
        status: 500,
        headers: { 'access-control-allow-origin': '*' },
      },
    );
  }
}
