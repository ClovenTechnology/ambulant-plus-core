import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const u = new URL(req.url);
  const deviceId = u.searchParams.get('deviceId') || 'unknown';
  // TODO: hand off to real BLE pairing workflow per deviceId
  return NextResponse.json({ ok: true, deviceId, status: 'pairing_started' }, {
    headers: { 'access-control-allow-origin': '*' }
  });
}
