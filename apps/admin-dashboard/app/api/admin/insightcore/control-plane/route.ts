import { NextRequest, NextResponse } from 'next/server';
import { apigwBase } from '@/app/api/_apigw';
import { requireAdminApiSession } from '@/app/api/_adminApiSession';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SourceResult = {
  ok: boolean;
  status: number;
  body: any;
};

const SOURCE_PATHS = {
  dashboard: '/api/insightcore/studio/dashboard',
  cohort: '/api/insightcore/studio/cohort',
  evaluationModels: '/api/insightcore/studio/evaluation/models',
  evaluationFamilies: '/api/insightcore/studio/evaluation/families',
  runtimeDrift: '/api/insightcore/studio/evaluation/runtime-drift',
  governanceAudit: '/api/insightcore/studio/governance/audit-summary',
  compliance: '/api/insightcore/studio/governance/compliance',
  runtimePlan: '/api/insightcore/studio/runtime/plan',
  researchPipelines: '/api/insightcore/studio/research/pipelines',
  experiments: '/api/insightcore/studio/experiments/active',
} as const;

async function fetchSource(
  path: string,
  headers: Headers,
): Promise<SourceResult> {
  try {
    const response = await fetch(
      new URL(path, apigwBase()),
      {
        method: 'GET',
        headers,
        cache: 'no-store',
      },
    );

    const body = await response
      .json()
      .catch(() => null);

    return {
      ok: response.ok,
      status: response.status,
      body,
    };
  }
  catch {
    return {
      ok: false,
      status: 503,
      body: {
        error: 'upstream_unavailable',
      },
    };
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAdminApiSession(
    req,
    [
      'insightcore:read',
      'insightcore:manage',
      'ai:read',
      'ai:governance',
      'tech:read',
      'tech:manage',
      'tech',
    ],
  );

  if (!auth.ok) return auth.response;

  const pairs = await Promise.all(
    Object.entries(SOURCE_PATHS).map(
      async ([key, path]) => [
        key,
        await fetchSource(
          path,
          auth.gatewayHeaders,
        ),
      ] as const,
    ),
  );

  const sources = Object.fromEntries(pairs);

  const available = Object.values(sources)
    .filter((source) => source.ok)
    .length;

  return NextResponse.json(
    {
      ok: true,
      asAt: new Date().toISOString(),
      sourceAuthority: 'api-gateway',
      mode: 'read-only',
      sourceSummary: {
        available,
        total: Object.keys(SOURCE_PATHS).length,
      },
      sources,
    },
    {
      headers: {
        'cache-control': 'no-store',
      },
    },
  );
}
