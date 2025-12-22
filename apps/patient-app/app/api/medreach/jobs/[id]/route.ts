// apps/patient-app/app/api/medreach/jobs/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { medReachMockData } from '../../../../../components/fallbackMocks';

export const dynamic = 'force-dynamic';

const CLIN_BASE =
  process.env.CLINICIAN_BASE_URL ||
  process.env.NEXT_PUBLIC_CLINICIAN_BASE_URL ||
  '';

export async function GET(req: NextRequest, context: { params: { id: string } }) {
  const id = context.params.id;

  // 1) Try clinician backend if configured
  if (CLIN_BASE) {
    try {
      const res = await fetch(
        `${CLIN_BASE.replace(/\/$/, '')}/api/medreach/jobs/${encodeURIComponent(
          id,
        )}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json();
        return NextResponse.json(json);
      }
    } catch (err) {
      console.warn('MedReach job detail: remote fetch failed, falling back', err);
      // fall through to mock
    }
  }

  // 2) Fallback to mock data
  const job = medReachMockData.find((j) => j.id === id);
  if (!job) {
    return NextResponse.json(
      { error: 'Job not found' },
      { status: 404 },
    );
  }

  return NextResponse.json({ job });
}
