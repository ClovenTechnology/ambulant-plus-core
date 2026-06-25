// apps/patient-app/app/api/labs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  });
}

function clean(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function sameOriginBase(req: NextRequest) {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

function forwardHeaders(req: NextRequest) {
  const headers = new Headers();
  const cookie = req.headers.get('cookie');
  if (cookie) headers.set('cookie', cookie);
  headers.set('accept', 'application/json');
  return headers;
}

function toIso(value: unknown) {
  if (!value) return new Date().toISOString();
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const s = clean(value, 500);
    if (s) return s;
  }
  return '';
}

function normalizeFlag(value: unknown) {
  const raw = clean(value, 80).toLowerCase();
  if (raw.includes('critical')) return 'critical';
  if (raw.includes('abnormal')) return 'abnormal';
  if (raw.includes('high')) return 'high';
  if (raw.includes('low')) return 'low';
  if (raw.includes('normal')) return 'normal';
  return undefined;
}

async function readPatientSession(req: NextRequest) {
  const res = await fetch(`${sameOriginBase(req)}/api/auth/me`, {
    method: 'GET',
    cache: 'no-store',
    headers: forwardHeaders(req),
  });

  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload?.ok) return null;

  const patientId = clean(
    payload.patientId ||
      payload.actorRefId ||
      payload.profile?.patientId ||
      payload.profile?.id ||
      payload.user?.patientId ||
      payload.user?.actorRefId,
    180,
  );

  return patientId ? { patientId } : null;
}

function mapResult(row: any) {
  const order = row.order && typeof row.order === 'object' ? row.order : null;
  const hasNumericValue = row.valueNum !== null && row.valueNum !== undefined && Number.isFinite(Number(row.valueNum));

  return {
    id: row.id,
    test: firstText(row.name, row.loincCode, 'Laboratory result'),
    date: toIso(row.createdAt || order?.updatedAt || order?.createdAt),
    status: 'Completed',
    result: hasNumericValue
      ? String(row.valueNum)
      : row.isPositive === true
        ? 'Positive'
        : row.isPositive === false
          ? 'Negative'
          : firstText(row.flag, 'Result available'),
    unit: firstText(row.unit),
    reference: firstText(row.loincCode, order?.id),
    performer: firstText(order?.clinicianId, 'MedReach laboratory'),
    sample: '',
    panel: firstText(order?.panel),
    flag: normalizeFlag(row.flag),
    source: 'prisma.labResult',
  };
}

function mapOrder(row: any) {
  return {
    id: `order_${row.id}`,
    test: firstText(row.panel, 'Laboratory order'),
    date: toIso(row.updatedAt || row.createdAt),
    status: firstText(row.status, 'Pending'),
    result: firstText(row.status, 'Pending'),
    unit: '',
    reference: row.id,
    performer: firstText(row.clinicianId, 'MedReach laboratory'),
    sample: '',
    panel: firstText(row.panel),
    flag: undefined,
    source: 'prisma.labOrder',
  };
}

export async function GET(req: NextRequest) {
  try {
    const session = await readPatientSession(req);
    if (!session) return json({ ok: false, error: 'patient_session_required' }, 401);

    const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get('limit') || 200), 1), 500);

    const [results, orders] = await Promise.all([
      prisma.labResult.findMany({
        where: { patientId: session.patientId },
        include: {
          order: {
            select: {
              id: true,
              panel: true,
              status: true,
              clinicianId: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.labOrder.findMany({
        where: { patientId: session.patientId },
        include: {
          results: {
            select: { id: true },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    ]);

    const resultRows = results.map(mapResult);
    const orderIdsWithResults = new Set(results.map((row) => clean(row.orderId, 180)).filter(Boolean));
    const pendingRows = orders
      .filter((row) => !orderIdsWithResults.has(clean(row.id, 180)))
      .map(mapOrder);

    const items = [...resultRows, ...pendingRows].sort((a, b) => +new Date(b.date) - +new Date(a.date));

    return json({
      ok: true,
      items,
      labs: items,
      source: 'patient-app.api.labs.real-db',
      counts: {
        results: results.length,
        orders: orders.length,
        returned: items.length,
      },
    });
  } catch (error: any) {
    console.error('[patient-app][api/labs] failed', error);
    return json({ ok: false, error: error?.message || 'labs_failed' }, 500);
  }
}
