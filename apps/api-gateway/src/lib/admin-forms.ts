import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { AdminStaffActor } from '@/src/lib/admin-staff-auth';
import type {
  EnterpriseFormDefinition,
  EnterpriseFormFieldDefinition,
  EnterpriseFormPageDefinition,
  EnterpriseFormRuleDefinition,
  EnterpriseFormSectionDefinition,
  EnterpriseFormTranslationDefinition,
} from '@/src/lib/admin-forms-policy';

export function asJsonInput(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return value as Prisma.InputJsonValue;
}

export function asNullableJsonInput(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.DbNull;
  return value as Prisma.InputJsonValue;
}

export function isPrismaUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

export async function writeEnterpriseFormAudit(input: {
  actor: AdminStaffActor;
  action: string;
  entityType: string;
  entityId: string;
  description?: string | null;
  userAgent?: string | null;
  meta?: Prisma.InputJsonObject;
}) {
  await prisma.auditLog.create({
    data: {
      actorUserId: input.actor.userId,
      actorType: 'ADMIN',
      actorRefId: input.actor.profileId,
      app: 'admin-dashboard',
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      description: input.description || undefined,
      userAgent: input.userAgent || undefined,
      meta: input.meta,
    },
  });
}

export const enterpriseFormVersionStructureInclude = {
  pages: {
    orderBy: { order: 'asc' as const },
    include: {
      sections: {
        orderBy: { order: 'asc' as const },
        include: {
          fields: {
            orderBy: { order: 'asc' as const },
            include: {
              options: { orderBy: { order: 'asc' as const } },
            },
          },
        },
      },
    },
  },
  rules: { orderBy: [{ priority: 'asc' as const }, { key: 'asc' as const }] },
  translations: {
    orderBy: [
      { locale: 'asc' as const },
      { targetType: 'asc' as const },
      { targetKey: 'asc' as const },
    ],
  },
};

export function toEnterpriseFormDefinition(version: any): EnterpriseFormDefinition {
  return {
    pages: (version?.pages ?? []).map((page: any) => ({
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
          sensitive: field.sensitive,
          defaultValue: field.defaultValue,
          validation: field.validation,
          visibilityLogic: field.visibilityLogic,
          calculation: field.calculation,
          scoring: field.scoring,
          config: field.config,
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
    rules: (version?.rules ?? []).map((rule: any) => ({
      key: rule.key,
      kind: rule.kind,
      priority: rule.priority,
      enabled: rule.enabled,
      condition: rule.condition,
      effect: rule.effect,
    })),
    translations: (version?.translations ?? []).map((translation: any) => ({
      locale: translation.locale,
      targetType: translation.targetType,
      targetKey: translation.targetKey,
      values: translation.values,
    })),
  };
}

function fieldCreateData(
  versionId: string,
  field: EnterpriseFormFieldDefinition,
) {
  return {
    versionId,
    key: field.key,
    type: field.type,
    label: field.label,
    helpText: field.helpText || null,
    placeholder: field.placeholder || null,
    order: field.order,
    required: field.required === true,
    sensitive: field.sensitive === true,
    defaultValue: asNullableJsonInput(field.defaultValue),
    validation: asNullableJsonInput(field.validation),
    visibilityLogic: asNullableJsonInput(field.visibilityLogic),
    calculation: asNullableJsonInput(field.calculation),
    scoring: asNullableJsonInput(field.scoring),
    config: asNullableJsonInput(field.config),
    options: {
      create: (field.options ?? []).map((option) => ({
        versionId,
        key: option.key,
        label: option.label,
        value: option.value,
        order: option.order,
        metadata: asNullableJsonInput(option.metadata),
      })),
    },
  };
}

function sectionCreateData(
  versionId: string,
  section: EnterpriseFormSectionDefinition,
) {
  return {
    versionId,
    key: section.key,
    title: section.title,
    description: section.description || null,
    order: section.order,
    repeatable: section.repeatable === true,
    minRepeats: section.minRepeats ?? null,
    maxRepeats: section.maxRepeats ?? null,
    fields: {
      create: section.fields.map((field) => fieldCreateData(versionId, field)),
    },
  };
}

function pageCreateData(
  versionId: string,
  page: EnterpriseFormPageDefinition,
) {
  return {
    versionId,
    key: page.key,
    title: page.title,
    description: page.description || null,
    order: page.order,
    sections: {
      create: page.sections.map((section) => sectionCreateData(versionId, section)),
    },
  };
}

function ruleCreateData(
  versionId: string,
  rule: EnterpriseFormRuleDefinition,
) {
  return {
    versionId,
    key: rule.key,
    kind: rule.kind,
    priority: rule.priority ?? 0,
    enabled: rule.enabled !== false,
    condition: asJsonInput(rule.condition) as Prisma.InputJsonValue,
    effect: asJsonInput(rule.effect) as Prisma.InputJsonValue,
  };
}

function translationCreateData(
  versionId: string,
  translation: EnterpriseFormTranslationDefinition,
) {
  return {
    versionId,
    locale: translation.locale,
    targetType: translation.targetType,
    targetKey: translation.targetKey,
    values: asJsonInput(translation.values) as Prisma.InputJsonValue,
  };
}

async function writeEnterpriseFormStructure(
  tx: Prisma.TransactionClient,
  input: {
    versionId: string;
    definition: EnterpriseFormDefinition;
    replace: boolean;
  },
) {
  if (input.replace) {
    const guard = await tx.enterpriseFormVersion.updateMany({
      where: { id: input.versionId, state: 'DRAFT' },
      data: { updatedAt: new Date() },
    });

    if (guard.count !== 1) {
      throw new Error('enterprise_form_version_immutable');
    }

    await tx.enterpriseFormRule.deleteMany({ where: { versionId: input.versionId } });
    await tx.enterpriseFormTranslation.deleteMany({ where: { versionId: input.versionId } });
    await tx.enterpriseFormPage.deleteMany({ where: { versionId: input.versionId } });
  }

  for (const page of input.definition.pages) {
    await tx.enterpriseFormPage.create({
      data: pageCreateData(input.versionId, page),
    });
  }

  if (input.definition.rules?.length) {
    await tx.enterpriseFormRule.createMany({
      data: input.definition.rules.map((rule) => ruleCreateData(input.versionId, rule)),
    });
  }

  if (input.definition.translations?.length) {
    await tx.enterpriseFormTranslation.createMany({
      data: input.definition.translations.map((translation) =>
        translationCreateData(input.versionId, translation),
      ),
    });
  }
}

export async function replaceEnterpriseFormDraftStructure(input: {
  versionId: string;
  definition: EnterpriseFormDefinition;
}) {
  return prisma.$transaction(async (tx) => {
    await writeEnterpriseFormStructure(tx, {
      ...input,
      replace: true,
    });

    return tx.enterpriseFormVersion.findUniqueOrThrow({
      where: { id: input.versionId },
      include: enterpriseFormVersionStructureInclude,
    });
  });
}

export async function createEnterpriseFormDraftVersion(input: {
  formId: string;
  actorProfileId: string;
  sourceVersionId?: string | null;
}) {
  const explicitSourceId = input.sourceVersionId || null;

  const source = explicitSourceId
    ? await prisma.enterpriseFormVersion.findFirst({
        where: {
          id: explicitSourceId,
          formId: input.formId,
          state: { in: ['PUBLISHED', 'RETIRED'] },
        },
        include: enterpriseFormVersionStructureInclude,
      })
    : await prisma.enterpriseFormVersion.findFirst({
        where: {
          formId: input.formId,
          state: 'PUBLISHED',
        },
        orderBy: { versionNumber: 'desc' },
        include: enterpriseFormVersionStructureInclude,
      });

  if (explicitSourceId && !source) {
    throw new Error('enterprise_form_source_version_not_found');
  }

  const sourceDefinition = source ? toEnterpriseFormDefinition(source) : null;

  return prisma.$transaction(async (tx) => {
    const existingDraft = await tx.enterpriseFormVersion.findFirst({
      where: { formId: input.formId, state: 'DRAFT' },
      select: { id: true },
    });

    if (existingDraft) {
      throw new Error('enterprise_form_draft_already_exists');
    }

    const latest = await tx.enterpriseFormVersion.aggregate({
      where: { formId: input.formId },
      _max: { versionNumber: true },
    });

    const created = await tx.enterpriseFormVersion.create({
      data: {
        formId: input.formId,
        versionNumber: (latest._max.versionNumber ?? 0) + 1,
        state: 'DRAFT',
        accessMode: source?.accessMode ?? 'PUBLIC',
        title: source?.title ?? 'Untitled form',
        description: source?.description ?? null,
        locale: source?.locale ?? 'en',
        fallbackLocale: source?.fallbackLocale ?? null,
        submitLabel: source?.submitLabel ?? 'Submit',
        allowSaveResume: source?.allowSaveResume ?? true,
        acceptingFrom: source?.acceptingFrom ?? null,
        acceptingUntil: source?.acceptingUntil ?? null,
        retentionDays: source?.retentionDays ?? null,
        branding: asNullableJsonInput(source?.branding),
        settings: asNullableJsonInput(source?.settings),
        notificationRules: asNullableJsonInput(source?.notificationRules),
        antiSpamPolicy: asNullableJsonInput(source?.antiSpamPolicy),
        createdFromVersionId: source?.id ?? null,
        createdByProfileId: input.actorProfileId,
      },
    });

    if (sourceDefinition) {
      await writeEnterpriseFormStructure(tx, {
        versionId: created.id,
        definition: sourceDefinition,
        replace: false,
      });
    }

    return tx.enterpriseFormVersion.findUniqueOrThrow({
      where: { id: created.id },
      include: enterpriseFormVersionStructureInclude,
    });
  });
}
