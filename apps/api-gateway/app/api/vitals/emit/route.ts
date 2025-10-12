import { NextRequest, NextResponse } from 'next/server';
import { pushVital } from '@/src/lib/sseBus';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST,OPTIONS',
      'access-control-allow-headers': 'content-type'
    }
  });
}

export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const v = {
      roomId: String(b.roomId || ''),
      type: String(b.type || ''),
      value: Number(b.value),
      unit: b.unit ? String(b.unit) : undefined,
      t: b.t ? String(b.t) : new Date().toISOString(),
    };
    if (!v.roomId || !v.type || Number.isNaN(v.value)) {
      return NextResponse.json({ error: 'bad_vital' }, { status: 400, headers: { 'access-control-allow-origin': '*' } });
    }
    pushVital(v);
    return NextResponse.json({ ok: true }, { headers: { 'access-control-allow-origin': '*' } });
  } catch (e:any) {
    return NextResponse.json({ error: 'bad_request', detail: e?.message }, { status: 400, headers: { 'access-control-allow-origin': '*' } });
  }
}
