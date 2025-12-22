// apps/api-gateway/app/api/erx/[id]/pdf/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = params.id;

  const erx = await prisma.erxOrder.findUnique({
    where: { id },
  });

  if (!erx) {
    return NextResponse.json(
      { error: 'eRx not found' },
      { status: 404 }
    );
  }

  // TODO: replace this with real PDF generation
  const text = `
Ambulant+ ePrescription
-----------------------

ERX:    ${erx.id}
Drug:   ${erx.drug}
Sig:    ${erx.sig}
Enc:    ${erx.encounterId}
Patient:${ erx.patientId }
Clin:   ${ erx.clinicianId }
Date:   ${ erx.createdAt.toISOString() }
`.trim();

  const pdfPlaceholder = Buffer.from(text, 'utf-8');

  return new NextResponse(pdfPlaceholder, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${erx.id}.pdf"`,
    },
  });
}
