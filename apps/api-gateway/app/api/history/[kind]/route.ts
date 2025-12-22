// apps/api-gateway/app/api/history/[kind]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

type HistoryItem = {
  id: string;
  date: string;     // ISO
  label: string;    // primary text
  subtitle?: string;
  meta?: string;
  status?: string;
};

function json(items: HistoryItem[]) {
  return NextResponse.json({ items });
}

export async function GET(
  req: NextRequest,
  ctx: { params: { kind: string } }
) {
  const { kind } = ctx.params;
  const url = new URL(req.url);
  const patientId = url.searchParams.get('patientId') || undefined;

  if (!patientId) {
    return NextResponse.json(
      { error: 'patientId query param is required' },
      { status: 400 }
    );
  }

  const limitRaw = url.searchParams.get('limit') || '50';
  const limit = Math.min(Math.max(parseInt(limitRaw, 10) || 50, 1), 200);

  try {
    switch (kind) {
      case 'conditions':
        return json(await getConditions(patientId, limit));
      case 'vaccinations':
        return json(await getVaccinations(patientId, limit));
      case 'operations':
        return json(await getOperations(patientId, limit));
      case 'rx':
        return json(await getMedications(patientId, limit));
      case 'labs':
        return json(await getLabOrders(patientId, limit));
      case 'cases':
        return json(await getCases(patientId, limit));
      default:
        return NextResponse.json(
          { error: `Unsupported history kind: ${kind}` },
          { status: 400 }
        );
    }
  } catch (err: any) {
    console.error('[history] error', kind, err);
    return NextResponse.json(
      { error: 'Failed to load history' },
      { status: 500 }
    );
  }
}

/* ---------- per-kind helpers (Prisma-aware) ---------- */

async function getConditions(patientId: string, limit: number): Promise<HistoryItem[]> {
  const rows = await prisma.condition.findMany({
    where: { patientId },
    orderBy: [
      { diagnosedAt: 'desc' },
      { createdAt: 'desc' },
    ],
    take: limit,
  });

  return rows.map((c) => {
    const subtitleParts: string[] = [];
    if (c.status) subtitleParts.push(c.status);
    if (c.facility) subtitleParts.push(c.facility);
    if (c.clinician) subtitleParts.push(c.clinician);

    const metaParts: string[] = [];
    if (c.onAmbulant) metaParts.push('On Ambulant+');
    if (c.source) metaParts.push(`Source: ${c.source}`);

    return {
      id: c.id,
      date: (c.diagnosedAt ?? c.createdAt).toISOString(),
      label: c.name,
      subtitle: subtitleParts.join(' • ') || undefined,
      meta: metaParts.join(' | ') || undefined,
      status: c.status || undefined,
    };
  });
}

async function getVaccinations(patientId: string, limit: number): Promise<HistoryItem[]> {
  const rows = await prisma.vaccination.findMany({
    where: { patientId },
    orderBy: [
      { date: 'desc' },
      { createdAt: 'desc' },
    ],
    take: limit,
  });

  return rows.map((v) => {
    const subtitleParts: string[] = [];
    if (v.date) subtitleParts.push(`Date: ${v.date.toISOString().slice(0, 10)}`);
    if (v.facility) subtitleParts.push(v.facility);
    if (v.clinician) subtitleParts.push(v.clinician);

    const metaParts: string[] = [];
    if (v.batch) metaParts.push(`Batch: ${v.batch}`);
    if (v.source) metaParts.push(`Source: ${v.source}`);

    return {
      id: v.id,
      date: (v.date ?? v.createdAt).toISOString(),
      label: v.vaccine,
      subtitle: subtitleParts.join(' • ') || undefined,
      meta: metaParts.join(' | ') || undefined,
      status: 'Completed',
    };
  });
}

async function getOperations(patientId: string, limit: number): Promise<HistoryItem[]> {
  const rows = await prisma.operation.findMany({
    where: { patientId },
    orderBy: [
      { date: 'desc' },
      { createdAt: 'desc' },
    ],
    take: limit,
  });

  return rows.map((o) => {
    const subtitleParts: string[] = [];
    if (o.date) subtitleParts.push(`Date: ${o.date.toISOString().slice(0, 10)}`);
    if (o.facility) subtitleParts.push(o.facility);
    if (o.surgeon) subtitleParts.push(`Surgeon: ${o.surgeon}`);

    const metaParts: string[] = [];
    if (o.coClinicians?.length) metaParts.push(`Assist: ${o.coClinicians.join(', ')}`);
    if (o.source) metaParts.push(`Source: ${o.source}`);

    return {
      id: o.id,
      date: (o.date ?? o.createdAt).toISOString(),
      label: o.title,
      subtitle: subtitleParts.join(' • ') || undefined,
      meta: metaParts.join(' | ') || undefined,
      status: 'Completed',
    };
  });
}

async function getMedications(patientId: string, limit: number): Promise<HistoryItem[]> {
  const rows = await prisma.medication.findMany({
    where: { patientId },
    orderBy: [{ createdAt: 'desc' }],
    take: limit,
  });

  return rows.map((m) => {
    const subtitleParts: string[] = [];
    if (m.dose) subtitleParts.push(m.dose);
    if (m.frequency) subtitleParts.push(m.frequency);
    if (m.route) subtitleParts.push(m.route);
    if (m.durationDays != null) subtitleParts.push(`${m.durationDays} days`);

    const metaParts: string[] = [];
    if (m.status) metaParts.push(`Status: ${m.status}`);
    if (m.source) metaParts.push(`Source: ${m.source}`);

    const date =
      m.started ??
      m.lastFilled ??
      m.createdAt;

    return {
      id: m.id,
      date: date.toISOString(),
      label: m.name,
      subtitle: subtitleParts.join(' • ') || undefined,
      meta: metaParts.join(' | ') || undefined,
      status: m.status || undefined,
    };
  });
}

async function getLabOrders(patientId: string, limit: number): Promise<HistoryItem[]> {
  const rows = await prisma.labOrder.findMany({
    where: { patientId },
    orderBy: [{ createdAt: 'desc' }],
    take: limit,
  });

  return rows.map((l) => {
    const subtitleParts: string[] = [];
    if (l.kind) subtitleParts.push(l.kind);
    if (l.clinicianId) subtitleParts.push(`Clinician: ${l.clinicianId}`);

    return {
      id: l.id,
      date: l.createdAt.toISOString(),
      label: l.panel,
      subtitle: subtitleParts.join(' • ') || undefined,
      meta: l.caseId ? `Case: ${l.caseId}` : undefined,
      status: 'Ordered',
    };
  });
}

async function getCases(patientId: string, limit: number): Promise<HistoryItem[]> {
  const rows = await prisma.encounter.findMany({
    where: { patientId },
    orderBy: [{ createdAt: 'desc' }],
    take: limit,
  });

  return rows.map((e) => {
    const subtitleParts: string[] = [];
    if (e.clinicianId) subtitleParts.push(`Clinician: ${e.clinicianId}`);
    if (e.status) subtitleParts.push(`Status: ${e.status}`);

    return {
      id: e.id,
      date: e.createdAt.toISOString(),
      label: e.caseId || `Encounter ${e.id.slice(0, 8)}`,
      subtitle: subtitleParts.join(' • ') || undefined,
      meta: e.orgId ? `Org: ${e.orgId}` : undefined,
      status: e.status || undefined,
    };
  });
}
