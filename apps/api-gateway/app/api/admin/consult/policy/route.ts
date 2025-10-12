import { NextRequest, NextResponse } from 'next/server';
import { getAdminPolicy, setAdminPolicy } from '@/src/store/consult';

function isAdmin(h: Headers){ return (h.get('x-role') || '') === 'admin'; }

export async function GET(req: NextRequest){
  if (!isAdmin(req.headers)) return NextResponse.json({ error:'unauthorized' }, { status:401 });
  const p = await getAdminPolicy();
  return NextResponse.json(p);
}

export async function PUT(req: NextRequest){
  if (!isAdmin(req.headers)) return NextResponse.json({ error:'unauthorized' }, { status:401 });
  const body = await req.json();
  await setAdminPolicy({
    minStandardMinutes: Number(body.minStandardMinutes ?? 30),
    minFollowupMinutes: Number(body.minFollowupMinutes ?? 15),
    bufferAfterMinutes: Number(body.bufferAfterMinutes ?? 5),
    joinGracePatientMin: Number(body.joinGracePatientMin ?? 5),
    joinGraceClinicianMin: Number(body.joinGraceClinicianMin ?? 5),
  });
  return NextResponse.json({ ok:true });
}
