// apps/patient-app/app/api/medreach/timeline/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const MOCK = [
  { status: 'PHLEB_ASSIGNED',   at: new Date(Date.now() - 70 * 60 * 1000).toISOString() },
  { status: 'TRAVELING',        at: new Date(Date.now() - 55 * 60 * 1000).toISOString() },
  { status: 'ARRIVED',          at: new Date(Date.now() - 40 * 60 * 1000).toISOString() },
  { status: 'SAMPLE_COLLECTED', at: new Date(Date.now() - 35 * 60 * 1000).toISOString() },
  { status: 'LAB_RECEIVED',     at: new Date(Date.now() - 20 * 60 * 1000).toISOString() },
  { status: 'COMPLETE',         at: new Date(Date.now() - 10 * 60 * 1000).toISOString() },
];

const CLIN_BASE =
  process.env.CLINICIAN_BASE_URL ||
  process.env.NEXT_PUBLIC_CLINICIAN_BASE_URL ||
  '';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const id = (url.searchParams.get('id') || 'LAB-2001').trim();

  // Try clinician backend first (BFF pattern)
  if (CLIN_BASE) {
    try {
      const res = await fetch(
        `${CLIN_BASE.replace(/\/$/, '')}/api/medreach/timeline?id=${encodeURIComponent(id)}`,
        {
          cache: 'no-store',
        },
      );

      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.timeline)) {
          const safeTimeline = json.timeline
            .filter((it: any) => it && typeof it.status === 'string' && typeof it.at === 'string')
            .sort((a: any, b: any) => new Date(a.at).getTime() - new Date(b.at).getTime());

          return NextResponse.json({ id, timeline: safeTimeline });
        }
      }
    } catch (err) {
      console.warn('MedReach timeline: remote fetch failed, using mock', err);
      // fall through to mock
    }
  }

  // Graceful mock fallback
  return NextResponse.json({ id, timeline: MOCK });
}
