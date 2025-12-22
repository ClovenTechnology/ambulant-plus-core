// apps/careport/app/api/jobs/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { JOBS, CarePortStatus, appendTimeline } from '../data';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const job = JOBS.find((j) => j.id === params.id);
  if (!job) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ job });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = (await req.json().catch(() => ({}))) as {
    status?: CarePortStatus;
  };

  const job = JOBS.find((j) => j.id === params.id);
  if (!job) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (body.status) {
    job.status = body.status;

    // simple mapping to human-readable timeline event
    const msg = `Status updated: ${body.status}`;
    appendTimeline(job.id, { msg });
  }

  return NextResponse.json({ job });
}
