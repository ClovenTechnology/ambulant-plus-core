// apps/clinician-app/app/api/lab/timeline/route.ts
import { NextRequest, NextResponse } from 'next/server';

type TL = Array<{ status: string; at: string }>;
const fallback = new Map<string, TL>();

function cors(res: NextResponse) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'content-type');
  return res;
}

export async function OPTIONS() {
  return cors(new NextResponse(null, { status: 204 }));
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id') || 'LAB-2001';

  // Try global shared map (if present)
  // @ts-ignore
  const globalAny = global as any;
  let timeline: TL | undefined = globalAny?.__LAB_TIMELINE__?.get?.(id);

  if (!timeline) {
    // fallback or synthesize realistic sample
    timeline = fallback.get(id);
    if (!timeline) {
      const now = Date.now();
      timeline = [
        { status: 'PHLEB_ASSIGNED', at: new Date(now - 70 * 60000).toISOString() },
        { status: 'TRAVELING', at: new Date(now - 55 * 60000).toISOString() },
        { status: 'ARRIVED', at: new Date(now - 40 * 60000).toISOString() },
        { status: 'SAMPLE_COLLECTED', at: new Date(now - 35 * 60000).toISOString() },
        { status: 'LAB_RECEIVED', at: new Date(now - 20 * 60000).toISOString() },
        { status: 'COMPLETE', at: new Date(now - 10 * 60000).toISOString() },
      ];
      fallback.set(id, timeline);
    }
  }

  return cors(NextResponse.json({ id, timeline }));
}
