import { NextRequest } from 'next/server';
import {
  jsonNoStore,
  TRAINING_GUEST_COOKIE,
  trainingGuestCookieOptions,
  trainingGuestGatewayFetch,
} from '../_gateway';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { response, json } =
    await trainingGuestGatewayFetch(
      request,
      '/api/training/guest/verify',
      { method: 'POST', body },
    );

  if (
    !response.ok ||
    !json?.ok ||
    !json?.guestSessionToken
  ) {
    return jsonNoStore(
      {
        ok: false,
        error:
          json?.error ||
          'invalid_or_expired_training_invitation',
      },
      response.status || 401,
    );
  }

  const result = jsonNoStore({
    ok: true,
    expiresAt: json.expiresAt,
    participant: json.participant,
    training: json.training,
  });

  result.cookies.set(
    TRAINING_GUEST_COOKIE,
    String(json.guestSessionToken),
    trainingGuestCookieOptions(
      json.expiresAt,
    ),
  );

  return result;
}
