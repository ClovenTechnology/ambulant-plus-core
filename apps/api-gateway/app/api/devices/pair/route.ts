import { NextRequest, NextResponse } from 'next/server';
import { pairUserDevice } from '@/src/lib/devices';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const uid = req.headers.get('x-uid') || 'pt-za-001';
  const b = await req.json().catch(()=>({}));
  try {
    const rec = await pairUserDevice(uid, b.deviceId, b.meta);
    return NextResponse.json({ ok: true, id: rec.id });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e.message || 'pair_failed' }, { status: 400 });
  }
}
