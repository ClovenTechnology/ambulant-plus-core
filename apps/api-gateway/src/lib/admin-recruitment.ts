import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  AdminStaffAuthError,
  type AdminStaffActor,
} from '@/src/lib/admin-staff-auth';
import {
  hasStaffCapability,
  type StaffCapability,
} from '@/src/lib/admin-staff-policy';
import { sendEmail } from '@/src/lib/mailer';
import { canStartCanonicalStaffOnboarding } from './enterprise-completion-policy';

export class RecruitmentError extends Error {
  status: number;
  detail?: unknown;

  constructor(message: string, status = 400, detail?: unknown) {
    super(message);
    this.name = 'RecruitmentError';
    this.status = status;
    this.detail = detail;
  }
}

export function recruitmentErrorResponse(error: unknown) {
  if (error instanceof RecruitmentError || error instanceof AdminStaffAuthError) {
    return {
      status: error.status,
      body: {
        ok: false,
        error: error.message,
        ...(error instanceof RecruitmentError && error.detail !== undefined
          ? { detail: error.detail }
          : {}),
      },
    };
  }
  return null;
}

function cleanText(value: unknown, max = 240) {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, max) : null;
}

function cleanEmail(value: unknown) {
  const email = String(value ?? '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email.slice(0, 320) : null;
}

function uniqueIds(value: unknown, max = 100) {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];
  return Array.from(
    new Set(values.map((entry) => cleanText(entry, 160)).filter(Boolean) as string[]),
  ).slice(0, max);
}

function requireCapability(actor: AdminStaffActor, capability: StaffCapability) {
  if (!hasStaffCapability(actor, capability)) {
    throw new AdminStaffAuthError('staff_capability_required', 403);
  }
  return actor;
}

function templateKey(value: unknown) {
  const key = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);

  return /^[a-z0-9][a-z0-9._-]{2,119}$/.test(key) ? key : null;
}

const templateInclude = {
  applicationForm: {
    select: { id: true, key: true, name: true, status: true },
  },
  evaluationFormVersion: {
    select: {
      id: true,
      versionNumber: true,
      state: true,
      accessMode: true,
      title: true,
      form: { select: { id: true, key: true, name: true, status: true } },
    },
  },
  defaultDepartment: { select: { id: true, name: true, active: true } },
  defaultDesignation: { select: { id: true, name: true, departmentId: true } },
  createdByProfile: { select: { id: true, name: true, email: true } },
  updatedByProfile: { select: { id: true, name: true, email: true } },
} satisfies Prisma.RecruitmentTemplateInclude;

async function validateTemplateReferences(input: {
  applicationFormId?: string | null;
  evaluationFormVersionId?: string | null;
  defaultDepartmentId?: string | null;
  defaultDesignationId?: string | null;
  defaultRoleIds?: string[];
}) {
  const [applicationForm, evaluationVersion, department, designation, roles] = await Promise.all([
    input.applicationFormId
      ? prisma.enterpriseForm.findUnique({
          where: { id: input.applicationFormId },
          select: { id: true, status: true },
        })
      : null,
    input.evaluationFormVersionId
      ? prisma.enterpriseFormVersion.findUnique({
          where: { id: input.evaluationFormVersionId },
          select: { id: true, state: true, accessMode: true, form: { select: { status: true } } },
        })
      : null,
    input.defaultDepartmentId
      ? prisma.department.findUnique({
          where: { id: input.defaultDepartmentId },
          select: { id: true, active: true },
        })
      : null,
    input.defaultDesignationId
      ? prisma.designation.findUnique({
          where: { id: input.defaultDesignationId },
          select: { id: true, departmentId: true },
        })
      : null,
    input.defaultRoleIds?.length
      ? prisma.role.findMany({
          where: { id: { in: input.defaultRoleIds } },
          select: { id: true },
        })
      : [],
  ]);

  if (input.applicationFormId && (!applicationForm || applicationForm.status !== 'ACTIVE')) {
    throw new RecruitmentError('recruitment_application_form_must_be_active', 409);
  }

  if (
    input.evaluationFormVersionId &&
    (!evaluationVersion ||
      evaluationVersion.state !== 'PUBLISHED' ||
      evaluationVersion.accessMode !== 'INTERNAL' ||
      evaluationVersion.form.status !== 'ACTIVE')
  ) {
    throw new RecruitmentError('recruitment_evaluation_form_must_be_published_internal', 409);
  }

  if (input.defaultDepartmentId && (!department || !department.active)) {
    throw new RecruitmentError('recruitment_department_must_be_active', 409);
  }

  if (input.defaultDesignationId && !designation) {
    throw new RecruitmentError('recruitment_designation_not_found', 409);
  }

  if (
    designation &&
    input.defaultDepartmentId &&
    designation.departmentId !== input.defaultDepartmentId
  ) {
    throw new RecruitmentError('recruitment_designation_department_mismatch', 409);
  }

  if ((input.defaultRoleIds?.length || 0) !== roles.length) {
    throw new RecruitmentError('recruitment_role_not_found', 409);
  }
}

export async function getRecruitmentWorkspace(actor: AdminStaffActor) {
  if (
    !hasStaffCapability(actor, 'recruitment.templates.read') &&
    !hasStaffCapability(actor, 'applications.onboarding.manage')
  ) {
    throw new AdminStaffAuthError('staff_capability_required', 403);
  }

  const [templates, settings, forms, evaluationVersions, departments, roles] = await Promise.all([
    prisma.recruitmentTemplate.findMany({
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
      include: templateInclude,
    }),
    prisma.recruitmentSettings.findUnique({
      where: { key: 'global' },
      include: {
        defaultTemplate: { select: { id: true, key: true, name: true, status: true } },
        updatedByProfile: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.enterpriseForm.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      select: { id: true, key: true, name: true, status: true },
    }),
    prisma.enterpriseFormVersion.findMany({
      where: {
        state: 'PUBLISHED',
        accessMode: 'INTERNAL',
        form: { status: 'ACTIVE' },
      },
      orderBy: [{ formId: 'asc' }, { versionNumber: 'desc' }],
      select: {
        id: true,
        formId: true,
        versionNumber: true,
        title: true,
        state: true,
        accessMode: true,
        form: { select: { id: true, key: true, name: true } },
      },
    }),
    prisma.department.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      include: { designations: { orderBy: { name: 'asc' } } },
    }),
    prisma.role.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);

  return {
    ok: true,
    templates,
    settings,
    support: { forms, evaluationVersions, departments, roles },
    permissions: {
      canManageTemplates: hasStaffCapability(actor, 'recruitment.templates.manage'),
      canManageSettings: hasStaffCapability(actor, 'recruitment.settings.manage'),
      canConvertApplicants: hasStaffCapability(actor, 'applications.onboarding.manage'),
    },
  };
}

export async function createRecruitmentTemplate(input: {
  actor: AdminStaffActor;
  body: any;
}) {
  requireCapability(input.actor, 'recruitment.templates.manage');

  const key = templateKey(input.body?.key || input.body?.name);
  const name = cleanText(input.body?.name, 240);
  if (!key || !name) throw new RecruitmentError('recruitment_template_key_and_name_required', 400);

  const applicationFormId = cleanText(input.body?.applicationFormId, 160);
  const evaluationFormVersionId = cleanText(input.body?.evaluationFormVersionId, 160);
  const defaultDepartmentId = cleanText(input.body?.defaultDepartmentId, 160);
  const defaultDesignationId = cleanText(input.body?.defaultDesignationId, 160);
  const defaultRoleIds = uniqueIds(input.body?.defaultRoleIds, 50);

  await validateTemplateReferences({
    applicationFormId,
    evaluationFormVersionId,
    defaultDepartmentId,
    defaultDesignationId,
    defaultRoleIds,
  });

  const opportunityType = cleanText(input.body?.opportunityType, 80)?.toUpperCase() || null;
  const validOpportunityTypes = [
    'CAREER_JOB', 'INTERNSHIP_GRADUATE', 'ONBOARDING', 'PARTNERSHIP',
    'FRANCHISE', 'VENDOR_PROVIDER', 'RESEARCH_PILOT', 'CUSTOM',
  ];
  if (opportunityType && !validOpportunityTypes.includes(opportunityType)) {
    throw new RecruitmentError('invalid_recruitment_opportunity_type', 400);
  }

  const created = await prisma.recruitmentTemplate.create({
    data: {
      key,
      name,
      description: cleanText(input.body?.description, 8000),
      opportunityType: opportunityType as any,
      opportunityTitle: cleanText(input.body?.opportunityTitle, 240),
      opportunitySummary: cleanText(input.body?.opportunitySummary, 1200),
      opportunityDescription: cleanText(input.body?.opportunityDescription, 16000),
      applicationFormId,
      evaluationFormVersionId,
      defaultDepartmentId,
      defaultDesignationId,
      defaultRoleIds,
      settings: input.body?.settings && typeof input.body.settings === 'object'
        ? input.body.settings as Prisma.InputJsonValue
        : Prisma.JsonNull,
      status: input.body?.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      createdByProfileId: input.actor.profileId,
      updatedByProfileId: input.actor.profileId,
    },
    include: templateInclude,
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: input.actor.userId,
      actorType: 'ADMIN',
      actorRefId: input.actor.profileId,
      app: 'admin-dashboard',
      action: 'recruitment.template.created',
      entityType: 'RecruitmentTemplate',
      entityId: created.id,
      description: created.name,
      meta: { key: created.key },
    },
  }).catch(() => null);

  return { ok: true, template: created };
}

export async function updateRecruitmentTemplate(input: {
  actor: AdminStaffActor;
  templateId: string;
  body: any;
}) {
  requireCapability(input.actor, 'recruitment.templates.manage');
  const current = await prisma.recruitmentTemplate.findUnique({ where: { id: input.templateId } });
  if (!current) throw new RecruitmentError('recruitment_template_not_found', 404);

  const applicationFormId = Object.prototype.hasOwnProperty.call(input.body, 'applicationFormId')
    ? cleanText(input.body.applicationFormId, 160)
    : current.applicationFormId;
  const evaluationFormVersionId = Object.prototype.hasOwnProperty.call(input.body, 'evaluationFormVersionId')
    ? cleanText(input.body.evaluationFormVersionId, 160)
    : current.evaluationFormVersionId;
  const defaultDepartmentId = Object.prototype.hasOwnProperty.call(input.body, 'defaultDepartmentId')
    ? cleanText(input.body.defaultDepartmentId, 160)
    : current.defaultDepartmentId;
  const defaultDesignationId = Object.prototype.hasOwnProperty.call(input.body, 'defaultDesignationId')
    ? cleanText(input.body.defaultDesignationId, 160)
    : current.defaultDesignationId;
  const defaultRoleIds = Object.prototype.hasOwnProperty.call(input.body, 'defaultRoleIds')
    ? uniqueIds(input.body.defaultRoleIds, 50)
    : current.defaultRoleIds;

  await validateTemplateReferences({
    applicationFormId,
    evaluationFormVersionId,
    defaultDepartmentId,
    defaultDesignationId,
    defaultRoleIds,
  });

  const status = cleanText(input.body?.status, 40)?.toUpperCase();
  if (status && !['ACTIVE', 'INACTIVE', 'ARCHIVED'].includes(status)) {
    throw new RecruitmentError('invalid_recruitment_template_status', 400);
  }

  const opportunityType = Object.prototype.hasOwnProperty.call(input.body, 'opportunityType')
    ? cleanText(input.body.opportunityType, 80)?.toUpperCase() || null
    : current.opportunityType;

  const updated = await prisma.recruitmentTemplate.update({
    where: { id: current.id },
    data: {
      ...(Object.prototype.hasOwnProperty.call(input.body, 'name')
        ? { name: cleanText(input.body.name, 240) || current.name }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(input.body, 'description')
        ? { description: cleanText(input.body.description, 8000) }
        : {}),
      opportunityType: opportunityType as any,
      applicationFormId,
      evaluationFormVersionId,
      defaultDepartmentId,
      defaultDesignationId,
      defaultRoleIds,
      ...(Object.prototype.hasOwnProperty.call(input.body, 'opportunityTitle')
        ? { opportunityTitle: cleanText(input.body.opportunityTitle, 240) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(input.body, 'opportunitySummary')
        ? { opportunitySummary: cleanText(input.body.opportunitySummary, 1200) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(input.body, 'opportunityDescription')
        ? { opportunityDescription: cleanText(input.body.opportunityDescription, 16000) }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(input.body, 'settings')
        ? {
            settings: input.body.settings && typeof input.body.settings === 'object'
              ? input.body.settings as Prisma.InputJsonValue
              : Prisma.JsonNull,
          }
        : {}),
      ...(status ? { status: status as any } : {}),
      updatedByProfileId: input.actor.profileId,
    },
    include: templateInclude,
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: input.actor.userId,
      actorType: 'ADMIN',
      actorRefId: input.actor.profileId,
      app: 'admin-dashboard',
      action: 'recruitment.template.updated',
      entityType: 'RecruitmentTemplate',
      entityId: updated.id,
      description: updated.name,
      meta: { status: updated.status },
    },
  }).catch(() => null);

  return { ok: true, template: updated };
}

export async function updateRecruitmentSettings(input: {
  actor: AdminStaffActor;
  body: any;
}) {
  requireCapability(input.actor, 'recruitment.settings.manage');

  const defaultTemplateId = cleanText(input.body?.defaultTemplateId, 160);
  if (defaultTemplateId) {
    const template = await prisma.recruitmentTemplate.findUnique({
      where: { id: defaultTemplateId },
      select: { id: true, status: true },
    });
    if (!template || template.status === 'ARCHIVED') {
      throw new RecruitmentError('recruitment_default_template_invalid', 409);
    }
  }

  const settings = await prisma.recruitmentSettings.upsert({
    where: { key: 'global' },
    update: {
      defaultTemplateId,
      onboardingMessage: cleanText(input.body?.onboardingMessage, 4000),
      requireCredentialBeforeApproval: input.body?.requireCredentialBeforeApproval !== false,
      updatedByProfileId: input.actor.profileId,
    },
    create: {
      key: 'global',
      defaultTemplateId,
      onboardingMessage: cleanText(input.body?.onboardingMessage, 4000),
      requireCredentialBeforeApproval: input.body?.requireCredentialBeforeApproval !== false,
      updatedByProfileId: input.actor.profileId,
    },
    include: { defaultTemplate: true },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: input.actor.userId,
      actorType: 'ADMIN',
      actorRefId: input.actor.profileId,
      app: 'admin-dashboard',
      action: 'recruitment.settings.updated',
      entityType: 'RecruitmentSettings',
      entityId: settings.key,
      description: 'Recruitment settings updated',
      meta: {
        defaultTemplateId: settings.defaultTemplateId,
        requireCredentialBeforeApproval: settings.requireCredentialBeforeApproval,
      },
    },
  }).catch(() => null);

  return { ok: true, settings };
}

async function deliverOnboardingNotice(input: {
  email: string;
  name: string | null;
  referenceCode: string;
  message: string | null;
}) {
  const subject = `Ambulant+ staff onboarding — ${input.referenceCode}`;
  const text = [
    `Hello ${input.name || input.email},`,
    '',
    'Your successful application is moving into Ambulant+ staff onboarding.',
    input.message || '',
    '',
    'Your access remains subject to the internal role-request approval and credential checks.',
  ].filter(Boolean).join('\n');
  const html = `<p>Hello ${String(input.name || input.email).replace(/[<>&]/g, '')},</p><p>Your successful application is moving into Ambulant+ staff onboarding.</p>${input.message ? `<p>${String(input.message).replace(/[<>&]/g, '')}</p>` : ''}<p>Your access remains subject to the internal role-request approval and credential checks.</p>`;
  return sendEmail(input.email, subject, html, text);
}

export async function initiateApplicationStaffConversion(input: {
  actor: AdminStaffActor;
  applicationId: string;
  body: any;
}) {
  requireCapability(input.actor, 'applications.onboarding.manage');

  const templateId = cleanText(input.body?.templateId, 160);
  const template = templateId
    ? await prisma.recruitmentTemplate.findUnique({ where: { id: templateId } })
    : null;

  if (templateId && (!template || template.status === 'ARCHIVED')) {
    throw new RecruitmentError('recruitment_template_not_available', 409);
  }

  const roleIds = uniqueIds(
    input.body?.roleIds ?? template?.defaultRoleIds ?? [],
    50,
  );
  const departmentId = cleanText(input.body?.departmentId ?? template?.defaultDepartmentId, 160);
  const designationId = cleanText(input.body?.designationId ?? template?.defaultDesignationId, 160);
  const notes = cleanText(input.body?.notes, 2000);
  const name = cleanText(input.body?.name, 240);

  const application = await prisma.application.findUnique({
    where: { id: input.applicationId },
    include: {
      staffConversion: {
        include: {
          roleRequest: true,
          staffProfile: { select: { id: true, email: true, name: true } },
        },
      },
      opportunity: { select: { title: true } },
    },
  });

  if (!application) throw new RecruitmentError('application_not_found', 404);
  if (!canStartCanonicalStaffOnboarding(application.status)) {
    throw new RecruitmentError('application_not_eligible_for_staff_onboarding', 409, {
      status: application.status,
    });
  }

  if (application.staffConversion?.status === 'ACTIVE') {
    return { ok: true, conversion: application.staffConversion, alreadyActive: true };
  }
  if (application.staffConversion?.status === 'PENDING_APPROVAL') {
    return { ok: true, conversion: application.staffConversion, alreadyPending: true };
  }

  const email = cleanEmail(input.body?.email || application.applicantEmailNormalized);
  if (!email) throw new RecruitmentError('applicant_email_required_for_staff_onboarding', 409);

  const [department, designation, roles, existingProfile, credential, settings] = await Promise.all([
    departmentId
      ? prisma.department.findUnique({ where: { id: departmentId }, select: { id: true, active: true } })
      : null,
    designationId
      ? prisma.designation.findUnique({
          where: { id: designationId },
          select: { id: true, departmentId: true, roles: { select: { roleId: true } } },
        })
      : null,
    roleIds.length
      ? prisma.role.findMany({ where: { id: { in: roleIds } }, select: { id: true } })
      : [],
    prisma.adminUserProfile.findUnique({
      where: { email },
      select: { id: true, userId: true, email: true, name: true },
    }),
    prisma.adminAuthCredential.findUnique({ where: { email }, select: { id: true } }),
    prisma.recruitmentSettings.findUnique({ where: { key: 'global' } }),
  ]);

  if (departmentId && (!department || !department.active)) {
    throw new RecruitmentError('staff_onboarding_department_invalid', 409);
  }
  if (designationId && !designation) {
    throw new RecruitmentError('staff_onboarding_designation_invalid', 409);
  }
  if (designation && departmentId && designation.departmentId !== departmentId) {
    throw new RecruitmentError('staff_onboarding_designation_department_mismatch', 409);
  }
  if (roles.length !== roleIds.length) {
    throw new RecruitmentError('staff_onboarding_role_invalid', 409);
  }
  if (!roleIds.length && !(designation?.roles?.length || 0)) {
    throw new RecruitmentError('staff_onboarding_requires_role_or_designation_role', 409);
  }

  const result = await prisma.$transaction(async (tx) => {
    const roleRequest = await tx.roleRequest.create({
      data: {
        userId: existingProfile?.id || null,
        email,
        name: name || existingProfile?.name || null,
        departmentId,
        designationId,
        reason: cleanText(
          `Application ${application.referenceCode} staff onboarding${notes ? ` — ${notes}` : ''}`,
          1000,
        ),
        roles: roleIds.length
          ? { create: roleIds.map((roleId) => ({ roleId })) }
          : undefined,
      },
      include: { roles: { include: { role: true } }, department: true, designation: true },
    });

    const conversion = application.staffConversion
      ? await tx.applicationStaffConversion.update({
          where: { id: application.staffConversion.id },
          data: {
            roleRequestId: roleRequest.id,
            staffProfileId: null,
            status: 'PENDING_APPROVAL',
            initiatedByProfileId: input.actor.profileId,
            activatedByProfileId: null,
            activatedAt: null,
            notes,
          },
          include: { roleRequest: true, staffProfile: true },
        })
      : await tx.applicationStaffConversion.create({
          data: {
            applicationId: application.id,
            roleRequestId: roleRequest.id,
            status: 'PENDING_APPROVAL',
            initiatedByProfileId: input.actor.profileId,
            notes,
          },
          include: { roleRequest: true, staffProfile: true },
        });

    await tx.auditLog.create({
      data: {
        actorUserId: input.actor.userId,
        actorType: 'ADMIN',
        actorRefId: input.actor.profileId,
        app: 'admin-dashboard',
        action: 'application.staff_onboarding.started',
        entityType: 'Application',
        entityId: application.id,
        description: `Canonical staff onboarding initiated for ${application.referenceCode}`,
        meta: {
          referenceCode: application.referenceCode,
          roleRequestId: roleRequest.id,
          conversionId: conversion.id,
          credentialReady: Boolean(credential),
          existingProfileId: existingProfile?.id || null,
          templateId: template?.id || null,
        },
      },
    });

    return { roleRequest, conversion };
  }, { isolationLevel: 'Serializable' });

  deliverOnboardingNotice({
    email,
    name: name || existingProfile?.name || null,
    referenceCode: application.referenceCode,
    message: settings?.onboardingMessage || null,
  }).catch((error) => console.warn('[recruitment onboarding email] failed', error));

  return {
    ok: true,
    conversion: result.conversion,
    roleRequest: result.roleRequest,
    credentialReady: Boolean(credential),
    existingProfileId: existingProfile?.id || null,
  };
}
