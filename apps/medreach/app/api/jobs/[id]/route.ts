import { NextRequest, NextResponse } from 'next/server';
import { JOBS, MedReachStatus, appendTimeline } from '../data';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const job = JOBS.find((j) => j.id === params.id);
  if (!job) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ job });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = (await req.json().catch(() => ({}))) as {
    status?: MedReachStatus;
  };

  const job = JOBS.find((j) => j.id === params.id);
  if (!job) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (body.status) {
    job.status = body.status;
    appendTimeline(job.id, body.status.toUpperCase().replace(/\s+/g, '_'));
  }

  return NextResponse.json({ job });
}
