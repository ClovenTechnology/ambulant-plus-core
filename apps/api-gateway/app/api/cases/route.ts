// apps/api-gateway/app/api/cases/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

export const dynamic = 'force-dynamic';

function caseDelegate() {
  return (prisma as any).case ?? (prisma as any).clinicalCase ?? null;
}

function cleanStr(value: unknown, fallback = '') {
  const s = String(value ?? '').trim();
  return s || fallback;
}

export async function GET(req: NextRequest) {
  const delegate = caseDelegate();

  if (!delegate?.findMany) {
    return NextResponse.json({ cases: [] });
  }

  const q = req.nextUrl.searchParams;

  const where: Record<string, any> = {};

  const patientId = q.get('patientId') || q.get('patient_id');
  const clinicianId = q.get('clinicianId') || q.get('clinician_id');
  const status = q.get('status');

  if (patientId) where.patientId = patientId;
  if (clinicianId) where.clinicianId = clinicianId;
  if (status && status !== 'all') where.status = status;

  const rows = await delegate.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });

  return NextResponse.json({ cases: rows });
}

export async function POST(req: NextRequest) {
  const delegate = caseDelegate();

  if (!delegate?.create) {
    return NextResponse.json(
      { error: 'case_store_unavailable' },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => ({}));

  const patientId = cleanStr(body.patientId ?? body.patient_id);
  const clinicianId = cleanStr(body.clinicianId ?? body.clinician_id);

  if (!patientId) {
    return NextResponse.json({ error: 'patientId_required' }, { status: 400 });
  }

  const data: Record<string, any> = {
    patientId,
    status: cleanStr(body.status, 'open'),
  };

  if (clinicianId) data.clinicianId = clinicianId;
  if (body.title !== undefined) data.title = cleanStr(body.title, 'Clinical case');
  if (body.summary !== undefined) data.summary = cleanStr(body.summary);
  if (body.priority !== undefined) data.priority = cleanStr(body.priority);
  if (body.notes !== undefined) data.notes = cleanStr(body.notes);

  try {
    const created = await delegate.create({ data });

    return NextResponse.json(created, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'create_failed' },
      { status: 500 },
    );
  }
}