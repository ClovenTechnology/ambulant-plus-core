// apps/admin-dashboard/app/api/admin/clinicians/approve/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

async function readId(req: NextRequest) {
  const ct = req.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    const body = await req.json().catch(() => ({} as any));
    return body?.id ? String(body.id) : null;
  }
  const fd = await req.formData().catch(() => null);
  const id = fd?.get('id');
  return id ? String(id) : null;
}

function redirectBack(req: NextRequest, fallbackPath = '/admin/clinicians') {
  const ref = req.headers.get('referer');
  const origin = new URL(req.url).origin;
  if (ref) {
    try {
      const u = new URL(ref);
      if (u.origin === origin) return NextResponse.redirect(u);
    } catch {}
  }
  return NextResponse.redirect(new URL(fallbackPath, req.url));
}

export async function POST(req: NextRequest) {
  try {
    const id = await readId(req);
    if (!id) {
      return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });
    }

    const gatewayBase =
      process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ??
      process.env.APIGW_BASE ??
      process.env.NEXT_PUBLIC_GATEWAY_BASE ??
      process.env.GATEWAY_URL ??
      'http://localhost:3010';

    const url = `${gatewayBase}/api/clinicians`;

    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        'x-admin-key': process.env.ADMIN_API_KEY ?? '',
      },
      body: JSON.stringify({
        id,
        status: 'active',
        // IMPORTANT: approval != training completion
        // leave trainingCompleted alone (or explicitly false if you prefer)
      }),
    });

    const text = await res.text().catch(() => '');
    if (!res.ok) {
      return new NextResponse(text || 'approve_failed', { status: res.status });
    }

    // Form submit UX: redirect back
    const ct = req.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return redirectBack(req);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('admin/clinicians/approve error', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
