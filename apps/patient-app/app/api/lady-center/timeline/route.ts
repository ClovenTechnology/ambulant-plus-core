import { NextRequest } from 'next/server';
import {
  resolveLadyPatientContext,
  jsonErr,
  jsonOk,
  mapLadyDayLog,
} from '@/app/api/lady-center/_lib/server';
import {
  patientGatewayHeaders,
  readPatientGatewayIdentity,
} from '@/src/lib/gateway-identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clampDays(value: string | null) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 90;
  if (n <= 14) return 14;
  if (n <= 28) return 28;
  return 90;
}

export async function GET(req: NextRequest) {
  const ctx = await resolveLadyPatientContext(req);
  if (!ctx.ok) return jsonErr(ctx.error, ctx.status);

  const identity = await readPatientGatewayIdentity(req);
  if (!identity) return jsonErr('patient_authentication_required', 401);
  if (identity.patientId !== ctx.patientId) return jsonErr('patient_context_mismatch', 403);

  const days = clampDays(req.nextUrl.searchParams.get('days'));
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  from.setHours(0, 0, 0, 0);
  const range = days <= 30 ? '30d' : '90d';

  const [logs, fertility] = await Promise.all([
    ctx.prisma.ladyCenterDayLog.findMany({
      where: { patientId: ctx.patientId, date: { gte: from } },
      orderBy: { date: 'asc' },
    }),
    fetch(`${req.nextUrl.origin}/api/reports/fertility?range=${range}`, {
      cache: 'no-store',
      headers: patientGatewayHeaders({ req, identity }),
    })
      .then(async (res) => (res.ok ? res.json() : null))
      .catch(() => null),
  ]);

  const logMap = new Map<string, any>();
  for (const row of logs) {
    const mapped = mapLadyDayLog(row);
    logMap.set(mapped.date, mapped);
  }

  const fertilityMap = new Map<string, any>();
  if (fertility?.ok && Array.isArray(fertility.trend)) {
    for (const row of fertility.trend) {
      const date = String(row?.date || '').slice(0, 10);
      if (date) fertilityMap.set(date, row);
    }
  }

  const items: Array<{ date: string; log: any | null; fertility: any | null }> = [];

  for (let i = 0; i < days; i += 1) {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    items.push({
      date: iso,
      log: logMap.get(iso) || null,
      fertility: fertilityMap.get(iso) || null,
    });
  }

  return jsonOk({
    days,
    items,
    generatedAtISO: new Date().toISOString(),
  });
}
