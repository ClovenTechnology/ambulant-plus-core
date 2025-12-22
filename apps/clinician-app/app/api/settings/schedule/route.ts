// apps/clinician-app/app/api/settings/schedule/route.ts
import { NextRequest, NextResponse } from 'next/server';

type WindowShape = { min: string; max: string; clinicianId?: string };

let _store: Record<string, WindowShape> = {}; // keyed by clinicianId; fallback default at _default

const _default: WindowShape = { min: '00:00', max: '23:00' };

export async function GET(req: NextRequest) {
  try {
    const u = new URL(req.url);
    const clinicianId = u.searchParams.get('clinicianId') || 'default';
    const v = _store[clinicianId] || _default;
    return NextResponse.json(v);
  } catch (e) {
    console.error('schedule GET error', e);
    return NextResponse.json({ error: 'Internal' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const clinicianId = body.clinicianId || 'default';
    const min = body.window?.min ?? body.min ?? body.minTime;
    const max = body.window?.max ?? body.max ?? body.maxTime;
    if (!min || !max) {
      return NextResponse.json({ error: 'Missing min/max' }, { status: 400 });
    }
    _store[clinicianId] = { clinicianId, min, max };
    return NextResponse.json(_store[clinicianId]);
  } catch (e) {
    console.error('schedule PUT error', e);
    return NextResponse.json({ error: 'Internal' }, { status: 500 });
  }
}
