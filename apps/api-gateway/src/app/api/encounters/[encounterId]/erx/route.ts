// apps/api-gateway/app/api/encounters/[encounterId]/erx/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export async function POST(
  req: NextRequest,
  { params }: { params: { encounterId: string } }
) {
  const encounterId = params.encounterId;
  const body = await req.json().catch(() => ({}));

  const {
    sessionId,
    caseId,
    patientId,
    clinicianId,
    drug,
    sig,
    kind = 'erx',
  } = body as {
    sessionId: string;
    caseId: string;
    patientId: string;
    clinicianId: string;
    drug: string;
    sig: string;
    kind?: string;
  };

  if (!patientId || !clinicianId || !drug || !sig) {
    return NextResponse.json(
      { error: 'Missing required eRx fields' },
      { status: 400 }
    );
  }

  // ensure encounter exists (optional but recommended)
  const enc = await prisma.encounter.findUnique({
    where: { id: encounterId },
  });
  if (!enc) {
    return NextResponse.json(
      { error: 'Encounter not found' },
      { status: 404 }
    );
  }

  const erx = await prisma.erxOrder.create({
    data: {
      id: `ERX-${Date.now()}`, // or cuid(); keep externalId separately if you like
      kind,
      encounterId,
      sessionId,
      caseId,
      patientId,
      clinicianId,
      drug,
      sig,
    },
  });

  // TODO: emit RuntimeEvent or ML call if you want InsightCore to see new eRx.

  return NextResponse.json({ erx });
}
