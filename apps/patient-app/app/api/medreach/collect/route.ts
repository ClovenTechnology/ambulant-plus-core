// apps/patient-app/app/api/medreach/collect/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { medReachMockData } from '../../../../components/fallbackMocks';

export const dynamic = 'force-dynamic';

// Basic mutable store seeded from mock (demo only)
let JOBS = medReachMockData.map((j) => ({ ...j }));

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const id = body?.id ? String(body.id) : null;
    if (!id) {
      return NextResponse.json(
        { error: 'Missing id in body' },
        { status: 400 },
      );
    }

    const idx = JOBS.findIndex((j) => j.id === id);
    if (idx === -1) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 },
      );
    }

    const updated = {
      ...JOBS[idx],
      status: 'Collected',
      eta: JOBS[idx].eta || 'Collected',
    };
    JOBS[idx] = updated;

    // In a real system you’d persist and maybe enqueue an event here

    return NextResponse.json({ job: updated });
  } catch (err: any) {
    console.error('MedReach collect error', err);
    return NextResponse.json(
      { error: 'Internal error', detail: String(err) },
      { status: 500 },
    );
  }
}
