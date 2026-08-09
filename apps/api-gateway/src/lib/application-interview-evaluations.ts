import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { AdminStaffActor } from '@/src/lib/admin-staff-auth';
import {
  hasApplicationScope,
} from '@/src/lib/admin-application-access';
import {
  hasEnterpriseFormScope,
} from '@/src/lib/admin-form-access';
import {
  enterpriseFormVersionStructureInclude,
  toEnterpriseFormDefinition,
} from '@/src/lib/admin-forms';
import {
  consentTextHash,
  derivePublicFormValues,
  validatePublicFormAnswers,
} from '@/src/lib/public-forms-policy';
import {
  APPLICATION_INTERVIEW_CONTEXT_TYPE,
} from '@/src/lib/application-interviews-policy';
import {
  APPLICATION_INTERVIEW_EVALUATION_CONTEXT_TYPE,
  aggregateInterviewEvaluationScore,
  canMakeApplicationInterviewDecision,
  canStartApplicationInterviewEvaluation,
  canSubmitApplicationInterviewEvaluation,
  cleanApplicationInterviewEvaluationText,
  evaluationFormCompatibility,
  type ApplicationInterviewEvaluationDecision,
} from '@/src/lib/application-interview-evaluations-policy';
import { sendEmail } from '@/src/lib/mailer';

export class ApplicationInterviewEvaluationError extends Error {
  code: string;
  status: number;
  detail?: unknown;

  constructor(code: string, status = 400, detail?: unknown) {
    super(code);
    this.name = 'ApplicationInterviewEvaluationError';
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

const evaluationFormInclude = {
  form: true,
  ...enterpriseFormVersionStructureInclude,
} satisfies Prisma.EnterpriseFormVersionInclude;

const evaluationCycleInclude = {
  application: {
    select: {
      id: true,
      referenceCode: true,
      status: true,
      applicantEmailNormalized: true,
      opportunity: { select: { title: true } },
    },
  },
  meeting: {
    select: {
      id: true,
      state: true,
      startsAt: true,
      endsAt: true,
      endedAt: true,
      timezone: true,
      title: true,
    },
  },
  formVersion: {
    include: evaluationFormInclude,
  },
  evaluations: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      evaluatorProfile: {
        select: {
          id: true,
          email: true,
          name: true,
          designation: { select: { name: true } },
        },
      },
      waivedByProfile: {
        select: { id: true, name: true, email: true },
      },
      formSubmission: {
        include: {
          answers: { orderBy: { createdAt: 'asc' as const } },
        },
      },
    },
  },
  decisions: {
    orderBy: { createdAt: 'desc' as const },
    include: {
      actorProfile: { select: { id: true, name: true, email: true } },
    },
  },
} satisfies Prisma.ApplicationInterviewEvaluationCycleInclude;

type EvaluationCycleRow = Prisma.ApplicationInterviewEvaluationCycleGetPayload<{
  include: typeof evaluationCycleInclude;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normaliseEmail(value: unknown) {
  const email = cleanApplicationInterviewEvaluationText(value, 320).toLowerCase();
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function flattenDbFields(version: any) {
  const fields: any[] = [];
  for (const page of version?.pages ?? []) {
    for (const section of page?.sections ?? []) {
      for (const field of section?.fields ?? []) fields.push(field);
    }
  }
  return fields;
}

function answerMap(submission: any) {
  const out: Record<string, unknown> = {};
  for (const answer of submission?.answers ?? []) {
    out[String(answer.fieldKey)] = answer.value;
  }
  return out;
}

function interviewParticipantAttended(participant: any) {
  return Boolean(
    participant?.firstJoinedAt ||
      (Array.isArray(participant?.attendanceSessions) &&
        participant.attendanceSessions.length > 0),
  );
}

function calculatedEvaluationFieldKeys(definition: any) {
  const keys = new Set<string>();
  for (const page of definition?.pages ?? []) {
    for (const section of page?.sections ?? []) {
      for (const field of section?.fields ?? []) {
        if (field.calculation != null) keys.add(String(field.key));
      }
    }
  }
  for (const rule of definition?.rules ?? []) {
    if (rule?.enabled === false || String(rule?.kind) !== 'CALCULATION') continue;
    if (!isRecord(rule.effect)) continue;
    const target = cleanApplicationInterviewEvaluationText(rule.effect.target, 120);
    if (target) keys.add(target);
  }
  return keys;
}

function clientEvaluationDefinition(version: any) {
  const definition = toEnterpriseFormDefinition(version);
  const calculatedFieldKeys = calculatedEvaluationFieldKeys(definition);
  return {
    pages: definition.pages.map((page) => ({
      key: page.key,
      title: page.title,
      description: page.description ?? null,
      order: page.order,
      sections: page.sections.map((section) => ({
        key: section.key,
        title: section.title,
        description: section.description ?? null,
        order: section.order,
        fields: section.fields.map((field) => ({
          key: field.key,
          type: field.type,
          label: field.label,
          helpText: field.helpText ?? null,
          placeholder: field.placeholder ?? null,
          order: field.order,
          required: field.required === true,
          sensitive: field.sensitive === true,
          calculated: calculatedFieldKeys.has(field.key),
          defaultValue: field.defaultValue ?? null,
          validation: field.validation ?? null,
          config: field.config ?? null,
          options: (field.options ?? []).map((option) => ({
            key: option.key,
            label: option.label,
            value: option.value,
            order: option.order,
          })),
        })),
      })),
    })),
  };
}

async function latestApplicationInterviewForEvaluation(
  applicationId: string,
  tx: Prisma.TransactionClient = prisma,
) {
  return tx.meeting.findFirst({
    where: {
      kind: 'INTERVIEW',
      contextType: APPLICATION_INTERVIEW_CONTEXT_TYPE,
      contextId: applicationId,
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: {
      participants: {
        orderBy: { invitedAt: 'asc' },
        include: {
          attendanceSessions: {
            select: { id: true },
            take: 1,
          },
          staffProfile: {
            select: {
              id: true,
              email: true,
              name: true,
              lifecycleState: true,
            },
          },
        },
      },
    },
  });
}

function interviewAttendance(meeting: any) {
  const interviewee = (meeting?.participants ?? []).find(
    (participant: any) =>
      participant.participantType === 'EXTERNAL_GUEST' &&
      participant.role === 'INTERVIEWEE',
  );

  const evaluators = (meeting?.participants ?? []).filter(
    (participant: any) =>
      participant.participantType === 'INTERNAL_STAFF' &&
      ['HOST', 'COHOST'].includes(String(participant.role)) &&
      participant.staffProfileId &&
      participant.staffProfile?.lifecycleState === 'ACTIVE' &&
      interviewParticipantAttended(participant),
  );

  return {
    intervieweeAttended: interviewParticipantAttended(interviewee),
    evaluators,
  };
}

export async function listPublishedInternalEvaluationForms() {
  const versions = await prisma.enterpriseFormVersion.findMany({
    where: {
      state: 'PUBLISHED',
      accessMode: 'INTERNAL',
      form: { status: 'ACTIVE' },
    },
    orderBy: [{ publishedAt: 'desc' }, { versionNumber: 'desc' }],
    take: 100,
    include: evaluationFormInclude,
  });

  return versions
    .map((version) => {
      const compatibilityIssues = evaluationFormCompatibility(
        toEnterpriseFormDefinition(version),
      );
      return {
        id: version.id,
        formId: version.formId,
        formKey: version.form.key,
        formName: version.form.name,
        title: version.title,
        versionNumber: version.versionNumber,
        compatibilityIssues,
      };
    })
    .filter((version) => version.compatibilityIssues.length === 0);
}

async function latestEvaluationCycle(applicationId: string) {
  return prisma.applicationInterviewEvaluationCycle.findFirst({
    where: { applicationId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: evaluationCycleInclude,
  });
}

function serializeEvaluationAnswers(input: {
  cycle: EvaluationCycleRow;
  actor: AdminStaffActor;
}) {
  const canReadPanel =
    hasApplicationScope(input.actor, 'applications.decision') &&
    hasEnterpriseFormScope(input.actor, 'forms.submissions.read');
  const canReadSensitive =
    canReadPanel &&
    hasEnterpriseFormScope(input.actor, 'forms.submissions.sensitive.read');

  const dbFields = new Map(
    flattenDbFields(input.cycle.formVersion).map((field) => [String(field.key), field]),
  );

  return input.cycle.evaluations.map((evaluation) => {
    const isSelf = evaluation.evaluatorProfileId === input.actor.profileId;
    const mayReadAnswers = isSelf || (canReadPanel && evaluation.state === 'SUBMITTED');

    const answers = mayReadAnswers
      ? evaluation.formSubmission.answers.map((answer) => {
          const field = dbFields.get(String(answer.fieldKey));
          const sensitive = field?.sensitive === true;
          const redacted = sensitive && !isSelf && !canReadSensitive;
          return {
            fieldKey: answer.fieldKey,
            label: field?.label || answer.fieldKey,
            sensitive,
            redacted,
            value: redacted ? null : answer.value,
          };
        })
      : [];

    return {
      id: evaluation.id,
      evaluatorProfileId: evaluation.evaluatorProfileId,
      evaluator: evaluation.evaluatorProfile,
      state: evaluation.state,
      score:
        evaluation.state === 'SUBMITTED' && (isSelf || canReadPanel)
          ? evaluation.score
          : null,
      submittedAt: evaluation.submittedAt,
      waivedAt: evaluation.waivedAt,
      waivedBy: isSelf || canReadPanel ? evaluation.waivedByProfile : null,
      waiverReason: isSelf || canReadPanel ? evaluation.waiverReason : null,
      isSelf,
      answers,
    };
  });
}

export async function getApplicationInterviewEvaluationWorkspace(input: {
  applicationId: string;
  actor: AdminStaffActor;
}) {
  const application = await prisma.application.findUnique({
    where: { id: input.applicationId },
    select: {
      id: true,
      referenceCode: true,
      status: true,
    },
  });

  if (!application) {
    throw new ApplicationInterviewEvaluationError('application_not_found', 404);
  }

  const meeting = await latestApplicationInterviewForEvaluation(input.applicationId);
  const attendance = meeting
    ? interviewAttendance(meeting)
    : { intervieweeAttended: false, evaluators: [] as any[] };
  const cycle = await latestEvaluationCycle(input.applicationId);

  const canEvaluate = hasApplicationScope(
    input.actor,
    'applications.interviews.evaluate',
  );
  const canDecision = hasApplicationScope(input.actor, 'applications.decision');
  const canReadPanel =
    canDecision && hasEnterpriseFormScope(input.actor, 'forms.submissions.read');
  const canReadSensitive =
    canReadPanel &&
    hasEnterpriseFormScope(input.actor, 'forms.submissions.sensitive.read');
  const canStart =
    canDecision &&
    Boolean(meeting) &&
    canStartApplicationInterviewEvaluation({
      applicationStatus: application.status,
      meetingState: meeting?.state || '',
      intervieweeAttended: attendance.intervieweeAttended,
      attendingEvaluatorCount: attendance.evaluators.length,
    }) &&
    !cycle;

  const selfEvaluation = cycle?.evaluations.find(
    (evaluation) => evaluation.evaluatorProfileId === input.actor.profileId,
  );

  return {
    application,
    eligibility: {
      meetingId: meeting?.id || null,
      meetingState: meeting?.state || null,
      intervieweeAttended: attendance.intervieweeAttended,
      attendingEvaluatorCount: attendance.evaluators.length,
      canStart,
    },
    permissions: {
      canEvaluate,
      canDecision,
      canReadPanel,
      canReadSensitive,
      canEvaluateSelf: Boolean(
        canEvaluate && cycle?.status === 'OPEN' && selfEvaluation?.state === 'DRAFT',
      ),
    },
    formOptions: canStart ? await listPublishedInternalEvaluationForms() : [],
    cycle: cycle
      ? {
          id: cycle.id,
          status: cycle.status,
          aggregateScore: canDecision ? cycle.aggregateScore : null,
          openedAt: cycle.openedAt,
          completedAt: cycle.completedAt,
          meeting: cycle.meeting,
          form: {
            id: cycle.formVersion.form.id,
            key: cycle.formVersion.form.key,
            name: cycle.formVersion.form.name,
            versionId: cycle.formVersionId,
            versionNumber: cycle.formVersion.versionNumber,
            title: cycle.formVersion.title,
          },
          definition: clientEvaluationDefinition(cycle.formVersion),
          evaluations: serializeEvaluationAnswers({ cycle, actor: input.actor }),
          selfAnswers: selfEvaluation ? answerMap(selfEvaluation.formSubmission) : {},
          decisions: canDecision
            ? cycle.decisions.map((decision) => ({
                id: decision.id,
                decision: decision.decision,
                fromStatus: decision.fromStatus,
                reason: decision.reason,
                applicantMessage: decision.applicantMessage,
                aggregateScore: decision.aggregateScore,
                createdAt: decision.createdAt,
                actor: decision.actorProfile,
              }))
            : [],
        }
      : null,
  };
}

export async function startApplicationInterviewEvaluationCycle(input: {
  applicationId: string;
  formVersionId: unknown;
  actor: AdminStaffActor;
  userAgent?: string | null;
}) {
  const formVersionId = cleanApplicationInterviewEvaluationText(
    input.formVersionId,
    240,
  );
  if (!formVersionId) {
    throw new ApplicationInterviewEvaluationError(
      'application_interview_evaluation_form_required',
      400,
    );
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string; status: string }>>(Prisma.sql`
        SELECT "id", "status"::text AS "status"
        FROM "Application"
        WHERE "id" = ${input.applicationId}
        FOR UPDATE
      `);
      const current = locked[0];
      if (!current) {
        throw new ApplicationInterviewEvaluationError('application_not_found', 404);
      }

      const existing = await tx.applicationInterviewEvaluationCycle.findFirst({
        where: { applicationId: current.id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
      if (existing) {
        throw new ApplicationInterviewEvaluationError(
          'application_interview_evaluation_cycle_exists',
          409,
        );
      }

      const meeting = await latestApplicationInterviewForEvaluation(current.id, tx);
      if (!meeting) {
        throw new ApplicationInterviewEvaluationError(
          'application_interview_not_found',
          404,
        );
      }

      const attendance = interviewAttendance(meeting);
      if (
        !canStartApplicationInterviewEvaluation({
          applicationStatus: current.status,
          meetingState: meeting.state,
          intervieweeAttended: attendance.intervieweeAttended,
          attendingEvaluatorCount: attendance.evaluators.length,
        })
      ) {
        throw new ApplicationInterviewEvaluationError(
          'application_interview_evaluation_not_ready',
          409,
          {
            applicationStatus: current.status,
            meetingState: meeting.state,
            intervieweeAttended: attendance.intervieweeAttended,
            attendingEvaluatorCount: attendance.evaluators.length,
          },
        );
      }

      const formVersion = await tx.enterpriseFormVersion.findFirst({
        where: {
          id: formVersionId,
          state: 'PUBLISHED',
          accessMode: 'INTERNAL',
          form: { status: 'ACTIVE' },
        },
        include: evaluationFormInclude,
      });
      if (!formVersion) {
        throw new ApplicationInterviewEvaluationError(
          'application_interview_evaluation_form_not_available',
          409,
        );
      }

      const compatibilityIssues = evaluationFormCompatibility(
        toEnterpriseFormDefinition(formVersion),
      );
      if (compatibilityIssues.length) {
        throw new ApplicationInterviewEvaluationError(
          'application_interview_evaluation_form_incompatible',
          409,
          compatibilityIssues,
        );
      }

      const cycle = await tx.applicationInterviewEvaluationCycle.create({
        data: {
          applicationId: current.id,
          meetingId: meeting.id,
          formVersionId: formVersion.id,
          openedByProfileId: input.actor.profileId,
        },
      });

      for (const participant of attendance.evaluators) {
        const evaluator = participant.staffProfile;
        if (!evaluator?.id) continue;

        const submission = await tx.enterpriseFormSubmission.create({
          data: {
            formId: formVersion.formId,
            versionId: formVersion.id,
            status: 'DRAFT',
            identityEmailNormalized: normaliseEmail(evaluator.email),
            contextType: APPLICATION_INTERVIEW_EVALUATION_CONTEXT_TYPE,
            contextId: cycle.id,
            locale: formVersion.locale,
            source: 'ADMIN_APPLICATION_INTERVIEW_EVALUATION',
            metadata: asJson({
              applicationId: current.id,
              meetingId: meeting.id,
              evaluationCycleId: cycle.id,
              evaluatorProfileId: evaluator.id,
            }),
          },
        });

        await tx.applicationInterviewEvaluation.create({
          data: {
            cycleId: cycle.id,
            evaluatorProfileId: evaluator.id,
            formSubmissionId: submission.id,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorUserId: input.actor.userId,
          actorType: 'ADMIN',
          actorRefId: input.actor.profileId,
          app: 'admin-dashboard',
          action: 'application.interview_evaluation.opened',
          entityType: 'Application',
          entityId: current.id,
          userAgent: input.userAgent || undefined,
          meta: {
            meetingId: meeting.id,
            evaluationCycleId: cycle.id,
            formVersionId: formVersion.id,
            evaluatorCount: attendance.evaluators.length,
          },
        },
      });

      return cycle;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ApplicationInterviewEvaluationError(
        'application_interview_evaluation_cycle_exists',
        409,
      );
    }
    throw error;
  }
}

async function evaluationForActor(
  applicationId: string,
  actor: AdminStaffActor,
  db: Prisma.TransactionClient = prisma,
) {
  const evaluation = await db.applicationInterviewEvaluation.findFirst({
    where: {
      evaluatorProfileId: actor.profileId,
      cycle: { applicationId },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    include: {
      cycle: {
        include: {
          application: { select: { id: true, status: true } },
          meeting: { select: { id: true, state: true } },
          formVersion: { include: evaluationFormInclude },
        },
      },
      formSubmission: {
        include: { answers: true, consents: true },
      },
    },
  });

  if (!evaluation) {
    throw new ApplicationInterviewEvaluationError(
      'application_interview_evaluation_not_assigned',
      403,
    );
  }
  return evaluation;
}

async function persistEvaluationAnswers(input: {
  tx: Prisma.TransactionClient;
  submission: any;
  version: any;
  answers: Record<string, unknown>;
}) {
  const fields = flattenDbFields(input.version);
  const byKey = new Map(fields.map((field) => [String(field.key), field]));

  for (const [fieldKey, value] of Object.entries(input.answers)) {
    const field = byKey.get(fieldKey);
    if (!field) {
      throw new ApplicationInterviewEvaluationError(
        'application_interview_evaluation_unknown_field',
        400,
        { fieldKey },
      );
    }
    if (field.type === 'INFORMATION' || field.calculation != null) {
      continue;
    }

    await input.tx.enterpriseFormSubmissionAnswer.upsert({
      where: {
        submissionId_fieldId: {
          submissionId: input.submission.id,
          fieldId: field.id,
        },
      },
      create: {
        submissionId: input.submission.id,
        fieldId: field.id,
        fieldKey,
        value: asJson(value),
      },
      update: {
        fieldKey,
        value: asJson(value),
      },
    });

    if (field.type === 'CONSENT') {
      await input.tx.enterpriseFormConsentEvidence.upsert({
        where: {
          submissionId_fieldId: {
            submissionId: input.submission.id,
            fieldId: field.id,
          },
        },
        create: {
          submissionId: input.submission.id,
          fieldId: field.id,
          fieldKey,
          accepted: value === true,
          consentTextHash: consentTextHash(field),
          acceptedAt: value === true ? new Date() : null,
          evidence: asJson({ source: 'admin_application_interview_evaluation' }),
        },
        update: {
          fieldKey,
          accepted: value === true,
          consentTextHash: consentTextHash(field),
          acceptedAt: value === true ? new Date() : null,
          evidence: asJson({ source: 'admin_application_interview_evaluation' }),
        },
      });
    }
  }

  const touched = await input.tx.enterpriseFormSubmission.updateMany({
    where: { id: input.submission.id, status: 'DRAFT' },
    data: { lastSavedAt: new Date() },
  });
  if (touched.count !== 1) {
    throw new ApplicationInterviewEvaluationError(
      'application_interview_evaluation_not_editable',
      409,
    );
  }
}

function editableEvaluationAnswerPatch(
  version: any,
  incoming: Record<string, unknown>,
) {
  const fields = new Map(
    flattenDbFields(version).map((field) => [String(field.key), field]),
  );
  const calculatedFieldKeys = calculatedEvaluationFieldKeys(
    toEnterpriseFormDefinition(version),
  );
  const out: Record<string, unknown> = {};

  for (const [fieldKey, value] of Object.entries(incoming)) {
    const field = fields.get(fieldKey) as any;
    if (!field) {
      throw new ApplicationInterviewEvaluationError(
        'application_interview_evaluation_unknown_field',
        400,
        { fieldKey },
      );
    }
    if (field.type === 'INFORMATION' || calculatedFieldKeys.has(fieldKey)) continue;
    out[fieldKey] = value;
  }

  return out;
}

async function lockFreshEvaluationForActor(input: {
  tx: Prisma.TransactionClient;
  evaluationId: string;
  applicationId: string;
  actor: AdminStaffActor;
}) {
  const locked = await input.tx.$queryRaw<Array<{ id: string; state: string }>>(Prisma.sql`
    SELECT "id", "state"::text AS "state"
    FROM "ApplicationInterviewEvaluation"
    WHERE "id" = ${input.evaluationId}
    FOR UPDATE
  `);

  if (!locked[0]) {
    throw new ApplicationInterviewEvaluationError(
      'application_interview_evaluation_not_assigned',
      403,
    );
  }

  const evaluation = await evaluationForActor(
    input.applicationId,
    input.actor,
    input.tx,
  );

  if (evaluation.id !== input.evaluationId) {
    throw new ApplicationInterviewEvaluationError(
      'application_interview_evaluation_status_conflict',
      409,
    );
  }

  if (
    !canSubmitApplicationInterviewEvaluation({
      applicationStatus: evaluation.cycle.application.status,
      cycleStatus: evaluation.cycle.status,
      evaluationState: evaluation.state,
      meetingState: evaluation.cycle.meeting.state,
    })
  ) {
    throw new ApplicationInterviewEvaluationError(
      'application_interview_evaluation_not_editable',
      409,
    );
  }

  return evaluation;
}

export async function saveOwnApplicationInterviewEvaluation(input: {
  applicationId: string;
  answers: unknown;
  actor: AdminStaffActor;
}) {
  const initial = await evaluationForActor(input.applicationId, input.actor);
  const incoming = isRecord(input.answers) ? input.answers : null;
  if (!incoming) {
    throw new ApplicationInterviewEvaluationError(
      'application_interview_evaluation_answers_required',
      400,
    );
  }

  await prisma.$transaction(async (tx) => {
    const evaluation = await lockFreshEvaluationForActor({
      tx,
      evaluationId: initial.id,
      applicationId: input.applicationId,
      actor: input.actor,
    });

    const patch = editableEvaluationAnswerPatch(
      evaluation.cycle.formVersion,
      incoming,
    );
    const definition = toEnterpriseFormDefinition(evaluation.cycle.formVersion);
    const merged = { ...answerMap(evaluation.formSubmission), ...patch };
    const issues = validatePublicFormAnswers({
      definition,
      answers: merged,
      mode: 'draft',
    });
    if (issues.length) {
      throw new ApplicationInterviewEvaluationError(
        'application_interview_evaluation_validation_failed',
        422,
        issues.slice(0, 50),
      );
    }

    await persistEvaluationAnswers({
      tx,
      submission: evaluation.formSubmission,
      version: evaluation.cycle.formVersion,
      answers: patch,
    });
  });

  return { ok: true };
}

async function finalizeCycleIfReady(input: {
  tx: Prisma.TransactionClient;
  cycleId: string;
  actor: AdminStaffActor;
  now: Date;
}) {
  const lockedCycles = await input.tx.$queryRaw<
    Array<{ id: string; applicationId: string; status: string }>
  >(Prisma.sql`
    SELECT "id", "applicationId", "status"::text AS "status"
    FROM "ApplicationInterviewEvaluationCycle"
    WHERE "id" = ${input.cycleId}
    FOR UPDATE
  `);
  const cycle = lockedCycles[0];
  if (!cycle || cycle.status !== 'OPEN') return false;

  const evaluations = await input.tx.applicationInterviewEvaluation.findMany({
    where: { cycleId: input.cycleId },
    select: { id: true, state: true, score: true },
  });
  if (evaluations.some((evaluation) => evaluation.state === 'DRAFT')) return false;

  const submitted = evaluations.filter((evaluation) => evaluation.state === 'SUBMITTED');
  if (!submitted.length) {
    throw new ApplicationInterviewEvaluationError(
      'application_interview_evaluation_submission_required',
      409,
    );
  }

  const lockedApplication = await input.tx.$queryRaw<
    Array<{ id: string; status: string }>
  >(Prisma.sql`
    SELECT "id", "status"::text AS "status"
    FROM "Application"
    WHERE "id" = ${cycle.applicationId}
    FOR UPDATE
  `);
  const application = lockedApplication[0];
  if (!application || application.status !== 'INTERVIEW_SCHEDULED') {
    throw new ApplicationInterviewEvaluationError(
      'application_interview_evaluation_status_conflict',
      409,
    );
  }

  const aggregateScore = aggregateInterviewEvaluationScore(
    submitted.map((evaluation) => evaluation.score),
  );

  const completed = await input.tx.applicationInterviewEvaluationCycle.updateMany({
    where: { id: cycle.id, status: 'OPEN' },
    data: {
      status: 'COMPLETED',
      aggregateScore,
      completedAt: input.now,
      completedByProfileId: input.actor.profileId,
    },
  });
  if (completed.count !== 1) return false;

  const moved = await input.tx.application.updateMany({
    where: { id: application.id, status: 'INTERVIEW_SCHEDULED' },
    data: {
      status: 'INTERVIEWED',
      statusReason: null,
      statusChangedAt: input.now,
      lastReviewedAt: input.now,
    },
  });
  if (moved.count !== 1) {
    throw new ApplicationInterviewEvaluationError(
      'application_interview_evaluation_status_conflict',
      409,
    );
  }

  await input.tx.applicationStatusEvent.create({
    data: {
      applicationId: application.id,
      fromStatus: 'INTERVIEW_SCHEDULED',
      toStatus: 'INTERVIEWED',
      actorType: 'ADMIN',
      actorRefId: input.actor.profileId,
      metadata: {
        source: 'application_interview_evaluation_completed',
        evaluationCycleId: cycle.id,
        aggregateScore,
        submittedEvaluations: submitted.length,
        waivedEvaluations: evaluations.filter((evaluation) => evaluation.state === 'WAIVED').length,
      },
    },
  });

  await input.tx.auditLog.create({
    data: {
      actorUserId: input.actor.userId,
      actorType: 'ADMIN',
      actorRefId: input.actor.profileId,
      app: 'admin-dashboard',
      action: 'application.interview_evaluation.completed',
      entityType: 'Application',
      entityId: application.id,
      meta: {
        evaluationCycleId: cycle.id,
        aggregateScore,
        submittedEvaluations: submitted.length,
      },
    },
  });

  return true;
}

export async function submitOwnApplicationInterviewEvaluation(input: {
  applicationId: string;
  answers?: unknown;
  actor: AdminStaffActor;
}) {
  const initial = await evaluationForActor(input.applicationId, input.actor);
  const incoming = input.answers === undefined
    ? {}
    : isRecord(input.answers)
      ? input.answers
      : null;
  if (!incoming) {
    throw new ApplicationInterviewEvaluationError(
      'application_interview_evaluation_answers_required',
      400,
    );
  }

  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const evaluation = await lockFreshEvaluationForActor({
      tx,
      evaluationId: initial.id,
      applicationId: input.applicationId,
      actor: input.actor,
    });

    const patch = editableEvaluationAnswerPatch(
      evaluation.cycle.formVersion,
      incoming,
    );
    const definition = toEnterpriseFormDefinition(evaluation.cycle.formVersion);
    const answers = { ...answerMap(evaluation.formSubmission), ...patch };
    const derived = derivePublicFormValues(definition, answers);
    const effectiveAnswers = { ...answers, ...derived.calculations };
    const issues = validatePublicFormAnswers({
      definition,
      answers: effectiveAnswers,
      mode: 'submit',
    });
    if (issues.length) {
      throw new ApplicationInterviewEvaluationError(
        'application_interview_evaluation_validation_failed',
        422,
        issues.slice(0, 100),
      );
    }

    await persistEvaluationAnswers({
      tx,
      submission: evaluation.formSubmission,
      version: evaluation.cycle.formVersion,
      answers: patch,
    });

    const dbFields = new Map(
      flattenDbFields(evaluation.cycle.formVersion).map((field) => [String(field.key), field]),
    );
    for (const [fieldKey, value] of Object.entries(derived.calculations)) {
      const field = dbFields.get(fieldKey) as any;
      if (!field) continue;
      await tx.enterpriseFormSubmissionAnswer.upsert({
        where: {
          submissionId_fieldId: {
            submissionId: evaluation.formSubmission.id,
            fieldId: field.id,
          },
        },
        create: {
          submissionId: evaluation.formSubmission.id,
          fieldId: field.id,
          fieldKey,
          value: asJson(value),
        },
        update: { fieldKey, value: asJson(value) },
      });
    }

    const claimed = await tx.applicationInterviewEvaluation.updateMany({
      where: {
        id: evaluation.id,
        evaluatorProfileId: input.actor.profileId,
        state: 'DRAFT',
        cycle: {
          status: 'OPEN',
          application: { status: 'INTERVIEW_SCHEDULED' },
          meeting: { state: 'ENDED' },
        },
      },
      data: {
        state: 'SUBMITTED',
        score: derived.score,
        calculations: asJson(derived.calculations),
        submittedAt: now,
      },
    });
    if (claimed.count !== 1) {
      throw new ApplicationInterviewEvaluationError(
        'application_interview_evaluation_status_conflict',
        409,
      );
    }

    const existingMetadata = isRecord(evaluation.formSubmission.metadata)
      ? evaluation.formSubmission.metadata
      : {};
    const submitted = await tx.enterpriseFormSubmission.updateMany({
      where: { id: evaluation.formSubmission.id, status: 'DRAFT' },
      data: {
        status: 'SUBMITTED',
        submittedAt: now,
        lastSavedAt: now,
        metadata: asJson({
          ...existingMetadata,
          runtime: {
            calculations: derived.calculations,
            score: derived.score,
            submittedVersionId: evaluation.cycle.formVersion.id,
            kind: 'application_interview_evaluation',
          },
        }),
      },
    });
    if (submitted.count !== 1) {
      throw new ApplicationInterviewEvaluationError(
        'application_interview_evaluation_status_conflict',
        409,
      );
    }

    await tx.auditLog.create({
      data: {
        actorUserId: input.actor.userId,
        actorType: 'ADMIN',
        actorRefId: input.actor.profileId,
        app: 'admin-dashboard',
        action: 'application.interview_evaluation.submitted',
        entityType: 'ApplicationInterviewEvaluation',
        entityId: evaluation.id,
        meta: {
          applicationId: input.applicationId,
          evaluationCycleId: evaluation.cycle.id,
          formSubmissionId: evaluation.formSubmission.id,
          score: derived.score,
        },
      },
    });

    const completed = await finalizeCycleIfReady({
      tx,
      cycleId: evaluation.cycle.id,
      actor: input.actor,
      now,
    });

    return { completed, score: derived.score };
  });

  return { ok: true, ...result };
}

export async function waiveApplicationInterviewEvaluation(input: {
  applicationId: string;
  evaluationId: string;
  reason: unknown;
  actor: AdminStaffActor;
}) {
  const reason = cleanApplicationInterviewEvaluationText(input.reason, 1000);
  if (!reason) {
    throw new ApplicationInterviewEvaluationError(
      'application_interview_evaluation_waiver_reason_required',
      400,
    );
  }

  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const evaluation = await tx.applicationInterviewEvaluation.findFirst({
      where: {
        id: input.evaluationId,
        cycle: { applicationId: input.applicationId },
      },
      include: {
        cycle: {
          include: {
            application: { select: { status: true } },
            meeting: { select: { state: true } },
          },
        },
      },
    });
    if (!evaluation) {
      throw new ApplicationInterviewEvaluationError(
        'application_interview_evaluation_not_found',
        404,
      );
    }
    if (
      !canSubmitApplicationInterviewEvaluation({
        applicationStatus: evaluation.cycle.application.status,
        cycleStatus: evaluation.cycle.status,
        evaluationState: evaluation.state,
        meetingState: evaluation.cycle.meeting.state,
      })
    ) {
      throw new ApplicationInterviewEvaluationError(
        'application_interview_evaluation_not_waivable',
        409,
      );
    }

    const otherEvaluations = await tx.applicationInterviewEvaluation.findMany({
      where: { cycleId: evaluation.cycleId, id: { not: evaluation.id } },
      select: { state: true },
    });
    if (
      !otherEvaluations.some((item) => item.state === 'SUBMITTED') &&
      !otherEvaluations.some((item) => item.state === 'DRAFT')
    ) {
      throw new ApplicationInterviewEvaluationError(
        'application_interview_evaluation_submission_required',
        409,
      );
    }

    const waived = await tx.applicationInterviewEvaluation.updateMany({
      where: { id: evaluation.id, state: 'DRAFT' },
      data: {
        state: 'WAIVED',
        waivedAt: now,
        waivedByProfileId: input.actor.profileId,
        waiverReason: reason,
      },
    });
    if (waived.count !== 1) {
      throw new ApplicationInterviewEvaluationError(
        'application_interview_evaluation_status_conflict',
        409,
      );
    }

    await tx.enterpriseFormSubmission.updateMany({
      where: { id: evaluation.formSubmissionId, status: 'DRAFT' },
      data: { status: 'ABANDONED', expiresAt: now, lastSavedAt: now },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: input.actor.userId,
        actorType: 'ADMIN',
        actorRefId: input.actor.profileId,
        app: 'admin-dashboard',
        action: 'application.interview_evaluation.waived',
        entityType: 'ApplicationInterviewEvaluation',
        entityId: evaluation.id,
        description: reason,
        meta: {
          applicationId: input.applicationId,
          evaluationCycleId: evaluation.cycleId,
          evaluatorProfileId: evaluation.evaluatorProfileId,
        },
      },
    });

    const completed = await finalizeCycleIfReady({
      tx,
      cycleId: evaluation.cycleId,
      actor: input.actor,
      now,
    });

    return { ok: true, completed };
  });
}

async function deliverDecisionNotification(input: {
  outboxId: string;
  recipientEmail: string;
  subject: string;
  text: string;
  html: string;
}) {
  const sent = await sendEmail(
    input.recipientEmail,
    input.subject,
    input.html,
    input.text,
  );

  await prisma.notificationOutbox.update({
    where: { id: input.outboxId },
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
          lastError: cleanApplicationInterviewEvaluationText(sent.error, 1000) || 'email_delivery_failed',
        },
  }).catch(() => null);
}

export async function makeApplicationRecruitmentDecision(input: {
  applicationId: string;
  expectedStatus: unknown;
  decision: unknown;
  reason?: unknown;
  applicantMessage?: unknown;
  actor: AdminStaffActor;
  userAgent?: string | null;
}) {
  const expectedStatus = cleanApplicationInterviewEvaluationText(input.expectedStatus, 80);
  const decision = cleanApplicationInterviewEvaluationText(
    input.decision,
    80,
  ) as ApplicationInterviewEvaluationDecision;
  const reason = cleanApplicationInterviewEvaluationText(input.reason, 1000);
  const applicantMessage = cleanApplicationInterviewEvaluationText(
    input.applicantMessage,
    4000,
  );

  if (!['SUCCESSFUL', 'OFFERED', 'DECLINED'].includes(decision)) {
    throw new ApplicationInterviewEvaluationError(
      'application_recruitment_decision_invalid',
      400,
    );
  }
  if (decision === 'DECLINED' && !reason) {
    throw new ApplicationInterviewEvaluationError(
      'application_recruitment_decision_reason_required',
      400,
    );
  }
  if (decision === 'OFFERED' && !applicantMessage) {
    throw new ApplicationInterviewEvaluationError(
      'application_offer_message_required',
      400,
    );
  }

  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string; status: string }>>(Prisma.sql`
      SELECT "id", "status"::text AS "status"
      FROM "Application"
      WHERE "id" = ${input.applicationId}
      FOR UPDATE
    `);
    const current = locked[0];
    if (!current) {
      throw new ApplicationInterviewEvaluationError('application_not_found', 404);
    }
    if (current.status !== expectedStatus) {
      throw new ApplicationInterviewEvaluationError(
        'application_status_changed_concurrently',
        409,
      );
    }
    if (!canMakeApplicationInterviewDecision(current.status, decision)) {
      throw new ApplicationInterviewEvaluationError(
        'application_recruitment_decision_not_available',
        409,
      );
    }

    const cycle = await tx.applicationInterviewEvaluationCycle.findFirst({
      where: { applicationId: current.id, status: 'COMPLETED' },
      orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
    });
    if (!cycle) {
      throw new ApplicationInterviewEvaluationError(
        'application_interview_evaluation_incomplete',
        409,
      );
    }

    const application = await tx.application.update({
      where: { id: current.id },
      data: {
        status: decision,
        statusReason: reason || null,
        statusChangedAt: now,
        lastReviewedAt: now,
      },
      include: {
        opportunity: { select: { title: true } },
      },
    });

    const decisionRecord = await tx.applicationRecruitmentDecision.create({
      data: {
        applicationId: application.id,
        evaluationCycleId: cycle.id,
        decision,
        fromStatus: current.status as any,
        actorProfileId: input.actor.profileId,
        reason: reason || null,
        applicantMessage: applicantMessage || null,
        aggregateScore: cycle.aggregateScore,
      },
    });

    await tx.applicationStatusEvent.create({
      data: {
        applicationId: application.id,
        fromStatus: current.status as any,
        toStatus: decision,
        actorType: 'ADMIN',
        actorRefId: input.actor.profileId,
        reason: reason || null,
        metadata: {
          source: 'application_recruitment_decision',
          decisionRecordId: decisionRecord.id,
          evaluationCycleId: cycle.id,
          aggregateScore: cycle.aggregateScore,
        },
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: input.actor.userId,
        actorType: 'ADMIN',
        actorRefId: input.actor.profileId,
        app: 'admin-dashboard',
        action: `application.recruitment_decision.${decision.toLowerCase()}`,
        entityType: 'Application',
        entityId: application.id,
        description: reason || undefined,
        userAgent: input.userAgent || undefined,
        meta: {
          fromStatus: current.status,
          toStatus: decision,
          decisionRecordId: decisionRecord.id,
          evaluationCycleId: cycle.id,
          aggregateScore: cycle.aggregateScore,
        },
      },
    });

    const recipientEmail = normaliseEmail(application.applicantEmailNormalized);
    let notification: null | {
      outboxId: string;
      recipientEmail: string;
      subject: string;
      text: string;
      html: string;
    } = null;

    if (recipientEmail && (decision === 'OFFERED' || decision === 'DECLINED')) {
      const subject = decision === 'OFFERED'
        ? `Ambulant+ application offer — ${application.referenceCode}`
        : `Ambulant+ application update — ${application.referenceCode}`;
      const opening = decision === 'OFFERED'
        ? 'We are pleased to share an offer update regarding your application.'
        : 'We have completed the current recruitment decision for your application.';
      const message = applicantMessage || (
        decision === 'DECLINED'
          ? 'Your application will not progress further in this recruitment process.'
          : ''
      );
      const text = [
        opening,
        `Reference: ${application.referenceCode}`,
        `Opportunity: ${application.opportunity.title}`,
        message,
        'You can use the secure application portal to view your current application status.',
      ].filter(Boolean).join('\n\n');
      const html = `
        <div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;line-height:1.6">
          <h2>${escapeHtml(decision === 'OFFERED' ? 'Application offer update' : 'Application update')}</h2>
          <p>${escapeHtml(opening)}</p>
          <p><strong>Reference:</strong> ${escapeHtml(application.referenceCode)}</p>
          <p><strong>Opportunity:</strong> ${escapeHtml(application.opportunity.title)}</p>
          ${message ? `<p>${escapeHtml(message).replace(/\n/g, '<br />')}</p>` : ''}
          <p>Use the secure Ambulant+ application portal to view your current application status.</p>
        </div>
      `;

      const outbox = await tx.notificationOutbox.create({
        data: {
          eventKind: `application.recruitment_decision.${decision.toLowerCase()}`,
          recipientEmail,
          channel: 'EMAIL',
          payload: {
            applicationId: application.id,
            referenceCode: application.referenceCode,
            opportunityTitle: application.opportunity.title,
            decision,
            decisionRecordId: decisionRecord.id,
            subject,
          },
        },
      });

      notification = { outboxId: outbox.id, recipientEmail, subject, text, html };
    }

    return {
      application,
      decisionRecord,
      notification,
    };
  });

  if (result.notification) {
    await deliverDecisionNotification(result.notification).catch(() => null);
  }

  return {
    ok: true,
    application: {
      id: result.application.id,
      status: result.application.status,
      statusChangedAt: result.application.statusChangedAt,
    },
    decision: {
      id: result.decisionRecord.id,
      decision: result.decisionRecord.decision,
      createdAt: result.decisionRecord.createdAt,
    },
  };
}

export function applicationInterviewEvaluationResponse(error: unknown) {
  if (!(error instanceof ApplicationInterviewEvaluationError)) return null;
  return {
    status: error.status,
    body: {
      ok: false,
      error: error.code,
      ...(error.detail === undefined ? {} : { detail: error.detail }),
    },
  };
}
