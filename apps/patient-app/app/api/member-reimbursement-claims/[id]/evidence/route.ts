import { NextRequest, NextResponse } from 'next/server';
import {
  applyPatientSessionHeaders,
  resolvePatientAppSession,
} from '../../../_session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function gatewayBase() {
  return (
    process.env.APIGW_BASE ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    'http://localhost:3010'
  ).replace(/\/+$/, '');
}

function forwardHeaders(req: NextRequest) {
  const headers = new Headers();

  [
    'authorization',
    'x-ambulant-identity',
    'x-ambulant-user-id',
    'x-ambulant-org-id',
    'x-ambulant-role',
    'x-uid',
    'x-user-id',
    'x-org-id',
    'x-role',
  ].forEach((key) => {
    const value = req.headers.get(key);
    if (value) headers.set(key, value);
  });

  const session = resolvePatientAppSession();
  applyPatientSessionHeaders(headers, session);

  if (!headers.get('x-role')) headers.set('x-role', 'patient');
  headers.set('accept', 'application/json');

  return headers;
}

export async function POST(
  req: NextRequest,
  ctx: { params: { id: string } },
) {
  const claimId = String(ctx.params.id || '').trim();

  if (!claimId) {
    return NextResponse.json(
      { ok: false, error: 'claim_id_required' },
      { status: 400 },
    );
  }

  try {
    const form = await req.formData();

    const res = await fetch(
      `${gatewayBase()}/api/member-reimbursement-claims/${encodeURIComponent(
        claimId,
      )}/evidence`,
      {
        method: 'POST',
        headers: forwardHeaders(req),
        body: form,
        cache: 'no-store',
      },
    );

    const text = await res.text();

    return new NextResponse(text, {
      status: res.status,
      headers: {
        'content-type': res.headers.get('content-type') || 'application/json',
        'cache-control': 'no-store',
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: e?.message || 'evidence_upload_proxy_failed',
      },
      { status: 502 },
    );
  }
}