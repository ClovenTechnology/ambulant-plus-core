import { NextRequest, NextResponse } from 'next/server';

// NOTE: Actual BLE pairing happens client-side via Web Bluetooth.
// This endpoint exists to acknowledge/persist pairing state (DB, KV, etc.)
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}));
  const deviceId = String(b?.deviceId || '');
  if (!deviceId) return NextResponse.json({ error: 'deviceId required' }, { status: 400 });
  // Persist pairing state here if you have storage; for demo we just echo ok.
  return NextResponse.json({ ok: true, deviceId, name: b?.name || null });
}
