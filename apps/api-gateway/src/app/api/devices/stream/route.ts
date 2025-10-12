import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const u = new URL(req.url);
  const deviceId = u.searchParams.get('deviceId') || 'unknown';
  // TODO: start a session; for now return a pretend console URL
  return NextResponse.json({
    ok: true,
    deviceId,
    sessionUrl: `/iomt/console?deviceId=${encodeURIComponent(deviceId)}`
  }, { headers: { 'access-control-allow-origin': '*' } });
}
