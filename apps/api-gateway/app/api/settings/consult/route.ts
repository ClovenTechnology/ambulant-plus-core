// apps/api-gateway/app/api/settings/consult/admin/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/src/auth'; // implement this
import { saveAdminConsultSettings } from '@/src/store/consult'; // implement persistence layer

export async function PUT(req: NextRequest) {
  try {
    // Example: require an admin session/token - implement requireAdmin appropriately
    const adminUser = await requireAdmin(req);
    if (!adminUser) return NextResponse.json({ message: 'unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    // Validate numeric ranges
    const admin = {
      bufferAfterMinutes: Math.max(0, Number(body.admin?.bufferAfterMinutes ?? 0)),
      joinGracePatientMin: Math.max(0, Number(body.admin?.joinGracePatientMin ?? 0)),
      joinGraceClinicianMin: Math.max(0, Number(body.admin?.joinGraceClinicianMin ?? 0)),
      minStandardMinutes: Math.max(1, Number(body.admin?.minStandardMinutes ?? 15)),
      minFollowupMinutes: Math.max(1, Number(body.admin?.minFollowupMinutes ?? 5)),
    };

    // Persist — implement saveAdminConsultSettings to write to DB
    await saveAdminConsultSettings(admin);

    return NextResponse.json({ admin }, { status: 200 });
  } catch (err: any) {
    console.error('admin save error', err);
    return NextResponse.json({ message: 'server_error', error: String(err?.message || err) }, { status: 500 });
  }
}
