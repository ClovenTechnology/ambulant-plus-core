// apps/patient-app/app/api/medreach/jobs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { medReachMockData } from '../../../../components/fallbackMocks';

export const dynamic = 'force-dynamic';

// In-memory store (demo only – not persisted across deployments/instances)
let JOBS = medReachMockData.map((j) => ({ ...j }));

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const status = url.searchParams.get('status');

  let jobs = JOBS.slice();

  if (id) {
    jobs = jobs.filter((j) => j.id === id);
  }
  if (status) {
    const s = status.toLowerCase();
    jobs = jobs.filter(
      (j: any) =>
        j.status && String(j.status).toLowerCase() === s,
    );
  }

  return NextResponse.json({ jobs });
}

// Small helper to let other routes mutate the in-memory list
export function updateJobStatus(id: string, status: string) {
  JOBS = JOBS.map((j) =>
    j.id === id ? { ...j, status } : j,
  );
}
