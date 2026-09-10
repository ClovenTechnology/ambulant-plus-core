// apps/patient-app/app/api/triage/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function retired() {
  return NextResponse.json(
    {
      ok: false,
      error: 'legacy_triage_route_retired',
      message:
        'Patient self-check analysis is available only through the authenticated InsightCore pathway.',
    },
    {
      status: 410,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    },
  );
}

export async function GET() {
  return retired();
}

export async function POST() {
  return retired();
}
