// apps/clinician-app/app/api/settings/plan-tiers/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GATEWAY =
  process.env.GATEWAY_URL ||
  process.env.APIGW_BASE ||
  process.env.NEXT_PUBLIC_APIGW_BASE ||
  process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ||
  '';

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

export async function GET(_req: NextRequest) {
  if (!GATEWAY) {
    return json(
      {
        ok: false,
        error: 'missing_gateway_base',
        clinicianPlans: [],
      },
      500,
    );
  }
  try {
    const res = await fetch(`${GATEWAY}/api/settings/plans`, {
      cache: 'no-store',
    });
    const js = await res.json().catch(() => ({} as any));
    if (!res.ok) {
      throw new Error(js?.error || `HTTP ${res.status}`);
    }
    return json({
      ok: true,
      clinicianPlans: Array.isArray(js.clinicianPlans)
        ? js.clinicianPlans
        : [],
    });
  } catch (err: any) {
    console.error('/api/settings/plan-tiers proxy error', err);
    return json(
      {
        ok: false,
        error: err?.message || 'failed_to_load_plan_tiers',
        clinicianPlans: [],
      },
      500,
    );
  }
}
