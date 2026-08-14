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
    'x-join-token',
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
        '/api/training/materials',
        gateway,
      );

    [
      'clinicianId',
      'trainingSlotId',
      'roomId',
    ].forEach((key) => {
      const value =
        request.nextUrl
          .searchParams
          .get(key);

      if (value) {
        upstreamUrl
          .searchParams
          .set(
            key,
            value,
          );
      }
    });

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
      role:
        data?.role ||
        'clinician',
      identity:
        data?.identity ||
        null,
      trainingSlotId:
        data?.trainingSlotId ||
        null,
      trainingSlot:
        data?.trainingSlot ||
        null,
      sessions:
        Array.isArray(
          data?.sessions,
        )
          ? data.sessions
          : [],
      modules:
        Array.isArray(
          data?.modules,
        )
          ? data.modules
          : [],
      legacyMaterials:
        Array.isArray(
          data?.legacyMaterials,
        )
          ? data.legacyMaterials
          : [],
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
