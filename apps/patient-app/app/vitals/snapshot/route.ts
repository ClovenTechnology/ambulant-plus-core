import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      error: 'synthetic_vitals_snapshot_disabled',
      message:
        'This legacy snapshot endpoint is disabled because patient-facing clinical values must come from authenticated persisted observations.',
    },
    { status: 410, headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}
