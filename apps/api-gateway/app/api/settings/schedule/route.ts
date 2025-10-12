import { NextRequest, NextResponse } from 'next/server';
import { getSchedule, setSchedule } from '@/src/store/schedule';

function who(h: Headers){ return { uid: h.get('x-uid') || '', role: h.get('x-role') || '' }; }

export async function GET(req: NextRequest){
  const { uid } = who(req.headers);
  if (!uid) return NextResponse.json({ error:'unauthorized' }, { status:401 });
  const val = await getSchedule(uid);
  return NextResponse.json(val);
}

export async function PUT(req: NextRequest){
  const { uid } = who(req.headers);
  if (!uid) return NextResponse.json({ error:'unauthorized' }, { status:401 });

  const body = await req.json();
  // minimal validation (trust UI)
  await setSchedule(uid, body);
  return NextResponse.json({ ok:true });
}
