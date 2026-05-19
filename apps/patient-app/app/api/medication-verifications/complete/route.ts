import { NextRequest, NextResponse } from 'next/server';
import { apigwBase } from '@/app/api/_apigw';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function forwardMedicationVerificationPost(
  req: NextRequest,
  path: '/api/medication-verifications/start' | '/api/medication-verifications/complete',
) {
  try {
    const base = apigwBase();

    if (!base) {
      return NextResponse.json(
        { ok: false, error: 'Missing API gateway base (apigwBase())' },
        { status: 500 },
      );
    }

    const body = await req.json().catch(() => ({}));
    const uid = String(req.headers.get('x-uid') || '').trim();
    const upstream = new URL(`${base.replace(/\/$/, '')}${path}`);

    const res = await fetch(upstream.toString(), {
      method: 'POST',
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-role': 'patient',
        ...(uid ? { 'x-uid': uid } : {}),
      },
      body: JSON.stringify(body),
    });

    const text = await res.text().catch(() => '');
    const contentType = res.headers.get('content-type') || 'application/json';

    if (!text) {
      return NextResponse.json(
        {
          ok: res.ok,
          error: res.ok ? undefined : `Upstream returned empty body (HTTP ${res.status})`,
          status: res.status,
        },
        { status: res.status },
      );
    }

    try {
      const data = JSON.parse(text);

      if (data && typeof data === 'object') {
        data.ok ??= res.ok;
      }

      return NextResponse.json(data, { status: res.status });
    } catch {
      return new NextResponse(text, {
        status: res.status,
        headers: {
          'cache-control': 'no-store',
          'content-type': contentType,
        },
      });
    }
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || 'Medication verification proxy failed' },
      { status: 502 },
    );
  }
}

export async function POST(req: NextRequest) {
  return forwardMedicationVerificationPost(req, '/api/medication-verifications/complete');
}
