// apps/clinician-app/app/api/training/materials/route.ts

import {
  NextRequest,
  NextResponse,
} from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function trimSlash(
  value: string,
) {
  return String(
    value || '',
  ).replace(/\/+$/, '');
}

function gatewayBase() {
  return trimSlash(
    process.env.APIGW_BASE_URL ||
    process.env.APIGW_BASE ||
    process.env.API_GATEWAY_URL ||
    process.env.API_GATEWAY_BASE_URL ||
    process.env.GATEWAY_URL ||
    process.env.NEXT_PUBLIC_APIGW_BASE ||
    process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
    process.env.NEXT_PUBLIC_GATEWAY_BASE ||
    process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ||
    '',
  );
}

function forwardHeaders(
  request: NextRequest,
) {
  const headers =
    new Headers();

  [
    'cookie',
    'authorization',
    'x-role',
    'x-uid',
    'x-user-id',
    'x-org-id',
    'x-ambulant-identity',
    'user-agent',
  ].forEach((key) => {
    const value =
      request.headers.get(
        key,
      );

    if (value) {
      headers.set(
        key,
        value,
      );
    }
  });

  headers.set(
    'accept',
    'application/json',
  );

  return headers;
}

function json(
  body: unknown,
  status = 200,
) {
  return NextResponse.json(
    body,
    {
      status,
      headers: {
        'cache-control':
          'no-store, max-age=0',
      },
    },
  );
}

export async function GET(
  request: NextRequest,
) {
  try {
    const gateway =
      gatewayBase();

    if (!gateway) {
      return json(
        {
          ok: false,
          error:
            'training_materials_gateway_not_configured',
        },
        503,
      );
    }

    const upstreamUrl =
      new URL(
        '/api/clinicians/me/training/materials',
        gateway,
      );

    const clinicianId =
      request.nextUrl
        .searchParams
        .get('clinicianId');

    if (clinicianId) {
      upstreamUrl
        .searchParams
        .set(
          'clinicianId',
          clinicianId,
        );
    }

    const upstream =
      await fetch(
        upstreamUrl,
        {
          method: 'GET',
          headers:
            forwardHeaders(
              request,
            ),
          cache: 'no-store',
        },
      );

    const data =
      await upstream
        .json()
        .catch(
          () => null,
        );

    if (
      !upstream.ok ||
      !data?.ok
    ) {
      return json(
        {
          ok: false,
          error:
            data?.error ||
            'training_materials_fetch_failed',
        },
        upstream.status ||
          502,
      );
    }

    const items =
      Array.isArray(
        data?.items,
      )
        ? data.items
        : Array.isArray(
              data?.materials,
            )
          ? data.materials
          : [];

    return json({
      ok: true,
      source:
        data?.source ||
        'admin_configured',
      trainingSlotId:
        data?.trainingSlotId ||
        null,
      items,
      materials: items,
    });
  } catch (error: any) {
    console.error(
      '[clinician-app][training/materials][GET] upstream error',
      error,
    );

    return json(
      {
        ok: false,
        error:
          error?.message ||
          'training_materials_fetch_failed',
      },
      502,
    );
  }
}
