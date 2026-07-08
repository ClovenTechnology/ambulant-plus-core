// apps/api-gateway/app/api/medreach/labs/orders/[orderId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import { emitEvent } from '@/src/lib/events';
import { push, sseKeys } from '@/src/lib/sse';
import {
  MEDREACH_DRAW_STATUSES,
  MEDREACH_ELIGIBILITY_STATUSES,
  MEDREACH_ORDER_STATUSES,
  MEDREACH_RESULT_STATUSES,
  isValidDrawStatus,
  isValidResultStatus,
} from '@shared/medreach';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type LabTestResultFlag =
  | 'LOW'
  | 'NORMAL'
  | 'HIGH'
  | 'ABNORMAL'
  | 'UNSPECIFIED';

type LabTestResult = {
  code: string;
  name: string;
  category?: string;
  sampleType?: string;
  value?: string;
  units?: string;
  referenceRange?: string;
  flag?: LabTestResultFlag;
  comments?: string;
};

type LabResultStatus = 'PENDING' | 'IN_PROGRESS' | 'READY' | 'SENT';

type PatchBody =
  | { action: 'accept'; labId?: string }
  | { action: 'decline'; labId?: string }
  | { action: 'updateStatus'; status: string }
  | { action: 'markReceivedAtLab'; receivedAtLabAt?: string }
  | { action: 'markAccepted'; acceptedAt?: string }
  | { action: 'markRejected'; rejectedAt?: string; rejectionReason?: string }
  | { action: 'linkSpecimenBundle'; specimenBundleId: string }
  | {
      action: 'updateResult';
      resultStatus: LabResultStatus;
      resultSummary?: string;
      resultPdfUrl?: string;
      testResults?: LabTestResult[];
    };

function safeJson<T = any>(v: unknown): T | null {
  try {
    return JSON.parse(JSON.stringify(v ?? null)) as T;
  } catch {
    return null;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function sanitizeTestResults(input?: LabTestResult[]): LabTestResult[] {
  if (!Array.isArray(input)) return [];

  return input.map((r) => ({
    code: String(r.code || '').trim(),
    name: String(r.name || '').trim(),
    category: r.category?.trim() || '',
    sampleType: r.sampleType?.trim() || '',
    value: r.value?.trim() || '',
    units: r.units?.trim() || '',
    referenceRange: r.referenceRange?.trim() || '',
    flag: r.flag || 'UNSPECIFIED',
    comments: r.comments?.trim() || '',
  }));
}

function toResultRows(
  orderId: string,
  encounterId: string,
  patientId: string,
  clinicianId: string | null | undefined,
  results: LabTestResult[],
) {
  return results.map((r) => ({
    orderId,
    encounterId,
    patientId,
    clinicianId: clinicianId ?? null,
    loincCode: r.code || null,
    name: r.name || r.code || 'Unnamed test',
    valueNum: r.value && !Number.isNaN(Number(r.value)) ? Number(r.value) : null,
    unit: r.units || null,
    flag: r.flag || null,
    isPositive: r.flag === 'ABNORMAL' ? true : null,
  }));
}

async function resolveActorLabId(req: NextRequest, who: any, explicitLabId?: string) {
  const role = String(who.role || '').toLowerCase();

  if (role === 'admin') {
    return explicitLabId || null;
  }

  if (role === 'lab') {
    const headerLabId = req.headers.get('x-lab-id') || '';
    if (!headerLabId) return null;

    const lab = await prisma.labPartner.findUnique({
      where: { id: headerLabId },
      select: { id: true, active: true, status: true, ownerUserId: true },
    });

    if (!lab || !lab.active || lab.status !== 'ACTIVE') return null;
    if (lab.ownerUserId && who.uid && lab.ownerUserId !== who.uid) return null;

    return lab.id;
  }

  if (role === 'lab_staff') {
    const headerLabId = req.headers.get('x-staff-lab-id') || '';
    if (!headerLabId || !who.uid) return null;

    const staff = await prisma.medReachLabStaff.findFirst({
      where: {
        userId: who.uid,
        labId: headerLabId,
        active: true,
        status: 'ACTIVE',
      },
      select: { labId: true },
    });

    return staff?.labId || null;
  }

  return null;
}

async function ensureMarketplaceEligibility(orderId: string, effectiveLabId: string) {
  if (!effectiveLabId) return false;

  const eligibility = await prisma.medReachOrderEligibleLab.findUnique({
    where: {
      orderId_labId: {
        orderId,
        labId: effectiveLabId,
      },
    },
    select: {
      status: true,
      lab: {
        select: {
          id: true,
          active: true,
          status: true,
        },
      },
    },
  });

  if (!eligibility) return false;

  return (
    eligibility.status === MEDREACH_ELIGIBILITY_STATUSES.ELIGIBLE &&
    !!eligibility.lab &&
    eligibility.lab.active === true &&
    eligibility.lab.status === 'ACTIVE'
  );
}

async function assertOrderAccess(params: {
  role: string;
  actorLabId: string | null;
  orderId: string;
  drawPartnerId: string | null;
}) {
  const { role, actorLabId, orderId, drawPartnerId } = params;

  if (role === 'admin') return true;
  if (!actorLabId) return false;

  if (drawPartnerId) {
    return drawPartnerId === actorLabId;
  }

  return ensureMarketplaceEligibility(orderId, actorLabId);
}

async function buildProjection(orderId: string) {
  const draw = await prisma.draw.findFirst({
    where: { orderId },
    orderBy: { createdAt: 'desc' },
  });

  if (!draw) return null;

  const [bundle, lab, latestResults, latestResultAudit, eligibilityRows] = await Promise.all([
    prisma.medReachSpecimenBundle.findFirst({
      where: {
        OR: [{ orderId }, { drawId: draw.id }],
      },
      orderBy: { updatedAt: 'desc' },
    }),
    draw.partnerId
      ? prisma.labPartner.findUnique({
          where: { id: draw.partnerId },
          select: { id: true, name: true },
        })
      : Promise.resolve(null),
    prisma.labResult.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.auditEvent.findFirst({
      where: {
        subjectId: orderId,
        kind: 'lab_result_updated',
      },
      orderBy: { at: 'desc' },
    }),
    prisma.medReachOrderEligibleLab.findMany({
      where: { orderId },
      select: {
        labId: true,
        status: true,
      },
      orderBy: { invitedAt: 'asc' },
    }),
  ]);

  const resultMeta = safeJson(latestResultAudit?.meta) as
    | {
        resultStatus?: LabResultStatus;
        resultSummary?: string | null;
        resultPdfUrl?: string | null;
        testResults?: LabTestResult[];
      }
    | null;

  const patientSnapshot = safeJson<any>((draw as any).patientSnapshot) || {};
  const testsSnapshot = safeJson<any>((draw as any).testsSnapshot) || {};

  const projectedTestResults: LabTestResult[] =
    Array.isArray(resultMeta?.testResults) && resultMeta.testResults.length > 0
      ? sanitizeTestResults(resultMeta.testResults)
      : latestResults.map((r) => ({
          code: r.loincCode || '',
          name: r.name || 'Unnamed test',
          value: r.valueNum != null ? String(r.valueNum) : '',
          units: r.unit || '',
          flag: (r.flag as LabTestResultFlag | null) || 'UNSPECIFIED',
        }));

  const tests =
    Array.isArray(testsSnapshot?.tests) && testsSnapshot.tests.length > 0
      ? testsSnapshot.tests.map((t: any) => ({
          code: String(t?.code || t?.name || '').trim(),
          name: String(t?.name || t?.code || 'Unnamed test').trim(),
        }))
      : projectedTestResults.map((r) => ({
          code: r.code || r.name,
          name: r.name || r.code || 'Unnamed test',
        }));

  return {
    id: orderId,
    displayId: orderId,
    labId: draw.partnerId,
    eligibleLabs: eligibilityRows
      .filter((r) => r.status === 'ELIGIBLE' || r.status === 'ACCEPTED')
      .map((r) => r.labId),
    declinedByLabs: eligibilityRows
      .filter((r) => r.status === 'DECLINED')
      .map((r) => r.labId),
    status: draw.status,
    resultStatus:
      (String(resultMeta?.resultStatus || '').toUpperCase() as LabResultStatus) || 'PENDING',
    resultSummary: resultMeta?.resultSummary || undefined,
    resultPdfUrl: resultMeta?.resultPdfUrl || undefined,
    testResults: projectedTestResults,
    patientId: draw.patientId,
    encounterId: draw.encounterId,
    patientName: patientSnapshot?.patientName || '',
    patientDob: patientSnapshot?.patientDob || '',
    patientGender: patientSnapshot?.patientGender || undefined,
    patientIdentifier: patientSnapshot?.patientIdentifier || undefined,
    patientAddress: patientSnapshot?.patientAddress || '',
    patientArea: patientSnapshot?.patientArea || '',
    labNameHint: lab?.name || undefined,
    phlebId: draw.phlebId || undefined,
    tests,
    createdAt: draw.createdAt.toISOString(),
    collectionTime: bundle?.collectedAt?.toISOString(),
    deliveredToLabAt: bundle?.inTransitAt?.toISOString(),
    receivedAtLabAt: bundle?.receivedAtLabAt?.toISOString(),
    acceptedAt: bundle?.acceptedAt?.toISOString(),
    rejectedAt: bundle?.rejectedAt?.toISOString(),
    specimenBundleId: bundle?.id,
  };
}

function buildEnvelope(params: {
  order: any;
  warning?: string | null;
  action: string;
  actorRole: string;
  actorId: string | null | undefined;
  actorLabId: string | null;
}) {
  return {
    ok: true,
    data: params.order,
    warning: params.warning ?? null,
    meta: {
      orderId: params.order.id,
      action: params.action,
      actorRole: params.actorRole,
      actorId: params.actorId ?? null,
      actorLabId: params.actorLabId ?? null,
      at: nowIso(),
    },
  };
}


export async function GET(
  req: NextRequest,
  { params }: { params: { orderId: string } },
) {
  const who = readIdentity(req.headers);
  const orderId = String(params.orderId || '').trim();

  if (!orderId) {
    return NextResponse.json({ ok: false, error: 'missing_orderId' }, { status: 400 });
  }

  const order = await buildProjection(orderId);

  if (!order) {
    return NextResponse.json({ ok: false, error: 'order_not_found' }, { status: 404 });
  }

  const role = String(who.role || '').toLowerCase();
  const uid = String(who.uid || '').trim();

  let allowed = false;

  if (['admin', 'system'].includes(role)) {
    allowed = true;
  } else if (role === 'patient') {
    let profileId = '';

    if (uid) {
      try {
        const profile = await prisma.patientProfile.findUnique({
          where: { userId: uid },
          select: { id: true },
        });

        profileId = profile?.id || '';
      } catch {
        profileId = '';
      }
    }

    const patientIds = Array.from(
      new Set(
        [
          uid,
          profileId,
          req.headers.get('x-patient-id'),
          req.headers.get('x-current-patient-id'),
          req.headers.get('x-actor-ref-id'),
          req.headers.get('x-ambulant-patient-id'),
        ]
          .map((value) => String(value || '').trim())
          .filter(Boolean),
      ),
    );

    allowed = Boolean(order.patientId && patientIds.includes(String(order.patientId)));
  } else if (role === 'lab' || role === 'lab_staff') {
    const actorLabId = await resolveActorLabId(req, who);

    allowed = Boolean(
      actorLabId &&
        (await assertOrderAccess({
          role,
          actorLabId,
          orderId,
          drawPartnerId: order.labId ?? null,
        })),
    );
  } else if (role === 'phleb') {
    allowed = Boolean(uid && order.phlebId && String(order.phlebId) === uid);
  }

  if (!allowed) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  return NextResponse.json({
    ok: true,
    data: order,
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { orderId: string } },
) {
  const who = readIdentity(req.headers);
  const orderId = params.orderId;
  const role = String(who.role || '').toLowerCase();

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const draw = await prisma.draw.findFirst({
    where: { orderId },
    orderBy: { createdAt: 'desc' },
  });

  if (!draw) {
    return NextResponse.json(
      { ok: false, error: 'draw_not_found_for_order' },
      { status: 404 },
    );
  }

  const actorLabId = await resolveActorLabId(req, who, (body as any)?.labId);
  const now = new Date();

  switch (body.action) {
    case 'accept': {
      if (!['admin', 'lab', 'lab_staff'].includes(role)) {
        return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
      }

      if (!actorLabId) {
        return NextResponse.json({ ok: false, error: 'missing_lab_id' }, { status: 400 });
      }

      const allowed = await assertOrderAccess({
        role,
        actorLabId,
        orderId,
        drawPartnerId: draw.partnerId ?? null,
      });

      if (!allowed) {
        return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
      }

      if (draw.partnerId && draw.partnerId !== actorLabId) {
        return NextResponse.json(
          { ok: false, error: 'order_already_assigned_to_other_lab' },
          { status: 409 },
        );
      }

      await prisma.$transaction(async (tx) => {
        const row = await tx.medReachOrderEligibleLab.findUnique({
          where: {
            orderId_labId: {
              orderId,
              labId: actorLabId,
            },
          },
        });

        if (!row || row.status !== MEDREACH_ELIGIBILITY_STATUSES.ELIGIBLE) {
          throw new Error('lab_not_eligible_for_accept');
        }

        await tx.draw.update({
          where: { id: draw.id },
          data: {
            partnerId: actorLabId,
            status: MEDREACH_ORDER_STATUSES.ASSIGNED,
            assignedAt: now,
            updatedAt: now,
          },
        });

        await tx.medReachOrderEligibleLab.update({
          where: {
            orderId_labId: {
              orderId,
              labId: actorLabId,
            },
          },
          data: {
            status: MEDREACH_ELIGIBILITY_STATUSES.ACCEPTED,
            respondedAt: now,
            respondedByUserId: who.uid ?? null,
            responseActorRole: who.role ?? null,
            acceptedAt: now,
          },
        });

        await tx.medReachOrderEligibleLab.updateMany({
          where: {
            orderId,
            labId: { not: actorLabId },
            status: MEDREACH_ELIGIBILITY_STATUSES.ELIGIBLE,
          },
          data: {
            status: MEDREACH_ELIGIBILITY_STATUSES.EXPIRED,
            respondedAt: now,
            respondedByUserId: who.uid ?? null,
            responseActorRole: who.role ?? null,
            expiredAt: now,
          },
        });

        await tx.auditEvent.create({
          data: {
            kind: 'lab_order_accepted',
            actorId: who.uid,
            actorRole: who.role,
            subjectId: orderId,
            meta: { labId: actorLabId, drawId: draw.id },
          },
        });
      });

      emitEvent({
        kind: 'lab_order_accepted',
        encounterId: draw.encounterId,
        patientId: draw.patientId,
        clinicianId: draw.clinicianId,
        payload: { orderId, drawId: draw.id, labId: actorLabId },
        targets: {
          patientId: draw.patientId,
          clinicianId: draw.clinicianId,
          admin: true,
        },
      });

      const evt = {
        kind: 'lab_order_accepted',
        orderId,
        drawId: draw.id,
        labId: actorLabId,
        at: now.toISOString(),
      };

      await Promise.allSettled([
        push(sseKeys.order(orderId), evt),
        push(sseKeys.draw(draw.id), evt),
        push(sseKeys.lab(actorLabId), evt),
      ]);

      const order = await buildProjection(orderId);
      if (!order) {
        return NextResponse.json({ ok: false, error: 'projection_failed' }, { status: 500 });
      }

      return NextResponse.json(
        buildEnvelope({
          order,
          warning: null,
          action: 'accept',
          actorRole: role,
          actorId: who.uid,
          actorLabId,
        }),
      );
    }

    case 'decline': {
      if (!['admin', 'lab', 'lab_staff'].includes(role)) {
        return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
      }

      if (!actorLabId) {
        return NextResponse.json({ ok: false, error: 'missing_lab_id' }, { status: 400 });
      }

      if (draw.partnerId) {
        return NextResponse.json(
          { ok: false, error: 'assigned_order_cannot_be_declined' },
          { status: 409 },
        );
      }

      const allowed = await assertOrderAccess({
        role,
        actorLabId,
        orderId,
        drawPartnerId: draw.partnerId ?? null,
      });

      if (!allowed) {
        return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
      }

      let exhausted = false;

      await prisma.$transaction(async (tx) => {
        const row = await tx.medReachOrderEligibleLab.findUnique({
          where: {
            orderId_labId: {
              orderId,
              labId: actorLabId,
            },
          },
        });

        if (!row || row.status !== MEDREACH_ELIGIBILITY_STATUSES.ELIGIBLE) {
          throw new Error('lab_not_eligible_for_decline');
        }

        await tx.medReachOrderEligibleLab.update({
          where: {
            orderId_labId: {
              orderId,
              labId: actorLabId,
            },
          },
          data: {
            status: MEDREACH_ELIGIBILITY_STATUSES.DECLINED,
            respondedAt: now,
            respondedByUserId: who.uid ?? null,
            responseActorRole: who.role ?? null,
            declinedAt: now,
          },
        });

        const remainingEligible = await tx.medReachOrderEligibleLab.count({
          where: {
            orderId,
            status: MEDREACH_ELIGIBILITY_STATUSES.ELIGIBLE,
          },
        });

        if (remainingEligible === 0) {
          exhausted = true;
          await tx.draw.update({
            where: { id: draw.id },
            data: {
              status: MEDREACH_ORDER_STATUSES.MARKETPLACE_EXHAUSTED,
              updatedAt: now,
            },
          });
        }

        await tx.auditEvent.create({
          data: {
            kind: 'lab_order_declined',
            actorId: who.uid,
            actorRole: who.role,
            subjectId: orderId,
            meta: { labId: actorLabId, drawId: draw.id, exhausted },
          },
        });
      });

      emitEvent({
        kind: 'lab_order_declined',
        encounterId: draw.encounterId,
        patientId: draw.patientId,
        clinicianId: draw.clinicianId,
        payload: { orderId, drawId: draw.id, labId: actorLabId, exhausted },
        targets: {
          patientId: draw.patientId,
          clinicianId: draw.clinicianId,
          admin: true,
        },
      });

      const evt = {
        kind: 'lab_order_declined',
        orderId,
        drawId: draw.id,
        labId: actorLabId,
        exhausted,
        at: now.toISOString(),
      };

      await Promise.allSettled([
        push(sseKeys.order(orderId), evt),
        push(sseKeys.draw(draw.id), evt),
        push(sseKeys.lab(actorLabId), evt),
      ]);

      const order = await buildProjection(orderId);
      if (!order) {
        return NextResponse.json({ ok: false, error: 'projection_failed' }, { status: 500 });
      }

      return NextResponse.json(
        buildEnvelope({
          order,
          warning: exhausted ? 'No eligible labs remain for this order.' : null,
          action: 'decline',
          actorRole: role,
          actorId: who.uid,
          actorLabId,
        }),
      );
    }

    case 'updateStatus': {
      if (!['admin', 'lab', 'lab_staff', 'phleb'].includes(role)) {
        return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
      }

      if (!isValidDrawStatus(body.status)) {
        return NextResponse.json({ ok: false, error: 'invalid_draw_status' }, { status: 400 });
      }

      if (role !== 'phleb') {
        const allowed = await assertOrderAccess({
          role,
          actorLabId,
          orderId,
          drawPartnerId: draw.partnerId ?? null,
        });

        if (!allowed) {
          return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
        }
      } else if (draw.phlebId && draw.phlebId !== who.uid) {
        return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
      }

      const patch: any = {
        status: body.status,
        updatedAt: now,
      };

      if (body.status === MEDREACH_DRAW_STATUSES.SPECIMEN_COLLECTED) {
        patch.specimenCollectedAt = now;
      }

      if (body.status === MEDREACH_DRAW_STATUSES.RECEIVED_AT_LAB) {
        patch.receivedByLabAt = now;
      }

      await prisma.draw.update({
        where: { id: draw.id },
        data: patch,
      });

      await prisma.auditEvent.create({
        data: {
          kind: 'draw_status_updated',
          actorId: who.uid,
          actorRole: who.role,
          subjectId: orderId,
          meta: { drawId: draw.id, status: body.status },
        },
      });

      const payload = {
        kind: 'draw_status_updated',
        orderId,
        drawId: draw.id,
        status: body.status,
        at: now.toISOString(),
      };

      await Promise.allSettled([
        push(sseKeys.order(orderId), payload),
        push(sseKeys.draw(draw.id), payload),
        ...(actorLabId ? [push(sseKeys.lab(actorLabId), payload)] : []),
      ]);

      const order = await buildProjection(orderId);
      if (!order) {
        return NextResponse.json({ ok: false, error: 'projection_failed' }, { status: 500 });
      }

      return NextResponse.json(
        buildEnvelope({
          order,
          warning: null,
          action: 'updateStatus',
          actorRole: role,
          actorId: who.uid,
          actorLabId,
        }),
      );
    }

    case 'markReceivedAtLab': {
      if (!['admin', 'lab', 'lab_staff'].includes(role)) {
        return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
      }

      const allowed = await assertOrderAccess({
        role,
        actorLabId,
        orderId,
        drawPartnerId: draw.partnerId ?? null,
      });

      if (!allowed) {
        return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
      }

      const receivedAt = body.receivedAtLabAt ? new Date(body.receivedAtLabAt) : now;

      await prisma.draw.update({
        where: { id: draw.id },
        data: {
          status: MEDREACH_ORDER_STATUSES.RECEIVED_AT_LAB,
          receivedByLabAt: receivedAt,
          updatedAt: now,
        },
      });

      await prisma.auditEvent.create({
        data: {
          kind: 'specimen_received_at_lab',
          actorId: who.uid,
          actorRole: who.role,
          subjectId: orderId,
          meta: { drawId: draw.id, receivedAtLabAt: receivedAt.toISOString() },
        },
      });

      const bundle = await prisma.medReachSpecimenBundle.findFirst({
        where: { OR: [{ orderId }, { drawId: draw.id }] },
      });

      if (bundle) {
        await prisma.medReachSpecimenBundle.update({
          where: { id: bundle.id },
          data: {
            status: 'RECEIVED_AT_LAB',
            receivedAtLabAt: receivedAt,
            updatedAt: now,
          },
        });

        await prisma.medReachCustodyEvent.create({
          data: {
            bundleId: bundle.id,
            action: 'RECEIVED_SCAN',
            actorId: who.uid ?? null,
            actorRole: who.role,
            correlationId: `recv_${Date.now()}`,
            meta: { orderId, drawId: draw.id },
          },
        });

        await push(sseKeys.bundle(bundle.id), {
          kind: 'specimen_received_at_lab',
          bundleId: bundle.id,
          orderId,
          drawId: draw.id,
          receivedAtLabAt: receivedAt.toISOString(),
          at: now.toISOString(),
        });
      }

      await Promise.allSettled([
        push(sseKeys.order(orderId), {
          kind: 'specimen_received_at_lab',
          orderId,
          drawId: draw.id,
          receivedAtLabAt: receivedAt.toISOString(),
          at: now.toISOString(),
        }),
        push(sseKeys.draw(draw.id), {
          kind: 'specimen_received_at_lab',
          orderId,
          drawId: draw.id,
          receivedAtLabAt: receivedAt.toISOString(),
          at: now.toISOString(),
        }),
      ]);

      const order = await buildProjection(orderId);
      if (!order) {
        return NextResponse.json({ ok: false, error: 'projection_failed' }, { status: 500 });
      }

      return NextResponse.json(
        buildEnvelope({
          order,
          warning: null,
          action: 'markReceivedAtLab',
          actorRole: role,
          actorId: who.uid,
          actorLabId,
        }),
      );
    }

    case 'markAccepted': {
      if (!['admin', 'lab', 'lab_staff'].includes(role)) {
        return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
      }

      const allowed = await assertOrderAccess({
        role,
        actorLabId,
        orderId,
        drawPartnerId: draw.partnerId ?? null,
      });

      if (!allowed) {
        return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
      }

      const acceptedAt = body.acceptedAt ? new Date(body.acceptedAt) : now;

      const bundle = await prisma.medReachSpecimenBundle.findFirst({
        where: { OR: [{ orderId }, { drawId: draw.id }] },
      });

      if (bundle) {
        await prisma.medReachSpecimenBundle.update({
          where: { id: bundle.id },
          data: {
            status: 'ACCEPTED',
            acceptedAt,
            receivedAtLabAt: bundle.receivedAtLabAt ?? acceptedAt,
            updatedAt: now,
          },
        });

        await prisma.medReachCustodyEvent.create({
          data: {
            bundleId: bundle.id,
            action: 'ACCEPTED',
            actorId: who.uid ?? null,
            actorRole: who.role,
            correlationId: `accept_${Date.now()}`,
            meta: { orderId, drawId: draw.id },
          },
        });

        await push(sseKeys.bundle(bundle.id), {
          kind: 'specimen_accepted',
          bundleId: bundle.id,
          orderId,
          drawId: draw.id,
          acceptedAt: acceptedAt.toISOString(),
          at: now.toISOString(),
        });
      }

      await prisma.auditEvent.create({
        data: {
          kind: 'specimen_accepted',
          actorId: who.uid,
          actorRole: who.role,
          subjectId: orderId,
          meta: { drawId: draw.id, acceptedAt: acceptedAt.toISOString() },
        },
      });

      const order = await buildProjection(orderId);
      if (!order) {
        return NextResponse.json({ ok: false, error: 'projection_failed' }, { status: 500 });
      }

      return NextResponse.json(
        buildEnvelope({
          order,
          warning: null,
          action: 'markAccepted',
          actorRole: role,
          actorId: who.uid,
          actorLabId,
        }),
      );
    }

    case 'markRejected': {
      if (!['admin', 'lab', 'lab_staff'].includes(role)) {
        return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
      }

      const allowed = await assertOrderAccess({
        role,
        actorLabId,
        orderId,
        drawPartnerId: draw.partnerId ?? null,
      });

      if (!allowed) {
        return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
      }

      const rejectedAt = body.rejectedAt ? new Date(body.rejectedAt) : now;

      const bundle = await prisma.medReachSpecimenBundle.findFirst({
        where: { OR: [{ orderId }, { drawId: draw.id }] },
      });

      if (bundle) {
        await prisma.medReachSpecimenBundle.update({
          where: { id: bundle.id },
          data: {
            status: 'REJECTED',
            rejectedAt,
            updatedAt: now,
          },
        });

        await prisma.medReachCustodyEvent.create({
          data: {
            bundleId: bundle.id,
            action: 'REJECTED',
            actorId: who.uid ?? null,
            actorRole: who.role,
            correlationId: `reject_${Date.now()}`,
            meta: {
              orderId,
              drawId: draw.id,
              rejectionReason: body.rejectionReason ?? null,
            },
          },
        });

        await push(sseKeys.bundle(bundle.id), {
          kind: 'specimen_rejected',
          bundleId: bundle.id,
          orderId,
          drawId: draw.id,
          rejectedAt: rejectedAt.toISOString(),
          rejectionReason: body.rejectionReason ?? null,
          at: now.toISOString(),
        });
      }

      await prisma.auditEvent.create({
        data: {
          kind: 'specimen_rejected',
          actorId: who.uid,
          actorRole: who.role,
          subjectId: orderId,
          meta: {
            drawId: draw.id,
            rejectedAt: rejectedAt.toISOString(),
            rejectionReason: body.rejectionReason ?? null,
          },
        },
      });

      emitEvent({
        kind: 'specimen_rejected',
        encounterId: draw.encounterId,
        patientId: draw.patientId,
        clinicianId: draw.clinicianId,
        payload: {
          orderId,
          drawId: draw.id,
          rejectionReason: body.rejectionReason ?? null,
        },
        targets: {
          patientId: draw.patientId,
          clinicianId: draw.clinicianId,
          admin: true,
        },
      });

      const order = await buildProjection(orderId);
      if (!order) {
        return NextResponse.json({ ok: false, error: 'projection_failed' }, { status: 500 });
      }

      return NextResponse.json(
        buildEnvelope({
          order,
          warning: null,
          action: 'markRejected',
          actorRole: role,
          actorId: who.uid,
          actorLabId,
        }),
      );
    }

    case 'linkSpecimenBundle': {
      if (!['admin', 'lab', 'lab_staff'].includes(role)) {
        return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
      }

      const allowed = await assertOrderAccess({
        role,
        actorLabId,
        orderId,
        drawPartnerId: draw.partnerId ?? null,
      });

      if (!allowed) {
        return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
      }

      const bundle = await prisma.medReachSpecimenBundle.findUnique({
        where: { id: body.specimenBundleId },
      });

      if (!bundle) {
        return NextResponse.json({ ok: false, error: 'bundle_not_found' }, { status: 404 });
      }

      await prisma.medReachSpecimenBundle.update({
        where: { id: bundle.id },
        data: {
          orderId,
          drawId: draw.id,
          encounterId: bundle.encounterId ?? draw.encounterId,
          patientId: bundle.patientId ?? draw.patientId,
          clinicianId: bundle.clinicianId ?? draw.clinicianId,
          labPartnerId: bundle.labPartnerId ?? draw.partnerId,
          updatedAt: now,
        },
      });

      await prisma.auditEvent.create({
        data: {
          kind: 'specimen_bundle_linked',
          actorId: who.uid,
          actorRole: who.role,
          subjectId: orderId,
          meta: { drawId: draw.id, bundleId: bundle.id },
        },
      });

      const order = await buildProjection(orderId);
      if (!order) {
        return NextResponse.json({ ok: false, error: 'projection_failed' }, { status: 500 });
      }

      return NextResponse.json(
        buildEnvelope({
          order,
          warning: null,
          action: 'linkSpecimenBundle',
          actorRole: role,
          actorId: who.uid,
          actorLabId,
        }),
      );
    }

    case 'updateResult': {
      if (!['admin', 'lab', 'lab_staff'].includes(role)) {
        return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
      }

      const allowed = await assertOrderAccess({
        role,
        actorLabId,
        orderId,
        drawPartnerId: draw.partnerId ?? null,
      });

      if (!allowed) {
        return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
      }

      if (!isValidResultStatus(body.resultStatus)) {
        return NextResponse.json({ ok: false, error: 'invalid_result_status' }, { status: 400 });
      }

      const sanitized = sanitizeTestResults(body.testResults);
      const resultRows = sanitized.length
        ? toResultRows(orderId, draw.encounterId, draw.patientId, draw.clinicianId, sanitized)
        : [];

      await prisma.$transaction(async (tx) => {
        if (resultRows.length) {
          await tx.labResult.deleteMany({ where: { orderId } });
          await tx.labResult.createMany({ data: resultRows });
        }

        await tx.auditEvent.create({
          data: {
            kind: 'lab_result_updated',
            actorId: who.uid,
            actorRole: who.role,
            subjectId: orderId,
            meta: {
              drawId: draw.id,
              resultStatus: body.resultStatus,
              resultSummary: body.resultSummary ?? null,
              resultPdfUrl: body.resultPdfUrl ?? null,
              testResults: safeJson(sanitized),
            },
          },
        });

        if (body.resultStatus === MEDREACH_RESULT_STATUSES.READY) {
          await tx.draw.update({
            where: { id: draw.id },
            data: {
              status: MEDREACH_ORDER_STATUSES.RESULT_READY,
              updatedAt: now,
            },
          });
        }
      });

      const bundle = await prisma.medReachSpecimenBundle.findFirst({
        where: { OR: [{ orderId }, { drawId: draw.id }] },
      });

      if (bundle && body.resultStatus === MEDREACH_RESULT_STATUSES.READY) {
        await prisma.medReachCustodyEvent.create({
          data: {
            bundleId: bundle.id,
            action: 'RESULT_READY',
            actorId: who.uid ?? null,
            actorRole: who.role,
            correlationId: `result_ready_${Date.now()}`,
            meta: { orderId, drawId: draw.id },
          },
        });

        await push(sseKeys.bundle(bundle.id), {
          kind: 'result_ready',
          bundleId: bundle.id,
          orderId,
          drawId: draw.id,
          at: now.toISOString(),
        });
      }

      if (bundle && body.resultStatus === MEDREACH_RESULT_STATUSES.SENT) {
        await prisma.medReachCustodyEvent.create({
          data: {
            bundleId: bundle.id,
            action: 'RESULT_PUBLISHED',
            actorId: who.uid ?? null,
            actorRole: who.role,
            correlationId: `result_published_${Date.now()}`,
            meta: { orderId, drawId: draw.id },
          },
        });

        await push(sseKeys.bundle(bundle.id), {
          kind: 'result_published',
          bundleId: bundle.id,
          orderId,
          drawId: draw.id,
          at: now.toISOString(),
        });
      }

      emitEvent({
        kind: body.resultStatus === 'SENT' ? 'lab_result_published' : 'lab_result_ready',
        encounterId: draw.encounterId,
        patientId: draw.patientId,
        clinicianId: draw.clinicianId,
        payload: {
          orderId,
          drawId: draw.id,
          resultStatus: body.resultStatus,
          resultSummary: body.resultSummary ?? null,
          testResults: safeJson(sanitized),
        },
        targets: {
          patientId: draw.patientId,
          clinicianId: draw.clinicianId,
          admin: true,
        },
      });

      const order = await buildProjection(orderId);
      if (!order) {
        return NextResponse.json({ ok: false, error: 'projection_failed' }, { status: 500 });
      }

      return NextResponse.json(
        buildEnvelope({
          order,
          warning: null,
          action: 'updateResult',
          actorRole: role,
          actorId: who.uid,
          actorLabId,
        }),
      );
    }

    default:
      return NextResponse.json({ ok: false, error: 'unsupported_action' }, { status: 400 });
  }
}