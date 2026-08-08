import { NextRequest, NextResponse } from 'next/server';
import {
  PublicFormError,
  publicFormClientKey,
  submissionBearerToken,
} from '@/src/lib/public-forms';

export function publicFormRequestClientKey(request: NextRequest) {
  return publicFormClientKey({
    forwardedFor: request.headers.get('x-forwarded-for'),
    realIp: request.headers.get('x-real-ip'),
    userAgent: request.headers.get('user-agent'),
  });
}

export function publicFormRequestToken(request: NextRequest) {
  return submissionBearerToken(request.headers.get('authorization'));
}

export function publicFormJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'cache-control': 'no-store, private',
      'x-content-type-options': 'nosniff',
    },
  });
}

export function publicFormErrorResponse(error: unknown) {
  if (error instanceof PublicFormError) {
    return publicFormJson(
      {
        ok: false,
        error: error.code,
        ...(error.detail !== undefined ? { issues: error.detail } : {}),
      },
      error.status,
    );
  }

  console.error('public_form_runtime_error', error);
  return publicFormJson({ ok: false, error: 'form_runtime_error' }, 500);
}

export async function publicFormJsonBody(request: NextRequest) {
  try {
    const body = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  } catch {
    throw new PublicFormError('invalid_json_body', 400);
  }
}
