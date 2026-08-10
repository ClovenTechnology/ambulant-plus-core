import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { AdminStaffActor } from '@/src/lib/admin-staff-auth';
import { isManagedEnterpriseMediaRef } from '@/src/lib/enterprise-media-storage';
import { generateOpportunityDiscovery } from '@/src/lib/opportunity-discovery';
import {
  cleanOpportunityText,
  isOpportunityApplicationMode,
  isOpportunityLocationMode,
  isOpportunityType,
  isOpportunityVisibility,
  normaliseCountryCode,
  normaliseOpportunityKey,
  normaliseOpportunitySlug,
  normaliseOpportunityTags,
  opportunityAvailability,
  parseOpportunityDate,
  validateOpportunityApplicationTarget,
  validCountryCode,
  validOpportunityImage,
  validOpportunityKey,
  validOpportunitySlug,
  validOpportunityTags,
  validOpportunityWindow,
  type OpportunityApplicationMode,
} from '@/src/lib/opportunities-policy';

export class OpportunityDomainError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function isOpportunityUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

export async function writeOpportunityAudit(input: {
  actor: AdminStaffActor;
  action: string;
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
      entityType: 'Opportunity',
      entityId: input.entityId,
      description: input.description || undefined,
      userAgent: input.userAgent || undefined,
      meta: input.meta,
    },
  });
}

export const opportunityAdminInclude = {
  applicationForm: {
    include: {
      versions: {
        where: { state: 'PUBLISHED' as const },
        orderBy: { versionNumber: 'desc' as const },
        take: 1,
        select: {
          id: true,
          versionNumber: true,
          state: true,
          accessMode: true,
          acceptingFrom: true,
          acceptingUntil: true,
          publishedAt: true,
        },
      },
    },
  },
  createdByProfile: { select: { id: true, name: true, email: true } },
  lastUpdatedByProfile: { select: { id: true, name: true, email: true } },
  publishedByProfile: { select: { id: true, name: true, email: true } },
  pausedByProfile: { select: { id: true, name: true, email: true } },
  closedByProfile: { select: { id: true, name: true, email: true } },
  archivedByProfile: { select: { id: true, name: true, email: true } },
  galleryImages: {
    orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
    select: {
      id: true,
      mediaRef: true,
      altText: true,
      caption: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  _count: { select: { applications: true } },
};


export type OpportunityWriteInput = {
  key: string;
  slug: string;
  type: import('@/src/lib/opportunities-policy').OpportunityType;
  visibility: import('@/src/lib/opportunities-policy').OpportunityVisibility;
  applicationMode: import('@/src/lib/opportunities-policy').OpportunityApplicationMode;
  title: string;
  summary: string | null;
  description: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  tags: string[];
  referenceCode: string | null;
  audienceLabel: string | null;
  commitmentLabel: string | null;
  commercialLabel: string | null;
  ctaLabel: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  aeoSummary: string | null;
  aeoQuestions: Prisma.InputJsonValue | typeof Prisma.JsonNull;
  discoveryMeta: Prisma.InputJsonValue | typeof Prisma.JsonNull;
  departmentLabel: string | null;
  locationMode: import('@/src/lib/opportunities-policy').OpportunityLocationMode | null;
  locationLabel: string | null;
  countryCode: string | null;
  opensAt: Date | null;
  closesAt: Date | null;
  applicationFormId: string | null;
  externalApplicationUrl: string | null;
  featured: boolean;
  sortOrder: number;
};

function normaliseAeoQuestions(value: unknown) {
  if (!Array.isArray(value)) return null;
  const items = value
    .slice(0, 12)
    .map((item) => {
      const question = cleanOpportunityText((item as any)?.question, 240);
      const answer = cleanOpportunityText((item as any)?.answer, 1000);
      return question && answer ? { question, answer } : null;
    })
    .filter(Boolean) as Array<{ question: string; answer: string }>;
  return items.length ? items : null;
}

type OpportunityWriteDefaults =
  Omit<Partial<OpportunityWriteInput>, 'aeoQuestions' | 'discoveryMeta'> & {
    aeoQuestions?: unknown;
    discoveryMeta?: unknown;
  };

export function parseOpportunityWriteInput(
  body: any,
  defaults: OpportunityWriteDefaults = {},
): OpportunityWriteInput {
  const title = cleanOpportunityText(body?.title ?? defaults.title, 240);
  const key = normaliseOpportunityKey(body?.key ?? defaults.key ?? title);
  const slug = normaliseOpportunitySlug(body?.slug ?? defaults.slug ?? title);
  const type = body?.type ?? defaults.type ?? 'CUSTOM';
  const visibility = body?.visibility ?? defaults.visibility ?? 'PUBLIC';
  const applicationMode =
    body?.applicationMode ?? defaults.applicationMode ?? 'NONE';

  const rawLocationMode =
    body?.locationMode === undefined ? defaults.locationMode : body.locationMode;
  const locationMode =
    rawLocationMode === null || String(rawLocationMode ?? '').trim() === ''
      ? null
      : rawLocationMode;

  const rawOpensAt = body?.opensAt === undefined ? defaults.opensAt : body.opensAt;
  const rawClosesAt =
    body?.closesAt === undefined ? defaults.closesAt : body.closesAt;
  const opensAt = rawOpensAt instanceof Date ? rawOpensAt : parseOpportunityDate(rawOpensAt);
  const closesAt =
    rawClosesAt instanceof Date ? rawClosesAt : parseOpportunityDate(rawClosesAt);

  if (!title) throw new OpportunityDomainError('opportunity_title_required', 400);
  if (!validOpportunityKey(key)) {
    throw new OpportunityDomainError('invalid_opportunity_key', 400);
  }
  if (!validOpportunitySlug(slug)) {
    throw new OpportunityDomainError('invalid_opportunity_slug', 400);
  }
  if (!isOpportunityType(type)) {
    throw new OpportunityDomainError('invalid_opportunity_type', 400);
  }
  if (!isOpportunityVisibility(visibility)) {
    throw new OpportunityDomainError('invalid_opportunity_visibility', 400);
  }
  if (!isOpportunityApplicationMode(applicationMode)) {
    throw new OpportunityDomainError('invalid_opportunity_application_mode', 400);
  }
  if (locationMode !== null && !isOpportunityLocationMode(locationMode)) {
    throw new OpportunityDomainError('invalid_opportunity_location_mode', 400);
  }

  if (
    rawOpensAt !== null &&
    rawOpensAt !== undefined &&
    String(rawOpensAt).trim() !== '' &&
    !opensAt
  ) {
    throw new OpportunityDomainError('invalid_opportunity_opens_at', 400);
  }
  if (
    rawClosesAt !== null &&
    rawClosesAt !== undefined &&
    String(rawClosesAt).trim() !== '' &&
    !closesAt
  ) {
    throw new OpportunityDomainError('invalid_opportunity_closes_at', 400);
  }
  if (!validOpportunityWindow({ opensAt, closesAt })) {
    throw new OpportunityDomainError('invalid_opportunity_window', 400);
  }

  const countryCode = normaliseCountryCode(
    body?.countryCode === undefined ? defaults.countryCode : body.countryCode,
  );
  if (!validCountryCode(countryCode)) {
    throw new OpportunityDomainError('invalid_opportunity_country_code', 400);
  }

  if (body && Object.prototype.hasOwnProperty.call(body, 'imageUrl')) {
    throw new OpportunityDomainError('opportunity_image_upload_required', 400);
  }

  const imageUrl = cleanOpportunityText(defaults.imageUrl, 2048) || null;
  const imageAlt =
    cleanOpportunityText(
      body?.imageAlt === undefined ? defaults.imageAlt : body.imageAlt,
      240,
    ) || null;

  if (!validOpportunityImage({ imageUrl, imageAlt })) {
    throw new OpportunityDomainError('invalid_opportunity_image', 400);
  }

  const applicationFormId =
    cleanOpportunityText(
      body?.applicationFormId === undefined
        ? defaults.applicationFormId
        : body.applicationFormId,
      240,
    ) || null;
  const externalApplicationUrl =
    cleanOpportunityText(
      body?.externalApplicationUrl === undefined
        ? defaults.externalApplicationUrl
        : body.externalApplicationUrl,
      2048,
    ) || null;

  if (
    !validateOpportunityApplicationTarget({
      applicationMode,
      applicationFormId,
      externalApplicationUrl,
    })
  ) {
    throw new OpportunityDomainError('invalid_opportunity_application_target', 400);
  }

  const rawSortOrder = body?.sortOrder ?? defaults.sortOrder ?? 0;
  const sortOrder = Number(rawSortOrder);
  if (!Number.isInteger(sortOrder) || Math.abs(sortOrder) > 1_000_000) {
    throw new OpportunityDomainError('invalid_opportunity_sort_order', 400);
  }

  const summary =
    cleanOpportunityText(body?.summary ?? defaults.summary, 1200) || null;
  const description =
    cleanOpportunityText(body?.description ?? defaults.description, 50000) || null;
  const tags = normaliseOpportunityTags(
    body?.tags === undefined ? defaults.tags : body.tags,
  );
  const audienceLabel =
    cleanOpportunityText(body?.audienceLabel ?? defaults.audienceLabel, 160) || null;
  const commitmentLabel =
    cleanOpportunityText(body?.commitmentLabel ?? defaults.commitmentLabel, 160) || null;
  const commercialLabel =
    cleanOpportunityText(body?.commercialLabel ?? defaults.commercialLabel, 200) || null;
  const ctaLabel =
    cleanOpportunityText(body?.ctaLabel ?? defaults.ctaLabel, 80) || null;
  const departmentLabel =
    cleanOpportunityText(body?.departmentLabel ?? defaults.departmentLabel, 160) || null;
  const locationLabel =
    cleanOpportunityText(body?.locationLabel ?? defaults.locationLabel, 240) || null;

  const generated = generateOpportunityDiscovery({
    title,
    type,
    summary,
    description,
    tags,
    audienceLabel,
    commitmentLabel,
    commercialLabel,
    ctaLabel,
    departmentLabel,
    locationMode,
    locationLabel,
    countryCode,
    opensAt,
    closesAt,
  });

  const explicitSeoTitle =
    cleanOpportunityText(body?.seoTitle ?? defaults.seoTitle, 240) || null;
  const explicitSeoDescription =
    cleanOpportunityText(body?.seoDescription ?? defaults.seoDescription, 500) || null;
  const explicitAeoSummary =
    cleanOpportunityText(body?.aeoSummary ?? defaults.aeoSummary, 1200) || null;
  const explicitAeoQuestions = normaliseAeoQuestions(
    body?.aeoQuestions === undefined ? defaults.aeoQuestions : body.aeoQuestions,
  );
  const existingDiscoveryMeta =
    (body?.discoveryMeta === undefined ? defaults.discoveryMeta : body.discoveryMeta);
  const effectiveAeoQuestions =
    explicitAeoQuestions || generated.aeoQuestions;

  return {
    key,
    slug,
    type,
    visibility,
    applicationMode,
    title,
    summary,
    description,
    imageUrl,
    imageAlt,
    tags,
    referenceCode:
      cleanOpportunityText(body?.referenceCode ?? defaults.referenceCode, 80) || null,
    audienceLabel,
    commitmentLabel,
    commercialLabel,
    ctaLabel,
    seoTitle: explicitSeoTitle || generated.seoTitle,
    seoDescription: explicitSeoDescription || generated.seoDescription,
    aeoSummary: explicitAeoSummary || generated.aeoSummary,
    aeoQuestions:
      effectiveAeoQuestions?.length
        ? effectiveAeoQuestions
        : Prisma.JsonNull,
    discoveryMeta:
      existingDiscoveryMeta &&
      typeof existingDiscoveryMeta === 'object' &&
      !Array.isArray(existingDiscoveryMeta)
        ? existingDiscoveryMeta as unknown as Prisma.InputJsonObject
        : generated.discoveryMeta as unknown as Prisma.InputJsonObject,
    departmentLabel,
    locationMode,
    locationLabel,
    countryCode,
    opensAt,
    closesAt,
    applicationFormId,
    externalApplicationUrl,
    featured: Boolean(body?.featured ?? defaults.featured ?? false),
    sortOrder,
  };
}

export function serializeAdminOpportunity(row: any) {
  return {
    ...row,
    imageUrl: isManagedEnterpriseMediaRef(row?.imageUrl)
      ? `/api/admin/opportunities/${encodeURIComponent(String(row.id))}/image`
      : row?.imageUrl || null,
    galleryImages: Array.isArray(row?.galleryImages)
      ? row.galleryImages.map((image: any) => ({
          id: String(image.id),
          imageUrl: isManagedEnterpriseMediaRef(image.mediaRef)
            ? `/api/admin/opportunities/${encodeURIComponent(String(row.id))}/gallery/${encodeURIComponent(String(image.id))}`
            : image.mediaRef || null,
          altText: image.altText || '',
          caption: image.caption || null,
          sortOrder: Number(image.sortOrder || 0),
          createdAt: image.createdAt,
          updatedAt: image.updatedAt,
        }))
      : [],
  };
}

export function assertOpportunityStoredPublishable(input: any) {
  if (!cleanOpportunityText(input?.title, 240)) {
    throw new OpportunityDomainError('opportunity_title_required', 400);
  }
  if (!validOpportunityKey(input?.key)) {
    throw new OpportunityDomainError('invalid_opportunity_key', 400);
  }
  if (!validOpportunitySlug(input?.slug)) {
    throw new OpportunityDomainError('invalid_opportunity_slug', 400);
  }
  if (!isOpportunityType(input?.type)) {
    throw new OpportunityDomainError('invalid_opportunity_type', 400);
  }
  if (!isOpportunityVisibility(input?.visibility)) {
    throw new OpportunityDomainError('invalid_opportunity_visibility', 400);
  }
  if (!isOpportunityApplicationMode(input?.applicationMode)) {
    throw new OpportunityDomainError('invalid_opportunity_application_mode', 400);
  }
  if (input?.locationMode && !isOpportunityLocationMode(input.locationMode)) {
    throw new OpportunityDomainError('invalid_opportunity_location_mode', 400);
  }
  if (!validCountryCode(input?.countryCode)) {
    throw new OpportunityDomainError('invalid_opportunity_country_code', 400);
  }
  if (!validOpportunityImage({ imageUrl: input?.imageUrl, imageAlt: input?.imageAlt })) {
    throw new OpportunityDomainError('invalid_opportunity_image', 400);
  }
  if (!validOpportunityTags(input?.tags)) {
    throw new OpportunityDomainError('invalid_opportunity_tags', 400);
  }
  if (!validOpportunityWindow({ opensAt: input?.opensAt, closesAt: input?.closesAt })) {
    throw new OpportunityDomainError('invalid_opportunity_window', 400);
  }
  if (
    !validateOpportunityApplicationTarget({
      applicationMode: input.applicationMode,
      applicationFormId: input.applicationFormId,
      externalApplicationUrl: input.externalApplicationUrl,
    })
  ) {
    throw new OpportunityDomainError('invalid_opportunity_application_target', 400);
  }
}

export async function assertOpportunityApplicationFormReady(input: {
  applicationMode: OpportunityApplicationMode;
  applicationFormId?: string | null;
  now?: Date;
}) {
  if (input.applicationMode !== 'ENTERPRISE_FORM') return null;

  const formId = cleanOpportunityText(input.applicationFormId, 240);
  if (!formId) {
    throw new OpportunityDomainError('opportunity_application_form_required', 400);
  }

  const form = await prisma.enterpriseForm.findFirst({
    where: { id: formId, status: 'ACTIVE' },
    include: {
      versions: {
        where: { state: 'PUBLISHED', accessMode: 'PUBLIC' },
        orderBy: { versionNumber: 'desc' },
        take: 1,
        select: {
          id: true,
          versionNumber: true,
          acceptingFrom: true,
          acceptingUntil: true,
          publishedAt: true,
        },
      },
    },
  });

  if (!form) {
    throw new OpportunityDomainError('opportunity_application_form_not_active', 409);
  }

  const version = form.versions[0];
  if (!version) {
    throw new OpportunityDomainError(
      'opportunity_application_form_public_version_required',
      409,
    );
  }

  const now = input.now ?? new Date();
  if (version.acceptingUntil && version.acceptingUntil.getTime() <= now.getTime()) {
    throw new OpportunityDomainError(
      'opportunity_application_form_submission_window_closed',
      409,
    );
  }

  return { form, version };
}

export function serializePublicOpportunity(row: any, now = new Date()) {
  const availability = opportunityAvailability({
    status: row.status,
    opensAt: row.opensAt,
    closesAt: row.closesAt,
    now,
  });

  const publishedFormVersion = row.applicationForm?.versions?.[0] ?? null;
  const formWindowOpen =
    publishedFormVersion &&
    (!publishedFormVersion.acceptingFrom ||
      publishedFormVersion.acceptingFrom.getTime() <= now.getTime()) &&
    (!publishedFormVersion.acceptingUntil ||
      publishedFormVersion.acceptingUntil.getTime() > now.getTime());

  let application:
    | {
        mode: 'ENTERPRISE_FORM';
        available: boolean;
        href: string | null;
        formSlug: string | null;
      }
    | {
        mode: 'EXTERNAL_URL';
        available: boolean;
        href: string | null;
      }
    | { mode: 'NONE'; available: false; href: null };

  if (row.applicationMode === 'ENTERPRISE_FORM') {
    const formSlug = row.applicationForm?.slug || null;
    const available =
      availability === 'OPEN' &&
      row.applicationForm?.status === 'ACTIVE' &&
      Boolean(publishedFormVersion) &&
      formWindowOpen;

    application = {
      mode: 'ENTERPRISE_FORM',
      available,
      href: available && formSlug ? `/forms/${formSlug}?opportunity=${encodeURIComponent(row.slug)}` : null,
      formSlug,
    };
  } else if (row.applicationMode === 'EXTERNAL_URL') {
    const available = availability === 'OPEN' && Boolean(row.externalApplicationUrl);
    application = {
      mode: 'EXTERNAL_URL',
      available,
      href: available ? row.externalApplicationUrl : null,
    };
  } else {
    application = { mode: 'NONE', available: false, href: null };
  }

  return {
    slug: row.slug,
    type: row.type,
    visibility: row.visibility,
    title: row.title,
    summary: row.summary,
    description: row.description,
    imageUrl: row.imageUrl,
    imageAlt: row.imageAlt,
    galleryImages: Array.isArray(row.galleryImages)
      ? row.galleryImages.map((image: any) => ({
          id: String(image.id),
          imageUrl: image.mediaRef || null,
          altText: image.altText || '',
          caption: image.caption || null,
          sortOrder: Number(image.sortOrder || 0),
        }))
      : [],
    tags: Array.isArray(row.tags) ? row.tags : [],
    referenceCode: row.referenceCode,
    audienceLabel: row.audienceLabel,
    commitmentLabel: row.commitmentLabel,
    commercialLabel: row.commercialLabel,
    ctaLabel: row.ctaLabel,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    aeoSummary: row.aeoSummary,
    aeoQuestions: Array.isArray(row.aeoQuestions) ? row.aeoQuestions : [],
    discoveryMeta: row.discoveryMeta,
    departmentLabel: row.departmentLabel,
    locationMode: row.locationMode,
    locationLabel: row.locationLabel,
    countryCode: row.countryCode,
    opensAt: row.opensAt,
    closesAt: row.closesAt,
    featured: row.featured,
    availability,
    publishedAt: row.publishedAt,
    application,
  };
}

export function opportunityDomainResponse(error: unknown) {
  if (error instanceof OpportunityDomainError) {
    return { status: error.status, body: { ok: false, error: error.message } };
  }
  return null;
}
