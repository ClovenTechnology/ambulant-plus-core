// apps/patient-app/app/api/notify/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest) {
  return NextResponse.json(
    {
      ok: false,
      error: 'patient_notification_service_not_configured',
      message: 'Patient notification delivery is not configured for this environment.',
    },
    {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
