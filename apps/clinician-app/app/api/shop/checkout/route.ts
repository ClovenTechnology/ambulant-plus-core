// apps/clinician-app/app/api/shop/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authErrorResponse, requireClinicianAuth } from '@/src/lib/clinician-auth';
import { createTrustedClinicianIdentityHeader } from '@/src/lib/clinician-session';
import { apigwBase } from '@/app/api/_apigw';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


export async function POST(req: NextRequest) {
  const auth = await requireClinicianAuth(req, { allowAdmin: true, allowAdminStaff: true });
  if (!auth.ok) return authErrorResponse(auth);
  const body = await req.json().catch(() => ({}));
  const uid = String(auth.clinicianId || auth.session.sub || '').trim();

  const payload = { ...body, channel: 'clinician' };

  const res = await fetch(`${apigwBase()}/api/shop/checkout`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-uid': uid,
      'x-ambulant-identity': createTrustedClinicianIdentityHeader(req),
    },
    body: JSON.stringify(payload),
  });

  const js = await res.json().catch(() => ({}));
  return NextResponse.json(js, { status: res.status });
}