// apps/admin-dashboard/app/api/admin/analytics/clinicians/[id]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  buildMockClinicianAnalytics,
  buildRealClinicianAnalytics,
  buildClinicianDetailFromOverview,
  type ClinicianDetailAnalytics,
} from '@/lib/analytics/clinician';

function parseDateOrFallback(value: string | null, fallback: Date): Date {
  if (!value) return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

type RouteContext = {
  params: { id: string };
};

export async function GET(req: Request, ctx: RouteContext) {
  const clinicianId = ctx.params.id;
  const { searchParams } = new URL(req.url);
  const now = new Date();

  const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const from = parseDateOrFallback(searchParams.get('from'), defaultFrom);
  const to = parseDateOrFallback(searchParams.get('to'), now);
  const granularityParam = searchParams.get('granularity');
  const granularity =
    granularityParam === 'week' || granularityParam === 'month'
      ? granularityParam
      : 'day';

  const forceMock = searchParams.get('mock') === '1';

  let mode: 'real' | 'mock' = 'real';
  let data: ClinicianDetailAnalytics;

  try {
    if (!forceMock) {
      // Try real analytics first (overview → detail)
      let overview = await buildRealClinicianAnalytics({
        prisma,
        from,
        to,
        granularity,
      });

      if (!overview.panelTable.length) {
        // No real data in this window → fall back to mock
        mode = 'mock';
        overview = buildMockClinicianAnalytics({
          from,
          to,
          granularity,
        });
      }

      try {
        // First try with the requested clinicianId
        data = buildClinicianDetailFromOverview(clinicianId, overview);
      } catch {
        // If that clinicianId doesn't exist (e.g. in mock data),
        // fall back to the first available clinician in the table.
        const fallback = overview.panelTable[0];
        if (!fallback) {
          throw new Error('No clinicians available in overview analytics');
        }
        data = buildClinicianDetailFromOverview(fallback.clinicianId, overview);
        mode = 'mock';
      }
    } else {
      // Forced mock mode
      mode = 'mock';
      const overview = buildMockClinicianAnalytics({
        from,
        to,
        granularity,
      });

      const target =
        overview.panelTable.find((c) => c.clinicianId === clinicianId) ??
        overview.panelTable[0];

      if (!target) {
        throw new Error('No clinicians available in mock overview');
      }

      data = buildClinicianDetailFromOverview(target.clinicianId, overview);
    }

    return NextResponse.json({ ok: true, mode, data });
  } catch (err) {
    console.error(
      '[analytics/clinicians/:id] error, falling back to mock detail:',
      err,
    );

    // Full fallback: pure mock, safe defaults
    mode = 'mock';
    const overview = buildMockClinicianAnalytics({
      from,
      to,
      granularity,
    });

    const fallback =
      overview.panelTable.find((c) => c.clinicianId === clinicianId) ??
      overview.panelTable[0];

    if (!fallback) {
      return NextResponse.json(
        {
          ok: false,
          mode: 'mock',
          error: 'No clinician analytics available (even in mock)',
        },
        { status: 500 },
      );
    }

    data = buildClinicianDetailFromOverview(fallback.clinicianId, overview);

    return NextResponse.json({ ok: true, mode, data });
  }
}
