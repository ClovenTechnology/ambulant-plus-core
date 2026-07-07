// apps/api-gateway/app/api/medreach/phlebs/[phlebId]/jobs/[jobId]/command/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import { emitEvent } from '@/src/lib/events';
import { push, sseKeys } from '@/src/lib/sse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PhlebCommand =
  | 'START_JOURNEY'
  | 'ARRIVED_PATIENT'
  | 'START_COLLECTION'
  | 'PRINT_LABEL'
  | 'SPECIMEN_COLLECTED'
  | 'SEAL_BUNDLE'
  | 'DEPART_TO_LAB'
  | 'ARRIVED_AT_LAB'
  | 'LAB_HANDOFF';

type Body = {
  action?: string;
  bundleId?: string | null;
  specimenId?: string | null;
  lat?: number | null;
  lng?: number | null;
  meta?: Record<string, unknown> | null;
  specimens?: Array<{
    specimenType?: string;
    containerType?: string | null;
    containerCount?: number | null;
    requiresColdChain?: boolean | null;
    requiredTempMinC?: number | null;
    requiredTempMaxC?: number | null;
    maxTransitMins?: number | null;
    storageMode?: string | null;
  }>;
};

const ALLOWED_ROLES = new Set(['admin', 'system', 'phleb']);

const ALLOWED_COMMANDS = new Set<PhlebCommand>([
  'START_JOURNEY',
  'ARRIVED_PATIENT',
  'START_COLLECTION',
  'PRINT_LABEL',
  'SPECIMEN_COLLECTED',
  'SEAL_BUNDLE',
  'DEPART_TO_LAB',
  'ARRIVED_AT_LAB',
  'LAB_HANDOFF',
]);

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function nullableString(value: unknown): string | null {
  const text = cleanString(value);
  return text || null;
}

function finiteNumber(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function safeJson(value: unknown) {
  try {
    return JSON.parse(JSON.stringify(value ?? null));
  } catch {
    return null;
  }
}

function normalizeCommand(value: unknown): PhlebCommand | null {
  const action = cleanString(value).toUpperCase();

  return ALLOWED_COMMANDS.has(action as PhlebCommand)
    ? (action as PhlebCommand)
    : null;
}

function drawStatusFor(action: PhlebCommand): string | null {
  switch (action) {
    case 'START_JOURNEY':
      return 'PHLEB_EN_ROUTE_TO_PATIENT';
    case 'ARRIVED_PATIENT':
      return 'PHLEB_ARRIVED';
    case 'START_COLLECTION':
    case 'SPECIMEN_COLLECTED':
    case 'SEAL_BUNDLE':
      return 'SAMPLING_IN_PROGRESS';
    case 'DEPART_TO_LAB':
      return 'PHLEB_EN_ROUTE_TO_LAB';
    case 'ARRIVED_AT_LAB':
    case 'LAB_HANDOFF':
      return 'DELIVERED_TO_LAB';
    case 'PRINT_LABEL':
    default:
      return null;
  }
}

function custodyActionFor(action: PhlebCommand): string | null {
  switch (action) {
    case 'SPECIMEN_COLLECTED':
      return 'COLLECTED';
    case 'SEAL_BUNDLE':
      return 'SEALED';
    case 'DEPART_TO_LAB':
      return 'IN_TRANSIT';
    case 'ARRIVED_AT_LAB':
      return 'ARRIVED_AT_LAB';
    case 'LAB_HANDOFF':
      return 'RECEIVED_SCAN';
    default:
      return null;
  }
}

function barcodeFor(bundleId: string, index: number) {
  return `MR-${bundleId.slice(-6).toUpperCase()}-${String(index + 1).padStart(2, '0')}`;
}

function normalizeSpecimens(value: Body['specimens']) {
  const rows = Array.isArray(value) && value.length > 0 ? value : [{}];

  return rows.map((raw) => ({
    specimenType: cleanString(raw.specimenType) || 'Blood',
    containerType: nullableString(raw.containerType) || 'EDTA',
    containerCount: Math.max(1, Math.trunc(Number(raw.containerCount || 1))),
    barcodeValue: '',
    barcodeChecksum: null,
    labelVersion: 1,
    requiresColdChain: Boolean(raw.requiresColdChain),
    requiredTempMinC: finiteNumber(raw.requiredTempMinC),
    requiredTempMaxC: finiteNumber(raw.requiredTempMaxC),
    maxTransitMins:
      raw.maxTransitMins == null ? null : Math.trunc(Number(raw.maxTransitMins)),
    storageMode: cleanString(raw.storageMode).toUpperCase() || 'AMBIENT',
    status: 'PLANNED',
  }));
}

async function findPhleb(phlebId: string) {
  return prisma.medReachPhlebProfile.findFirst({
    where: {
      OR: [{ id: phlebId }, { userId: phlebId }],
    },
  });
}

async function findDraw(jobId: string, possiblePhlebIds: string[], unrestricted: boolean) {
  const baseWhere: Record<string, any> = {
    OR: [{ id: jobId }, { orderId: jobId }],
  };

  if (!unrestricted) {
    baseWhere.phlebId = { in: possiblePhlebIds };
  }

  return prisma.draw.findFirst({
    where: baseWhere,
    orderBy: { createdAt: 'desc' },
  });
}

async function ensureBundle(draw: any, body: Body, action: PhlebCommand) {
  const explicitBundleId = nullableString(body.bundleId);

  if (explicitBundleId) {
    const existing = await prisma.medReachSpecimenBundle.findUnique({
      where: { id: explicitBundleId },
      include: { specimens: true },
    });

    if (existing) return existing;
  }

  const existing = await prisma.medReachSpecimenBundle.findFirst({
    where: {
      OR: [{ drawId: draw.id }, { orderId: draw.orderId }],
    },
    include: { specimens: true },
  });

  if (existing) return existing;

  const created = await prisma.medReachSpecimenBundle.create({
    data: {
      orderId: draw.orderId,
      drawId: draw.id,
      encounterId: draw.encounterId ?? null,
      patientId: draw.patientId ?? null,
      clinicianId: draw.clinicianId ?? null,
      labPartnerId: draw.partnerId ?? null,
      status: 'PLANNED' as any,
      labelPrintedAt: action === 'PRINT_LABEL' ? new Date() : null,
      specimens: {
        create: normalizeSpecimens(body.specimens) as any,
      },
    } as any,
    include: { specimens: true },
  });

  for (let i = 0; i < created.specimens.length; i += 1) {
    const specimen = created.specimens[i];
    const barcodeValue = barcodeFor(created.id, i);

    await prisma.medReachSpecimen.update({
      where: { id: specimen.id },
      data: {
        barcodeValue,
        barcodeChecksum: `chk_${barcodeValue.length}_${i + 1}`,
      } as any,
    });
  }

  return prisma.medReachSpecimenBundle.findUnique({
    where: { id: created.id },
    include: { specimens: true },
  });
}

async function applyCustodyPatch(params: {
  bundle: any;
  specimenId: string | null;
  action: string;
  now: Date;
  meta: any;
}) {
  const { bundle, specimenId, action, now, meta } = params;

  const patchBundle: Record<string, any> = {};
  const patchSpecimen: Record<string, any> = {};

  switch (action) {
    case 'COLLECTED':
      patchBundle.status = 'COLLECTED';
      patchBundle.collectedAt = now;
      patchSpecimen.status = 'COLLECTED';
      patchSpecimen.collectionTime = now;
      break;

    case 'SEALED':
      patchBundle.status = 'SEALED';
      patchBundle.sealedAt = now;
      patchSpecimen.status = 'SEALED';
      patchSpecimen.sealStatus = 'APPLIED';
      break;

    case 'IN_TRANSIT':
      patchBundle.status = 'IN_TRANSIT';
      patchBundle.inTransitAt = now;
      patchSpecimen.status = 'IN_TRANSIT';
      break;

    case 'ARRIVED_AT_LAB':
    case 'RECEIVED_SCAN':
      patchBundle.status = 'RECEIVED_AT_LAB';
      patchBundle.receivedAtLabAt = now;
      patchSpecimen.status = 'RECEIVED_AT_LAB';
      patchSpecimen.deliveredAtLabAt = now;
      break;
  }

  if (action === 'COLLECTED' && meta?.collectionNotes) {
    patchBundle.notes = String(meta.collectionNotes);
  }

  if (Object.keys(patchBundle).length > 0) {
    await prisma.medReachSpecimenBundle.update({
      where: { id: bundle.id },
      data: {
        ...patchBundle,
        updatedAt: now,
      } as any,
    });
  }

  if (specimenId && Object.keys(patchSpecimen).length > 0) {
    await prisma.medReachSpecimen.update({
      where: { id: specimenId },
      data: {
        ...patchSpecimen,
        updatedAt: now,
      } as any,
    });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { phlebId: string; jobId: string } },
) {
  const who = readIdentity(req.headers);
  const role = String(who.role || '').toLowerCase();

  if (!ALLOWED_ROLES.has(role)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const phlebId = cleanString(params.phlebId);
  const jobId = cleanString(params.jobId);

  if (!phlebId || !jobId) {
    return NextResponse.json(
      { ok: false, error: 'missing_phlebId_or_jobId' },
      { status: 400 },
    );
  }

  let body: Body;

  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const command = normalizeCommand(body.action);

  if (!command) {
    return NextResponse.json(
      { ok: false, error: 'invalid_or_missing_action' },
      { status: 400 },
    );
  }

  const phleb = await findPhleb(phlebId);
  const unrestricted = role === 'admin' || role === 'system';

  if (!phleb && !unrestricted) {
    return NextResponse.json({ ok: false, error: 'phleb_not_found' }, { status: 404 });
  }

  if (!unrestricted && who.uid && phleb?.userId !== who.uid && phlebId !== who.uid) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const possiblePhlebIds = Array.from(
    new Set([phleb?.id, phleb?.userId, phlebId].filter(Boolean).map(String)),
  );

  const draw = await findDraw(jobId, possiblePhlebIds, unrestricted);

  if (!draw) {
    return NextResponse.json({ ok: false, error: 'job_not_found' }, { status: 404 });
  }

  const now = new Date();
  const drawStatus = drawStatusFor(command);
  const custodyAction = custodyActionFor(command);
  const meta = safeJson(body.meta) || {};

  let updatedDraw = draw;

  if (drawStatus && draw.status !== drawStatus) {
    updatedDraw = await prisma.draw.update({
      where: { id: draw.id },
      data: {
        status: drawStatus,
        updatedAt: now,
        ...(drawStatus === 'DELIVERED_TO_LAB' ? { receivedByLabAt: now } : {}),
      } as any,
    });
  }

  let bundle: any = null;
  let custodyEvent: any = null;

  if (command === 'PRINT_LABEL' || custodyAction) {
    bundle = await ensureBundle(updatedDraw, body, command);

    if (command === 'PRINT_LABEL' && bundle) {
      await prisma.medReachCustodyEvent.create({
        data: {
          bundleId: bundle.id,
          action: 'LABEL_PRINTED' as any,
          actorId: who.uid ?? phleb?.userId ?? phlebId,
          actorRole: who.role ?? 'phleb',
          lat: finiteNumber(body.lat),
          lng: finiteNumber(body.lng),
          meta,
          correlationId: `phleb_command_${Date.now()}`,
        } as any,
      }).catch(() => null);

      await prisma.medReachSpecimenBundle.update({
        where: { id: bundle.id },
        data: {
          labelPrintedAt: bundle.labelPrintedAt ?? now,
          updatedAt: now,
        } as any,
      }).catch(() => null);
    }

    if (custodyAction && bundle) {
      const specimenId =
        nullableString(body.specimenId) ||
        bundle.specimens?.[0]?.id ||
        null;

      custodyEvent = await prisma.medReachCustodyEvent.create({
        data: {
          bundleId: bundle.id,
          specimenId,
          action: custodyAction as any,
          actorId: who.uid ?? phleb?.userId ?? phlebId,
          actorRole: who.role ?? 'phleb',
          lat: finiteNumber(body.lat),
          lng: finiteNumber(body.lng),
          meta,
          correlationId: `phleb_command_${Date.now()}`,
        } as any,
      });

      await applyCustodyPatch({
        bundle,
        specimenId,
        action: custodyAction,
        now,
        meta,
      });
    }

    bundle = await prisma.medReachSpecimenBundle.findUnique({
      where: { id: bundle.id },
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
  }

  await prisma.auditEvent.create({
    data: {
      kind: 'medreach_phleb_job_command',
      actorId: who.uid ?? phleb?.userId ?? phlebId,
      actorRole: who.role ?? 'phleb',
      subjectId: updatedDraw.orderId ?? updatedDraw.id,
      meta: {
        phlebProfileId: phleb?.id ?? null,
        phlebUserId: phleb?.userId ?? phlebId,
        drawId: updatedDraw.id,
        orderId: updatedDraw.orderId,
        command,
        drawStatus,
        custodyAction,
        bundleId: bundle?.id ?? null,
        specimenId: nullableString(body.specimenId) ?? null,
      },
    } as any,
  });

  emitEvent({
    kind: 'medreach_phleb_job_command',
    encounterId: updatedDraw.encounterId ?? undefined,
    patientId: updatedDraw.patientId ?? undefined,
    clinicianId: updatedDraw.clinicianId ?? undefined,
    payload: {
      command,
      drawId: updatedDraw.id,
      orderId: updatedDraw.orderId,
      phlebId,
      status: updatedDraw.status,
      bundleId: bundle?.id ?? null,
      custodyAction,
    },
    targets: {
      admin: true,
      patientId: updatedDraw.patientId ?? undefined,
      clinicianId: updatedDraw.clinicianId ?? undefined,
    },
  });

  const evt = {
    kind: 'medreach_phleb_job_command',
    at: now.toISOString(),
    command,
    drawId: updatedDraw.id,
    orderId: updatedDraw.orderId,
    phlebId,
    status: updatedDraw.status,
    bundleId: bundle?.id ?? null,
    custodyAction,
  };

  await Promise.allSettled([
    push(sseKeys.draw(updatedDraw.id), evt),
    push(sseKeys.order(updatedDraw.orderId), evt),
    bundle?.id ? push(sseKeys.bundle(bundle.id), evt) : Promise.resolve(),
    updatedDraw.partnerId ? push(sseKeys.lab(updatedDraw.partnerId), evt) : Promise.resolve(),
  ]);

  return NextResponse.json({
    ok: true,
    data: {
      draw: updatedDraw,
      bundle,
      custodyEvent,
    },
    meta: {
      action: command,
      drawStatus,
      custodyAction,
      at: now.toISOString(),
    },
  });
}