// apps/admin-dashboard/app/api/analytics/overview/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { apigwBase } from '@/app/api/_apigw';

export const dynamic = 'force-dynamic';

const ANALYTICS_CALLER_SCOPES = [
  'analytics.read',
  'reports.read',
  'reports',
  'finance',
  'tech',
  'compliance',
  'manageRoles',
  'rnd',
] as const;

type AuthMePayload = {
  authenticated?: boolean;
  user?: {
    id?: string;
    userId?: string;
    email?: string;
    scopes?: unknown[];
  };
};

type GatewaySummary = {
  ok?: boolean;
  period?: {
    from?: string;
    to?: string;
  };
  kpis?: {
    revenueCapturedCents?: unknown;
    refundsCents?: unknown;
    payoutsDueCents?: unknown;
    netEarningsCents?: unknown;
    patients?: unknown;
    clinicians?: unknown;
    devicesOnline?: unknown;
    riderPayoutsCount?: unknown;
    phlebPayoutsCount?: unknown;
  };
  error?: unknown;
};

function jsonError(
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

function gatewayHeaders(
  req: NextRequest,
) {
  const headers = new Headers({
    accept: 'application/json',
    'cache-control': 'no-store',
  });

  const cookie =
    req.headers.get('cookie');

  const authorization =
    req.headers.get('authorization');

  if (cookie) {
    headers.set(
      'cookie',
      cookie,
    );
  }

  if (authorization) {
    headers.set(
      'authorization',
      authorization,
    );
  }

  const adminKey =
    process.env.ADMIN_API_KEY?.trim();

  if (adminKey) {
    headers.set(
      'x-admin-key',
      adminKey,
    );
  }

  return headers;
}

async function requireAnalyticsCaller(
  req: NextRequest,
) {
  const cookie =
    req.headers.get('cookie') || '';

  const authorization =
    req.headers.get('authorization') || '';

  if (
    !cookie &&
    !authorization
  ) {
    return jsonError(
      'unauthorized',
      401,
    );
  }

  let response: Response;

  try {
    response = await fetch(
      new URL(
        '/api/auth/me',
        apigwBase(),
      ),
      {
        method: 'GET',
        headers:
          gatewayHeaders(req),
        cache: 'no-store',
      },
    );
  } catch {
    return jsonError(
      'analytics_auth_unavailable',
      503,
    );
  }

  const body =
    (await response
      .json()
      .catch(() => null)) as
      | AuthMePayload
      | null;

  if (
    !response.ok ||
    body?.authenticated !== true ||
    !body.user
  ) {
    return jsonError(
      'unauthorized',
      401,
    );
  }

  const scopes =
    Array.isArray(
      body.user.scopes,
    )
      ? body.user.scopes
          .map((scope) =>
            String(
              scope || '',
            ).trim(),
          )
          .filter(Boolean)
      : [];

  const authorised =
    ANALYTICS_CALLER_SCOPES.some(
      (scope) =>
        scopes.includes(
          scope,
        ),
    );

  if (!authorised) {
    return jsonError(
      'forbidden',
      403,
    );
  }

  return null;
}

function nonNegativeNumber(
  value: unknown,
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(
      number,
    )
  ) {
    return 0;
  }

  return Math.max(
    0,
    number,
  );
}

function wholeNumber(
  value: unknown,
) {
  return Math.trunc(
    nonNegativeNumber(
      value,
    ),
  );
}

function formatZarFromCents(
  value: unknown,
) {
  const cents =
    nonNegativeNumber(
      value,
    );

  return new Intl.NumberFormat(
    'en-ZA',
    {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  ).format(
    cents / 100,
  );
}

function validIsoDate(
  value: unknown,
) {
  if (
    typeof value !==
    'string'
  ) {
    return null;
  }

  const timestamp =
    Date.parse(value);

  return Number.isFinite(
    timestamp,
  )
    ? new Date(
        timestamp,
      ).toISOString()
    : null;
}

export async function GET(
  req: NextRequest,
) {
  const rejection =
    await requireAnalyticsCaller(
      req,
    );

  if (rejection) {
    return rejection;
  }

  let upstream: Response;

  try {
    upstream = await fetch(
      new URL(
        '/api/analytics/summary',
        apigwBase(),
      ),
      {
        method: 'GET',
        headers:
          gatewayHeaders(req),
        cache: 'no-store',
      },
    );
  } catch {
    return jsonError(
      'analytics_upstream_unavailable',
      503,
    );
  }

  const body =
    (await upstream
      .json()
      .catch(() => null)) as
      | GatewaySummary
      | null;

  if (
    !upstream.ok ||
    body?.ok !== true ||
    !body.kpis
  ) {
    return jsonError(
      'analytics_upstream_failed',
      502,
    );
  }

  const from =
    validIsoDate(
      body.period?.from,
    );

  const to =
    validIsoDate(
      body.period?.to,
    );

  const period =
    from && to
      ? {
          from,
          to,
        }
      : null;

  const periodDescription =
    period
      ? `${new Date(period.from).toLocaleDateString('en-ZA')} – ${new Date(
          period.to,
        ).toLocaleDateString('en-ZA')}`
      : 'Current Gateway reporting period';

  const requestedFilters =
    Array.from(
      new Set(
        Array.from(
          req.nextUrl.searchParams.keys(),
        ),
      ),
    );

  const warnings = [
    'The live summary currently provides aggregate KPIs only. Revenue series, product mix, geographic, cohort and top-entity sections remain empty until authoritative live contracts are available.',
  ];

  if (
    requestedFilters.length >
    0
  ) {
    warnings.push(
      'The current Gateway summary uses its authoritative reporting period; the selected dashboard filters are not yet applied to aggregate KPIs.',
    );
  }

  return NextResponse.json(
    {
      source:
        'api-gateway:/api/analytics/summary',

      generatedAt:
        new Date().toISOString(),

      period,

      warnings,

      kpis: [
        {
          label:
            'Revenue captured',
          value:
            formatZarFromCents(
              body.kpis.revenueCapturedCents,
            ),
          sub:
            periodDescription,
        },
        {
          label:
            'Patient profiles',
          value:
            wholeNumber(
              body.kpis.patients,
            ),
          sub:
            'Current database total',
        },
        {
          label:
            'Clinician profiles',
          value:
            wholeNumber(
              body.kpis.clinicians,
            ),
          sub:
            'Current database total',
        },
        {
          label:
            'IoMT devices online',
          value:
            wholeNumber(
              body.kpis.devicesOnline,
            ),
          sub:
            'Seen within the live-device window',
        },
        {
          label:
            'Payouts due',
          value:
            formatZarFromCents(
              body.kpis.payoutsDueCents,
            ),
          sub:
            periodDescription,
        },
        {
          label:
            'Ambulant+ net earnings',
          value:
            formatZarFromCents(
              body.kpis.netEarningsCents,
            ),
          sub:
            'Captured revenue less refunds and payouts due',
        },
        {
          label:
            'Refunds',
          value:
            formatZarFromCents(
              body.kpis.refundsCents,
            ),
          sub:
            periodDescription,
        },
        {
          label:
            'Rider payouts pending',
          value:
            wholeNumber(
              body.kpis.riderPayoutsCount,
            ),
        },
        {
          label:
            'Phlebotomist payouts pending',
          value:
            wholeNumber(
              body.kpis.phlebPayoutsCount,
            ),
        },
      ],

      revenueSeries: [],
      productMix: [],
      geo: [],
      cohorts: [],
      topEntities: [],
    },
    {
      headers: {
        'Cache-Control':
          'no-store',
      },
    },
  );
}
