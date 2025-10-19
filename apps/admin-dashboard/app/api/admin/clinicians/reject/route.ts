// apps/admin-dashboard/app/api/admin/clinicians/reject/route.ts
import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const id = body?.id;
    if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });

    const patientBase = process.env.NEXT_PUBLIC_PATIENT_BASE ?? 'http://localhost:3000';
    const url = `${patientBase}/api/clinicians`;

    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'x-admin-key': process.env.ADMIN_API_KEY ?? '',
      },
      body: JSON.stringify({ id, status: 'rejected' }),
    });

    const data = await res.text();
    if (!res.ok) return new NextResponse(data, { status: res.status });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
