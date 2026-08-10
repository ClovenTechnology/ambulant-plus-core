import { NextRequest, NextResponse } from 'next/server';
import { adminStaffAuthResponse, requireAdminStaffActor } from '@/src/lib/admin-staff-auth';
import { communicationsErrorResponse, staffCommunicationsSummary } from '@/src/lib/admin-communications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAdminStaffActor(request);
    return NextResponse.json(await staffCommunicationsSummary(actor), {
      headers: { 'cache-control': 'no-store' },
    });
  } catch (error) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return NextResponse.json(auth.body, { status: auth.status });
    const comms = communicationsErrorResponse(error);
    if (comms) return NextResponse.json(comms.body, { status: comms.status });
    console.error('[admin communications] summary failed', error);
    return NextResponse.json({ ok: false, error: 'communications_summary_failed' }, { status: 500 });
  }
}
