import { NextResponse } from 'next/server';
import {
  createTrustedClinicianIdentityHeader,
} from '@/src/lib/clinician-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function apigwBase(): string {
  const value = String(
    process.env.APIGW_BASE || '',
  ).trim();

  if (!value) {
    const error = new Error(
      'APIGW_BASE_required',
    ) as Error & { status?: number };
    error.status = 503;
    throw error;
  }

  return value.replace(/\/+$/, '');
}

export function jsonError(
  error: unknown,
  defaultError = 'request_failed',
  status = 500,
) {
  const message =
    error instanceof Error
      ? error.message
      : defaultError;

  const resolvedStatus =
    typeof (error as any)?.status === 'number'
      ? (error as any).status
      : status;

  return NextResponse.json(
    {
      ok: false,
      error: message,
    },
    {
      status: resolvedStatus,
      headers: {
        'cache-control': 'no-store',
      },
    },
  );
}

export async function relayJsonResponse(
  response: Response,
) {
  const text =
    await response.text().catch(() => '');
  let payload: unknown = {};

  if (text) {
    try {
      payload = JSON.parse(text);
    }
    catch {
      payload = {
        ok: false,
        error: text,
      };
    }
  }

  return NextResponse.json(payload, {
    status: response.status,
    headers: {
      'cache-control': 'no-store',
    },
  });
}

export function forwardClinicianHeaders(
  request: Request,
) {
  const incoming = request.headers;
  const headers = new Headers();

  for (const key of [
    'x-correlation-id',
    'x-request-id',
    'x-idempotency-key',
    'idempotency-key',
    'user-agent',
    'accept-language',
  ]) {
    const value = incoming.get(key);
    if (value) headers.set(key, value);
  }

  headers.set(
    'x-ambulant-identity',
    createTrustedClinicianIdentityHeader(request),
  );
  headers.set('accept', 'application/json');
  headers.set('content-type', 'application/json');

  return headers;
}
