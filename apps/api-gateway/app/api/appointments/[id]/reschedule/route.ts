// apps/api-gateway/app/api/appointments/[id]/reschedule/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

export const dynamic = 'force-dynamic';

const INACTIVE_STATUSES: string[] = ['canceled', 'cancelled', 'completed'];

function parseISO(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error('invalid_date');
  }
  return d;
}

function overlapWhere(start: Date, end: Date) {
  return {
    startsAt: { lt: end },
    endsAt: { gt: start },
    status: { notIn: INACTIVE_STATUSES },
  };
}

export async function PUT(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const id = ctx.params.id;
    const body = await req.json().catch(() => ({}));

    const start = parseISO(String(body.startsAt || ''));
    const end = parseISO(String(body.endsAt || ''));

    if (end <= start) {
      return NextResponse.json({ error: 'end_before_start' }, { status: 400 });
    }

    const out = await prisma.$transaction(async (tx) => {
      const appt = await tx.appointment.findUnique({
        where: { id },
      });

      if (!appt) {
        return { error: 'not_found' } as const;
      }

      // Patient overlap, excluding current appointment.
      const pClash = await tx.appointment.findFirst({
        where: {
          id: { not: id },
          patientId: appt.patientId,
          ...overlapWhere(start, end),
        },
        select: { id: true },
      });

      if (pClash) {
        return { conflict: { scope: 'patient', with: pClash } } as const;
      }

      // Clinician overlap, excluding current appointment.
      const cClash = await tx.appointment.findFirst({
        where: {
          id: { not: id },
          clinicianId: appt.clinicianId,
          ...overlapWhere(start, end),
        },
        select: { id: true },
      });

      if (cClash) {
        return { conflict: { scope: 'clinician', with: cClash } } as const;
      }

      const updated = await tx.appointment.update({
        where: { id },
        data: {
          startsAt: start,
          endsAt: end,
          status: 'pending',
        },
      });

      return { updated } as const;
    });

    if ('error' in out) {
      return NextResponse.json(out, { status: 404 });
    }

    if ('conflict' in out) {
      return NextResponse.json({ error: 'CONFLICT', ...out }, { status: 409 });
    }

    return NextResponse.json(out.updated);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'failed' },
      { status: 500 },
    );
  }
}