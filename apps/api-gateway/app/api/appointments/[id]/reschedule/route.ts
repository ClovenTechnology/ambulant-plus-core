// apps/app-gateway/app/api/appointments/[id]/reschedule/route.ts
// apps/api-gateway/app/api/appointments/[id]/reschedule/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

const ACTIVE = { notIn: ['canceled', 'cancelled', 'completed'] } as const;
function parseISO(s: string) { const d = new Date(s); if (Number.isNaN(d.getTime())) throw new Error('invalid_date'); return d; }
function overlapWhere(start: Date, end: Date) { return { startsAt: { lt: end }, endsAt: { gt: start }, status: ACTIVE }; }

export async function PUT(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const id = ctx.params.id;
    const b = await req.json();
    const start = parseISO(b.startsAt);
    const end = parseISO(b.endsAt);
    if (end <= start) return NextResponse.json({ error: 'end_before_start' }, { status: 400 });

    const out = await prisma.$transaction(async (tx) => {
      const appt = await tx.appointment.findUnique({ where: { id } });
      if (!appt) return { error: 'not_found' } as const;

      // Patient overlap (excluding current)
      const pClash = await tx.appointment.findFirst({
        where: { id: { not: id }, patientId: appt.patientId, ...overlapWhere(start, end) },
        select: { id: true },
      });
      if (pClash) return { conflict: { scope: 'patient', with: pClash } } as const;

      // Clinician overlap (excluding current)
      const cClash = await tx.appointment.findFirst({
        where: { id: { not: id }, clinicianId: appt.clinicianId, ...overlapWhere(start, end) },
        select: { id: true },
      });
      if (cClash) return { conflict: { scope: 'clinician', with: cClash } } as const;

      const updated = await tx.appointment.update({
        where: { id }, data: { startsAt: start, endsAt: end, status: 'pending' },
      });
      return { updated } as const;
    });

    if ('error' in out) return NextResponse.json(out, { status: 404 });
    if ('conflict' in out) return NextResponse.json({ error: 'CONFLICT', ...out }, { status: 409 });
    return NextResponse.json(out.updated);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'failed' }, { status: 500 });
  }
}
export const dynamic = 'force-dynamic';
