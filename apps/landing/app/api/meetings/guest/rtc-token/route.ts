import { NextRequest } from 'next/server';
import {
  guestGatewayFetch,
  guestSessionFromRequest,
  jsonNoStore,
} from '../_gateway';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const sessionToken = guestSessionFromRequest(request);
  if (!sessionToken) {
    return jsonNoStore({ ok: false, error: 'guest_session_required' }, 401);
  }

  const { response, json } = await guestGatewayFetch(
    request,
    '/api/meetings/guest/rtc-token',
    { method: 'POST', body: {}, sessionToken },
  );

  return jsonNoStore(json, response.status);
}
