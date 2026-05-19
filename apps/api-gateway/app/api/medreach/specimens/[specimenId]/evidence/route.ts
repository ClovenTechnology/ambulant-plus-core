import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import { push, sseKeys } from '@/src/lib/sse';

export const dynamic = 'force-dynamic';

type Body = {
  kind: string;
  fileKey: string;
  fileMime?: string;
  fileName?: string;
  capturedBy?: string;
  actorRole?: string;
  correlationId?: string;
};

export async function POST(req: NextRequest, { params }: { params: { specimenId: string } }) {
  const who = readIdentity(req.headers);
  if (!['admin', 'phleb', 'lab'].includes(who.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const specimenId = params.specimenId;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!body.kind || !body.fileKey) {
    return NextResponse.json({ error: 'missing_kind_or_fileKey' }, { status: 400 });
  }

  const specimen = await prisma.medReachSpecimen.findUnique({
    where: { id: specimenId },
  });

  if (!specimen) {
    return NextResponse.json({ error: 'specimen_not_found' }, { status: 404 });
  }

  const row = await prisma.medReachSpecimenEvidence.create({
    data: {
      specimenId,
      kind: body.kind,
      fileKey: body.fileKey,
      fileMime: body.fileMime ?? null,
      fileName: body.fileName ?? null,
      capturedBy: body.capturedBy ?? who.uid ?? null,
      actorRole: body.actorRole ?? who.role,
      correlationId: body.correlationId ?? `evidence_${Date.now()}`,
    },
  });

  await prisma.auditEvent.create({
    data: {
      kind: 'specimen_evidence_uploaded',
      actorId: who.uid,
      actorRole: who.role,
      subjectId: specimenId,
      meta: {
        specimenId,
        bundleId: specimen.bundleId,
        kind: body.kind,
        fileKey: body.fileKey,
      },
    },
  });

  await push(sseKeys.bundle(specimen.bundleId), {
    kind: 'specimen_evidence_uploaded',
    bundleId: specimen.bundleId,
    specimenId,
    evidenceKind: body.kind,
    at: row.capturedAt.toISOString(),
  });

  return NextResponse.json(row);
}