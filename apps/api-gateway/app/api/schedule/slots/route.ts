// apps/api-gateway/app/api/schedule/slots/batch/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { addDays, startOfDay } from '@/src/time';
import { getEffectiveConsultConfig, generateSlotsForDate } from '@/src/consult/engine';

export const dynamic = 'force-dynamic';

type BatchParams = {
  start?: string;
  days?: number;
  clinicianId?: string;
};

async function parseParams(req: NextRequest): Promise<BatchParams> {
  if (req.method === 'GET') {
    const q = req.nextUrl.searchParams;
    return {
      start: q.get('start') ?? undefined,
      days: q.get('days') ? Number(q.get('days')) : undefined,
      clinicianId: q.get('clinicianId') ?? q.get('clinician_id') ?? undefined,
    };
  } else {
    // POST
    try {
      const body = await req.json().catch(() => ({}));
      return {
        start: body.start,
        days: typeof body.days === 'number' ? body.days : undefined,
        clinicianId: body.clinicianId || body.clinician_id,
      };
    } catch {
      return {};
    }
  }
}

export async function handleBatch(req: NextRequest) {
  const { start, days = 42, clinicianId } = await parseParams(req);

  if (!start || !clinicianId) {
    return NextResponse.json({ error: 'missing_start_or_clinicianId' }, { status: 400 });
  }

  const safeDays = Math.max(1, Math.min(62, Number(days || 42)));

  try {
    const startDay = startOfDay(new Date(start));
    const cfg = await getEffectiveConsultConfig(clinicianId); // should return effective admin+clinician config

    const out: Record<string, any[]> = {};
    for (let i = 0; i < safeDays; i++) {
      const d = addDays(startDay, i);
      const key = d.toISOString().slice(0, 10);
      const slotObjs = generateSlotsForDate(d, cfg).map((s) => ({
        start: s.start.toISOString(),
        end: s.end.toISOString(),
        label: s.label,
        // include status/metadata if generateSlots provides it
        ...(s.status ? { status: s.status } : {}),
      }));
      out[key] = slotObjs;
    }

    return NextResponse.json({ slots: out });
  } catch (err: any) {
    console.error('slots/batch error', err);
    return NextResponse.json({ error: 'server_error', message: String(err?.message || err) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handleBatch(req);
}

export async function POST(req: NextRequest) {
  return handleBatch(req);
}
