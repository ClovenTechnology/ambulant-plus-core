import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import { push, sseKeys } from '@/src/lib/sse';

export const dynamic = 'force-dynamic';

type Body = {
  valueC: number;
  source?: 'MANUAL' | 'IOT_LOGGER' | 'TEMP_STRIP' | 'COOLER_SENSOR' | 'OTHER';
  note?: string;
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

  if (!Number.isFinite(body.valueC)) {
    return NextResponse.json({ error: 'invalid_valueC' }, { status: 400 });
  }

  const specimen = await prisma.medReachSpecimen.findUnique({
    where: { id: specimenId },
    include: { bundle: true },
  });

  if (!specimen) {
    return NextResponse.json({ error: 'specimen_not_found' }, { status: 404 });
  }

  const row = await prisma.medReachSpecimenTemperatureLog.create({
    data: {
      specimenId,
      valueC: body.valueC,
      source: body.source ?? 'MANUAL',
      note: body.note ?? null,
      correlationId: body.correlationId ?? `temp_${Date.now()}`,
    },
  });

  await prisma.auditEvent.create({
    data: {
      kind: 'specimen_temperature_logged',
      actorId: who.uid,
      actorRole: who.role,
      subjectId: specimen.bundle.orderId ?? specimenId,
      meta: {
        specimenId,
        bundleId: specimen.bundleId,
        valueC: body.valueC,
        source: body.source ?? 'MANUAL',
      },
    },
  });

  await push(sseKeys.bundle(specimen.bundleId), {
    kind: 'specimen_temperature_logged',
    bundleId: specimen.bundleId,
    specimenId,
    valueC: body.valueC,
    source: body.source ?? 'MANUAL',
    at: row.recordedAt.toISOString(),
  });

  return NextResponse.json(row);
}