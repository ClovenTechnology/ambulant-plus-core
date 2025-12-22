// apps/api-gateway/app/api/cases/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

export const dynamic = 'force-dynamic';

function cors(json: any, status = 200) {
  return NextResponse.json(json, { status, headers: { 'access-control-allow-origin': '*' } });
}

// GET /api/cases?patientId=...
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams.get('patientId') || undefined;
  const where: any = p ? { patientId: p } : {};
  const rows = await prisma.case.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    include: {
      encounters: { select: { id: true, createdAt: true, updatedAt: true, status: true }, orderBy: { createdAt: 'desc' } },
    },
  });
  const data = rows.map(c => ({
    id: c.id,
    title: c.title,
    status: c.status,
    encounterCount: c.encounters.length,
    lastEncounterAt: c.encounters[0]?.updatedAt ?? c.updatedAt,
    updatedAt: c.updatedAt,
  }));
  return cors({ items: data });
}

// POST /api/cases
export async function POST(req: NextRequest) {
  const b = await req.json().catch(()=> ({}));
  const patientId = String(b.patientId || '');
  const title = String(b.title || 'Case');
  if (!patientId) return cors({ error: 'patientId_required' }, 400);

  const row = await prisma.case.create({ data: { patientId, title, status: 'open' } });
  return cors(row, 201);
}
