import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/src/lib/mailer';
import type { AdminStaffActor } from '@/src/lib/admin-staff-auth';
import {
  canAdminTransitionApplication,
  cleanApplicationReason,
  type ApplicationStatus,
} from '@/src/lib/applications-policy';

export class AdminApplicationError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export const applicationAdminListInclude = {
  opportunity: {
    select: {
      id: true,
      key: true,
      slug: true,
      title: true,
      type: true,
      referenceCode: true,
    },
  },
  assignedReviewerProfile: {
    select: {
      id: true,
      name: true,
      email: true,
      staffIdentifier: true,
      lifecycleState: true,
    },
  },
  formVersion: {
    select: {
      id: true,
      versionNumber: true,
      title: true,
    },
  },
} satisfies Prisma.ApplicationInclude;

export const applicationAdminDetailInclude = {
  ...applicationAdminListInclude,
  formSubmission: {
    include: {
      answers: {
        orderBy: { createdAt: 'asc' as const },
        include: {
          field: {
            select: {
              id: true,
              key: true,
              label: true,
              type: true,
              required: true,
              sensitive: true,
              order: true,
              section: {
                select: {
                  id: true,
                  title: true,
                  order: true,
                  page: {
                    select: {
                      id: true,
                      title: true,
                      order: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      files: {
        orderBy: { createdAt: 'asc' as const },
        include: {
          field: {
            select: {
              id: true,
              key: true,
              label: true,
              sensitive: true,
            },
          },
        },
      },
      consents: {
        orderBy: { createdAt: 'asc' as const },
        include: {
          field: {
            select: {
              id: true,
              key: true,
              label: true,
              sensitive: true,
            },
          },
        },
      },
    },
  },
  statusHistory: {
    orderBy: { createdAt: 'desc' as const },
  },
  staffConversion: {
    include: {
      roleRequest: {
        include: {
          department: true,
          designation: true,
          roles: { include: { role: true } },
        },
      },
      staffProfile: {
        select: {
          id: true,
          name: true,
          email: true,
          staffIdentifier: true,
          lifecycleState: true,
        },
      },
      initiatedByProfile: { select: { id: true, name: true, email: true } },
      activatedByProfile: { select: { id: true, name: true, email: true } },
    },
  },
  documentCycles: {
    orderBy: { cycleNumber: 'desc' as const },
    include: {
      requests: {
        orderBy: { createdAt: 'asc' as const },
        include: {
          files: {
            where: { removedAt: null },
            orderBy: { createdAt: 'desc' as const },
            select: {
              id: true,
              fileName: true,
              contentType: true,
              sizeBytes: true,
              checksumSha256: true,
              state: true,
              availableAt: true,
              createdAt: true,
            },
          },
        },
      },
      events: {
        orderBy: { createdAt: 'desc' as const },
        select: {
          id: true,
          requestId: true,
          fileId: true,
          action: true,
          actorType: true,
          actorRefId: true,
          note: true,
          createdAt: true,
        },
      },
    },
  },
} satisfies Prisma.ApplicationInclude;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function serializeAdminApplication(
  row: any,
  options: {
    canReadSubmission: boolean;
    canReadSensitive: boolean;
    canReadDocuments: boolean;
    canRequestDocuments: boolean;
    canReviewDocuments: boolean;
  },
) {
  const submission = row.formSubmission;
  const answerRows = Array.isArray(submission?.answers) ? submission.answers : [];
  const fileRows = Array.isArray(submission?.files) ? submission.files : [];
  const consentRows = Array.isArray(submission?.consents) ? submission.consents : [];

  const answers = options.canReadSubmission
    ? answerRows.map((answer: any) => {
        const sensitive = Boolean(answer?.field?.sensitive);
        const redacted = sensitive && !options.canReadSensitive;
        return {
          id: answer.id,
          fieldId: answer.fieldId,
          fieldKey: answer.fieldKey,
          label: answer?.field?.label || answer.fieldKey,
          type: answer?.field?.type || null,
          required: Boolean(answer?.field?.required),
          sensitive,
          redacted,
          value: redacted ? null : answer.value,
          page: answer?.field?.section?.page
            ? {
                id: answer.field.section.page.id,
                title: answer.field.section.page.title,
                order: answer.field.section.page.order,
              }
            : null,
          section: answer?.field?.section
            ? {
                id: answer.field.section.id,
                title: answer.field.section.title,
                order: answer.field.section.order,
              }
            : null,
          order: answer?.field?.order ?? 0,
        };
      })
    : [];

  const files = options.canReadSubmission
    ? fileRows.map((file: any) => {
        const sensitive = Boolean(file?.field?.sensitive);
        const redacted = sensitive && !options.canReadSensitive;
        return {
          id: file.id,
          fieldId: file.fieldId,
          fieldKey: file.fieldKey,
          label: file?.field?.label || file.fieldKey,
          sensitive,
          redacted,
          state: file.state,
          fileName: redacted ? null : file.fileName,
          contentType: redacted ? null : file.contentType,
          sizeBytes: redacted ? null : file.sizeBytes,
          checksumSha256: redacted ? null : file.checksumSha256,
          availableAt: file.availableAt,
          createdAt: file.createdAt,
        };
      })
    : [];

  const consents = options.canReadSubmission
    ? consentRows.map((consent: any) => {
        const sensitive = Boolean(consent?.field?.sensitive);
        const redacted = sensitive && !options.canReadSensitive;
        return {
          id: consent.id,
          fieldId: consent.fieldId,
          fieldKey: consent.fieldKey,
          label: consent?.field?.label || consent.fieldKey,
          sensitive,
          redacted,
          accepted: redacted ? null : consent.accepted,
          acceptedAt: redacted ? null : consent.acceptedAt,
          consentTextHash: redacted ? null : consent.consentTextHash,
        };
      })
    : [];

  return {
    id: row.id,
    referenceCode: row.referenceCode,
    source: row.source,
    status: row.status,
    applicantEmailNormalized: row.applicantEmailNormalized,
    statusReason: row.statusReason,
    statusChangedAt: row.statusChangedAt,
    submittedAt: row.submittedAt,
    lastReviewedAt: row.lastReviewedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    opportunity: row.opportunity,
    formVersion: row.formVersion,
    assignedReviewer: row.assignedReviewerProfile,
    submission: submission
      ? {
          id: submission.id,
          status: submission.status,
          locale: submission.locale,
          startedAt: submission.startedAt,
          submittedAt: submission.submittedAt,
          identityEmailNormalized: submission.identityEmailNormalized,
          canRead: options.canReadSubmission,
          canReadSensitive: options.canReadSensitive,
          answers,
          files,
          consents,
        }
      : null,
    statusHistory: Array.isArray(row.statusHistory) ? row.statusHistory : [],
    staffConversion: row.staffConversion || null,
    documents: {
      canRead: options.canReadDocuments,
      canRequest: options.canRequestDocuments,
      canReview: options.canReviewDocuments,
      cycles: options.canReadDocuments && Array.isArray(row.documentCycles)
        ? row.documentCycles.map((cycle: any) => ({
            id: cycle.id,
            cycleNumber: cycle.cycleNumber,
            returnStatus: cycle.returnStatus,
            status: cycle.status,
            requestedByProfileId: cycle.requestedByProfileId,
            requestedAt: cycle.requestedAt,
            completedByProfileId: cycle.completedByProfileId,
            completedAt: cycle.completedAt,
            createdAt: cycle.createdAt,
            updatedAt: cycle.updatedAt,
            requests: Array.isArray(cycle.requests)
              ? cycle.requests.map((request: any) => ({
                  id: request.id,
                  requestKey: request.requestKey,
                  title: request.title,
                  instructions: request.instructions,
                  required: request.required,
                  dueAt: request.dueAt,
                  status: request.status,
                  allowedContentTypes: request.allowedContentTypes,
                  maxFileSizeBytes: request.maxFileSizeBytes,
                  requestedAt: request.requestedAt,
                  reviewedAt: request.reviewedAt,
                  reviewedByProfileId: request.reviewedByProfileId,
                  reviewReason: request.reviewReason,
                  files: Array.isArray(request.files) ? request.files : [],
                }))
              : [],
            events: Array.isArray(cycle.events) ? cycle.events : [],
          }))
        : [],
    },
  };
}

export function adminApplicationResponse(error: unknown) {
  if (error instanceof AdminApplicationError) {
    return { status: error.status, body: { ok: false, error: error.message } };
  }
  return null;
}

export async function writeApplicationAudit(input: {
  actor: AdminStaffActor;
  action: string;
  entityId: string;
  description: string;
  userAgent?: string | null;
  meta?: Prisma.InputJsonValue;
}) {
  await prisma.auditLog.create({
    data: {
      actorUserId: input.actor.userId,
      actorType: 'ADMIN',
      actorRefId: input.actor.profileId,
      app: 'api-gateway',
      action: input.action,
      entityType: 'Application',
      entityId: input.entityId,
      description: input.description,
      userAgent: input.userAgent || null,
      meta: input.meta,
    },
  });
}

export async function listApplicationReviewers() {
  return prisma.adminUserProfile.findMany({
    where: { lifecycleState: 'ACTIVE' },
    orderBy: [{ name: 'asc' }, { email: 'asc' }],
    take: 500,
    select: {
      id: true,
      name: true,
      email: true,
      staffIdentifier: true,
      department: { select: { id: true, name: true } },
      designation: { select: { id: true, name: true } },
    },
  });
}

export async function assertAssignableReviewer(profileId: string) {
  const reviewer = await prisma.adminUserProfile.findFirst({
    where: { id: profileId, lifecycleState: 'ACTIVE' },
    select: { id: true },
  });
  if (!reviewer) {
    throw new AdminApplicationError('application_reviewer_not_assignable', 400);
  }
}

export async function transitionApplication(input: {
  applicationId: string;
  expectedStatus: ApplicationStatus;
  toStatus: ApplicationStatus;
  reason?: string | null;
  actor: AdminStaffActor;
  userAgent?: string | null;
}) {
  const reason = cleanApplicationReason(input.reason);

  if (!canAdminTransitionApplication(input.expectedStatus, input.toStatus)) {
    throw new AdminApplicationError('application_transition_not_available_in_review_workspace', 409);
  }

  if (input.toStatus === 'DECLINED' && !reason) {
    throw new AdminApplicationError('application_decline_reason_required', 400);
  }

  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string; status: ApplicationStatus }>>`
      SELECT "id", "status"::text AS "status"
      FROM "Application"
      WHERE "id" = ${input.applicationId}
      FOR UPDATE
    `;

    const current = locked[0];
    if (!current) {
      throw new AdminApplicationError('application_not_found', 404);
    }
    if (current.status !== input.expectedStatus) {
      throw new AdminApplicationError('application_status_changed_concurrently', 409);
    }
    if (!canAdminTransitionApplication(current.status, input.toStatus)) {
      throw new AdminApplicationError('application_transition_not_available_in_review_workspace', 409);
    }

    const updated = await tx.application.update({
      where: { id: input.applicationId },
      data: {
        status: input.toStatus,
        statusReason: reason || null,
        statusChangedAt: now,
        lastReviewedAt: ['UNDER_REVIEW', 'SHORTLISTED', 'DECLINED'].includes(input.toStatus)
          ? now
          : undefined,
      },
      include: applicationAdminListInclude,
    });

    await tx.applicationStatusEvent.create({
      data: {
        applicationId: updated.id,
        fromStatus: current.status,
        toStatus: input.toStatus,
        actorType: 'ADMIN',
        actorRefId: input.actor.profileId,
        reason: reason || null,
        metadata: {
          workspace: 'applications-review',
        },
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: input.actor.userId,
        actorType: 'ADMIN',
        actorRefId: input.actor.profileId,
        app: 'api-gateway',
        action: 'application.status_changed',
        entityType: 'Application',
        entityId: updated.id,
        description: `Application state transition: ${current.status} -> ${input.toStatus}`,
        userAgent: input.userAgent || null,
        meta: {
          from: current.status,
          to: input.toStatus,
          reason: reason || null,
        },
      },
    });

    return updated;
  });

  const notification = await deliverApplicationStatusNotification(result).catch((error) => ({
    requested: true,
    sent: false,
    error: String((error as any)?.message || error),
  }));

  return { application: result, notification };
}

function statusMessage(status: ApplicationStatus) {
  if (status === 'UNDER_REVIEW') {
    return 'Your application is now under review.';
  }
  if (status === 'SHORTLISTED') {
    return 'Your application has progressed to the shortlist.';
  }
  if (status === 'DECLINED') {
    return 'Your application will not progress further in this opportunity.';
  }
  return `Your application status is now ${status.replace(/_/g, ' ').toLowerCase()}.`;
}

export async function deliverApplicationStatusNotification(application: any) {
  const recipient = String(application.applicantEmailNormalized || '').trim().toLowerCase();
  if (!recipient) {
    return { requested: false, sent: false, error: 'application_email_unavailable' };
  }

  const subject = `Ambulant+ application update — ${application.referenceCode}`;
  const message = statusMessage(application.status);
  const opportunityTitle = application?.opportunity?.title || 'Ambulant+ opportunity';
  const text = [
    'Ambulant+ application update',
    '',
    `Reference: ${application.referenceCode}`,
    `Opportunity: ${opportunityTitle}`,
    '',
    message,
    '',
    'Please keep your application reference for future correspondence.',
  ].join('\n');
  const html = `
    <div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;line-height:1.6">
      <div style="max-width:680px;margin:auto;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden">
        <div style="background:#020617;color:white;padding:24px">
          <div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#67e8f9;font-weight:700">Ambulant+ application update</div>
          <h1 style="margin:10px 0 0;font-size:24px">${escapeHtml(opportunityTitle)}</h1>
        </div>
        <div style="padding:24px;background:white">
          <p><strong>Reference:</strong> ${escapeHtml(application.referenceCode)}</p>
          <p>${escapeHtml(message)}</p>
          <p style="font-size:12px;color:#64748b">Please keep your application reference for future correspondence.</p>
        </div>
      </div>
    </div>
  `;

  const outbox = await prisma.notificationOutbox.create({
    data: {
      eventKind: `application.status.${String(application.status).toLowerCase()}`,
      recipientEmail: recipient,
      channel: 'EMAIL',
      payload: {
        applicationId: application.id,
        referenceCode: application.referenceCode,
        opportunityId: application.opportunityId,
        status: application.status,
      },
    },
  });

  const sent = await sendEmail(recipient, subject, html, text);

  await prisma.notificationOutbox.update({
    where: { id: outbox.id },
    data: sent.ok
      ? {
          status: 'SENT',
          sentAt: new Date(),
          attempts: { increment: 1 },
          lastError: null,
        }
      : {
          status: 'FAILED',
          attempts: { increment: 1 },
          lastError: String(sent.error || 'email_delivery_failed').slice(0, 1000),
        },
  });

  return { requested: true, sent: sent.ok, error: sent.error || null };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function applicationSearchWhere(input: {
  q?: string;
  status?: ApplicationStatus | '';
  opportunityId?: string;
  reviewerProfileId?: string;
}) {
  const q = String(input.q || '').trim().slice(0, 240);
  const reviewer = String(input.reviewerProfileId || '').trim();
  const opportunityId = String(input.opportunityId || '').trim();

  return {
    ...(input.status ? { status: input.status } : {}),
    ...(opportunityId ? { opportunityId } : {}),
    ...(reviewer ? { assignedReviewerProfileId: reviewer } : {}),
    ...(q
      ? {
          OR: [
            { referenceCode: { contains: q, mode: 'insensitive' as const } },
            { applicantEmailNormalized: { contains: q, mode: 'insensitive' as const } },
            { opportunity: { title: { contains: q, mode: 'insensitive' as const } } },
            { opportunity: { key: { contains: q, mode: 'insensitive' as const } } },
          ],
        }
      : {}),
  };
}

export function applicationListItem(row: any) {
  return {
    id: row.id,
    referenceCode: row.referenceCode,
    source: row.source,
    status: row.status,
    applicantEmailNormalized: row.applicantEmailNormalized,
    statusReason: row.statusReason,
    statusChangedAt: row.statusChangedAt,
    submittedAt: row.submittedAt,
    lastReviewedAt: row.lastReviewedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    opportunity: row.opportunity,
    formVersion: row.formVersion,
    assignedReviewer: row.assignedReviewerProfile,
  };
}

export function cleanReviewerId(value: unknown) {
  return String(value ?? '').trim().slice(0, 240);
}

export function cleanApplicationPayload(value: unknown) {
  return isRecord(value) ? value : {};
}
