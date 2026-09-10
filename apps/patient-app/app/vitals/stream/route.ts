import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      error: 'synthetic_vitals_stream_disabled',
      message:
        'This legacy synthetic stream is disabled. Live patient vitals must use the authenticated persisted-observation stream.',
    },
    { status: 410, headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}
