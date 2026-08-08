import { NextRequest } from 'next/server';
import {
  guestGatewayFetch,
  guestSessionCookieOptions,
  jsonNoStore,
  MEETING_GUEST_COOKIE,
} from '../_gateway';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { response, json } = await guestGatewayFetch(
    request,
    '/api/meetings/guest/verify',
    { method: 'POST', body },
  );

  if (!response.ok || !json?.ok || !json?.guestSessionToken) {
    return jsonNoStore(
      { ok: false, error: json?.error || 'invalid_or_expired_invitation' },
      response.status || 401,
    );
  }

  const result = jsonNoStore({
    ok: true,
    expiresAt: json.expiresAt,
    meeting: json.meeting,
    participant: json.participant,
  });

  result.cookies.set(
    MEETING_GUEST_COOKIE,
    String(json.guestSessionToken),
    guestSessionCookieOptions(json.expiresAt),
  );

  return result;
}
