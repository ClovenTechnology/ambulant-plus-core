// apps/api-gateway/app/api/appointments/book/route.ts
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: 'legacy_booking_route_retired',
      message:
        'Use the authoritative /api/appointments preflight and creation flow.',
      replacement: '/api/appointments',
    },
    {
      status: 410,
      headers: {
        'Cache-Control': 'no-store',
        Deprecation: 'true',
        Link: '</api/appointments>; rel="successor-version"',
      },
    },
  );
}
