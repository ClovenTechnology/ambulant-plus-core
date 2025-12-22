// apps/clinician-app/app/api/practice/members/route.ts
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

/**
 * GET /api/practice/members
 *
 * Returns current practice members (clinicians + admin staff).
 * Proxies → CLIN /api/clinicians/me/practice-members
 */
export async function GET(req: NextRequest) {
  try {
    // Forward query params if any (e.g. ?role=admin, ?q=...)
    const url = new URL(req.url);
    const upstreamUrl = new URL(
      `${CLIN}/api/clinicians/me/practice-members`,
    );
    url.searchParams.forEach((v, k) => {
      upstreamUrl.searchParams.set(k, v);
    });

    const upstream = await fetch(upstreamUrl.toString(), {
      cache: 'no-store',
      headers: buildForwardHeaders(req),
    });

    const text = await upstream.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // ignore
    }

    if (!upstream.ok) {
      const msg = json?.error || text || `Upstream HTTP ${upstream.status}`;
      return NextResponse.json(
        { ok: false, error: msg },
        { status: upstream.status || 502 },
      );
    }

    const items = Array.isArray(json?.items)
      ? json.items
      : Array.isArray(json?.members)
      ? json.members
      : Array.isArray(json)
      ? json
      : [];

    return NextResponse.json(
      {
        ok: true,
        items,
      },
      { status: 200 },
    );
  } catch (err: any) {
    console.error('[practice/members][GET] error:', err);
    return NextResponse.json(
      {
        ok: false,
        error:
          err?.message ||
          'Unable to load practice members. Check CLIN /api/clinicians/me/practice-members.',
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/practice/members
 *
 * Creates / invites a new practice member.
 * Body is passed through untouched.
 * Proxies → CLIN /api/clinicians/me/practice-members
 *
 * Example payload your pages can send:
 * {
 *   "email": "admin@example.com",
 *   "role": "admin",            // or "clinician"
 *   "name": "Practice Admin",
 *   "notes": "Front desk"
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const upstream = await fetch(`${CLIN}/api/clinicians/me/practice-members`, {
      method: 'POST',
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
    console.error('[practice/members][POST] error:', err);
    return NextResponse.json(
      {
        ok: false,
        error:
          err?.message ||
          'Unable to create / invite member. Check CLIN /api/clinicians/me/practice-members (POST).',
      },
      { status: 500 },
    );
  }
}
