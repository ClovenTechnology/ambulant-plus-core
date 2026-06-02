// apps/clinician-app/app/api/me/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  authErrorResponse,
  requireClinicianAuth,
} from '@/src/lib/clinician-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'cache-control': 'no-store, max-age=0' },
  });
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireClinicianAuth(req, {
      allowAdmin: true,
      allowAdminStaff: true,
    });

    if (!auth.ok) {
      return authErrorResponse(auth);
    }

    const clinician = auth.clinician as any;
    const status = String(clinician.status || 'pending').toLowerCase();
    const canPractice =
      auth.role === 'admin' ||
      auth.role === 'admin_staff' ||
      status === 'active';

    return json({
      ok: true,
      role: auth.role,
      clinicianId: auth.clinicianId,
      name: clinician.displayName ?? auth.session.name ?? 'Clinician',
      status,
      canPractice,
      visibleToPatients: status === 'active',
      clinician,
    });
  } catch (err: any) {
    console.error('/api/me error', err);

    return json(
      {
        ok: false,
        error: err?.message || 'Unable to resolve clinician profile.',
      },
      500,
    );
  }
}
