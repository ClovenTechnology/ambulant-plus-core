import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { opportunityAvailability } from './opportunities-policy';
import { canTransitionApplication, publicApplicationContext } from './applications-policy';

export class PublicApplicationError extends Error {
  status: number;
  code: string;

  constructor(code: string, status = 400) {
    super(code);
    this.name = 'PublicApplicationError';
    this.status = status;
    this.code = code;
  }
}

export function applicationReferenceCode() {
  return `APP-${randomBytes(10).toString('hex').toUpperCase()}`;
}

export async function resolvePublicApplicationContext(input: {
  tx: Prisma.TransactionClient;
  value: unknown;
  formId: string;
}) {
  if (input.value === undefined || input.value === null) return null;

  const context = publicApplicationContext(input.value);
  if (!context) throw new PublicApplicationError('invalid_application_context', 400);

  const rows = await input.tx.$queryRaw<Array<{
    id: string;
    slug: string;
    status: string;
    opensAt: Date | null;
    closesAt: Date | null;
  }>>(Prisma.sql`
    SELECT
      o."id",
      o."slug",
      o."status"::text AS "status",
      o."opensAt",
      o."closesAt"
    FROM "Opportunity" o
    WHERE o."slug" = ${context.opportunitySlug}
      AND o."status" = 'PUBLISHED'
      AND o."visibility" IN ('PUBLIC', 'UNLISTED')
      AND o."applicationMode" = 'ENTERPRISE_FORM'
      AND o."applicationFormId" = ${input.formId}
    FOR SHARE OF o
  `);

  const opportunity = rows[0] || null;

  if (
    !opportunity ||
    opportunityAvailability({
      status: opportunity.status as 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'CLOSED' | 'ARCHIVED',
      opensAt: opportunity.opensAt,
      closesAt: opportunity.closesAt,
    }) !== 'OPEN'
  ) {
    throw new PublicApplicationError('opportunity_not_accepting_applications', 409);
  }

  return opportunity;
}

export async function assertDraftApplicationStillAccepting(input: {
  tx: Prisma.TransactionClient;
  submissionId: string;
  formId: string;
}) {
  const rows = await input.tx.$queryRaw<Array<{
    id: string;
    referenceCode: string;
    status: string;
    opportunityId: string;
    opportunityStatus: string;
    opportunityVisibility: string;
    applicationMode: string;
    applicationFormId: string | null;
    opensAt: Date | null;
    closesAt: Date | null;
  }>>(Prisma.sql`
    SELECT
      a."id",
      a."referenceCode",
      a."status"::text AS "status",
      o."id" AS "opportunityId",
      o."status"::text AS "opportunityStatus",
      o."visibility"::text AS "opportunityVisibility",
      o."applicationMode"::text AS "applicationMode",
      o."applicationFormId",
      o."opensAt",
      o."closesAt"
    FROM "Application" a
    JOIN "Opportunity" o ON o."id" = a."opportunityId"
    WHERE a."formSubmissionId" = ${input.submissionId}
    FOR UPDATE OF a, o
  `);

  const application = rows[0] || null;
  if (!application) return null;

  if (application.status !== 'DRAFT') {
    throw new PublicApplicationError('application_state_changed', 409);
  }

  const valid =
    application.opportunityVisibility !== 'INTERNAL' &&
    application.applicationMode === 'ENTERPRISE_FORM' &&
    application.applicationFormId === input.formId &&
    opportunityAvailability({
      status: application.opportunityStatus as 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'CLOSED' | 'ARCHIVED',
      opensAt: application.opensAt,
      closesAt: application.closesAt,
    }) === 'OPEN';

  if (!valid) {
    throw new PublicApplicationError('opportunity_not_accepting_applications', 409);
  }

  return {
    id: application.id,
    referenceCode: application.referenceCode,
    opportunityId: application.opportunityId,
  };
}

export async function submitDraftApplication(input: {
  tx: Prisma.TransactionClient;
  applicationId: string;
  submissionId: string;
  applicantEmailNormalized: string | null;
  now: Date;
}) {
  if (!canTransitionApplication('DRAFT', 'SUBMITTED')) {
    throw new PublicApplicationError('application_transition_not_allowed', 409);
  }

  const changed = await input.tx.application.updateMany({
    where: {
      id: input.applicationId,
      formSubmissionId: input.submissionId,
      status: 'DRAFT',
    },
    data: {
      status: 'SUBMITTED',
      applicantEmailNormalized: input.applicantEmailNormalized,
      submittedAt: input.now,
      statusChangedAt: input.now,
      statusReason: null,
    },
  });

  if (changed.count !== 1) {
    throw new PublicApplicationError('application_state_changed', 409);
  }

  await input.tx.applicationStatusEvent.create({
    data: {
      applicationId: input.applicationId,
      fromStatus: 'DRAFT',
      toStatus: 'SUBMITTED',
      actorType: 'EXTERNAL_GUEST',
      actorRefId: input.submissionId,
      metadata: {
        source: 'enterprise_form_runtime',
      },
    },
  });
}
