//apps/admin-dashboard/app/api/admin/clinicians/onboarding/_helpers.ts
import { NextRequest, NextResponse } from 'next/server';

export function gatewayBaseFromEnv() {
  const raw =
    process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ??
    process.env.APIGW_BASE ??
    process.env.GATEWAY_URL ??
    process.env.API_GATEWAY_BASE_URL ??
    process.env.API_GATEWAY_URL ??
    process.env.NEXT_PUBLIC_APIGW_BASE ??
    process.env.NEXT_PUBLIC_PATIENT_BASE ??
    '';

  const gateway = raw.trim().replace(/\/+$/, '');
  if (!gateway) {
    throw new Error('gateway_base_not_configured');
  }

  return gateway;
}

export async function readJson(req: NextRequest) {
  const ct = req.headers.get('content-type') || '';
  if (ct.includes('application/json')) return req.json().catch(() => ({} as any));
  // fallback (rare): formData
  const fd = await req.formData().catch(() => null);
  if (!fd) return {} as any;
  const out: any = {};
  fd.forEach((v, k) => (out[k] = v));
  return out;
}

const ADMIN_ONBOARDING_CALLER_SCOPES = [
  'manageRoles',
  'hr',
  'finance',
  'tech',
  'compliance',
  'reports',
  'rnd',
] as const;

export type AdminCallerGateResult =
  | {
      ok: true;
      userId: string;
      email: string | null;
    }
  | {
      ok: false;
      response: NextResponse;
    };

function unauthorizedAdminCaller(
  error = 'unauthorized',
  status = 401,
) {
  return {
    ok: false as const,
    response: NextResponse.json(
      {
        ok: false,
        error,
      },
      {
        status,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    ),
  };
}

export async function requireAdminCaller(
  req: NextRequest,
): Promise<AdminCallerGateResult> {
  const gateway = gatewayBaseFromEnv();

  const cookie =
    req.headers.get('cookie') || '';

  const authorization =
    req.headers.get('authorization') || '';

  if (!cookie && !authorization) {
    return unauthorizedAdminCaller();
  }

  const headers = new Headers({
    accept: 'application/json',
    'cache-control': 'no-store',
    'x-admin-origin': req.nextUrl.origin,
  });

  if (cookie) {
    headers.set('cookie', cookie);
  }

  if (authorization) {
    headers.set(
      'authorization',
      authorization,
    );
  }

  let response: Response;

  try {
    response = await fetch(
      `${gateway}/api/auth/me`,
      {
        method: 'GET',
        headers,
        cache: 'no-store',
      },
    );
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: 'admin_auth_unavailable',
        },
        {
          status: 503,
          headers: {
            'Cache-Control': 'no-store',
          },
        },
      ),
    };
  }

  const body =
    await response
      .json()
      .catch(() => null);

  if (
    !response.ok ||
    body?.authenticated !== true ||
    !body?.user
  ) {
    return unauthorizedAdminCaller();
  }

  const effectiveScopes =
    Array.isArray(body.user.scopes)
      ? body.user.scopes
          .map((scope: unknown) =>
            String(scope || '').trim(),
          )
          .filter(Boolean)
      : [];

  const authorised =
    ADMIN_ONBOARDING_CALLER_SCOPES.some(
      (scope) =>
        effectiveScopes.includes(scope),
    );

  if (!authorised) {
    return unauthorizedAdminCaller(
      'forbidden',
      403,
    );
  }

  const userId = String(
    body.user.id ||
      body.user.userId ||
      body.user.email ||
      '',
  ).trim();

  if (!userId) {
    return unauthorizedAdminCaller();
  }

  return {
    ok: true,
    userId,
    email:
      body.user.email == null
        ? null
        : String(body.user.email),
  };
}

export async function forwardToGateway(req: NextRequest, path: string, body: any) {
  const caller =
    await requireAdminCaller(req);

  if (!caller.ok) {
    return caller.response;
  }

  const gateway = gatewayBaseFromEnv();
  const adminKey = process.env.ADMIN_API_KEY ?? '';

  const url = `${gateway}${path.startsWith('/') ? path : `/${path}`}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-admin-key': adminKey,
    },
    body: JSON.stringify(body ?? {}),
    cache: 'no-store',
  });

  const text = await res.text().catch(() => '');
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    return NextResponse.json(
      { ok: false, error: json?.error || text || `HTTP_${res.status}`, status: res.status },
      { status: res.status }
    );
  }

  // pass-through success payload
  return NextResponse.json(json ?? { ok: true }, { status: 200 });
}

export async function bestEffortNotifyDispatch(payload: any) {
  const gateway = gatewayBaseFromEnv();
  const adminKey = process.env.ADMIN_API_KEY ?? '';
  const url = `${gateway}/api/admin/clinicians/onboarding/notify-dispatch`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-admin-key': adminKey },
      body: JSON.stringify(payload ?? {}),
      cache: 'no-store',
    });

    // If endpoint not implemented yet, ignore.
    if (res.status === 404) return { ok: false, ignored: true, reason: 'notify_404' };

    if (!res.ok) {
      const t = await res.text().catch(() => '');
      return { ok: false, ignored: false, reason: t || `notify_http_${res.status}` };
    }

    return { ok: true };
  } catch (e: any) {
    // do not break the main action
    return { ok: false, ignored: false, reason: e?.message || 'notify_failed' };
  }
}
