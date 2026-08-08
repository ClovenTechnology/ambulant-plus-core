export const OPPORTUNITY_TYPES = [
  'CAREER_JOB',
  'INTERNSHIP_GRADUATE',
  'ONBOARDING',
  'PARTNERSHIP',
  'FRANCHISE',
  'VENDOR_PROVIDER',
  'RESEARCH_PILOT',
  'CUSTOM',
] as const;

export const OPPORTUNITY_STATUSES = [
  'DRAFT',
  'PUBLISHED',
  'PAUSED',
  'CLOSED',
  'ARCHIVED',
] as const;

export const OPPORTUNITY_VISIBILITIES = [
  'PUBLIC',
  'UNLISTED',
  'INTERNAL',
] as const;

export const OPPORTUNITY_APPLICATION_MODES = [
  'ENTERPRISE_FORM',
  'EXTERNAL_URL',
  'NONE',
] as const;

export const OPPORTUNITY_LOCATION_MODES = [
  'REMOTE',
  'HYBRID',
  'ONSITE',
  'FLEXIBLE',
] as const;

export const OPPORTUNITY_STATE_ACTIONS = [
  'PUBLISH',
  'PAUSE',
  'CLOSE',
  'ARCHIVE',
] as const;

export type OpportunityType = (typeof OPPORTUNITY_TYPES)[number];
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];
export type OpportunityVisibility = (typeof OPPORTUNITY_VISIBILITIES)[number];
export type OpportunityApplicationMode =
  (typeof OPPORTUNITY_APPLICATION_MODES)[number];
export type OpportunityLocationMode = (typeof OPPORTUNITY_LOCATION_MODES)[number];
export type OpportunityStateAction = (typeof OPPORTUNITY_STATE_ACTIONS)[number];
export type OpportunityAvailability = 'UPCOMING' | 'OPEN' | 'CLOSED' | 'UNAVAILABLE';

const KEY_PATTERN = /^[a-z][a-z0-9_-]{0,119}$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COUNTRY_PATTERN = /^[A-Z]{2}$/;
const OPPORTUNITY_TAG_MAX_COUNT = 12;
const OPPORTUNITY_TAG_MAX_LENGTH = 48;

export function cleanOpportunityText(value: unknown, maxLength: number) {
  return String(value ?? '').trim().slice(0, maxLength);
}

export function normaliseOpportunityKey(value: unknown) {
  return cleanOpportunityText(value, 120)
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]+/g, '')
    .replace(/_+/g, '_')
    .replace(/-+/g, '-')
    .replace(/^[^a-z]+/, '')
    .replace(/[_-]+$/, '');
}

export function normaliseOpportunitySlug(value: unknown) {
  return cleanOpportunityText(value, 160)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

export function validOpportunityKey(value: unknown) {
  return KEY_PATTERN.test(cleanOpportunityText(value, 120));
}

export function validOpportunitySlug(value: unknown) {
  const slug = cleanOpportunityText(value, 160);
  return slug.length > 0 && slug.length <= 160 && SLUG_PATTERN.test(slug);
}

export function isOpportunityType(value: unknown): value is OpportunityType {
  return OPPORTUNITY_TYPES.includes(value as OpportunityType);
}

export function isOpportunityVisibility(
  value: unknown,
): value is OpportunityVisibility {
  return OPPORTUNITY_VISIBILITIES.includes(value as OpportunityVisibility);
}

export function isOpportunityApplicationMode(
  value: unknown,
): value is OpportunityApplicationMode {
  return OPPORTUNITY_APPLICATION_MODES.includes(
    value as OpportunityApplicationMode,
  );
}

export function isOpportunityLocationMode(
  value: unknown,
): value is OpportunityLocationMode {
  return OPPORTUNITY_LOCATION_MODES.includes(value as OpportunityLocationMode);
}

export function isOpportunityStateAction(
  value: unknown,
): value is OpportunityStateAction {
  return OPPORTUNITY_STATE_ACTIONS.includes(value as OpportunityStateAction);
}

export function normaliseCountryCode(value: unknown) {
  const code = cleanOpportunityText(value, 2).toUpperCase();
  return code || null;
}

export function validCountryCode(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return true;
  }
  return COUNTRY_PATTERN.test(normaliseCountryCode(value) || '');
}

export function parseOpportunityDate(value: unknown) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return null;
  }
  const date = new Date(String(value));
  return Number.isFinite(date.getTime()) ? date : null;
}

export function validOpportunityWindow(input: {
  opensAt?: Date | null;
  closesAt?: Date | null;
}) {
  if (
    input.opensAt &&
    input.closesAt &&
    input.closesAt.getTime() <= input.opensAt.getTime()
  ) {
    return false;
  }
  return true;
}

export function validHttpsUrl(value: unknown) {
  const raw = cleanOpportunityText(value, 2048);
  if (!raw) return false;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function normaliseOpportunityTags(value: unknown) {
  const source = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];

  const seen = new Set<string>();
  const tags: string[] = [];

  for (const item of source) {
    const tag = cleanOpportunityText(item, OPPORTUNITY_TAG_MAX_LENGTH)
      .replace(/\s+/g, ' ');
    if (!tag) continue;

    const key = tag.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    tags.push(tag);

    if (tags.length >= OPPORTUNITY_TAG_MAX_COUNT) break;
  }

  return tags;
}

export function validOpportunityTags(value: unknown) {
  if (!Array.isArray(value)) return false;

  const original = value.map((item) => String(item));
  const normalised = normaliseOpportunityTags(original);

  if (original.length !== normalised.length) return false;

  return original.every((item, index) => item === normalised[index]);
}

export function validOpportunityImage(input: {
  imageUrl?: string | null;
  imageAlt?: string | null;
}) {
  const imageUrl = cleanOpportunityText(input.imageUrl, 2048);
  const imageAlt = cleanOpportunityText(input.imageAlt, 240);

  if (!imageUrl) return imageAlt.length === 0;
  return validHttpsUrl(imageUrl) && imageAlt.length > 0;
}

export function validateOpportunityApplicationTarget(input: {
  applicationMode: OpportunityApplicationMode;
  applicationFormId?: string | null;
  externalApplicationUrl?: string | null;
}) {
  const formId = cleanOpportunityText(input.applicationFormId, 240) || null;
  const externalUrl =
    cleanOpportunityText(input.externalApplicationUrl, 2048) || null;

  if (input.applicationMode === 'ENTERPRISE_FORM') {
    return formId !== null && externalUrl === null;
  }

  if (input.applicationMode === 'EXTERNAL_URL') {
    return formId === null && externalUrl !== null && validHttpsUrl(externalUrl);
  }

  return formId === null && externalUrl === null;
}

export function canEditOpportunity(status: OpportunityStatus) {
  return status === 'DRAFT' || status === 'PAUSED';
}

export function canTransitionOpportunity(
  status: OpportunityStatus,
  action: OpportunityStateAction,
) {
  if (action === 'PUBLISH') return status === 'DRAFT' || status === 'PAUSED';
  if (action === 'PAUSE') return status === 'PUBLISHED';
  if (action === 'CLOSE') return status === 'PUBLISHED' || status === 'PAUSED';
  if (action === 'ARCHIVE') return status === 'DRAFT' || status === 'CLOSED';
  return false;
}

export function opportunityAvailability(input: {
  status: OpportunityStatus;
  opensAt?: Date | null;
  closesAt?: Date | null;
  now?: Date;
}): OpportunityAvailability {
  if (input.status !== 'PUBLISHED') return 'UNAVAILABLE';

  const now = (input.now ?? new Date()).getTime();
  if (input.closesAt && input.closesAt.getTime() <= now) return 'CLOSED';
  if (input.opensAt && input.opensAt.getTime() > now) return 'UPCOMING';
  return 'OPEN';
}

export function isPublicOpportunityDetailVisible(input: {
  status: OpportunityStatus;
  visibility: OpportunityVisibility;
}) {
  return input.status === 'PUBLISHED' && input.visibility !== 'INTERNAL';
}

export function isPublicOpportunityListVisible(input: {
  status: OpportunityStatus;
  visibility: OpportunityVisibility;
  closesAt?: Date | null;
  now?: Date;
}) {
  if (input.status !== 'PUBLISHED' || input.visibility !== 'PUBLIC') return false;
  const now = (input.now ?? new Date()).getTime();
  return !input.closesAt || input.closesAt.getTime() > now;
}
