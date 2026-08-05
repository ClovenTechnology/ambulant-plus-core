// apps/clinician-app/app/api/clinicians/me/multi-care-policy/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  authErrorResponse,
  requireClinicianAuth,
} from '@/src/lib/clinician-auth';
import {
  createTrustedClinicianIdentityHeader,
} from '@/src/lib/clinician-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GW =
  process.env.API_GATEWAY_URL?.replace(/\/+$/, '') ||
  process.env.NEXT_PUBLIC_API_GATEWAY_URL?.replace(/\/+$/, '') ||
  process.env.APIGW_BASE?.replace(/\/+$/, '') ||
  process.env.NEXT_PUBLIC_GATEWAY_ORIGIN?.replace(/\/+$/, '') ||
  '';

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

function clinicianUid(auth: any) {
  return String(
    auth?.clinicianId ||
      auth?.clinician?.id ||
      auth?.clinician?.userId ||
      auth?.session?.email ||
      auth?.session?.sub ||
      '',
  ).trim();
}

async function proxy(req: NextRequest, method: 'GET' | 'PUT') {
  if (!GW) {
    return json({ ok: false, error: 'missing_gateway_origin' }, 500);
  }

  const auth = await requireClinicianAuth(req, {
    allowAdmin: false,
    allowAdminStaff: false,
  });

  if (!auth.ok) return authErrorResponse(auth);

  const uid = clinicianUid(auth);

  if (!uid) {
    return json(
      { ok: false, error: 'missing_clinician_identity' },
      401,
    );
  }

  const init: RequestInit = {
    method,
    cache: 'no-store',
    headers: {
      accept: 'application/json',
      'x-ambulant-identity':
        createTrustedClinicianIdentityHeader(req),
      'x-uid': uid,
      'x-clinician-id': auth.clinicianId,
      'x-role': auth.role,
    },
  };

  if (method === 'PUT') {
    (init.headers as Record<string, string>)['content-type'] =
      'application/json';
    init.body = JSON.stringify(
      await req.json().catch(() => ({})),
    );
  }

  const response = await fetch(
    `${GW}/api/clinicians/me/multi-care-policy`,
    init,
  );
  const body = await response.json().catch(() => ({}));

  return json(body, response.status);
}

export async function GET(req: NextRequest) {
  try {
    return await proxy(req, 'GET');
  } catch (error: any) {
    console.error(
      '[clinician-app] multi-care policy proxy failed',
      error,
    );

    return json(
      { ok: false, error: error?.message || 'gateway_failed' },
      500,
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    return await proxy(req, 'PUT');
  } catch (error: any) {
    console.error(
      '[clinician-app] multi-care policy save proxy failed',
      error,
    );

    return json(
      { ok: false, error: error?.message || 'gateway_failed' },
      500,
    );
  }
}
