import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Prisma } from '@prisma/client';
import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
} from 'node:crypto';
import { prisma } from '@/lib/prisma';
import {
  enterpriseFormVersionStructureInclude,
  toEnterpriseFormDefinition,
} from './admin-forms';
import type {
  EnterpriseFormDefinition,
  EnterpriseFormFieldDefinition,
} from './admin-forms-policy';
import {
  consentTextHash,
  derivePublicFormValues,
  formAvailability,
  publicFormAntiSpamPolicy,
  publicFormUploadPolicy,
  validatePublicFormAnswers,
} from './public-forms-policy';

const PUBLIC_FORM_TOKEN_BYTES = 32;
const PUBLIC_FORM_HARD_DRAFT_DAYS = 90;
const PUBLIC_FORM_SESSION_HOURS = 4;
const UPLOAD_URL_TTL_SECONDS = 10 * 60;

export class PublicFormError extends Error {
  status: number;
  code: string;
  detail?: unknown;

  constructor(code: string, status = 400, detail?: unknown) {
    super(code);
    this.name = 'PublicFormError';
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

export const publicFormVersionInclude = {
  form: true,
  ...enterpriseFormVersionStructureInclude,
  fields: {
    orderBy: { order: 'asc' as const },
    include: {
      options: { orderBy: { order: 'asc' as const } },
    },
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanText(value: unknown, maxLength: number) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function normaliseEmail(value: unknown) {
  const email = cleanText(value, 320).toLowerCase();
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function runtimeHashSecret() {
  const secret = cleanText(
    process.env.FORM_RUNTIME_HASH_PEPPER ||
      process.env.AUTH_SESSION_SECRET ||
      process.env.NEXTAUTH_SECRET,
    500,
  );

  if (!secret) {
    throw new PublicFormError('form_runtime_not_configured', 503);
  }

  return secret;
}

function clientKeyHash(clientKey: string) {
  return createHmac('sha256', runtimeHashSecret())
    .update(clientKey)
    .digest('hex');
}

export function publicFormClientKey(input: {
  forwardedFor?: string | null;
  realIp?: string | null;
  userAgent?: string | null;
}) {
  const forwarded = cleanText(input.forwardedFor, 1000)
    .split(',')[0]
    .trim();
  const ip = forwarded || cleanText(input.realIp, 120) || 'unknown';
  const userAgent = cleanText(input.userAgent, 500) || 'unknown';
  return `${ip}\n${userAgent}`;
}

export async function enforcePublicFormRateLimit(input: {
  scope: string;
  clientKey: string;
  limit: number;
  windowSeconds: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const windowMs = Math.max(60, input.windowSeconds) * 1000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const scope = cleanText(input.scope, 180);
  const keyHash = clientKeyHash(input.clientKey);
  const id = randomUUID();

  const rows = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    INSERT INTO "EnterpriseFormRateLimitBucket"
      ("id", "scope", "keyHash", "windowStart", "count", "createdAt", "updatedAt")
    VALUES
      (${id}, ${scope}, ${keyHash}, ${windowStart}, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("scope", "keyHash", "windowStart")
    DO UPDATE SET
      "count" = "EnterpriseFormRateLimitBucket"."count" + 1,
      "updatedAt" = CURRENT_TIMESTAMP
    RETURNING "count"
  `);

  const count = Number(rows[0]?.count ?? 1);
  if (count > input.limit) {
    throw new PublicFormError('form_rate_limited', 429);
  }

  return { count, windowStart };
}

function publishedVersionWhere(slug: string) {
  return {
    state: 'PUBLISHED' as const,
    accessMode: 'PUBLIC' as const,
    form: {
      slug,
      status: 'ACTIVE' as const,
    },
  };
}

export async function findPublicFormVersion(slugInput: unknown) {
  const slug = cleanText(slugInput, 160).toLowerCase();
  if (!slug) throw new PublicFormError('form_not_found', 404);

  const version = await prisma.enterpriseFormVersion.findFirst({
    where: publishedVersionWhere(slug),
    orderBy: { versionNumber: 'desc' },
    include: publicFormVersionInclude,
  });

  if (!version) throw new PublicFormError('form_not_found', 404);
  return version;
}

function publicRule(rule: any) {
  if (!['VISIBILITY', 'REQUIREMENT', 'NAVIGATION'].includes(String(rule.kind))) {
    return null;
  }
  return {
    key: rule.key,
    kind: rule.kind,
    priority: rule.priority,
    enabled: rule.enabled,
    condition: rule.condition,
    effect: rule.effect,
  };
}

function publicJsonSubset(value: unknown, allowedKeys: string[]) {
  if (!isRecord(value)) return undefined;
  const output: Record<string, unknown> = {};
  for (const key of allowedKeys) {
    if (value[key] !== undefined) output[key] = value[key];
  }
  return Object.keys(output).length ? output : undefined;
}

function publicFieldConfig(field: any) {
  const common = [
    'prefix',
    'suffix',
    'rows',
    'columns',
    'maxRating',
    'countryOptions',
    'addLabel',
    'removeLabel',
  ];
  if (field.type === 'FILE_UPLOAD') {
    return publicJsonSubset(field.config, [
      'maxFiles',
      'maxFileSizeBytes',
      'allowedContentTypes',
      'helpText',
    ]);
  }
  return publicJsonSubset(field.config, common);
}

export function serializePublicForm(version: any) {
  return {
    id: version.form.id,
    key: version.form.key,
    slug: version.form.slug,
    name: version.form.name,
    description: version.form.description,
    version: {
      id: version.id,
      versionNumber: version.versionNumber,
      title: version.title,
      description: version.description,
      locale: version.locale,
      fallbackLocale: version.fallbackLocale,
      submitLabel: version.submitLabel,
      allowSaveResume: version.allowSaveResume,
      acceptingFrom: version.acceptingFrom,
      acceptingUntil: version.acceptingUntil,
      branding: publicJsonSubset(version.branding, [
        'logoUrl',
        'accentColor',
        'organisationName',
        'supportText',
      ]),
      settings: publicJsonSubset(version.settings, [
        'showProgress',
        'showPageTitles',
        'successTitle',
        'successMessage',
        'privacyNotice',
      ]),
      availability: formAvailability(version),
      pages: (version.pages ?? []).map((page: any) => ({
        key: page.key,
        title: page.title,
        description: page.description,
        order: page.order,
        sections: (page.sections ?? []).map((section: any) => ({
          key: section.key,
          title: section.title,
          description: section.description,
          order: section.order,
          repeatable: section.repeatable,
          minRepeats: section.minRepeats,
          maxRepeats: section.maxRepeats,
          fields: (section.fields ?? []).map((field: any) => ({
            key: field.key,
            type: field.type,
            label: field.label,
            helpText: field.helpText,
            placeholder: field.placeholder,
            order: field.order,
            required: field.required,
            defaultValue: field.defaultValue,
            validation: field.validation,
            visibilityLogic: field.visibilityLogic,
            config: publicFieldConfig(field),
            options: (field.options ?? []).map((option: any) => ({
              key: option.key,
              label: option.label,
              value: option.value,
              order: option.order,
              metadata: option.metadata,
            })),
          })),
        })),
      })),
      rules: (version.rules ?? []).map(publicRule).filter(Boolean),
      translations: version.translations ?? [],
    },
  };
}

function draftExpiry(version: any) {
  const now = Date.now();
  if (!version.allowSaveResume) {
    return new Date(now + PUBLIC_FORM_SESSION_HOURS * 60 * 60 * 1000);
  }

  const days = Math.max(
    1,
    Math.min(PUBLIC_FORM_HARD_DRAFT_DAYS, Number(version.retentionDays || 30)),
  );
  return new Date(now + days * 24 * 60 * 60 * 1000);
}

export async function startPublicFormSubmission(input: {
  version: any;
  clientKey: string;
  locale?: unknown;
  honeypot?: unknown;
}) {
  if (formAvailability(input.version) !== 'OPEN') {
    throw new PublicFormError('form_not_accepting_submissions', 409);
  }

  const antiSpam = publicFormAntiSpamPolicy(input.version.antiSpamPolicy);
  if (cleanText(input.honeypot, 200)) {
    throw new PublicFormError('form_request_rejected', 400);
  }

  await enforcePublicFormRateLimit({
    scope: `form:${input.version.id}:start`,
    clientKey: input.clientKey,
    limit: antiSpam.maxStarts,
    windowSeconds: antiSpam.windowSeconds,
  });

  const token = randomBytes(PUBLIC_FORM_TOKEN_BYTES).toString('base64url');
  const expiresAt = draftExpiry(input.version);
  const locale = cleanText(input.locale, 20) || input.version.locale || 'en';

  const submission = await prisma.enterpriseFormSubmission.create({
    data: {
      formId: input.version.formId,
      versionId: input.version.id,
      status: 'DRAFT',
      resumeTokenHash: sha256(token),
      resumeTokenExpiresAt: expiresAt,
      expiresAt,
      locale,
      source: 'landing',
    },
    select: {
      id: true,
      expiresAt: true,
      startedAt: true,
    },
  });

  return {
    submissionId: submission.id,
    submissionToken: token,
    expiresAt: submission.expiresAt,
    startedAt: submission.startedAt,
    allowSaveResume: input.version.allowSaveResume,
  };
}

export function submissionBearerToken(value: string | null | undefined) {
  const header = cleanText(value, 2000);
  const match = /^Bearer\s+([A-Za-z0-9_-]{32,500})$/i.exec(header);
  return match?.[1] || '';
}

async function submissionWithAuthority(submissionId: string, token: string) {
  if (!submissionId || !token) {
    throw new PublicFormError('form_submission_not_found', 404);
  }

  const submission = await prisma.enterpriseFormSubmission.findFirst({
    where: {
      id: submissionId,
      status: 'DRAFT',
      resumeTokenHash: sha256(token),
      resumeTokenExpiresAt: { gt: new Date() },
    },
    include: {
      version: {
        include: publicFormVersionInclude,
      },
      answers: true,
      files: {
        where: { removedAt: null },
        orderBy: { createdAt: 'asc' },
      },
      consents: true,
    },
  });

  if (!submission || submission.version.accessMode !== 'PUBLIC' || submission.version.form.status !== 'ACTIVE') {
    throw new PublicFormError('form_submission_not_found', 404);
  }

  return submission;
}

function answerMap(submission: any) {
  return Object.fromEntries((submission.answers ?? []).map((answer: any) => [answer.fieldKey, answer.value]));
}

export async function getPublicFormSubmission(input: {
  submissionId: string;
  token: string;
}) {
  const submission = await submissionWithAuthority(input.submissionId, input.token);
  return {
    id: submission.id,
    status: submission.status,
    locale: submission.locale,
    startedAt: submission.startedAt,
    lastSavedAt: submission.lastSavedAt,
    expiresAt: submission.expiresAt,
    answers: answerMap(submission),
    files: submission.files.map((file: any) => ({
      id: file.id,
      fieldKey: file.fieldKey,
      fileName: file.fileName,
      contentType: file.contentType,
      sizeBytes: file.sizeBytes,
      state: file.state,
      availableAt: file.availableAt,
    })),
    form: serializePublicForm(submission.version),
  };
}

function fieldIndex(definition: EnterpriseFormDefinition) {
  const map = new Map<string, EnterpriseFormFieldDefinition>();
  for (const page of definition.pages ?? []) {
    for (const section of page.sections ?? []) {
      for (const field of section.fields ?? []) map.set(field.key, field);
    }
  }
  return map;
}

function extractIdentityEmail(definition: EnterpriseFormDefinition, answers: Record<string, unknown>) {
  for (const field of fieldIndex(definition).values()) {
    if (field.type !== 'EMAIL') continue;
    const email = normaliseEmail(answers[field.key]);
    if (email) return email;
  }
  return null;
}

async function persistAnswersAndConsents(input: {
  submission: any;
  definition: EnterpriseFormDefinition;
  answers: Record<string, unknown>;
}) {
  const fields = fieldIndex(input.definition);
  const updates = Object.entries(input.answers);

  await prisma.$transaction(async (tx) => {
    for (const [fieldKey, value] of updates) {
      const field = fields.get(fieldKey);
      if (!field || field.type === 'INFORMATION' || field.type === 'FILE_UPLOAD') continue;

      const dbField = input.submission.version.fields.find((entry: any) => entry.key === fieldKey);
      if (!dbField) continue;

      if (value === undefined || value === null || value === '') {
        await tx.enterpriseFormSubmissionAnswer.deleteMany({
          where: { submissionId: input.submission.id, fieldId: dbField.id },
        });
        await tx.enterpriseFormConsentEvidence.deleteMany({
          where: { submissionId: input.submission.id, fieldId: dbField.id },
        });
        continue;
      }

      await tx.enterpriseFormSubmissionAnswer.upsert({
        where: {
          submissionId_fieldId: {
            submissionId: input.submission.id,
            fieldId: dbField.id,
          },
        },
        create: {
          submissionId: input.submission.id,
          fieldId: dbField.id,
          fieldKey,
          value: asJson(value),
        },
        update: {
          fieldKey,
          value: asJson(value),
        },
      });

      if (field.type === 'CONSENT') {
        const accepted = value === true;
        await tx.enterpriseFormConsentEvidence.upsert({
          where: {
            submissionId_fieldId: {
              submissionId: input.submission.id,
              fieldId: dbField.id,
            },
          },
          create: {
            submissionId: input.submission.id,
            fieldId: dbField.id,
            fieldKey,
            accepted,
            consentTextHash: consentTextHash(field),
            acceptedAt: accepted ? new Date() : null,
            evidence: {
              versionId: input.submission.versionId,
              capturedBy: 'public_form_runtime',
            },
          },
          update: {
            fieldKey,
            accepted,
            consentTextHash: consentTextHash(field),
            acceptedAt: accepted ? new Date() : null,
            evidence: {
              versionId: input.submission.versionId,
              capturedBy: 'public_form_runtime',
            },
          },
        });
      }
    }

    await tx.enterpriseFormSubmission.updateMany({
      where: { id: input.submission.id, status: 'DRAFT' },
      data: { lastSavedAt: new Date() },
    });
  });
}

export async function savePublicFormSubmission(input: {
  submissionId: string;
  token: string;
  clientKey: string;
  answers: unknown;
}) {
  const submission = await submissionWithAuthority(input.submissionId, input.token);
  const definition = toEnterpriseFormDefinition(submission.version);
  const answers = isRecord(input.answers) ? input.answers : null;
  if (!answers) throw new PublicFormError('form_answers_object_required', 400);

  const antiSpam = publicFormAntiSpamPolicy(submission.version.antiSpamPolicy);
  await enforcePublicFormRateLimit({
    scope: `form:${submission.versionId}:save:${submission.id}`,
    clientKey: input.clientKey,
    limit: antiSpam.maxSaves,
    windowSeconds: antiSpam.windowSeconds,
  });

  const merged = { ...answerMap(submission), ...answers };
  const issues = validatePublicFormAnswers({
    definition,
    answers: merged,
    mode: 'draft',
  });

  if (issues.length) {
    throw new PublicFormError('form_validation_failed', 422, issues.slice(0, 50));
  }

  await persistAnswersAndConsents({ submission, definition, answers });

  return getPublicFormSubmission({ submissionId: input.submissionId, token: input.token });
}

export async function submitPublicFormSubmission(input: {
  submissionId: string;
  token: string;
  clientKey: string;
  answers?: unknown;
  honeypotPayload?: unknown;
}) {
  let submission = await submissionWithAuthority(input.submissionId, input.token);
  const antiSpam = publicFormAntiSpamPolicy(submission.version.antiSpamPolicy);
  const honeypotPayload = isRecord(input.honeypotPayload) ? input.honeypotPayload : {};

  if (
    cleanText(honeypotPayload[antiSpam.honeypotField], 200) ||
    cleanText(honeypotPayload.__website, 200)
  ) {
    throw new PublicFormError('form_request_rejected', 400);
  }

  await enforcePublicFormRateLimit({
    scope: `form:${submission.versionId}:submit`,
    clientKey: input.clientKey,
    limit: antiSpam.maxSubmits,
    windowSeconds: antiSpam.windowSeconds,
  });

  if (Date.now() - new Date(submission.startedAt).getTime() < antiSpam.minSubmitSeconds * 1000) {
    throw new PublicFormError('form_submission_too_fast', 429);
  }

  if (formAvailability(submission.version) !== 'OPEN') {
    throw new PublicFormError('form_not_accepting_submissions', 409);
  }

  if (input.answers !== undefined) {
    const answers = isRecord(input.answers) ? input.answers : null;
    if (!answers) throw new PublicFormError('form_answers_object_required', 400);
    const definition = toEnterpriseFormDefinition(submission.version);
    const merged = { ...answerMap(submission), ...answers };
    const draftIssues = validatePublicFormAnswers({ definition, answers: merged, mode: 'draft' });
    if (draftIssues.length) {
      throw new PublicFormError('form_validation_failed', 422, draftIssues.slice(0, 50));
    }
    await persistAnswersAndConsents({ submission, definition, answers });
    submission = await submissionWithAuthority(input.submissionId, input.token);
  }

  const definition = toEnterpriseFormDefinition(submission.version);
  const answers = answerMap(submission);
  const derived = derivePublicFormValues(definition, answers);
  const effectiveAnswers = { ...answers, ...derived.calculations };
  const availableFileFieldKeys = new Set(
    submission.files
      .filter((file: any) => file.state === 'AVAILABLE' && !file.removedAt)
      .map((file: any) => file.fieldKey),
  );

  const issues = validatePublicFormAnswers({
    definition,
    answers: effectiveAnswers,
    mode: 'submit',
    availableFileFieldKeys,
  });

  if (issues.length) {
    throw new PublicFormError('form_validation_failed', 422, issues.slice(0, 100));
  }

  const identityEmailNormalized = extractIdentityEmail(definition, effectiveAnswers);
  const existingMetadata = isRecord(submission.metadata) ? submission.metadata : {};
  const dbFields = new Map(submission.version.fields.map((field: any) => [field.key, field]));

  const updated = await prisma.$transaction(async (tx) => {
    for (const [fieldKey, value] of Object.entries(derived.calculations)) {
      const dbField = dbFields.get(fieldKey) as any;
      if (!dbField) continue;
      await tx.enterpriseFormSubmissionAnswer.upsert({
        where: {
          submissionId_fieldId: {
            submissionId: submission.id,
            fieldId: dbField.id,
          },
        },
        create: {
          submissionId: submission.id,
          fieldId: dbField.id,
          fieldKey,
          value: asJson(value),
        },
        update: {
          fieldKey,
          value: asJson(value),
        },
      });
    }

    const stateChange = await tx.enterpriseFormSubmission.updateMany({
      where: {
        id: submission.id,
        status: 'DRAFT',
        resumeTokenHash: sha256(input.token),
      },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
        lastSavedAt: new Date(),
        identityEmailNormalized,
        resumeTokenHash: null,
        resumeTokenExpiresAt: null,
        metadata: asJson({
          ...existingMetadata,
          runtime: {
            calculations: derived.calculations,
            score: derived.score,
            submittedVersionId: submission.versionId,
          },
        }),
      },
    });

    if (stateChange.count === 1) {
      await tx.auditLog.create({
        data: {
          actorType: 'EXTERNAL_GUEST',
          actorRefId: submission.id,
          app: 'landing',
          action: 'enterprise_form.submitted',
          entityType: 'EnterpriseFormSubmission',
          entityId: submission.id,
          meta: asJson({
            formId: submission.formId,
            versionId: submission.versionId,
          }),
        },
      });
    }

    return stateChange;
  });

  if (updated.count !== 1) {
    throw new PublicFormError('form_submission_state_changed', 409);
  }

  return {
    ok: true,
    submissionId: submission.id,
    status: 'SUBMITTED' as const,
    submittedAt: new Date().toISOString(),
  };
}

function storageConfig() {
  const bucket = cleanText(
    process.env.FORM_SUBMISSION_S3_BUCKET ||
      process.env.S3_EVIDENCE_BUCKET ||
      process.env.S3_BUCKET,
    255,
  );
  const region = cleanText(
    process.env.FORM_SUBMISSION_S3_REGION ||
      process.env.AWS_REGION ||
      process.env.AWS_DEFAULT_REGION,
    120,
  );

  if (!bucket || !region) {
    throw new PublicFormError('form_upload_storage_not_configured', 503);
  }

  return { bucket, region, client: new S3Client({ region }) };
}

function safeFileName(value: unknown) {
  const source = cleanText(value, 255) || 'upload';
  return source
    .replace(/[\\/\u0000-\u001f\u007f]+/g, '_')
    .replace(/\s+/g, ' ')
    .slice(0, 255);
}

function safeObjectSegment(value: string) {
  return value.replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 160);
}

function fieldForUpload(submission: any, fieldKey: string) {
  const dbField = submission.version.fields.find((field: any) => field.key === fieldKey);
  if (!dbField || dbField.type !== 'FILE_UPLOAD') {
    throw new PublicFormError('form_upload_field_not_found', 404);
  }
  const definition = toEnterpriseFormDefinition(submission.version);
  const field = fieldIndex(definition).get(fieldKey);
  if (!field) throw new PublicFormError('form_upload_field_not_found', 404);
  return { dbField, field };
}

export async function createPublicFormUpload(input: {
  submissionId: string;
  token: string;
  clientKey: string;
  fieldKey: unknown;
  fileName: unknown;
  contentType: unknown;
  sizeBytes: unknown;
  checksumSha256?: unknown;
}) {
  const submission = await submissionWithAuthority(input.submissionId, input.token);
  const fieldKey = cleanText(input.fieldKey, 120);
  const { dbField, field } = fieldForUpload(submission, fieldKey);
  const policy = publicFormUploadPolicy(field);
  const contentType = cleanText(input.contentType, 160).toLowerCase();
  const sizeBytes = Math.round(Number(input.sizeBytes));
  const checksumSha256 = cleanText(input.checksumSha256, 64).toLowerCase();

  if (!contentType || !policy.allowedContentTypes.has(contentType)) {
    throw new PublicFormError('form_upload_content_type_rejected', 415);
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes < 1 || sizeBytes > policy.maxFileSizeBytes) {
    throw new PublicFormError('form_upload_size_rejected', 413);
  }
  if (!/^[a-f0-9]{64}$/.test(checksumSha256)) {
    throw new PublicFormError('form_upload_checksum_required', 400);
  }

  const checksumBase64 = Buffer.from(checksumSha256, 'hex').toString('base64');

  await prisma.enterpriseFormSubmissionFile.updateMany({
    where: {
      submissionId: submission.id,
      fieldId: dbField.id,
      state: 'PENDING',
      removedAt: null,
      createdAt: { lt: new Date(Date.now() - 30 * 60 * 1000) },
    },
    data: { state: 'REJECTED', removedAt: new Date() },
  });

  const existingCount = await prisma.enterpriseFormSubmissionFile.count({
    where: {
      submissionId: submission.id,
      fieldId: dbField.id,
      state: { in: ['PENDING', 'AVAILABLE'] },
      removedAt: null,
    },
  });

  if (existingCount >= policy.maxFiles) {
    throw new PublicFormError('form_upload_file_limit_reached', 409);
  }

  const antiSpam = publicFormAntiSpamPolicy(submission.version.antiSpamPolicy);
  await enforcePublicFormRateLimit({
    scope: `form:${submission.versionId}:upload:${submission.id}`,
    clientKey: input.clientKey,
    limit: Math.max(antiSpam.maxStarts, policy.maxFiles * 5),
    windowSeconds: antiSpam.windowSeconds,
  });

  const storage = storageConfig();
  const fileName = safeFileName(input.fileName);
  const objectKey = [
    'enterprise-forms',
    safeObjectSegment(submission.formId),
    safeObjectSegment(submission.id),
    safeObjectSegment(dbField.id),
    randomUUID(),
  ].join('/');

  const file = await prisma.enterpriseFormSubmissionFile.create({
    data: {
      submissionId: submission.id,
      fieldId: dbField.id,
      fieldKey,
      objectKey,
      fileName,
      contentType,
      sizeBytes,
      checksumSha256,
      state: 'PENDING',
    },
    select: { id: true },
  });

  try {
    const uploadUrl = await getSignedUrl(
      storage.client,
      new PutObjectCommand({
        Bucket: storage.bucket,
        Key: objectKey,
        ContentType: contentType,
        ChecksumSHA256: checksumBase64,
      }),
      { expiresIn: UPLOAD_URL_TTL_SECONDS },
    );

    return {
      fileId: file.id,
      uploadUrl,
      expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
      headers: {
        'content-type': contentType,
        'x-amz-checksum-sha256': checksumBase64,
      },
    };
  } catch (error) {
    await prisma.enterpriseFormSubmissionFile.update({
      where: { id: file.id },
      data: { state: 'REJECTED', removedAt: new Date() },
    });
    throw error;
  }
}

export async function confirmPublicFormUpload(input: {
  submissionId: string;
  fileId: string;
  token: string;
}) {
  const submission = await submissionWithAuthority(input.submissionId, input.token);
  const file = submission.files.find((entry: any) => entry.id === input.fileId && !entry.removedAt);
  if (!file || file.state !== 'PENDING') {
    throw new PublicFormError('form_upload_not_found', 404);
  }

  const storage = storageConfig();
  const head = await storage.client.send(
    new HeadObjectCommand({
      Bucket: storage.bucket,
      Key: file.objectKey,
      ChecksumMode: 'ENABLED',
    }),
  );

  if (Number(head.ContentLength ?? -1) !== file.sizeBytes) {
    throw new PublicFormError('form_upload_size_mismatch', 409);
  }
  const contentType = cleanText(head.ContentType, 160).toLowerCase();
  if (contentType && contentType !== file.contentType.toLowerCase()) {
    throw new PublicFormError('form_upload_content_type_mismatch', 409);
  }

  const expectedChecksum = file.checksumSha256
    ? Buffer.from(file.checksumSha256, 'hex').toString('base64')
    : '';
  const actualChecksum = cleanText(head.ChecksumSHA256, 200);
  if (!expectedChecksum || actualChecksum !== expectedChecksum) {
    throw new PublicFormError('form_upload_checksum_mismatch', 409);
  }

  const updated = await prisma.enterpriseFormSubmissionFile.updateMany({
    where: {
      id: file.id,
      submissionId: submission.id,
      state: 'PENDING',
      removedAt: null,
    },
    data: { state: 'AVAILABLE', availableAt: new Date() },
  });

  if (updated.count !== 1) {
    throw new PublicFormError('form_upload_state_changed', 409);
  }

  return { ok: true, fileId: file.id, state: 'AVAILABLE' as const };
}

export async function removePublicFormUpload(input: {
  submissionId: string;
  fileId: string;
  token: string;
}) {
  const submission = await submissionWithAuthority(input.submissionId, input.token);
  const file = submission.files.find((entry: any) => entry.id === input.fileId && !entry.removedAt);
  if (!file) throw new PublicFormError('form_upload_not_found', 404);

  const updated = await prisma.enterpriseFormSubmissionFile.updateMany({
    where: { id: file.id, submissionId: submission.id, removedAt: null },
    data: { state: 'REMOVED', removedAt: new Date() },
  });

  if (updated.count !== 1) {
    throw new PublicFormError('form_upload_state_changed', 409);
  }

  try {
    const storage = storageConfig();
    await storage.client.send(
      new DeleteObjectCommand({ Bucket: storage.bucket, Key: file.objectKey }),
    );
  } catch {
    // Metadata is already revoked. Physical object cleanup can be retried operationally.
  }

  return { ok: true, fileId: file.id, state: 'REMOVED' as const };
}
