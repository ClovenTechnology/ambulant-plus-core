// apps/clinician-app/app/api/encounters/[id]/docs/list/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  authErrorResponse,
  requireClinicianAuth,
} from '@/src/lib/clinician-auth';
import { createTrustedClinicianIdentityHeader } from '@/src/lib/clinician-session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CANONICAL_API_GATEWAY = 'https://api-gateway.ambulantplus.co.za';

function clean(value: unknown, max = 4000) {
  return String(value ?? '').trim().slice(0, max);
}

function gatewayBase() {
  const raw =
    process.env.APIGW_BASE ||
    process.env.APIGW_BASE_URL ||
    process.env.GATEWAY_URL ||
    process.env.API_GATEWAY_BASE_URL ||
    process.env.API_GATEWAY_URL ||
    CANONICAL_API_GATEWAY;

  return clean(raw, 1000).replace(/\/+$/, '');
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireClinicianAuth(req, {
    allowAdmin: false,
    allowAdminStaff: false,
  });

  if (!auth.ok) {
    return authErrorResponse(auth);
  }

  if (auth.role !== 'clinician') {
    return NextResponse.json(
      { ok: false, error: 'clinician_required' },
      { status: 403 },
    );
  }

  const encounterId = clean(params.id, 120);

  if (!encounterId) {
    return NextResponse.json(
      { ok: false, error: 'encounter_id_required' },
      { status: 400 },
    );
  }

  let trustedIdentity: string;

  try {
    trustedIdentity = createTrustedClinicianIdentityHeader(req);
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: clean(error?.message, 240) || 'identity_bridge_failed',
      },
      {
        status: Number(error?.status || 500),
        headers: { 'cache-control': 'no-store' },
      },
    );
  }

  const target = new URL(
    `/api/encounters/${encodeURIComponent(encounterId)}/docs`,
    gatewayBase(),
  );

  const requestUrl = new URL(req.url);

  for (const name of ['patientId', 'docType']) {
    const value = clean(requestUrl.searchParams.get(name), 240);
    if (value) {
      target.searchParams.set(name, value);
    }
  }

  try {
    const upstream = await fetch(target, {
      method: 'GET',
      headers: {
        accept: 'application/json',
        'x-ambulant-identity': trustedIdentity,
      },
      cache: 'no-store',
    });

    const text = await upstream.text();

    return new NextResponse(text, {
      status: upstream.status,
      headers: {
        'content-type':
          upstream.headers.get('content-type') || 'application/json',
        'cache-control': 'no-store',
      },
    });
  } catch (error: any) {
    console.error('[encounters/docs/list] gateway request failed', error);

    return NextResponse.json(
      {
        ok: false,
        error: 'encounter_documents_gateway_failed',
        message: clean(error?.message, 300),
      },
      { status: 502 },
    );
  }
}
