import {
  NextRequest,
  NextResponse,
} from 'next/server';
import {
  gatewayBaseFromEnv,
  requireAdminCaller,
} from '../../_helpers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function errorResponse(
  error: string,
  status: number,
) {
  return NextResponse.json(
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
  );
}

export async function GET(
  req: NextRequest,
  context: {
    params: {
      paymentId: string;
    };
  },
) {
  const caller =
    await requireAdminCaller(req);

  if (!caller.ok) {
    return caller.response;
  }

  const paymentId =
    String(
      context.params.paymentId || '',
    ).trim();

  if (!paymentId) {
    return errorResponse(
      'paymentId_required',
      400,
    );
  }

  const gateway =
    gatewayBaseFromEnv();

  const adminKey =
    process.env.ADMIN_API_KEY ?? '';

  let response: Response;

  try {
    response = await fetch(
      `${gateway}/api/admin/clinicians/onboarding/payment-pop/${encodeURIComponent(paymentId)}`,
      {
        method: 'GET',
        headers: {
          accept:
            'application/json',
          'x-admin-key':
            adminKey,
        },
        cache: 'no-store',
      },
    );
  } catch {
    return errorResponse(
      'gateway_unavailable',
      503,
    );
  }

  const text =
    await response
      .text()
      .catch(() => '');

  let body: any = null;

  try {
    body = text
      ? JSON.parse(text)
      : null;
  } catch {
    body = null;
  }

  if (!response.ok) {
    return errorResponse(
      body?.error ||
        text ||
        `HTTP_${response.status}`,
      response.status,
    );
  }

  return NextResponse.json(
    body ?? {
      ok: true,
    },
    {
      status: 200,
      headers: {
        'Cache-Control':
          'private, no-store, max-age=0',
        Pragma: 'no-cache',
      },
    },
  );
}