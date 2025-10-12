import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rows = await prisma.encounter.findMany({ orderBy: { updatedAt: 'desc' } });
  return NextResponse.json(rows, { headers: { 'access-control-allow-origin': '*' } });
}

export async function POST(req: NextRequest) {
  const b = await req.json().catch(()=> ({}));
  const id = b.id ?? `enc-za-${Math.floor(100 + Math.random()*900)}`;
  const row = await prisma.encounter.create({
    data: {
      id,
      caseId: b.caseId ?? 'case-za-001',
      patientId: b.patientId ?? 'pt-za-001',
      clinicianId: b.clinicianId ?? 'clin-za-001',
      status: 'open'
    }
  });
  return NextResponse.json(row, { status: 201, headers: { 'access-control-allow-origin': '*' } });
}
