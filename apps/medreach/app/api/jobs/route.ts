import { NextRequest, NextResponse } from 'next/server';
import { JOBS } from './data';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const phlebId = url.searchParams.get('phlebId');
  const labId = url.searchParams.get('labId');

  let jobs = JOBS.slice();

  if (phlebId) {
    jobs = jobs.filter((j) => j.phlebId === phlebId);
  }
  if (labId) {
    jobs = jobs.filter((j) => j.labId === labId);
  }

  return NextResponse.json({ jobs });
}
