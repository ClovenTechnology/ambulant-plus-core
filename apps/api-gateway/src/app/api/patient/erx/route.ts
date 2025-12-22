// apps/api-gateway/app/api/patient/erx/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const patientId = url.searchParams.get('patientId');

  if (!patientId) {
    return NextResponse.json(
      { error: 'Missing patientId' },
      { status: 400 }
    );
  }

  const erx = await prisma.erxOrder.findMany({
    where: { patientId },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ erx });
}
