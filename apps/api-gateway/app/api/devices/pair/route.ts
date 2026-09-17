import { NextRequest, NextResponse } from 'next/server';
import { pairUserDevice } from '@/src/lib/devices';
import { readIdentity, requireTrustedAuthenticatedIdentity } from '@/src/lib/identity';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const who = readIdentity(req.headers);
  try { requireTrustedAuthenticatedIdentity(who); }
  catch { return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 }); }
  const b = await req.json().catch(() => ({}));
  try {
    const rec = await pairUserDevice(who.uid!, b.deviceId, b.meta);
    return NextResponse.json({ ok: true, id: rec.id });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e.message || 'pair_failed' }, { status: 400 });
  }
}
