import { NextRequest, NextResponse } from 'next/server';
import { adminStaffAuthResponse, requireAdminStaffActor } from '@/src/lib/admin-staff-auth';
import { communicationsErrorResponse, respondToDirectStaffCall } from '@/src/lib/admin-communications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actor = await requireAdminStaffActor(request);
    const body = await request.json().catch(() => ({}));
    return NextResponse.json(await respondToDirectStaffCall({
      actor,
      meetingId: params.id,
      action: (body as any)?.action,
      userAgent: request.headers.get('user-agent'),
    }), { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return NextResponse.json(auth.body, { status: auth.status });
    const comms = communicationsErrorResponse(error);
    if (comms) return NextResponse.json(comms.body, { status: comms.status });
    console.error('[admin communications] direct call response failed', error);
    return NextResponse.json({ ok: false, error: 'direct_call_response_failed' }, { status: 500 });
  }
}
