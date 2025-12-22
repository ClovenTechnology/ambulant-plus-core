// apps/clinician-app/app/api/practice/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const CLIN = (
  process.env.NEXT_PUBLIC_CLINICIAN_BASE_URL ||
  process.env.CLINICIAN_SERVICE_ORIGIN ||
  'http://localhost:3010'
).replace(/\/$/, '');

// Helper: forward x-uid / x-role if they exist
function buildForwardHeaders(req: NextRequest, extra: HeadersInit = {}): HeadersInit {
  const h = new Headers(extra);
  const uid = req.headers.get('x-uid');
  const role = req.headers.get('x-role');
  if (uid) h.set('x-uid', uid);
  if (role) h.set('x-role', role);
  return h;
}

/**
 * GET /api/practice
 *
 * Returns the clinician's current practice overview.
 * Proxies →  CLIN /api/clinicians/me/practice
 */
export async function GET(req: NextRequest) {
  try {
    const upstream = await fetch(`${CLIN}/api/clinicians/me/practice`, {
      cache: 'no-store',
      headers: buildForwardHeaders(req),
    });

    const text = await upstream.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // non-JSON or empty, keep as text
    }

    if (!upstream.ok) {
      const msg = json?.error || text || `Upstream HTTP ${upstream.status}`;
      return NextResponse.json(
        { ok: false, error: msg },
        { status: upstream.status || 502 },
      );
    }

    // Normalize to a predictable shape
    const practice = json?.practice ?? json?.data ?? json ?? null;

    return NextResponse.json(
      {
        ok: true,
        practice,
      },
      { status: 200 },
    );
  } catch (err: any) {
    console.error('[practice][GET] error:', err);
    return NextResponse.json(
      {
        ok: false,
        error:
          err?.message ||
          'Unable to load practice. Check that CLIN /api/clinicians/me/practice exists.',
      },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/practice
 *
 * Updates practice profile / settings.
 * Body is passed through as-is to CLIN.
 * Proxies →  CLIN /api/clinicians/me/practice
 */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.text();
    const upstream = await fetch(`${CLIN}/api/clinicians/me/practice`, {
      method: 'PATCH',
      headers: buildForwardHeaders(req, {
        'content-type': req.headers.get('content-type') || 'application/json',
      }),
      body,
    });

    const text = await upstream.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // ignore, we’ll wrap it below
    }

    if (!upstream.ok || json?.ok === false) {
      const msg = json?.error || text || `Upstream HTTP ${upstream.status}`;
      return NextResponse.json(
        { ok: false, error: msg },
        { status: upstream.status || 502 },
      );
    }

    const practice = json?.practice ?? json?.data ?? json ?? null;

    return NextResponse.json(
      {
        ok: true,
        practice,
      },
      { status: 200 },
    );
  } catch (err: any) {
    console.error('[practice][PATCH] error:', err);
    return NextResponse.json(
      {
        ok: false,
        error:
          err?.message ||
          'Unable to update practice. Check CLIN /api/clinicians/me/practice (PATCH).',
      },
      { status: 500 },
    );
  }
}
