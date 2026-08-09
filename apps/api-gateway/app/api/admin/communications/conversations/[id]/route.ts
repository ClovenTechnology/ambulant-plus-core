import { NextRequest, NextResponse } from 'next/server';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
} from '@/src/lib/admin-staff-auth';
import {
  communicationsErrorResponse,
  getStaffConversation,
  updateStaffConversation,
} from '@/src/lib/admin-communications';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function respond(error: unknown) {
  const auth = adminStaffAuthResponse(error);
  if (auth) return NextResponse.json(auth.body, { status: auth.status });
  const comms = communicationsErrorResponse(error);
  if (comms) return NextResponse.json(comms.body, { status: comms.status });
  console.error('[admin conversation] failed', error);
  return NextResponse.json({ ok: false, error: 'conversation_failed' }, { status: 500 });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const actor = await requireAdminStaffActor(request);
    return NextResponse.json(
      await getStaffConversation({
        actor,
        conversationId: params.id,
        before: request.nextUrl.searchParams.get('before'),
      }),
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (error) {
    return respond(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const actor = await requireAdminStaffActor(request);
    const body = await request.json().catch(() => ({}));
    return NextResponse.json(
      await updateStaffConversation({ actor, conversationId: params.id, body }),
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (error) {
    return respond(error);
  }
}
