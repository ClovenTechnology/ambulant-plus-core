import { NextRequest } from 'next/server';
import {
  jsonNoStore,
  TRAINING_GUEST_COOKIE,
  trainingGuestGatewayFetch,
  trainingGuestSessionFromRequest,
} from '../_gateway';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const sessionToken =
    trainingGuestSessionFromRequest(request);

  if (!sessionToken) {
    return jsonNoStore(
      {
        ok: false,
        error: 'training_guest_session_required',
      },
      401,
    );
  }

  const { response, json } =
    await trainingGuestGatewayFetch(
      request,
      '/api/training/guest/status',
      { sessionToken },
    );

  const result = jsonNoStore(
    json,
    response.status,
  );

  if (response.status === 401) {
    result.cookies.set(
      TRAINING_GUEST_COOKIE,
      '',
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV ===
          'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0,
      },
    );
  }

  return result;
}
