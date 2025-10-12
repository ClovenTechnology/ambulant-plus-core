import { NextRequest, NextResponse } from 'next/server';
import { bus } from '../_bus';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.roomId || !body?.type || typeof body?.value !== 'number') {
    return NextResponse.json({ error: 'bad_payload' }, { status: 400 });
  }
  bus.emit('vitals', {
    roomId: body.roomId,
    data: { t: new Date().toISOString(), type: body.type, value: body.value, unit: body.unit },
  });
  return NextResponse.json({ ok: true });
}
