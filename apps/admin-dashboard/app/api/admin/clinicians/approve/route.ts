// apps/admin-dashboard/app/api/admin/clinicians/approve/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { apigwBase } from '@/app/api/_apigw';
import { gatewayProxyHeaders } from '@/src/lib/gateway-proxy';

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

function redirectBack(
  req: NextRequest,
  fallbackPath = '/admin/clinicians',
) {
  const ref = req.headers.get('referer');
  const origin = new URL(req.url).origin;

  if (ref) {
    try {
      const u = new URL(ref);
      if (u.origin === origin) {
        return NextResponse.redirect(u);
      }
    } catch {}
  }

  return NextResponse.redirect(
    new URL(fallbackPath, req.url),
  );
}

export async function POST(req: NextRequest) {
  try {
    const id = await readId(req);

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          error: 'id required',
        },
        {
          status: 400,
        },
      );
    }

    const base = apigwBase();

    if (!base) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Missing API gateway base',
        },
        {
          status: 500,
        },
      );
    }

    const res = await fetch(
      `${base}/api/clinicians`,
      {
        method: 'PATCH',
        cache: 'no-store',
        headers: gatewayProxyHeaders(
          req,
          {
            'content-type':
              'application/json',
          },
        ),
        body: JSON.stringify({
          id,
          status: 'active',

          // IMPORTANT:
          // approval != training completion
        }),
      },
    );

    const text =
      await res.text().catch(() => '');

    if (!res.ok) {
      return new NextResponse(
        text || 'approve_failed',
        {
          status: res.status,
        },
      );
    }

    const ct =
      req.headers.get('content-type') || '';

    if (!ct.includes('application/json')) {
      return redirectBack(req);
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (err: any) {
    console.error(
      'admin/clinicians/approve error',
      err,
    );

    return NextResponse.json(
      {
        ok: false,
        error: String(err),
      },
      {
        status: 500,
      },
    );
  }
}