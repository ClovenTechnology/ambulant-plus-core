import { NextRequest, NextResponse } from 'next/server';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
} from '@/src/lib/admin-staff-auth';
import {
  initiateApplicationStaffConversion,
  recruitmentErrorResponse,
} from '@/src/lib/admin-recruitment';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const actor = await requireAdminStaffActor(request);
    const body = await request.json().catch(() => ({}));
    return NextResponse.json(
      await initiateApplicationStaffConversion({ actor, applicationId: params.id, body }),
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return NextResponse.json(auth.body, { status: auth.status });
    const recruitment = recruitmentErrorResponse(error);
    if (recruitment) return NextResponse.json(recruitment.body, { status: recruitment.status });
    console.error('[application staff conversion] POST failed', error);
    return NextResponse.json({ ok: false, error: 'application_staff_conversion_failed' }, { status: 500 });
  }
}
