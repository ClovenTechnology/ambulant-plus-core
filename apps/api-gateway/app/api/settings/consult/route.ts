import { NextRequest, NextResponse } from 'next/server';
import { getAdminPolicy, getClinicianConsult, setClinicianConsult } from '@/src/store/consult';

function who(h: Headers){ 
  return { uid: h.get('x-uid') || '', role: h.get('x-role') || '' }; 
}

export async function GET(req: NextRequest){
  const { uid, role } = who(req.headers);
  if (!uid || role !== 'clinician') return NextResponse.json({ error:'unauthorized' }, { status:401 });

  const [admin, clin] = await Promise.all([getAdminPolicy(), getClinicianConsult(uid)]);
  return NextResponse.json({
    admin,              // read-only constraints
    clinician: clin,    // raw clinician config
    effective: {
      standardMinutes: Math.max(clin.defaultStandardMin, admin.minStandardMinutes),
      followupMinutes: Math.max(clin.defaultFollowupMin, admin.minFollowupMinutes),
      bufferAfterMinutes: admin.bufferAfterMinutes,
      joinGracePatientMin: admin.joinGracePatientMin,
      joinGraceClinicianMin: admin.joinGraceClinicianMin,
      minAdvanceMinutes: clin.minAdvanceMinutes,
      maxAdvanceDays: clin.maxAdvanceDays,
    }
  });
}

export async function PUT(req: NextRequest){
  const { uid, role } = who(req.headers);
  if (!uid || role !== 'clinician') return NextResponse.json({ error:'unauthorized' }, { status:401 });

  const body = await req.json();
  const admin = await getAdminPolicy();
  await setClinicianConsult(uid, {
    defaultStandardMin: Number(body?.clinician?.defaultStandardMin ?? 45),
    defaultFollowupMin: Number(body?.clinician?.defaultFollowupMin ?? 20),
    minAdvanceMinutes: Number(body?.clinician?.minAdvanceMinutes ?? 30),
    maxAdvanceDays: Number(body?.clinician?.maxAdvanceDays ?? 30),
  }, admin);

  return NextResponse.json({ ok:true });
}
