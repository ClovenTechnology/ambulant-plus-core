// apps/clinician-app/app/api/practice/members/[memberId]/route.ts
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const CLIN = (
  process.env.NEXT_PUBLIC_CLINICIAN_BASE_URL ||
  process.env.CLINICIAN_SERVICE_ORIGIN ||
  'http://localhost:3010'
).replace(/\/$/, '');

function buildForwardHeaders(req: NextRequest, extra: HeadersInit = {}): HeadersInit {
  const h = new Headers(extra);
  const uid = req.headers.get('x-uid');
  const role = req.headers.get('x-role');
  if (uid) h.set('x-uid', uid);
  if (role) h.set('x-role', role);
  return h;
}

type Params = {
  params: { memberId: string };
};

/**
 * PATCH /api/practice/members/[memberId]
 *
 * Generic updater – e.g. role changes, status changes, notes.
 * Body is forwarded.
 * Proxies → CLIN /api/clinicians/me/practice-members/:memberId
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { memberId } = params;
  if (!memberId) {
    return NextResponse.json(
      { ok: false, error: 'Missing memberId in route params.' },
      { status: 400 },
    );
  }

  try {
    const body = await req.text();
    const upstream = await fetch(
      `${CLIN}/api/clinicians/me/practice-members/${encodeURIComponent(memberId)}`,
      {
        method: 'PATCH',
        headers: buildForwardHeaders(req, {
          'content-type': req.headers.get('content-type') || 'application/json',
        }),
        body,
      },
    );

    const text = await upstream.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // ignore
    }

    if (!upstream.ok || json?.ok === false) {
      const msg = json?.error || text || `Upstream HTTP ${upstream.status}`;
      return NextResponse.json(
        { ok: false, error: msg },
        { status: upstream.status || 502 },
      );
    }

    const member = json?.member ?? json?.data ?? json ?? null;

    return NextResponse.json(
      {
        ok: true,
        member,
      },
      { status: 200 },
    );
  } catch (err: any) {
    console.error('[practice/members/:id][PATCH] error:', err);
    return NextResponse.json(
      {
        ok: false,
        error:
          err?.message ||
          'Unable to update member. Check CLIN /api/clinicians/me/practice-members/:id (PATCH).',
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/practice/members/[memberId]
 *
 * Removes a member from the practice (or soft-deletes, depending on CLIN implementation).
 * Proxies → CLIN /api/clinicians/me/practice-members/:memberId
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const { memberId } = params;
  if (!memberId) {
    return NextResponse.json(
      { ok: false, error: 'Missing memberId in route params.' },
      { status: 400 },
    );
  }

  try {
    const upstream = await fetch(
      `${CLIN}/api/clinicians/me/practice-members/${encodeURIComponent(memberId)}`,
      {
        method: 'DELETE',
        headers: buildForwardHeaders(req),
      },
    );

    const text = await upstream.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // ignore
    }

    if (!upstream.ok || json?.ok === false) {
      const msg = json?.error || text || `Upstream HTTP ${upstream.status}`;
      return NextResponse.json(
        { ok: false, error: msg },
        { status: upstream.status || 502 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        deleted: true,
      },
      { status: 200 },
    );
  } catch (err: any) {
    console.error('[practice/members/:id][DELETE] error:', err);
    return NextResponse.json(
      {
        ok: false,
        error:
          err?.message ||
          'Unable to delete member. Check CLIN /api/clinicians/me/practice-members/:id (DELETE).',
      },
      { status: 500 },
    );
  }
}
