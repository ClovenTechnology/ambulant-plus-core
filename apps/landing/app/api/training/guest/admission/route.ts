import { NextRequest } from 'next/server';
import {
  jsonNoStore,
  trainingGuestGatewayFetch,
  trainingGuestSessionFromRequest,
} from '../_gateway';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
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
      '/api/training/guest/admission',
      {
        method: 'POST',
        body: {},
        sessionToken,
      },
    );

  return jsonNoStore(
    json,
    response.status,
  );
}
