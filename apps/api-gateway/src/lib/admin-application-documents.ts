import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import type { AdminStaffActor } from '@/src/lib/admin-staff-auth';
import {
  applicationDocumentRequestExpired,
  canCompleteDocumentCycle,
  canReviewApplicationDocument,
  canStartApplicationDocumentCycle,
  cleanApplicationDocumentText,
  normaliseDocumentContentTypes,
  normaliseDocumentDecision,
  normaliseDocumentMaxBytes,
  type ApplicationDocumentDecision,
  type ApplicationDocumentRequestStatus,
} from './application-documents-policy';
import {
  ApplicationDocumentStorageError,
  presignApplicationDocumentDownload,
} from './application-documents-storage';
import {
  issueApplicationAccessLinkForApplication,
} from './public-application-portal';
import { canTransitionApplication, type ApplicationStatus } from './applications-policy';

export class AdminApplicationDocumentError extends Error {
  status: number;
  code: string;

  constructor(code: string, status = 400) {
    super(code);
    this.name = 'AdminApplicationDocumentError';
    this.status = status;
    this.code = code;
  }
}

function requestKey() {
  return `doc-${randomBytes(8).toString('hex')}`;
}

function dueDate(value: unknown) {
  const raw = cleanApplicationDocumentText(value, 80);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function adminDocumentRequestPayload(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

async function notifyApplicantDocumentAccess(input: {
  applicationId: string;
  referenceCode: string;
  applicantEmailNormalized: string | null;
  opportunityTitle: string;
  reason: 'documents_requested' | 'document_resubmission';
}) {
  if (!input.applicantEmailNormalized) return;
  await issueApplicationAccessLinkForApplication({
    applicationId: input.applicationId,
    referenceCode: input.referenceCode,
    applicantEmailNormalized: input.applicantEmailNormalized,
    opportunityTitle: input.opportunityTitle,
    reason: input.reason,
  }).catch(() => null);
}

export async function createApplicationDocumentRequest(input: {
  applicationId: string;
  payload: unknown;
  actor: AdminStaffActor;
  userAgent?: string | null;
}) {
  const body = adminDocumentRequestPayload(input.payload);
  const title = cleanApplicationDocumentText(body.title, 240);
  const instructions = cleanApplicationDocumentText(body.instructions, 2000);
  const required = body.required !== false;
  const dueAt = dueDate(body.dueAt);
  const allowedContentTypes = normaliseDocumentContentTypes(body.allowedContentTypes);
  const maxFileSizeBytes = normaliseDocumentMaxBytes(body.maxFileSizeBytes);

  if (!title) {
    throw new AdminApplicationDocumentError('application_document_title_required', 400);
  }
  if (body.dueAt && !dueAt) {
    throw new AdminApplicationDocumentError('application_document_due_date_invalid', 400);
  }
  if (dueAt && dueAt.getTime() <= Date.now()) {
    throw new AdminApplicationDocumentError('application_document_due_date_must_be_future', 400);
  }

  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{
      id: string;
      status: ApplicationStatus;
      referenceCode: string;
      applicantEmailNormalized: string | null;
      opportunityTitle: string;
    }>>(Prisma.sql`
      SELECT
        a."id",
        a."status"::text AS "status",
        a."referenceCode",
        a."applicantEmailNormalized",
        o."title" AS "opportunityTitle"
      FROM "Application" a
      JOIN "Opportunity" o ON o."id" = a."opportunityId"
      WHERE a."id" = ${input.applicationId}
      FOR UPDATE OF a
    `);

    const application = rows[0];
    if (!application) {
      throw new AdminApplicationDocumentError('application_not_found', 404);
    }

    let cycle = await tx.applicationDocumentCycle.findFirst({
      where: { applicationId: application.id, status: 'OPEN' },
      orderBy: { cycleNumber: 'desc' },
    });
    let transitioned = false;

    if (!cycle) {
      if (!canStartApplicationDocumentCycle(application.status)) {
        throw new AdminApplicationDocumentError('application_document_request_not_available', 409);
      }

      const previous = await tx.applicationDocumentCycle.findFirst({
        where: { applicationId: application.id },
        orderBy: { cycleNumber: 'desc' },
        select: { cycleNumber: true },
      });

      cycle = await tx.applicationDocumentCycle.create({
        data: {
          applicationId: application.id,
          cycleNumber: Number(previous?.cycleNumber || 0) + 1,
          returnStatus: application.status,
          status: 'OPEN',
          requestedByProfileId: input.actor.profileId,
          requestedAt: now,
        },
      });

      await tx.application.update({
        where: { id: application.id },
        data: {
          status: 'DOCUMENTS_REQUESTED',
          statusReason: null,
          statusChangedAt: now,
          lastReviewedAt: now,
        },
      });

      await tx.applicationStatusEvent.create({
        data: {
          applicationId: application.id,
          fromStatus: application.status,
          toStatus: 'DOCUMENTS_REQUESTED',
          actorType: 'ADMIN',
          actorRefId: input.actor.profileId,
          metadata: {
            workflow: 'application_documents',
            cycleId: cycle.id,
          },
        },
      });

      transitioned = true;
    } else if (application.status !== 'DOCUMENTS_REQUESTED') {
      throw new AdminApplicationDocumentError('application_document_cycle_state_mismatch', 409);
    }

    const request = await tx.applicationDocumentRequest.create({
      data: {
        applicationId: application.id,
        cycleId: cycle.id,
        requestKey: requestKey(),
        title,
        instructions: instructions || null,
        required,
        dueAt,
        status: 'REQUESTED',
        allowedContentTypes,
        maxFileSizeBytes,
        requestedAt: now,
      },
    });

    await tx.applicationDocumentEvent.create({
      data: {
        applicationId: application.id,
        cycleId: cycle.id,
        requestId: request.id,
        action: 'REQUESTED',
        actorType: 'ADMIN',
        actorRefId: input.actor.profileId,
        note: instructions || null,
        metadata: {
          title,
          required,
          dueAt: dueAt?.toISOString() || null,
          allowedContentTypes,
          maxFileSizeBytes,
        },
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: input.actor.userId,
        actorType: 'ADMIN',
        actorRefId: input.actor.profileId,
        app: 'api-gateway',
        action: 'application.document_requested',
        entityType: 'Application',
        entityId: application.id,
        description: `Application document requested: ${title}`,
        userAgent: input.userAgent || null,
        meta: {
          cycleId: cycle.id,
          requestId: request.id,
          transitionedToDocumentsRequested: transitioned,
        },
      },
    });

    return { application, cycle, request, transitioned };
  });

  await notifyApplicantDocumentAccess({
    applicationId: result.application.id,
    referenceCode: result.application.referenceCode,
    applicantEmailNormalized: result.application.applicantEmailNormalized,
    opportunityTitle: result.application.opportunityTitle,
    reason: 'documents_requested',
  });

  return {
    ok: true,
    request: result.request,
    cycle: result.cycle,
    transitionedToDocumentsRequested: result.transitioned,
  };
}

export async function reviewApplicationDocumentRequest(input: {
  applicationId: string;
  requestId: string;
  payload: unknown;
  actor: AdminStaffActor;
  userAgent?: string | null;
}) {
  const body = adminDocumentRequestPayload(input.payload);
  const decision = normaliseDocumentDecision(body.decision);
  const reason = cleanApplicationDocumentText(body.reason, 1000);
  const replacementDueAt = dueDate(body.dueAt);

  if (!decision) {
    throw new AdminApplicationDocumentError('application_document_review_decision_invalid', 400);
  }
  if ((decision === 'REJECT' || decision === 'REREQUEST') && !reason) {
    throw new AdminApplicationDocumentError('application_document_review_reason_required', 400);
  }
  if (body.dueAt && !replacementDueAt) {
    throw new AdminApplicationDocumentError('application_document_due_date_invalid', 400);
  }
  if (replacementDueAt && replacementDueAt.getTime() <= Date.now()) {
    throw new AdminApplicationDocumentError('application_document_due_date_must_be_future', 400);
  }

  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const applications = await tx.$queryRaw<Array<{
      id: string;
      status: ApplicationStatus;
      referenceCode: string;
      applicantEmailNormalized: string | null;
      opportunityTitle: string;
    }>>(Prisma.sql`
      SELECT
        a."id",
        a."status"::text AS "status",
        a."referenceCode",
        a."applicantEmailNormalized",
        o."title" AS "opportunityTitle"
      FROM "Application" a
      JOIN "Opportunity" o ON o."id" = a."opportunityId"
      WHERE a."id" = ${input.applicationId}
      FOR UPDATE OF a
    `);

    const application = applications[0];
    if (!application) {
      throw new AdminApplicationDocumentError('application_not_found', 404);
    }
    if (application.status !== 'DOCUMENTS_REQUESTED') {
      throw new AdminApplicationDocumentError('application_document_cycle_state_mismatch', 409);
    }

    const rows = await tx.$queryRaw<Array<{
      requestId: string;
      requestStatus: ApplicationDocumentRequestStatus;
      cycleId: string;
      dueAt: Date | null;
    }>>(Prisma.sql`
      SELECT
        r."id" AS "requestId",
        r."status"::text AS "requestStatus",
        r."cycleId",
        r."dueAt"
      FROM "ApplicationDocumentRequest" r
      JOIN "ApplicationDocumentCycle" c ON c."id" = r."cycleId"
      WHERE r."id" = ${input.requestId}
        AND r."applicationId" = ${input.applicationId}
        AND c."status" = 'OPEN'
      FOR UPDATE OF r
    `);

    const requestRow = rows[0];
    if (!requestRow) {
      throw new AdminApplicationDocumentError('application_document_request_not_found', 404);
    }

    const current = {
      requestId: requestRow.requestId,
      requestStatus: requestRow.requestStatus,
      cycleId: requestRow.cycleId,
      dueAt: requestRow.dueAt,
      applicationId: application.id,
      applicationStatus: application.status,
      referenceCode: application.referenceCode,
      applicantEmailNormalized: application.applicantEmailNormalized,
      opportunityTitle: application.opportunityTitle,
    };
    if (!canReviewApplicationDocument(current.requestStatus, decision as ApplicationDocumentDecision)) {
      throw new AdminApplicationDocumentError('application_document_review_not_available', 409);
    }
    if (
      decision === 'REREQUEST' &&
      applicationDocumentRequestExpired(current.dueAt, now.getTime()) &&
      !replacementDueAt
    ) {
      throw new AdminApplicationDocumentError('application_document_new_due_date_required', 400);
    }

    const currentFile = await tx.applicationDocumentFile.findFirst({
      where: { requestId: current.requestId, state: 'AVAILABLE' },
      orderBy: { createdAt: 'desc' },
    });

    if ((decision === 'ACCEPT' || decision === 'REJECT') && !currentFile) {
      throw new AdminApplicationDocumentError('application_document_file_not_available', 409);
    }

    let nextStatus: ApplicationDocumentRequestStatus;
    let eventAction: 'ACCEPTED' | 'REJECTED' | 'RE_REQUESTED';

    if (decision === 'ACCEPT') {
      nextStatus = 'ACCEPTED';
      eventAction = 'ACCEPTED';
    } else if (decision === 'REJECT') {
      nextStatus = 'REJECTED';
      eventAction = 'REJECTED';
    } else {
      nextStatus = 'REQUESTED';
      eventAction = 'RE_REQUESTED';
    }

    if (decision !== 'ACCEPT' && currentFile) {
      await tx.applicationDocumentFile.update({
        where: { id: currentFile.id },
        data: { state: 'REJECTED' },
      });
    }

    const request = await tx.applicationDocumentRequest.update({
      where: { id: current.requestId },
      data: {
        status: nextStatus,
        dueAt: decision === 'REREQUEST' && replacementDueAt ? replacementDueAt : undefined,
        reviewedAt: now,
        reviewedByProfileId: input.actor.profileId,
        reviewReason: reason || null,
      },
    });

    await tx.applicationDocumentEvent.create({
      data: {
        applicationId: current.applicationId,
        cycleId: current.cycleId,
        requestId: current.requestId,
        fileId: currentFile?.id || null,
        action: eventAction,
        actorType: 'ADMIN',
        actorRefId: input.actor.profileId,
        note: reason || null,
        metadata: decision === 'REREQUEST'
          ? { dueAt: (replacementDueAt || current.dueAt)?.toISOString() || null }
          : undefined,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: input.actor.userId,
        actorType: 'ADMIN',
        actorRefId: input.actor.profileId,
        app: 'api-gateway',
        action: `application.document_${decision.toLowerCase()}`,
        entityType: 'Application',
        entityId: current.applicationId,
        userAgent: input.userAgent || null,
        meta: {
          requestId: current.requestId,
          fileId: currentFile?.id || null,
          decision,
          dueAt: decision === 'REREQUEST'
            ? (replacementDueAt || current.dueAt)?.toISOString() || null
            : null,
        },
      },
    });

    return { current, request };
  });

  if (decision === 'REREQUEST') {
    await notifyApplicantDocumentAccess({
      applicationId: result.current.applicationId,
      referenceCode: result.current.referenceCode,
      applicantEmailNormalized: result.current.applicantEmailNormalized,
      opportunityTitle: result.current.opportunityTitle,
      reason: 'document_resubmission',
    });
  }

  return { ok: true, request: result.request };
}

export async function completeApplicationDocumentCycle(input: {
  applicationId: string;
  actor: AdminStaffActor;
  userAgent?: string | null;
}) {
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const applications = await tx.$queryRaw<Array<{
      id: string;
      status: ApplicationStatus;
      referenceCode: string;
      applicantEmailNormalized: string | null;
      opportunityTitle: string;
    }>>(Prisma.sql`
      SELECT
        a."id",
        a."status"::text AS "status",
        a."referenceCode",
        a."applicantEmailNormalized",
        o."title" AS "opportunityTitle"
      FROM "Application" a
      JOIN "Opportunity" o ON o."id" = a."opportunityId"
      WHERE a."id" = ${input.applicationId}
      FOR UPDATE OF a
    `);

    const application = applications[0];
    if (!application) throw new AdminApplicationDocumentError('application_not_found', 404);
    if (application.status !== 'DOCUMENTS_REQUESTED') {
      throw new AdminApplicationDocumentError('application_document_cycle_state_mismatch', 409);
    }

    const cycle = await tx.applicationDocumentCycle.findFirst({
      where: { applicationId: application.id, status: 'OPEN' },
      orderBy: { cycleNumber: 'desc' },
    });

    if (!cycle) {
      throw new AdminApplicationDocumentError('application_document_cycle_not_found', 404);
    }

    const lockedRequests = await tx.$queryRaw<Array<{
      id: string;
      required: boolean;
      status: ApplicationDocumentRequestStatus;
    }>>(Prisma.sql`
      SELECT r."id", r."required", r."status"::text AS "status"
      FROM "ApplicationDocumentRequest" r
      WHERE r."cycleId" = ${cycle.id}
        AND r."applicationId" = ${application.id}
      ORDER BY r."createdAt" ASC
      FOR UPDATE OF r
    `);

    if (!canCompleteDocumentCycle(lockedRequests)) {
      throw new AdminApplicationDocumentError('application_document_cycle_incomplete', 409);
    }
    if (!canTransitionApplication('DOCUMENTS_REQUESTED', cycle.returnStatus)) {
      throw new AdminApplicationDocumentError('application_document_return_state_invalid', 409);
    }

    const optionalOutstanding = lockedRequests.filter(
      (request) => !request.required && request.status !== 'ACCEPTED' && request.status !== 'CANCELLED',
    );

    if (optionalOutstanding.length) {
      await tx.applicationDocumentRequest.updateMany({
        where: { id: { in: optionalOutstanding.map((request) => request.id) } },
        data: { status: 'CANCELLED' },
      });

      await tx.applicationDocumentEvent.createMany({
        data: optionalOutstanding.map((request) => ({
          applicationId: application.id,
          cycleId: cycle.id,
          requestId: request.id,
          action: 'CANCELLED' as const,
          actorType: 'ADMIN' as const,
          actorRefId: input.actor.profileId,
          note: 'Optional request closed when document review completed.',
        })),
      });
    }

    await tx.applicationDocumentCycle.update({
      where: { id: cycle.id },
      data: {
        status: 'COMPLETED',
        completedAt: now,
        completedByProfileId: input.actor.profileId,
      },
    });

    await tx.application.update({
      where: { id: application.id },
      data: {
        status: cycle.returnStatus,
        statusReason: null,
        statusChangedAt: now,
        lastReviewedAt: now,
      },
    });

    await tx.applicationStatusEvent.create({
      data: {
        applicationId: application.id,
        fromStatus: 'DOCUMENTS_REQUESTED',
        toStatus: cycle.returnStatus,
        actorType: 'ADMIN',
        actorRefId: input.actor.profileId,
        metadata: {
          workflow: 'application_documents',
          cycleId: cycle.id,
          completed: true,
        },
      },
    });

    await tx.applicationDocumentEvent.create({
      data: {
        applicationId: application.id,
        cycleId: cycle.id,
        action: 'COMPLETED',
        actorType: 'ADMIN',
        actorRefId: input.actor.profileId,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: input.actor.userId,
        actorType: 'ADMIN',
        actorRefId: input.actor.profileId,
        app: 'api-gateway',
        action: 'application.document_cycle_completed',
        entityType: 'Application',
        entityId: application.id,
        userAgent: input.userAgent || null,
        meta: {
          cycleId: cycle.id,
          returnStatus: cycle.returnStatus,
        },
      },
    });

    return { application, cycle };
  });

  if (result.application.applicantEmailNormalized) {
    await issueApplicationAccessLinkForApplication({
      applicationId: result.application.id,
      referenceCode: result.application.referenceCode,
      applicantEmailNormalized: result.application.applicantEmailNormalized,
      opportunityTitle: result.application.opportunityTitle,
      reason: 'access_request',
    }).catch(() => null);
  }

  return { ok: true, status: result.cycle.returnStatus, cycleId: result.cycle.id };
}

export async function applicationDocumentDownload(input: {
  applicationId: string;
  fileId: string;
}) {
  const file = await prisma.applicationDocumentFile.findFirst({
    where: {
      id: input.fileId,
      request: { applicationId: input.applicationId },
      removedAt: null,
      state: { in: ['AVAILABLE', 'SUPERSEDED', 'REJECTED'] },
    },
    select: {
      id: true,
      objectKey: true,
      fileName: true,
      contentType: true,
      sizeBytes: true,
      checksumSha256: true,
      state: true,
    },
  });

  if (!file) {
    throw new AdminApplicationDocumentError('application_document_file_not_found', 404);
  }

  try {
    const signed = await presignApplicationDocumentDownload(file.objectKey, file.fileName);
    return {
      ok: true,
      file: {
        id: file.id,
        fileName: file.fileName,
        contentType: file.contentType,
        sizeBytes: file.sizeBytes,
        checksumSha256: file.checksumSha256,
        state: file.state,
      },
      ...signed,
    };
  } catch (error) {
    if (error instanceof ApplicationDocumentStorageError) {
      throw new AdminApplicationDocumentError(error.code, error.status);
    }
    throw error;
  }
}

export function adminApplicationDocumentResponse(error: unknown) {
  if (error instanceof AdminApplicationDocumentError) {
    return { status: error.status, body: { ok: false, error: error.code } };
  }
  if (error instanceof ApplicationDocumentStorageError) {
    return { status: error.status, body: { ok: false, error: error.code } };
  }
  return null;
}
