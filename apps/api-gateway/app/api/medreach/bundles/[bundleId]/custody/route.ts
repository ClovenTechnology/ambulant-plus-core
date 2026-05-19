// apps/api-gateway/app/api/medreach/bundles/[bundleId]/custody/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import { emitEvent } from '@/src/lib/events';
import { push, sseKeys } from '@/src/lib/sse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CustodyAction =
  | 'COLLECTED'
  | 'SEALED'
  | 'IN_TRANSIT'
  | 'ARRIVED_AT_LAB'
  | 'RECEIVED_SCAN'
  | 'ACCEPTED'
  | 'FLAGGED'
  | 'REJECTED'
  | 'DISPOSED';

type Body = {
  action?: string;
  specimenId?: string | null;
  actorId?: string | null;
  actorRole?: string | null;
  lat?: number | null;
  lng?: number | null;
  meta?: any;
  correlationId?: string | null;
};

const ALLOWED_ROLES = new Set(['admin', 'phleb', 'lab', 'clinician']);

const ALLOWED_ACTIONS = new Set<CustodyAction>([
  'COLLECTED',
  'SEALED',
  'IN_TRANSIT',
  'ARRIVED_AT_LAB',
  'RECEIVED_SCAN',
  'ACCEPTED',
  'FLAGGED',
  'REJECTED',
  'DISPOSED',
]);

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanNullableString(value: unknown): string | null {
  const cleaned = cleanString(value);
  return cleaned || null;
}

function cleanFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeAction(value: unknown): CustodyAction | null {
  const action = cleanString(value).toUpperCase();

  return ALLOWED_ACTIONS.has(action as CustodyAction)
    ? (action as CustodyAction)
    : null;
}

function safeJson(value: unknown) {
  try {
    return JSON.parse(JSON.stringify(value ?? null));
  } catch {
    return null;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { bundleId: string } },
) {
  const who = readIdentity(req.headers);

  if (!ALLOWED_ROLES.has(String(who.role || '').toLowerCase())) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const bundleId = cleanString(params.bundleId);

  if (!bundleId) {
    return NextResponse.json({ error: 'bundleId_required' }, { status: 400 });
  }

  let body: Body;

  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const action = normalizeAction(body.action);

  if (!action) {
    return NextResponse.json({ error: 'invalid_or_missing_action' }, { status: 400 });
  }

  const bundle = await prisma.medReachSpecimenBundle.findUnique({
    where: { id: bundleId },
    include: { specimens: true },
  });

  if (!bundle) {
    return NextResponse.json({ error: 'bundle_not_found' }, { status: 404 });
  }

  const specimenId = cleanNullableString(body.specimenId);
  const now = new Date();

  const event = await prisma.medReachCustodyEvent.create({
    data: {
      bundleId,
      specimenId,
      action: action as any,
      actorId: cleanNullableString(body.actorId) ?? who.uid ?? null,
      actorRole: cleanNullableString(body.actorRole) ?? who.role,
      lat: cleanFiniteNumber(body.lat),
      lng: cleanFiniteNumber(body.lng),
      meta: safeJson(body.meta),
      correlationId: cleanNullableString(body.correlationId) ?? `custody_${Date.now()}`,
    },
  });

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

    case 'ACCEPTED':
      patchBundle.status = 'ACCEPTED';
      patchBundle.acceptedAt = now;
      patchSpecimen.status = 'ACCEPTED';
      break;

    case 'FLAGGED':
      patchBundle.status = 'FLAGGED';
      patchSpecimen.status = 'FLAGGED';
      break;

    case 'REJECTED':
      patchBundle.status = 'REJECTED';
      patchBundle.rejectedAt = now;
      patchSpecimen.status = 'REJECTED';

      if (body.meta?.rejectionReason) {
        patchSpecimen.rejectionReason = String(body.meta.rejectionReason);
      }
      break;

    case 'DISPOSED':
      patchBundle.status = 'DISPOSED';
      patchSpecimen.status = 'DISPOSED';
      break;
  }

  if (Object.keys(patchBundle).length) {
    await prisma.medReachSpecimenBundle.update({
      where: { id: bundleId },
      data: {
        ...patchBundle,
        updatedAt: now,
      },
    });
  }

  if (specimenId && Object.keys(patchSpecimen).length) {
    await prisma.medReachSpecimen.update({
      where: { id: specimenId },
      data: {
        ...patchSpecimen,
        updatedAt: now,
      },
    });
  }

  await prisma.auditEvent.create({
    data: {
      kind: 'specimen_custody_event',
      actorId: who.uid,
      actorRole: who.role,
      subjectId: bundle.orderId ?? bundleId,
      meta: {
        bundleId,
        specimenId,
        action,
        correlationId: event.correlationId,
      },
    },
  });

  if (bundle.orderId || bundle.encounterId || bundle.patientId || bundle.clinicianId) {
    emitEvent({
      kind: 'specimen_custody_event',
      encounterId: bundle.encounterId ?? undefined,
      patientId: bundle.patientId ?? undefined,
      clinicianId: bundle.clinicianId ?? undefined,
      payload: {
        bundleId,
        orderId: bundle.orderId ?? null,
        specimenId,
        action,
      },
      targets: {
        patientId: bundle.patientId ?? undefined,
        clinicianId: bundle.clinicianId ?? undefined,
        admin: true,
      },
    });
  }

  await push(sseKeys.bundle(bundleId), {
    kind: 'specimen_custody_event',
    bundleId,
    orderId: bundle.orderId ?? null,
    specimenId,
    action,
    actorRole: cleanNullableString(body.actorRole) ?? who.role,
    at: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true, event });
}