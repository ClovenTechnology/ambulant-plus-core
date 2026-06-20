// apps/api-gateway/app/api/settings/refunds/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminPolicy, getClinicianRefunds, setClinicianRefunds } from '@/src/store/consult';

function who(h: Headers) {
  return {
    uid: h.get('x-uid') || h.get('x-clinician-id') || '',
    role: h.get('x-role') || '',
  };
}

export async function GET(req: NextRequest) {
  const { uid, role } = who(req.headers);
  if (!uid || role !== 'clinician') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const [admin, clin] = await Promise.all([
      getAdminPolicy(),
      getClinicianRefunds(uid),
    ]);

    // fallback safe defaults
    const effective = {
      within24hPercent: clin.within24hPercent ?? 50,
      noShowPercent: clin.noShowPercent ?? 0,
      clinicianMissPercent: clin.clinicianMissPercent ?? 100,
      networkProrate: clin.networkProrate ?? true,
    };

    return NextResponse.json({
      admin,           // admin consult policy (buffer, grace, minima for consults)
      clinician: clin, // raw clinician refund config
      effective,
    });
  } catch (e: any) {
    console.error('Refunds GET failed', e);
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const { uid, role } = who(req.headers);
  if (!uid || role !== 'clinician') {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const admin = await getAdminPolicy();
    const source = body?.clinician && typeof body.clinician === 'object' ? body.clinician : body;

    const saved = await setClinicianRefunds(
      uid,
      {
        within24hPercent: Number(source?.within24hPercent ?? 50),
        noShowPercent: Number(source?.noShowPercent ?? 0),
        clinicianMissPercent: Number(source?.clinicianMissPercent ?? 100),
        networkProrate: Boolean(source?.networkProrate),
      },
      admin,
    );
    return NextResponse.json({ ok: true, clinician: saved, effective: saved });
  } catch (e: any) {
    console.error('Refunds PUT failed', e);
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}
