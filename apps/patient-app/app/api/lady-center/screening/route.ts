import { NextRequest } from 'next/server';
import {
  computeScreeningStatus,
  inferNextDueISO,
  jsonErr,
  jsonOk,
  resolveLadyPatientContext,
} from '@/app/api/lady-center/_lib/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const ctx = await resolveLadyPatientContext(req);
  if (!ctx.ok) return jsonErr(ctx.error, ctx.status);

  const rows = await ctx.prisma.ladyCenterScreening.findMany({
    where: { patientId: ctx.patientId },
    orderBy: { updatedAt: 'desc' },
  });

  const items = rows.map((row: any) => ({
    key: row.key,
    title: row.title || null,
    desc: row.desc || null,
    cadence: row.cadence || null,
    lastDoneISO: row.lastDoneISO ? row.lastDoneISO.toISOString() : null,
    nextDueISO: row.nextDueISO ? row.nextDueISO.toISOString() : null,
    status: row.status,
  }));

  return jsonOk({ items });
}

export async function POST(req: NextRequest) {
  const ctx = await resolveLadyPatientContext(req);
  if (!ctx.ok) return jsonErr(ctx.error, ctx.status);

  const body = await req.json().catch(() => null);
  const key = body?.key ? String(body.key).trim() : '';
  const title = body?.title ? String(body.title).trim() : null;
  const desc = body?.desc ? String(body.desc).trim() : null;
  const cadence = body?.cadence ? String(body.cadence).trim() : null;
  const lastDoneISO = body?.lastDoneISO ? String(body.lastDoneISO) : null;

  if (!key) return jsonErr('Missing screening key.', 400, 'missing_key');

  const nextDueISO = inferNextDueISO(key, lastDoneISO);
  const status = computeScreeningStatus(nextDueISO);

  const row = await ctx.prisma.ladyCenterScreening.upsert({
    where: {
      patientId_key: {
        patientId: ctx.patientId,
        key,
      },
    },
    update: {
      title,
      desc,
      cadence,
      lastDoneISO: lastDoneISO ? new Date(lastDoneISO) : null,
      nextDueISO: nextDueISO ? new Date(nextDueISO) : null,
      status,
    },
    create: {
      patientId: ctx.patientId,
      key,
      title,
      desc,
      cadence,
      lastDoneISO: lastDoneISO ? new Date(lastDoneISO) : null,
      nextDueISO: nextDueISO ? new Date(nextDueISO) : null,
      status,
    },
  });

  return jsonOk({
    item: {
      key: row.key,
      title: row.title || null,
      desc: row.desc || null,
      cadence: row.cadence || null,
      lastDoneISO: row.lastDoneISO ? row.lastDoneISO.toISOString() : null,
      nextDueISO: row.nextDueISO ? row.nextDueISO.toISOString() : null,
      status: row.status,
    },
  });
}