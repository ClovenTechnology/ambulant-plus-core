import { NextRequest } from 'next/server';
import { resolveLadyPatientContext, jsonErr, jsonOk, mapLadyDayLog } from '@/app/api/lady-center/_lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clampDays(v: string | null) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 90;
  if (n <= 14) return 14;
  if (n <= 28) return 28;
  return 90;
}

export async function GET(req: NextRequest) {
  const ctx = await resolveLadyPatientContext(req);
  if (!ctx.ok) return jsonErr(ctx.error, ctx.status);

  const days = clampDays(req.nextUrl.searchParams.get('days'));
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  from.setHours(0, 0, 0, 0);

  const [logs, fert] = await Promise.all([
    ctx.prisma.ladyCenterDayLog.findMany({
      where: {
        patientId: ctx.patientId,
        date: { gte: from },
      },
      orderBy: { date: 'asc' },
    }),
    fetch(
      `${req.nextUrl.origin}/api/reports/fertility?patientId=${encodeURIComponent(ctx.patientId)}&range=${
        days <= 30 ? '30d' : days <= 90 ? '90d' : '1y'
      }`,
      { cache: 'no-store' }
    )
      .then(async (r) => (r.ok ? r.json() : null))
      .catch(() => null),
  ]);

  const logMap = new Map<string, any>();
  for (const row of logs) {
    const mapped = mapLadyDayLog(row);
    logMap.set(mapped.date, mapped);
  }

  const fertMap = new Map<string, any>();
  if (fert?.ok && Array.isArray(fert.trend)) {
    for (const row of fert.trend) {
      fertMap.set(row.date, row);
    }
  }

  const out: Array<{
    date: string;
    log: any | null;
    fertility: any | null;
  }> = [];

  for (let i = 0; i < days; i++) {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    const iso = d.toISOString().slice(0, 10);

    out.push({
      date: iso,
      log: logMap.get(iso) || null,
      fertility: fertMap.get(iso) || null,
    });
  }

  return jsonOk({
    patientId: ctx.patientId,
    days,
    items: out,
    generatedAtISO: new Date().toISOString(),
  });
}