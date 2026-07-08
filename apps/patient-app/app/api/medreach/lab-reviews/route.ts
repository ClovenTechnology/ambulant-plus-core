// apps/patient-app/app/api/medreach/lab-reviews/route.ts
import { NextRequest } from 'next/server';

import {
  apigwUrl,
  forwardHeaders,
  jsonError,
  relayJsonResponse,
} from '@/app/api/_apigw';
import {
  applyPatientSessionHeaders,
  resolvePatientAppSession,
} from '@/app/api/_session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clean(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function patientHeaders(req: NextRequest, contentType: string | null = 'application/json') {
  const session = resolvePatientAppSession();
  const headers = forwardHeaders(req, undefined, contentType);

  applyPatientSessionHeaders(headers, session);

  if (!headers.get('x-role')) headers.set('x-role', 'patient');
  if (!headers.get('x-ambulant-role')) headers.set('x-ambulant-role', 'patient');

  return { headers, session };
}

export async function GET(req: NextRequest) {
  try {
    const { headers, session } = patientHeaders(req, null);

    if (!session?.userId && !headers.get('x-uid') && !headers.get('x-user-id')) {
      return jsonError('patient_session_required', 401);
    }

    const upstream = await fetch(apigwUrl('/api/medreach/lab-reviews', req), {
      method: 'GET',
      cache: 'no-store',
      headers,
    });

    return relayJsonResponse(upstream);
  } catch (error: any) {
    return jsonError(error?.message || 'medreach_review_proxy_failed', 502);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { headers, session } = patientHeaders(req, 'application/json');

    if (!session?.userId && !headers.get('x-uid') && !headers.get('x-user-id')) {
      return jsonError('patient_session_required', 401);
    }

    let body: Record<string, unknown>;

    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return jsonError('invalid_json', 400);
    }

    const orderId = clean(body.orderId, 128);
    const stars = Number(body.stars);

    if (!orderId) {
      return jsonError('missing_orderId', 400);
    }

    if (!Number.isFinite(stars) || stars < 1 || stars > 5) {
      return jsonError('invalid_stars', 400);
    }

    const upstream = await fetch(apigwUrl('/api/medreach/lab-reviews', req), {
      method: 'POST',
      cache: 'no-store',
      headers,
      body: JSON.stringify({
        orderId,
        stars: Math.trunc(stars),
        comment: clean(body.comment, 1200) || undefined,
      }),
    });

    return relayJsonResponse(upstream);
  } catch (error: any) {
    return jsonError(error?.message || 'medreach_review_proxy_failed', 502);
  }
}