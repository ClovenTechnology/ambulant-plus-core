// apps/api-gateway/app/api/medreach/bundles/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  MedReachCustodyAction,
  MedReachSpecimenStatus,
  MedReachStorageMode,
} from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import { emitEvent } from '@/src/lib/events';
import { push, sseKeys } from '@/src/lib/sse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SpecimenDraft = {
  specimenType?: string;
  containerType?: string | null;
  containerCount?: number | null;
  requiresColdChain?: boolean | null;
  requiredTempMinC?: number | null;
  requiredTempMaxC?: number | null;
  maxTransitMins?: number | null;
  storageMode?: string | null;
};

type Body = {
  orderId?: string;
  encounterId?: string;
  patientId?: string;
  clinicianId?: string;
  labPartnerId?: string;
  drawId?: string;
  specimens?: SpecimenDraft[];
  labelVersion?: number;
};

const ALLOWED_ROLES = new Set(['admin', 'phleb', 'lab', 'clinician']);
const READ_ALLOWED_ROLES = new Set(['admin', 'phleb', 'lab', 'clinician', 'patient']);

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanNullableString(value: unknown): string | null {
  const cleaned = cleanString(value);
  return cleaned || null;
}

function cleanPositiveInt(value: unknown, fallback = 1): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.trunc(n));
}

function cleanNullableNumber(value: unknown): number | null {
  if (value == null) return null;

  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function cleanNullableInt(value: unknown): number | null {
  const n = cleanNullableNumber(value);
  return n == null ? null : Math.trunc(n);
}

function normalizeStorageMode(value: unknown): MedReachStorageMode {
  const raw = cleanString(value).toUpperCase();

  if (
    raw === MedReachStorageMode.AMBIENT ||
    raw === MedReachStorageMode.COOLER_BAG ||
    raw === MedReachStorageMode.ICE_PACK ||
    raw === MedReachStorageMode.DRY_ICE ||
    raw === MedReachStorageMode.PROTECT_FROM_LIGHT ||
    raw === MedReachStorageMode.OTHER
  ) {
    return raw;
  }

  return MedReachStorageMode.AMBIENT;
}

function barcodeFor(bundleId: string, index: number) {
  return `MR-${bundleId.slice(-6).toUpperCase()}-${String(index + 1).padStart(2, '0')}`;
}

function normalizeSpecimens(
  value: unknown,
  labelVersion: number,
): Prisma.MedReachSpecimenCreateWithoutBundleInput[] {
  const specimens = Array.isArray(value) ? value : [];

  if (specimens.length === 0) {
    return [
      {
        specimenType: 'Blood',
        containerType: 'EDTA',
        containerCount: 1,
        barcodeValue: '',
        barcodeChecksum: null,
        labelVersion,
        requiresColdChain: false,
        requiredTempMinC: null,
        requiredTempMaxC: null,
        maxTransitMins: null,
        storageMode: MedReachStorageMode.AMBIENT,
        status: MedReachSpecimenStatus.PLANNED,
      },
    ];
  }

  return specimens.map((raw) => {
    const specimen = raw as SpecimenDraft;

    return {
      specimenType: cleanString(specimen.specimenType) || 'Blood',
      containerType: cleanNullableString(specimen.containerType),
      containerCount: cleanPositiveInt(specimen.containerCount, 1),
      barcodeValue: '',
      barcodeChecksum: null,
      labelVersion,
      requiresColdChain: Boolean(specimen.requiresColdChain),
      requiredTempMinC: cleanNullableNumber(specimen.requiredTempMinC),
      requiredTempMaxC: cleanNullableNumber(specimen.requiredTempMaxC),
      maxTransitMins: cleanNullableInt(specimen.maxTransitMins),
      storageMode: normalizeStorageMode(specimen.storageMode),
      status: MedReachSpecimenStatus.PLANNED,
    };
  });
}

export async function POST(req: NextRequest) {
  const who = readIdentity(req.headers);

  if (!ALLOWED_ROLES.has(String(who.role || '').toLowerCase())) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: Body;

  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const orderId = cleanString(body.orderId);
  const drawId = cleanNullableString(body.drawId);
  const labelVersion = cleanPositiveInt(body.labelVersion, 1);

  if (!orderId) {
    return NextResponse.json({ error: 'missing_orderId' }, { status: 400 });
  }

  const draw = drawId
    ? await prisma.draw.findUnique({ where: { id: drawId } })
    : await prisma.draw.findFirst({ where: { orderId } });

  const existing = await prisma.medReachSpecimenBundle.findFirst({
    where: {
      OR: [{ orderId }, ...(draw?.id ? [{ drawId: draw.id }] : [])],
    },
    include: {
      specimens: true,
    },
  });

  if (existing) {
    return NextResponse.json(existing);
  }

  const created = await prisma.medReachSpecimenBundle.create({
    data: {
      orderId,
      drawId: draw?.id ?? drawId,
      encounterId: cleanNullableString(body.encounterId) ?? draw?.encounterId ?? null,
      patientId: cleanNullableString(body.patientId) ?? draw?.patientId ?? null,
      clinicianId: cleanNullableString(body.clinicianId) ?? draw?.clinicianId ?? null,
      labPartnerId: cleanNullableString(body.labPartnerId) ?? draw?.partnerId ?? null,
      status: MedReachSpecimenStatus.PLANNED,
      labelPrintedAt: new Date(),
      specimens: {
        create: normalizeSpecimens(body.specimens, labelVersion),
      },
    },
    include: {
      specimens: true,
    },
  });

  for (let i = 0; i < created.specimens.length; i++) {
    const specimen = created.specimens[i];
    const barcodeValue = barcodeFor(created.id, i);

    await prisma.medReachSpecimen.update({
      where: { id: specimen.id },
      data: {
        barcodeValue,
        barcodeChecksum: `chk_${barcodeValue.length}_${i + 1}`,
      },
    });
  }

  const finalBundle = await prisma.medReachSpecimenBundle.findUnique({
    where: { id: created.id },
    include: { specimens: true },
  });

  await prisma.medReachCustodyEvent.create({
    data: {
      bundleId: created.id,
      action: MedReachCustodyAction.LABEL_PRINTED,
      actorId: who.uid ?? null,
      actorRole: who.role,
      correlationId: `bundle_${Date.now()}`,
      meta: {
        orderId,
        drawId: draw?.id ?? null,
      },
    },
  });

  await prisma.auditEvent.create({
    data: {
      kind: 'specimen_bundle_created',
      actorId: who.uid,
      actorRole: who.role,
      subjectId: orderId,
      meta: {
        bundleId: created.id,
        drawId: draw?.id ?? null,
      },
    },
  });

  if (draw) {
    emitEvent({
      kind: 'specimen_bundle_created',
      encounterId: draw.encounterId,
      patientId: draw.patientId,
      clinicianId: draw.clinicianId,
      payload: {
        orderId,
        drawId: draw.id,
        bundleId: created.id,
      },
      targets: {
        patientId: draw.patientId,
        clinicianId: draw.clinicianId,
        admin: true,
      },
    });
  }

  await push(sseKeys.bundle(created.id), {
    kind: 'specimen_bundle_created',
    bundleId: created.id,
    orderId,
    drawId: draw?.id ?? null,
    at: new Date().toISOString(),
  });

  return NextResponse.json(finalBundle);
}

export async function GET(req: NextRequest) {
  const who = readIdentity(req.headers);

  if (!READ_ALLOWED_ROLES.has(String(who.role || '').toLowerCase())) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const bundleId = cleanNullableString(searchParams.get('bundleId'));
  const orderId = cleanNullableString(searchParams.get('orderId'));

  if (bundleId) {
    const item = await prisma.medReachSpecimenBundle.findUnique({
      where: { id: bundleId },
      include: {
        specimens: {
          include: {
            temperatures: true,
            evidence: true,
          },
        },
        custody: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!item) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    return NextResponse.json(item);
  }

  if (orderId) {
    const item = await prisma.medReachSpecimenBundle.findFirst({
      where: { orderId },
      include: {
        specimens: {
          include: {
            temperatures: true,
            evidence: true,
          },
        },
        custody: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!item) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    return NextResponse.json(item);
  }

  const items = await prisma.medReachSpecimenBundle.findMany({
    take: 100,
    orderBy: { createdAt: 'desc' },
    include: {
      specimens: true,
    },
  });

  return NextResponse.json({ items });
}