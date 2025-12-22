// apps/medreach/app/api/jobs/status/route.ts
import { NextRequest, NextResponse } from 'next/server';

// You can import the type if you want stricter typing:
// import type { PhlebJobStatus } from '@/app/api/phleb-jobs/route';

export async function PATCH(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const jobId = body?.jobId as string | undefined;
  const status = body?.status as string | undefined;

  if (!jobId || !status) {
    return NextResponse.json(
      { error: 'Missing jobId or status' },
      { status: 400 },
    );
  }

  // 🚧 TODO under Option A:
  // Forward this to your central MedReach backend / gateway:
  //
  // const res = await fetch(`${process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL}/jobs/status`, {
  //   method: 'PATCH',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ jobId, status }),
  // });
  // if (!res.ok) {
  //   return NextResponse.json({ error: 'Upstream error' }, { status: 502 });
  // }
  // const data = await res.json();
  // return NextResponse.json(data);

  // For now, just acknowledge success so the UI can function.
  return NextResponse.json({
    ok: true,
    jobId,
    status,
  });
}
