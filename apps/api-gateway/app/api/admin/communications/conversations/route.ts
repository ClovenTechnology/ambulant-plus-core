import { NextRequest, NextResponse } from 'next/server';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
} from '@/src/lib/admin-staff-auth';
import {
  communicationsErrorResponse,
  createStaffConversation,
  listStaffConversations,
} from '@/src/lib/admin-communications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function respond(error: unknown) {
  const auth = adminStaffAuthResponse(error);
  if (auth) return NextResponse.json(auth.body, { status: auth.status });
  const comms = communicationsErrorResponse(error);
  if (comms) return NextResponse.json(comms.body, { status: comms.status });
  console.error('[admin communications] failed', error);
  return NextResponse.json({ ok: false, error: 'communications_failed' }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json(
      await listStaffConversations(await requireAdminStaffActor(request)),
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (error) {
    return respond(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAdminStaffActor(request);
    const body = await request.json().catch(() => ({}));
    return NextResponse.json(await createStaffConversation({ actor, body }), {
      status: 201,
      headers: { 'cache-control': 'no-store' },
    });
  } catch (error) {
    return respond(error);
  }
}
