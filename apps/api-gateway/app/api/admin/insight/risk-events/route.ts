// apps/api-gateway/app/api/admin/insight/risk-events/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { startOfISOWeek } from 'date-fns';
import { parseRiskAlertPayload } from '@/src/insightcore/riskAlertTypes';
import { getRiskRule } from '@/src/insightcore/riskRules';

const prisma = new PrismaClient();

type RiskEventSummary = {
  weekStart: string;          // ISO date string (Monday of ISO week)
  ruleId: string;
  ruleName: string | null;
  description: string | null;
  syndrome: string | null;

  total: number;
  low: number;
  moderate: number;
  high: number;

  avgScore: number | null;
  distinctPatients: number;

  tags: string[];
  defaultSeverity: string | null;
  hardThreshold: number | null;
  minScore: number | null;
};

function parseDateParam(raw: string | null, fallback: Date): Date {
  if (!raw) return fallback;
  const ts = Date.parse(raw);
  if (Number.isNaN(ts)) return fallback;
  return new Date(ts);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const now = new Date();
    const defaultTo = now;
    const defaultFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const from = parseDateParam(searchParams.get('from'), defaultFrom);
    const to = parseDateParam(searchParams.get('to'), defaultTo);

    const orgId = searchParams.get('orgId') ?? undefined;
    const filterRuleId = searchParams.get('ruleId') ?? undefined;
    const filterSyndrome = searchParams.get('syndrome') ?? undefined;

    const where: any = {
      kind: 'insight.alert.risk',
      ts: {
        gte: BigInt(from.getTime()),
        lt: BigInt(to.getTime()),
      },
    };
    if (orgId) where.orgId = orgId;

    const events = await prisma.runtimeEvent.findMany({
      where,
    });

    type Bucket = {
      weekStart: Date;
      ruleId: string;
      syndrome: string | null;
      total: number;
      low: number;
      moderate: number;
      high: number;
      sumScore: number;
      scoreCount: number;
      patientIds: Set<string>;
    };

    const buckets = new Map<string, Bucket>();

    for (const ev of events) {
      const payload = parseRiskAlertPayload(ev.payload ?? null);
      const ruleId = (payload?.ruleId as string) || 'unknown';
      const syndrome = (payload?.syndrome as string) ?? null;

      if (filterRuleId && filterRuleId !== ruleId) continue;
      if (filterSyndrome && filterSyndrome !== syndrome) continue;

      const tsMs = Number(ev.ts);
      if (!Number.isFinite(tsMs)) continue;
      const date = new Date(tsMs);
      const weekStart = startOfISOWeek(date);

      const key = `${weekStart.toISOString()}|${ruleId}|${syndrome ?? ''}`;

      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = {
          weekStart,
          ruleId,
          syndrome,
          total: 0,
          low: 0,
          moderate: 0,
          high: 0,
          sumScore: 0,
          scoreCount: 0,
          patientIds: new Set<string>(),
        };
        buckets.set(key, bucket);
      }

      bucket.total += 1;

      const severity = (ev.severity ?? 'moderate').toLowerCase();
      if (severity === 'high') bucket.high += 1;
      else if (severity === 'low') bucket.low += 1;
      else bucket.moderate += 1;

      const score =
        typeof payload?.score === 'number' ? (payload.score as number) : null;
      if (score != null) {
        bucket.sumScore += score;
        bucket.scoreCount += 1;
      }

      if (ev.patientId) {
        bucket.patientIds.add(ev.patientId);
      }
    }

    const summaries: RiskEventSummary[] = Array.from(buckets.values())
      .map((b) => {
        const rule = getRiskRule(b.ruleId);
        const avgScore =
          b.scoreCount > 0 ? b.sumScore / b.scoreCount : null;

        return {
          weekStart: b.weekStart.toISOString(),
          ruleId: b.ruleId,
          ruleName: rule?.name ?? null,
          description: rule?.description ?? null,
          syndrome: b.syndrome,

          total: b.total,
          low: b.low,
          moderate: b.moderate,
          high: b.high,

          avgScore,
          distinctPatients: b.patientIds.size,

          tags: rule?.tags ?? [],
          defaultSeverity: rule?.defaultSeverity ?? null,
          hardThreshold: rule?.hardThreshold ?? null,
          minScore: rule?.minScore ?? null,
        };
      })
      .sort((a, b) => {
        // Newest weeks first, then by total desc
        if (a.weekStart < b.weekStart) return 1;
        if (a.weekStart > b.weekStart) return -1;
        if (a.total < b.total) return 1;
        if (a.total > b.total) return -1;
        return 0;
      });

    return NextResponse.json({
      ok: true,
      range: {
        from: from.toISOString(),
        to: to.toISOString(),
      },
      orgId: orgId ?? null,
      ruleId: filterRuleId ?? null,
      syndrome: filterSyndrome ?? null,
      count: summaries.length,
      summaries,
    });
  } catch (err) {
    console.error('[admin/insight/risk-events] error', err);
    return NextResponse.json(
      {
        ok: false,
        error: 'Internal server error',
      },
      { status: 500 },
    );
  }
}
