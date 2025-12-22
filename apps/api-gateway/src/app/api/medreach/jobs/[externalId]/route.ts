// apps/api-gateway/app/api/medreach/jobs/[externalId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export async function GET(
  _req: NextRequest,
  { params }: { params: { externalId: string } }
) {
  const { externalId } = params;

  const job = await prisma.medReachJob.findUnique({
    where: { externalId },
    include: {
      lab: true, // LabPartner
    },
  });

  if (!job) {
    return NextResponse.json(
      { error: 'MedReach job not found' },
      { status: 404 }
    );
  }

  // Shape it to match patient-app's MedReachJob expectations (loose type)
  const payload = {
    id: job.externalId,
    status: job.status,
    eta: job.eta,
    patient: job.patientName,
    labOrderNo: job.externalId,
    // optional clinical linkage (wire up once you link Draw/Encounter)
    encounterId: undefined,
    patientId: undefined,
    clinicianId: undefined,
    caseId: undefined,
    sessionId: undefined,
    trackingNo: job.externalId,

    // phleb fields – you can later join a PhlebProfile table
    phlebId: job.phlebId,
    phlebName: undefined,
    phlebotomist: undefined,

    // basic address info for map fallbacks
    address: job.patientAddress,
    collectionWindow: job.windowLabel,

    // lab info
    labId: job.labId,
    labName: job.lab?.name,
    labAddress: job.lab?.contact,
  };

  return NextResponse.json(payload);
}
