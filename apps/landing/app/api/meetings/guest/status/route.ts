import { NextRequest } from 'next/server';
import {
  guestGatewayFetch,
  guestSessionFromRequest,
  jsonNoStore,
  MEETING_GUEST_COOKIE,
} from '../_gateway';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const sessionToken = guestSessionFromRequest(request);
  if (!sessionToken) {
    return jsonNoStore({ ok: false, error: 'guest_session_required' }, 401);
  }

  const { response, json } = await guestGatewayFetch(
    request,
    '/api/meetings/guest/status',
    { sessionToken },
  );

  const result = jsonNoStore(json, response.status);
  if (response.status === 401) {
    result.cookies.set(MEETING_GUEST_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
  }

  return result;
}
