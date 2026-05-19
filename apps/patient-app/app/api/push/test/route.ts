// apps/patient-app/app/api/push/test/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: 'push_test_not_configured',
      message:
        'Push testing is disabled until a durable push subscription store and notification provider are connected.',
    },
    { status: 503 },
  );
}
