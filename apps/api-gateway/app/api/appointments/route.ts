// apps/api-gateway/app/api/appointments/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/appointments?patientId=... | clinicianId=...
export async function GET(req: NextRequest) {
  try {
    const u = new URL(req.url);
    const patientId = u.searchParams.get('patientId') || undefined;
    const clinicianId = u.searchParams.get('clinicianId') || undefined;

    const where: any = {};
    if (patientId) where.patientId = patientId;
    if (clinicianId) where.clinicianId = clinicianId;

    const items = await prisma.appointment.findMany({
      where,
      orderBy: { startsAt: 'desc' },
      take: 200,
    });

    return NextResponse.json({ ok: true, appointments: items }, { headers: { 'access-control-allow-origin': '*' } });
  } catch (e: any) {
    console.error('[appointments.list] error', e);
    return NextResponse.json({ ok: false, error: 'failed' }, { status: 500, headers: { 'access-control-allow-origin': '*' } });
  }
}
