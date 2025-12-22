// apps/admin-dashboard/app/api/admin/analytics/clinicians/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  buildMockClinicianAnalytics,
  buildRealClinicianAnalytics,
  type ClinicianAnalyticsOverview,
} from '@/lib/analytics/clinician';

function parseDateOrFallback(value: string | null, fallback: Date): Date {
  if (!value) return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

export async function GET(req: Request) {
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
  let data: ClinicianAnalyticsOverview;

  try {
    if (!forceMock) {
      data = await buildRealClinicianAnalytics({
        prisma,
        from,
        to,
        granularity,
      });

      // If there’s literally no data yet, fall back to mock
      if (!data.panelTable.length) {
        mode = 'mock';
        data = buildMockClinicianAnalytics({ from, to, granularity });
      }
    } else {
      mode = 'mock';
      data = buildMockClinicianAnalytics({ from, to, granularity });
    }

    return NextResponse.json({ ok: true, mode, data });
  } catch (err) {
    console.error('Clinician analytics error, falling back to mock:', err);
    mode = 'mock';
    data = buildMockClinicianAnalytics({ from, to, granularity });
    return NextResponse.json({ ok: true, mode, data });
  }
}
