// apps/clinician-app/app/api/schedule/slots/batch/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const GATEWAY =
  process.env.GATEWAY_URL ||
  process.env.APIGW_BASE ||
  process.env.NEXT_PUBLIC_APIGW_BASE ||
  '';

type Slot = { start: string; end: string; booked?: boolean; patientId?: string };
type DaySlots = { start: string; end?: string; label?: string }[];
type BatchResp = { slots: Record<string, DaySlots> };

function groupIntoBatch(slots: Slot[]): BatchResp {
  const out: Record<string, DaySlots> = {};

  for (const s of slots) {
    if (!s.start) continue;
    const dt = new Date(s.start);
    if (!Number.isFinite(dt.getTime())) continue;

    const key = dt.toISOString().slice(0, 10); // YYYY-MM-DD
    if (!out[key]) out[key] = [];

    // Only include free slots in availability view by default
    if (s.booked) continue;

    out[key].push({
      start: s.start,
      end: s.end,
      label: s.booked ? 'Booked' : 'Available',
    });
  }

  return { slots: out };
}

function generateMockSlots(startStr: string, days: number): BatchResp {
  const base = new Date(startStr);
  if (!Number.isFinite(base.getTime())) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    base.setTime(today.getTime());
  }

  const all: Slot[] = [];
  const SLOT_MIN = 9; // 09:00
  const SLOT_MAX = 17; // 17:00
  const DURATION_MIN = 30;

  for (let d = 0; d < days; d++) {
    for (let h = SLOT_MIN; h < SLOT_MAX; h++) {
      for (let m = 0; m < 60; m += DURATION_MIN) {
        const start = new Date(base);
        start.setDate(base.getDate() + d);
        start.setHours(h, m, 0, 0);
        const end = new Date(start);
        end.setMinutes(end.getMinutes() + DURATION_MIN);

        all.push({
          start: start.toISOString(),
          end: end.toISOString(),
          booked: false,
        });
      }
    }
  }

  return groupIntoBatch(all);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const clinicianId = url.searchParams.get('clinicianId') || 'clin-demo';
  const startStr =
    url.searchParams.get('start') || new Date().toISOString().slice(0, 10);
  const days = Number(url.searchParams.get('days') || '14') || 14;

  if (GATEWAY) {
    try {
      const r = await fetch(
        `${GATEWAY}/api/clinicians/${encodeURIComponent(
          clinicianId,
        )}/slots`,
        { cache: 'no-store' },
      );
      if (r.ok) {
        const slots = (await r.json().catch(() => [])) as Slot[];
        return NextResponse.json(groupIntoBatch(slots));
      }
      console.warn('[slots/batch] gateway returned non-OK status', r.status);
    } catch (e) {
      console.warn('[slots/batch] gateway error, using mock slots', e);
    }
  }

  const mock = generateMockSlots(startStr, days);
  return NextResponse.json(mock);
}
