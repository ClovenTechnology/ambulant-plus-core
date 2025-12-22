// apps/careport/app/api/jobs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { JOBS } from './data';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const riderId = url.searchParams.get('riderId');
  const pharmacyId = url.searchParams.get('pharmacyId');

  let jobs = JOBS.slice();

  if (riderId) {
    jobs = jobs.filter((j) => j.riderId === riderId);
  }
  if (pharmacyId) {
    jobs = jobs.filter((j) => j.pharmacyId === pharmacyId);
  }

  return NextResponse.json({ jobs });
}
