import { Prisma } from '@prisma/client';
import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
} from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/src/lib/mailer';
import {
  APPLICATION_PORTAL_TOKEN_BYTES,
  APPLICATION_PORTAL_TOKEN_HOURS,
  applicationDocumentRequestExpired,
  canApplicantUploadDocument,
  canApplicantWithdrawApplication,
  cleanApplicationDocumentText,
  normaliseApplicationPortalEmail,
  normaliseApplicationReference,
  validDocumentChecksum,
  type ApplicationDocumentRequestStatus,
} from './application-documents-policy';
import {
  ApplicationDocumentStorageError,
  applicationDocumentObjectKey,
  deleteApplicationDocument,
  headApplicationDocument,
  verifyApplicationDocumentSignature,
  presignApplicationDocumentUpload,
  safeApplicationDocumentFileName,
} from './application-documents-storage';
import type { ApplicationStatus } from './applications-policy';
import {
  ApplicationInterviewError,
  latestApplicationInterview,
  resendApplicationInterviewInvitation,
  respondToApplicationInterview,
  serializePublicApplicationInterview,
} from './application-interviews';

const ACCESS_REQUEST_LIMIT = 6;
const ACCESS_REQUEST_WINDOW_SECONDS = 15 * 60;
const UPLOAD_REQUEST_LIMIT = 24;
const UPLOAD_REQUEST_WINDOW_SECONDS = 15 * 60;

export class PublicApplicationPortalError extends Error {
  status: number;
  code: string;

  constructor(code: string, status = 400) {
    super(code);
    this.name = 'PublicApplicationPortalError';
    this.status = status;
    this.code = code;
  }
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function portalHashSecret() {
  const secret = cleanApplicationDocumentText(
    process.env.APPLICATION_PORTAL_HASH_PEPPER ||
      process.env.FORM_RUNTIME_HASH_PEPPER ||
      process.env.AUTH_SESSION_SECRET ||
      process.env.NEXTAUTH_SECRET,
    500,
  );

  if (!secret) {
    throw new PublicApplicationPortalError('application_portal_not_configured', 503);
  }

  return secret;
}

function clientKeyHash(value: string) {
  return createHmac('sha256', portalHashSecret()).update(value).digest('hex');
}

export function applicationPortalClientKey(input: {
  forwardedFor?: string | null;
  realIp?: string | null;
  userAgent?: string | null;
}) {
  const forwarded = cleanApplicationDocumentText(input.forwardedFor, 1000)
    .split(',')[0]
    .trim();
  const ip = forwarded || cleanApplicationDocumentText(input.realIp, 120) || 'unknown';
  const userAgent = cleanApplicationDocumentText(input.userAgent, 500) || 'unknown';
  return `${ip}\n${userAgent}`;
}

export function applicationPortalBearerToken(value: string | null | undefined) {
  const header = cleanApplicationDocumentText(value, 2000);
  const match = /^Bearer\s+([A-Za-z0-9_-]{32,500})$/i.exec(header);
  return match?.[1] || '';
}

async function enforceApplicationPortalRateLimit(input: {
  scope: string;
  clientKey: string;
  limit: number;
  windowSeconds: number;
}) {
  const now = new Date();
  const windowMs = Math.max(60, input.windowSeconds) * 1000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const scope = cleanApplicationDocumentText(input.scope, 180);
  const keyHash = clientKeyHash(input.clientKey);
  const id = randomUUID();

  const rows = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    INSERT INTO "ApplicationAccessRateLimitBucket"
      ("id", "scope", "keyHash", "windowStart", "count", "createdAt", "updatedAt")
    VALUES
      (${id}, ${scope}, ${keyHash}, ${windowStart}, 1, ${now}, ${now})
    ON CONFLICT ("scope", "keyHash", "windowStart")
    DO UPDATE SET
      "count" = "ApplicationAccessRateLimitBucket"."count" + 1,
      "updatedAt" = ${now}
    RETURNING "count"
  `);

  if (Number(rows[0]?.count || 0) > input.limit) {
    throw new PublicApplicationPortalError('application_portal_rate_limited', 429);
  }
}

function portalPublicBaseUrl() {
  return (
    process.env.LANDING_PUBLIC_URL ||
    process.env.LANDING_BASE_URL ||
    process.env.NEXT_PUBLIC_LANDING_URL ||
    'https://ambulantplus.co.za'
  ).replace(/\/+$/, '');
}

export function applicationPortalAccessUrl(referenceCode: string, token: string) {
  return `${portalPublicBaseUrl()}/applications/${encodeURIComponent(referenceCode)}#access=${encodeURIComponent(token)}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function createOutboxAndSend(input: {
  eventKind: string;
  applicationId: string;
  referenceCode: string;
  recipientEmail: string;
  subject: string;
  html: string;
  text: string;
  payload?: Prisma.InputJsonObject;
}) {
  const outbox = await prisma.notificationOutbox.create({
    data: {
      eventKind: input.eventKind,
      recipientEmail: input.recipientEmail,
      channel: 'EMAIL',
      payload: {
        applicationId: input.applicationId,
        referenceCode: input.referenceCode,
        ...(input.payload || {}),
      },
    },
  });

  const sent = await sendEmail(input.recipientEmail, input.subject, input.html, input.text);

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

  return sent;
}

export async function issueApplicationAccessLinkForApplication(input: {
  applicationId: string;
  referenceCode: string;
  applicantEmailNormalized: string;
  opportunityTitle?: string | null;
  reason?:
    | 'access_request'
    | 'documents_requested'
    | 'document_resubmission'
    | 'interview_invited'
    | 'interview_rescheduled';
  revokeExisting?: boolean;
}) {
  const token = randomBytes(APPLICATION_PORTAL_TOKEN_BYTES).toString('base64url');
  const tokenHash = sha256(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + APPLICATION_PORTAL_TOKEN_HOURS * 60 * 60 * 1000);

  const access = await prisma.$transaction(async (tx) => {
    if (input.revokeExisting) {
      await tx.applicationApplicantAccessToken.updateMany({
        where: {
          applicationId: input.applicationId,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { revokedAt: now },
      });
    }

    const created = await tx.applicationApplicantAccessToken.create({
      data: {
        applicationId: input.applicationId,
        tokenHash,
        expiresAt,
      },
      select: { id: true },
    });

    const excessActive = await tx.applicationApplicantAccessToken.findMany({
      where: {
        applicationId: input.applicationId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'desc' },
      skip: 5,
      select: { id: true },
    });
    if (excessActive.length) {
      await tx.applicationApplicantAccessToken.updateMany({
        where: { id: { in: excessActive.map((entry) => entry.id) } },
        data: { revokedAt: now },
      });
    }

    await tx.auditLog.create({
      data: {
        actorType: 'SYSTEM',
        app: 'api-gateway',
        action: 'application.portal_access_issued',
        entityType: 'Application',
        entityId: input.applicationId,
        meta: {
          reason: input.reason || 'access_request',
          expiresAt: expiresAt.toISOString(),
        },
      },
    });

    return created;
  });

  const link = applicationPortalAccessUrl(input.referenceCode, token);
  const opportunityTitle = input.opportunityTitle || 'Ambulant+ opportunity';
  const actionMessage = input.reason === 'documents_requested'
    ? 'Ambulant+ has requested one or more documents for your application.'
    : input.reason === 'document_resubmission'
      ? 'A document requires resubmission. Open the secure portal to review the applicant-facing reason and upload the replacement.'
      : input.reason === 'interview_invited'
        ? 'You have been invited to an interview. Open the secure application portal to review the schedule and accept or decline the invitation.'
        : input.reason === 'interview_rescheduled'
          ? 'Your application interview schedule has been updated. Open the secure portal to review the current interview details.'
          : 'Use the secure portal to view your application status and any document requests.';
  const subject = input.reason === 'documents_requested'
    ? `Documents requested for your Ambulant+ application — ${input.referenceCode}`
    : input.reason === 'document_resubmission'
      ? `Document resubmission requested — ${input.referenceCode}`
      : input.reason === 'interview_invited'
        ? `Interview invitation — ${input.referenceCode}`
        : input.reason === 'interview_rescheduled'
          ? `Interview rescheduled — ${input.referenceCode}`
          : `Secure access to your Ambulant+ application — ${input.referenceCode}`;
  const text = [
    'Secure Ambulant+ application access',
    '',
    `Reference: ${input.referenceCode}`,
    `Opportunity: ${opportunityTitle}`,
    '',
    actionMessage,
    link,
    '',
    `This link expires in ${APPLICATION_PORTAL_TOKEN_HOURS} hours. Request a new link if it expires.`,
  ].join('\n');
  const html = `
    <div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;line-height:1.6">
      <div style="max-width:680px;margin:auto;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden">
        <div style="background:#020617;color:white;padding:24px">
          <div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#67e8f9;font-weight:700">Secure application access</div>
          <h1 style="margin:10px 0 0;font-size:24px">${escapeHtml(opportunityTitle)}</h1>
        </div>
        <div style="padding:24px;background:white">
          <p><strong>Reference:</strong> ${escapeHtml(input.referenceCode)}</p>
          <p>${escapeHtml(actionMessage)}</p>
          <p><a href="${escapeHtml(link)}" style="display:inline-block;background:#0f172a;color:white;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">Open secure application portal</a></p>
          <p style="font-size:12px;color:#64748b">This secure link expires in ${APPLICATION_PORTAL_TOKEN_HOURS} hours. The access credential is not included in the web address sent to Ambulant+ servers until your browser presents it.</p>
        </div>
      </div>
    </div>
  `;

  await createOutboxAndSend({
    eventKind: `application.portal_access.${input.reason || 'access_request'}`,
    applicationId: input.applicationId,
    referenceCode: input.referenceCode,
    recipientEmail: input.applicantEmailNormalized,
    subject,
    html,
    text,
    payload: {
      reason: input.reason || 'access_request',
      expiresAt: expiresAt.toISOString(),
      accessTokenId: access.id,
    },
  }).catch(() => null);

  return { expiresAt };
}

export async function requestApplicationAccessLink(input: {
  referenceCode: unknown;
  email: unknown;
  clientKey: string;
}) {
  const referenceCode = normaliseApplicationReference(input.referenceCode);
  const email = normaliseApplicationPortalEmail(input.email);
  const rateIdentity = `${input.clientKey}\n${referenceCode || 'invalid'}\n${email || 'invalid'}`;

  await enforceApplicationPortalRateLimit({
    scope: 'application:portal:access',
    clientKey: rateIdentity,
    limit: ACCESS_REQUEST_LIMIT,
    windowSeconds: ACCESS_REQUEST_WINDOW_SECONDS,
  });

  if (!referenceCode || !email) {
    return { ok: true };
  }

  const application = await prisma.application.findFirst({
    where: {
      referenceCode,
      applicantEmailNormalized: email,
      status: { not: 'DRAFT' },
    },
    select: {
      id: true,
      referenceCode: true,
      applicantEmailNormalized: true,
      opportunity: { select: { title: true } },
    },
  });

  if (application?.applicantEmailNormalized) {
    await issueApplicationAccessLinkForApplication({
      applicationId: application.id,
      referenceCode: application.referenceCode,
      applicantEmailNormalized: application.applicantEmailNormalized,
      opportunityTitle: application.opportunity.title,
      reason: 'access_request',
      revokeExisting: true,
    }).catch(() => null);
  }

  return { ok: true };
}

const portalApplicationInclude = {
  opportunity: {
    select: {
      slug: true,
      title: true,
      referenceCode: true,
      type: true,
    },
  },
  statusHistory: {
    orderBy: { createdAt: 'desc' as const },
    select: {
      id: true,
      fromStatus: true,
      toStatus: true,
      createdAt: true,
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
              state: true,
              availableAt: true,
              createdAt: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.ApplicationInclude;

async function applicationPortalAuthority(input: {
  referenceCode: unknown;
  token: string;
}) {
  const referenceCode = normaliseApplicationReference(input.referenceCode);
  const token = cleanApplicationDocumentText(input.token, 1000);

  if (!referenceCode || !token) {
    throw new PublicApplicationPortalError('application_portal_not_found', 404);
  }

  const access = await prisma.applicationApplicantAccessToken.findFirst({
    where: {
      tokenHash: sha256(token),
      expiresAt: { gt: new Date() },
      revokedAt: null,
      application: { referenceCode },
    },
    select: {
      id: true,
      applicationId: true,
      application: { include: portalApplicationInclude },
    },
  });

  if (!access) {
    throw new PublicApplicationPortalError('application_portal_not_found', 404);
  }

  await prisma.applicationApplicantAccessToken.update({
    where: { id: access.id },
    data: { lastUsedAt: new Date() },
  });

  return access;
}

function serializePortalApplication(application: any, interview: any = null) {
  return {
    referenceCode: application.referenceCode,
    status: application.status,
    submittedAt: application.submittedAt,
    statusChangedAt: application.statusChangedAt,
    opportunity: application.opportunity,
    statusHistory: Array.isArray(application.statusHistory)
      ? application.statusHistory.map((event: any) => ({
          id: event.id,
          fromStatus: event.fromStatus,
          toStatus: event.toStatus,
          createdAt: event.createdAt,
        }))
      : [],
    interview: serializePublicApplicationInterview(interview),
    documentCycles: Array.isArray(application.documentCycles)
      ? application.documentCycles.map((cycle: any) => ({
          id: cycle.id,
          cycleNumber: cycle.cycleNumber,
          returnStatus: cycle.returnStatus,
          status: cycle.status,
          requestedAt: cycle.requestedAt,
          completedAt: cycle.completedAt,
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
                reviewReason: request.reviewReason,
                files: Array.isArray(request.files) ? request.files : [],
              }))
            : [],
        }))
      : [],
  };
}

export async function getApplicationPortal(input: {
  referenceCode: unknown;
  token: string;
}) {
  const access = await applicationPortalAuthority(input);
  const interview = await latestApplicationInterview(access.applicationId);
  return {
    ok: true,
    application: serializePortalApplication(access.application, interview),
  };
}

function rethrowInterviewPortalError(error: unknown): never {
  if (error instanceof ApplicationInterviewError) {
    throw new PublicApplicationPortalError(error.code, error.status);
  }
  throw error;
}

export async function respondToApplicationInterviewFromPortal(input: {
  referenceCode: unknown;
  token: string;
  clientKey: string;
  response: unknown;
}) {
  const access = await applicationPortalAuthority(input);
  await enforceApplicationPortalRateLimit({
    scope: `application:interview:respond:${access.applicationId}`,
    clientKey: input.clientKey,
    limit: 12,
    windowSeconds: 15 * 60,
  });

  try {
    return await respondToApplicationInterview({
      applicationId: access.applicationId,
      actor: {
        actorType: 'EXTERNAL_GUEST',
        actorRefId: access.id,
      },
      response: input.response,
    });
  } catch (error) {
    return rethrowInterviewPortalError(error);
  }
}

export async function resendApplicationInterviewFromPortal(input: {
  referenceCode: unknown;
  token: string;
  clientKey: string;
}) {
  const access = await applicationPortalAuthority(input);
  await enforceApplicationPortalRateLimit({
    scope: `application:interview:resend:${access.applicationId}`,
    clientKey: input.clientKey,
    limit: 4,
    windowSeconds: 15 * 60,
  });

  try {
    return await resendApplicationInterviewInvitation({
      applicationId: access.applicationId,
      actor: {
        actorType: 'EXTERNAL_GUEST',
        actorRefId: access.id,
      },
    });
  } catch (error) {
    return rethrowInterviewPortalError(error);
  }
}

async function deliverWithdrawalConfirmation(application: any) {
  const recipient = normaliseApplicationPortalEmail(application.applicantEmailNormalized);
  if (!recipient) return;

  const subject = `Ambulant+ application withdrawn — ${application.referenceCode}`;
  const text = [
    'Ambulant+ application update',
    '',
    `Reference: ${application.referenceCode}`,
    `Opportunity: ${application.opportunity?.title || 'Ambulant+ opportunity'}`,
    '',
    'Your application has been withdrawn as requested.',
  ].join('\n');
  const html = `<p>Your Ambulant+ application <strong>${escapeHtml(application.referenceCode)}</strong> has been withdrawn as requested.</p>`;

  await createOutboxAndSend({
    eventKind: 'application.status.withdrawn',
    applicationId: application.id,
    referenceCode: application.referenceCode,
    recipientEmail: recipient,
    subject,
    html,
    text,
    payload: { status: 'WITHDRAWN' },
  }).catch(() => null);
}

export async function withdrawApplicationFromPortal(input: {
  referenceCode: unknown;
  token: string;
  reason?: unknown;
}) {
  const access = await applicationPortalAuthority(input);
  const reason = cleanApplicationDocumentText(input.reason, 1000);
  const now = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string; status: ApplicationStatus }>>(Prisma.sql`
      SELECT "id", "status"::text AS "status"
      FROM "Application"
      WHERE "id" = ${access.applicationId}
      FOR UPDATE
    `);

    const current = rows[0];
    if (!current) throw new PublicApplicationPortalError('application_portal_not_found', 404);
    if (!canApplicantWithdrawApplication(current.status)) {
      throw new PublicApplicationPortalError('application_withdrawal_not_available', 409);
    }

    const openCycles = await tx.applicationDocumentCycle.findMany({
      where: { applicationId: current.id, status: 'OPEN' },
      select: { id: true },
    });

    if (openCycles.length) {
      const cycleIds = openCycles.map((cycle) => cycle.id);
      const openRequests = await tx.applicationDocumentRequest.findMany({
        where: {
          applicationId: current.id,
          cycleId: { in: cycleIds },
          status: { not: 'CANCELLED' },
        },
        select: { id: true, cycleId: true },
      });

      await tx.applicationDocumentCycle.updateMany({
        where: { id: { in: cycleIds }, status: 'OPEN' },
        data: {
          status: 'CANCELLED',
          cancelledByActorRefId: access.id,
          cancelledAt: now,
        },
      });
      await tx.applicationDocumentRequest.updateMany({
        where: { id: { in: openRequests.map((request) => request.id) } },
        data: { status: 'CANCELLED' },
      });

      await tx.applicationDocumentEvent.createMany({
        data: [
          ...openCycles.map((cycle) => ({
            applicationId: current.id,
            cycleId: cycle.id,
            requestId: null,
            action: 'CANCELLED' as const,
            actorType: 'EXTERNAL_GUEST' as const,
            actorRefId: access.id,
            note: 'Document cycle cancelled because the applicant withdrew the application.',
          })),
          ...openRequests.map((request) => ({
            applicationId: current.id,
            cycleId: request.cycleId,
            requestId: request.id,
            action: 'CANCELLED' as const,
            actorType: 'EXTERNAL_GUEST' as const,
            actorRefId: access.id,
            note: 'Document request cancelled because the applicant withdrew the application.',
          })),
        ],
      });
    }

    const application = await tx.application.update({
      where: { id: current.id },
      data: {
        status: 'WITHDRAWN',
        statusReason: reason || null,
        statusChangedAt: now,
      },
      include: {
        opportunity: { select: { title: true } },
      },
    });

    await tx.applicationStatusEvent.create({
      data: {
        applicationId: current.id,
        fromStatus: current.status,
        toStatus: 'WITHDRAWN',
        actorType: 'EXTERNAL_GUEST',
        actorRefId: access.id,
        reason: reason || null,
        metadata: { source: 'application_portal' },
      },
    });

    await tx.auditLog.create({
      data: {
        actorType: 'EXTERNAL_GUEST',
        actorRefId: access.id,
        app: 'landing',
        action: 'application.withdrawn',
        entityType: 'Application',
        entityId: current.id,
        meta: { from: current.status },
      },
    });

    return application;
  });

  await deliverWithdrawalConfirmation(updated);
  return { ok: true, status: 'WITHDRAWN' as const };
}

async function portalDocumentRequest(input: {
  applicationId: string;
  requestId: string;
}) {
  const request = await prisma.applicationDocumentRequest.findFirst({
    where: {
      id: input.requestId,
      applicationId: input.applicationId,
      cycle: { status: 'OPEN' },
      application: { status: 'DOCUMENTS_REQUESTED' },
    },
    include: {
      cycle: { select: { id: true, status: true } },
      files: {
        where: { removedAt: null },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!request) {
    throw new PublicApplicationPortalError('application_document_request_not_found', 404);
  }

  return request;
}

async function discardPendingApplicationDocumentUpload(file: {
  id: string;
  objectKey: string;
}) {
  const changed = await prisma.applicationDocumentFile.updateMany({
    where: { id: file.id, state: 'PENDING' },
    data: { state: 'REMOVED', removedAt: new Date() },
  }).catch(() => ({ count: 0 }));

  if (changed.count === 1) {
    await deleteApplicationDocument(file.objectKey).catch(() => null);
  }
}

async function rejectPendingApplicationDocumentUpload(
  file: { id: string; objectKey: string },
  code: string,
  status = 409,
): Promise<never> {
  await discardPendingApplicationDocumentUpload(file);
  throw new PublicApplicationPortalError(code, status);
}

export async function createApplicationDocumentUpload(input: {
  referenceCode: unknown;
  token: string;
  requestId: string;
  clientKey: string;
  fileName: unknown;
  contentType: unknown;
  sizeBytes: unknown;
  checksumSha256: unknown;
}) {
  const access = await applicationPortalAuthority(input);
  const request = await portalDocumentRequest({
    applicationId: access.applicationId,
    requestId: input.requestId,
  });

  if (!canApplicantUploadDocument(request.status as ApplicationDocumentRequestStatus)) {
    throw new PublicApplicationPortalError('application_document_upload_not_allowed', 409);
  }
  if (applicationDocumentRequestExpired(request.dueAt)) {
    throw new PublicApplicationPortalError('application_document_request_expired', 409);
  }

  const contentType = cleanApplicationDocumentText(input.contentType, 160).toLowerCase();
  const allowed = new Set((request.allowedContentTypes || []).map((value) => String(value).toLowerCase()));
  const sizeBytes = Math.round(Number(input.sizeBytes));
  const checksumSha256 = cleanApplicationDocumentText(input.checksumSha256, 64).toLowerCase();

  if (!allowed.has(contentType)) {
    throw new PublicApplicationPortalError('application_document_content_type_rejected', 415);
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes < 1 || sizeBytes > request.maxFileSizeBytes) {
    throw new PublicApplicationPortalError('application_document_size_rejected', 413);
  }
  if (!validDocumentChecksum(checksumSha256)) {
    throw new PublicApplicationPortalError('application_document_checksum_required', 400);
  }

  await enforceApplicationPortalRateLimit({
    scope: `application:document:upload:${access.applicationId}:${request.id}`,
    clientKey: input.clientKey,
    limit: UPLOAD_REQUEST_LIMIT,
    windowSeconds: UPLOAD_REQUEST_WINDOW_SECONDS,
  });

  const stalePending = await prisma.applicationDocumentFile.findMany({
    where: {
      requestId: request.id,
      state: 'PENDING',
      createdAt: { lt: new Date(Date.now() - 30 * 60 * 1000) },
    },
    select: { id: true, objectKey: true },
  });
  for (const pending of stalePending) {
    await discardPendingApplicationDocumentUpload(pending);
  }

  const recentPending = await prisma.applicationDocumentFile.findFirst({
    where: { requestId: request.id, state: 'PENDING' },
    select: { id: true },
  });
  if (recentPending) {
    throw new PublicApplicationPortalError('application_document_upload_pending', 409);
  }

  const fileName = safeApplicationDocumentFileName(input.fileName);
  const objectKey = applicationDocumentObjectKey({
    applicationId: access.applicationId,
    requestId: request.id,
  });

  let file: { id: string };
  try {
    file = await prisma.applicationDocumentFile.create({
      data: {
        requestId: request.id,
        objectKey,
        fileName,
        contentType,
        sizeBytes,
        checksumSha256,
        state: 'PENDING',
      },
      select: { id: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new PublicApplicationPortalError('application_document_upload_pending', 409);
    }
    throw error;
  }

  try {
    const signed = await presignApplicationDocumentUpload({
      objectKey,
      contentType,
      checksumSha256Hex: checksumSha256,
    });
    return { fileId: file.id, ...signed };
  } catch (error) {
    await prisma.applicationDocumentFile.update({
      where: { id: file.id },
      data: { state: 'REMOVED', removedAt: new Date() },
    });
    if (error instanceof ApplicationDocumentStorageError) {
      throw new PublicApplicationPortalError(error.code, error.status);
    }
    throw error;
  }
}

export async function confirmApplicationDocumentUpload(input: {
  referenceCode: unknown;
  token: string;
  requestId: string;
  fileId: string;
}) {
  const access = await applicationPortalAuthority(input);
  const request = await portalDocumentRequest({
    applicationId: access.applicationId,
    requestId: input.requestId,
  });

  if (!canApplicantUploadDocument(request.status as ApplicationDocumentRequestStatus)) {
    throw new PublicApplicationPortalError('application_document_upload_not_allowed', 409);
  }
  if (applicationDocumentRequestExpired(request.dueAt)) {
    throw new PublicApplicationPortalError('application_document_request_expired', 409);
  }

  const file = request.files.find((entry: any) => entry.id === input.fileId && entry.state === 'PENDING');
  if (!file) {
    throw new PublicApplicationPortalError('application_document_upload_not_found', 404);
  }

  let head;
  try {
    head = await headApplicationDocument(file.objectKey);
  } catch (error) {
    if (error instanceof ApplicationDocumentStorageError) {
      throw new PublicApplicationPortalError(error.code, error.status);
    }
    throw error;
  }

  if (Number(head.ContentLength ?? -1) !== file.sizeBytes) {
    return rejectPendingApplicationDocumentUpload(
      file,
      'application_document_size_mismatch',
      409,
    );
  }
  const headContentType = cleanApplicationDocumentText(head.ContentType, 160).toLowerCase();
  if (headContentType && headContentType !== file.contentType.toLowerCase()) {
    return rejectPendingApplicationDocumentUpload(
      file,
      'application_document_content_type_mismatch',
      409,
    );
  }
  const expectedChecksum = Buffer.from(file.checksumSha256, 'hex').toString('base64');
  const actualChecksum = cleanApplicationDocumentText(head.ChecksumSHA256, 200);
  if (!actualChecksum || actualChecksum !== expectedChecksum) {
    return rejectPendingApplicationDocumentUpload(
      file,
      'application_document_checksum_mismatch',
      409,
    );
  }

  let signatureMatches = false;
  try {
    signatureMatches = await verifyApplicationDocumentSignature(
      file.objectKey,
      file.contentType.toLowerCase(),
    );
  } catch (error) {
    if (error instanceof ApplicationDocumentStorageError) {
      throw new PublicApplicationPortalError(error.code, error.status);
    }
    throw error;
  }
  if (!signatureMatches) {
    return rejectPendingApplicationDocumentUpload(
      file,
      'application_document_signature_mismatch',
      415,
    );
  }

  const now = new Date();
  try {
    await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{
      id: string;
      status: ApplicationDocumentRequestStatus;
      dueAt: Date | null;
    }>>(Prisma.sql`
      SELECT r."id", r."status"::text AS "status", r."dueAt"
      FROM "ApplicationDocumentRequest" r
      JOIN "ApplicationDocumentCycle" c ON c."id" = r."cycleId"
      JOIN "Application" a ON a."id" = r."applicationId"
      WHERE r."id" = ${request.id}
        AND r."applicationId" = ${access.applicationId}
        AND c."status" = 'OPEN'
        AND a."status" = 'DOCUMENTS_REQUESTED'
      FOR UPDATE OF r
    `);

    const current = locked[0];
    if (!current || !canApplicantUploadDocument(current.status)) {
      throw new PublicApplicationPortalError('application_document_upload_not_allowed', 409);
    }
    if (applicationDocumentRequestExpired(current.dueAt)) {
      throw new PublicApplicationPortalError('application_document_request_expired', 409);
    }

    await tx.applicationDocumentFile.updateMany({
      where: {
        requestId: request.id,
        id: { not: file.id },
        state: 'AVAILABLE',
      },
      data: { state: 'SUPERSEDED' },
    });

    const fileChanged = await tx.applicationDocumentFile.updateMany({
      where: { id: file.id, requestId: request.id, state: 'PENDING' },
      data: { state: 'AVAILABLE', availableAt: now },
    });
    if (fileChanged.count !== 1) {
      throw new PublicApplicationPortalError('application_document_upload_state_changed', 409);
    }

    await tx.applicationDocumentRequest.update({
      where: { id: request.id },
      data: {
        status: 'RECEIVED',
        reviewedAt: null,
        reviewedByProfileId: null,
        reviewReason: null,
      },
    });

    await tx.applicationDocumentEvent.create({
      data: {
        applicationId: access.applicationId,
        cycleId: request.cycleId,
        requestId: request.id,
        fileId: file.id,
        action: 'UPLOADED',
        actorType: 'EXTERNAL_GUEST',
        actorRefId: access.id,
      },
    });

    await tx.auditLog.create({
      data: {
        actorType: 'EXTERNAL_GUEST',
        actorRefId: access.id,
        app: 'landing',
        action: 'application.document_uploaded',
        entityType: 'Application',
        entityId: access.applicationId,
        meta: {
          requestId: request.id,
          fileId: file.id,
          contentType: file.contentType,
          sizeBytes: file.sizeBytes,
        },
      },
    });
    });
  } catch (error) {
    if (
      error instanceof PublicApplicationPortalError &&
      (error.code === 'application_document_upload_not_allowed' ||
        error.code === 'application_document_request_expired')
    ) {
      await discardPendingApplicationDocumentUpload(file);
    }
    throw error;
  }

  return { ok: true, fileId: file.id, state: 'AVAILABLE' as const };
}

export async function removeApplicationDocumentUpload(input: {
  referenceCode: unknown;
  token: string;
  requestId: string;
  fileId: string;
}) {
  const access = await applicationPortalAuthority(input);
  const request = await portalDocumentRequest({
    applicationId: access.applicationId,
    requestId: input.requestId,
  });

  if (!canApplicantUploadDocument(request.status as ApplicationDocumentRequestStatus)) {
    throw new PublicApplicationPortalError('application_document_remove_not_allowed', 409);
  }
  if (applicationDocumentRequestExpired(request.dueAt)) {
    throw new PublicApplicationPortalError('application_document_request_expired', 409);
  }

  const file = request.files.find(
    (entry: any) =>
      entry.id === input.fileId &&
      (entry.state === 'PENDING' || entry.state === 'AVAILABLE'),
  );
  if (!file) {
    throw new PublicApplicationPortalError('application_document_upload_not_found', 404);
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{
      status: ApplicationDocumentRequestStatus;
      dueAt: Date | null;
    }>>(Prisma.sql`
      SELECT r."status"::text AS "status", r."dueAt"
      FROM "ApplicationDocumentRequest" r
      JOIN "ApplicationDocumentCycle" c ON c."id" = r."cycleId"
      JOIN "Application" a ON a."id" = r."applicationId"
      WHERE r."id" = ${request.id}
        AND r."applicationId" = ${access.applicationId}
        AND c."status" = 'OPEN'
        AND a."status" = 'DOCUMENTS_REQUESTED'
      FOR UPDATE OF r
    `);

    const current = locked[0];
    if (!current || !canApplicantUploadDocument(current.status)) {
      throw new PublicApplicationPortalError('application_document_remove_not_allowed', 409);
    }
    if (applicationDocumentRequestExpired(current.dueAt)) {
      throw new PublicApplicationPortalError('application_document_request_expired', 409);
    }

    const changed = await tx.applicationDocumentFile.updateMany({
      where: {
        id: file.id,
        requestId: request.id,
        state: { in: ['PENDING', 'AVAILABLE'] },
      },
      data: { state: 'REMOVED', removedAt: now },
    });
    if (changed.count !== 1) {
      throw new PublicApplicationPortalError('application_document_upload_state_changed', 409);
    }

    if (file.state === 'AVAILABLE' && current.status === 'RECEIVED') {
      await tx.applicationDocumentRequest.update({
        where: { id: request.id },
        data: { status: 'REQUESTED' },
      });
    }

    await tx.applicationDocumentEvent.create({
      data: {
        applicationId: access.applicationId,
        cycleId: request.cycleId,
        requestId: request.id,
        fileId: file.id,
        action: 'REMOVED',
        actorType: 'EXTERNAL_GUEST',
        actorRefId: access.id,
      },
    });
  });

  try {
    await deleteApplicationDocument(file.objectKey);
  } catch {
    // DB state is authoritative. Storage cleanup can be retried operationally.
  }

  return { ok: true, fileId: file.id, state: 'REMOVED' as const };
}

export function publicApplicationPortalResponse(error: unknown) {
  if (error instanceof PublicApplicationPortalError) {
    return { status: error.status, body: { ok: false, error: error.code } };
  }
  if (error instanceof ApplicationDocumentStorageError) {
    return { status: error.status, body: { ok: false, error: error.code } };
  }
  return null;
}
