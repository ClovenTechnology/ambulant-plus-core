import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import {
  readIdentity,
  requireAuthenticatedIdentity,
  requireTrustedIdentityInProduction,
  type Who,
} from '@/src/lib/identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EXCLUSION_REASONS = new Set([
  'INCORRECT_DEVICE_POSITION',
  'MOVEMENT_ARTIFACT',
  'INTERRUPTED_MEASUREMENT',
  'READING_APPEARS_INCORRECT',
  'WRONG_PERSON',
  'DUPLICATE_READING',
  'DEVICE_PROBLEM',
  'OTHER',
]);

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,PATCH,OPTIONS',
    'access-control-allow-headers':
      'content-type,authorization,cookie,x-uid,x-role,x-org-id,x-patient-id,x-ambulant-patient-id,x-ambulant-identity,x-request-id,x-correlation-id',
    'cache-control': 'no-store',
  };
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: corsHeaders() });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

function clean(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function authorizePatient(req: NextRequest, patientId: string): { who: Who | null; response: NextResponse | null } {
  const who = readIdentity(req.headers);

  try {
    requireTrustedIdentityInProduction(req.headers, who);
    requireAuthenticatedIdentity(who);
  } catch {
    return { who: null, response: json({ ok: false, error: 'unauthorized' }, 401) };
  }

  if (who.role !== 'patient') {
    return { who: null, response: json({ ok: false, error: 'patient_role_required' }, 403) };
  }

  const subjectPatientId = clean(who.actorRefId || who.uid, 180);
  if (!subjectPatientId || subjectPatientId !== patientId) {
    return { who: null, response: json({ ok: false, error: 'patient_subject_mismatch' }, 403) };
  }

  return { who, response: null };
}

function shapeSample(row: any) {
  return {
    id: row.id,
    observationId: row.observationId,
    patientId: row.patientId,
    deviceId: row.deviceId,
    type: row.vType,
    value: row.valueNum,
    unit: row.unit,
    recorded_at: row.t instanceof Date ? row.t.toISOString() : row.t,
    receivedAt: row.receivedAt instanceof Date ? row.receivedAt.toISOString() : row.receivedAt,
    timeAuthority: row.timeAuthority,
    interpretationStatus: row.interpretationStatus,
    statusChangedAt:
      row.statusChangedAt instanceof Date ? row.statusChangedAt.toISOString() : row.statusChangedAt,
    statusReasonCode: row.statusReasonCode,
    statusReasonText: row.statusReasonText,
  };
}

function shapeTrustEvent(row: any) {
  return {
    id: row.id,
    observationId: row.observationId,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    reasonCode: row.reasonCode,
    reasonText: row.reasonText,
    actorRole: row.actorRole,
    createdAt:
      row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  };
}

class TrustTransitionError extends Error {
  status: number;
  code: string;

  constructor(code: string, status: number) {
    super(code);
    this.name = 'TrustTransitionError';
    this.status = status;
    this.code = code;
  }
}

type RouteParams = {
  id: string;
  observationId: string;
};

export async function GET(
  req: NextRequest,
  { params }: { params: RouteParams },
) {
  const patientId = clean(params?.id, 180);
  const observationId = clean(params?.observationId, 180);

  if (!patientId || !observationId) {
    return json({ ok: false, error: 'patient_and_observation_required' }, 400);
  }

  const auth = authorizePatient(req, patientId);
  if (auth.response) return auth.response;

  const rows = await prisma.vitalSample.findMany({
    where: { patientId, observationId },
    orderBy: [{ t: 'desc' }, { id: 'asc' }],
  });

  if (!rows.length) {
    return json({ ok: false, error: 'observation_not_found' }, 404);
  }

  const events = await prisma.vitalSampleTrustEvent.findMany({
    where: { patientId, observationId },
    orderBy: { createdAt: 'desc' },
  });

  return json({
    ok: true,
    observationId,
    items: rows.map(shapeSample),
    trustEvents: events.map(shapeTrustEvent),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: RouteParams },
) {
  const patientId = clean(params?.id, 180);
  const observationId = clean(params?.observationId, 180);

  if (!patientId || !observationId) {
    return json({ ok: false, error: 'patient_and_observation_required' }, 400);
  }

  const auth = authorizePatient(req, patientId);
  if (auth.response || !auth.who) return auth.response || json({ ok: false, error: 'unauthorized' }, 401);
  const who = auth.who;

  const body = asRecord(await req.json().catch(() => ({})));
  const action = clean(body.action, 32).toLowerCase();
  const reasonCode = clean(body.reasonCode, 80).toUpperCase();
  const reasonText = clean(body.reasonText, 500) || null;

  if (action !== 'exclude' && action !== 'restore') {
    return json({ ok: false, error: 'unsupported_trust_action' }, 400);
  }

  if (action === 'exclude') {
    if (!EXCLUSION_REASONS.has(reasonCode)) {
      return json({ ok: false, error: 'valid_exclusion_reason_required' }, 400);
    }
    if (reasonCode === 'OTHER' && !reasonText) {
      return json({ ok: false, error: 'reason_text_required_for_other' }, 400);
    }
  }

  const now = new Date();
  const requestId =
    clean(req.headers.get('x-request-id') || req.headers.get('x-correlation-id'), 180) || null;
  const sessionId = who.sid || clean(req.headers.get('x-ambulant-session-id'), 180) || null;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const rows = await tx.vitalSample.findMany({
        where: { patientId, observationId },
        orderBy: { id: 'asc' },
      });

      if (!rows.length) {
        throw new TrustTransitionError('observation_not_found', 404);
      }

      if (action === 'exclude') {
        if (rows.every((row) => row.interpretationStatus === 'EXCLUDED')) {
          return { idempotent: true, rows };
        }

        if (rows.some((row) => row.interpretationStatus === 'EXCLUDED')) {
          throw new TrustTransitionError('observation_status_inconsistent', 409);
        }

        const updated = await tx.vitalSample.updateMany({
          where: {
            patientId,
            observationId,
            interpretationStatus: { in: ['ACTIVE', 'SUSPECT'] },
          },
          data: {
            interpretationStatus: 'EXCLUDED',
            statusChangedAt: now,
            statusChangedByUserId: who.uid,
            statusChangedByActorRefId: who.actorRefId ?? null,
            statusChangedByRole: who.role,
            statusReasonCode: reasonCode,
            statusReasonText: reasonText,
          },
        });

        if (updated.count !== rows.length) {
          throw new TrustTransitionError('observation_changed_concurrently', 409);
        }

        for (const row of rows) {
          await tx.vitalSampleTrustEvent.create({
            data: {
              vitalSampleId: row.id,
              observationId,
              patientId,
              fromStatus: row.interpretationStatus,
              toStatus: 'EXCLUDED',
              reasonCode,
              reasonText,
              actorUserId: who.uid,
              actorRefId: who.actorRefId ?? null,
              actorRole: who.role,
              sessionId,
              app: 'api-gateway',
              requestId,
              meta: {
                action: 'exclude',
                previousReasonCode: row.statusReasonCode ?? null,
                previousReasonText: row.statusReasonText ?? null,
              },
            },
          });
        }
      } else {
        if (rows.every((row) => row.interpretationStatus !== 'EXCLUDED')) {
          return { idempotent: true, rows };
        }

        if (rows.some((row) => row.interpretationStatus !== 'EXCLUDED')) {
          throw new TrustTransitionError('observation_status_inconsistent', 409);
        }

        const exclusionEvents = await tx.vitalSampleTrustEvent.findMany({
          where: {
            vitalSampleId: { in: rows.map((row) => row.id) },
            toStatus: 'EXCLUDED',
          },
          orderBy: { createdAt: 'desc' },
        });

        const latestExclusionBySample = new Map<string, (typeof exclusionEvents)[number]>();
        for (const event of exclusionEvents) {
          if (!latestExclusionBySample.has(event.vitalSampleId)) {
            latestExclusionBySample.set(event.vitalSampleId, event);
          }
        }

        for (const row of rows) {
          const exclusion = latestExclusionBySample.get(row.id);
          const previousStatus = exclusion?.fromStatus;

          if (previousStatus !== 'ACTIVE' && previousStatus !== 'SUSPECT') {
            throw new TrustTransitionError('restore_provenance_unavailable', 409);
          }

          const previousMeta = asRecord(exclusion?.meta);
          const restoredReasonCode =
            previousStatus === 'SUSPECT'
              ? clean(previousMeta.previousReasonCode, 120) || null
              : null;
          const restoredReasonText =
            previousStatus === 'SUSPECT'
              ? clean(previousMeta.previousReasonText, 500) || null
              : null;

          const updated = await tx.vitalSample.updateMany({
            where: {
              id: row.id,
              patientId,
              observationId,
              interpretationStatus: 'EXCLUDED',
            },
            data: {
              interpretationStatus: previousStatus,
              statusChangedAt: now,
              statusChangedByUserId: who.uid,
              statusChangedByActorRefId: who.actorRefId ?? null,
              statusChangedByRole: who.role,
              statusReasonCode: restoredReasonCode,
              statusReasonText: restoredReasonText,
            },
          });

          if (updated.count !== 1) {
            throw new TrustTransitionError('observation_changed_concurrently', 409);
          }

          await tx.vitalSampleTrustEvent.create({
            data: {
              vitalSampleId: row.id,
              observationId,
              patientId,
              fromStatus: 'EXCLUDED',
              toStatus: previousStatus,
              reasonCode: 'PATIENT_RESTORED',
              reasonText,
              actorUserId: who.uid,
              actorRefId: who.actorRefId ?? null,
              actorRole: who.role,
              sessionId,
              app: 'api-gateway',
              requestId,
              meta: {
                action: 'restore',
                restoredStatus: previousStatus,
              },
            },
          });
        }
      }

      const finalRows = await tx.vitalSample.findMany({
        where: { patientId, observationId },
        orderBy: { id: 'asc' },
      });

      return { idempotent: false, rows: finalRows };
    });

    return json({
      ok: true,
      action,
      observationId,
      idempotent: result.idempotent,
      items: result.rows.map(shapeSample),
    });
  } catch (error) {
    if (error instanceof TrustTransitionError) {
      return json({ ok: false, error: error.code }, error.status);
    }

    console.error('[vital-trust] transition failed', error);
    return json({ ok: false, error: 'vital_trust_transition_failed' }, 500);
  }
}
