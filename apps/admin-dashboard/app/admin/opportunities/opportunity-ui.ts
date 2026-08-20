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

export const OPPORTUNITY_VISIBILITIES = ['PUBLIC', 'UNLISTED', 'INTERNAL'] as const;
export const OPPORTUNITY_APPLICATION_MODES = ['ENTERPRISE_FORM', 'EXTERNAL_URL', 'NONE'] as const;
export const OPPORTUNITY_LOCATION_MODES = ['REMOTE', 'HYBRID', 'ONSITE', 'FLEXIBLE'] as const;

export type OpportunityType = (typeof OPPORTUNITY_TYPES)[number];
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];
export type OpportunityVisibility = (typeof OPPORTUNITY_VISIBILITIES)[number];
export type OpportunityApplicationMode = (typeof OPPORTUNITY_APPLICATION_MODES)[number];
export type OpportunityLocationMode = (typeof OPPORTUNITY_LOCATION_MODES)[number];


export type OpportunityContentBlock =
  | { id: string; type: 'paragraph'; text: string }
  | { id: string; type: 'heading'; level: 2 | 3 | 4; text: string }
  | { id: string; type: 'bulletList' | 'numberedList'; items: string[] }
  | { id: string; type: 'image'; mediaId: string; caption?: string; size?: 'compact' | 'normal' | 'wide'; align?: 'left' | 'center' | 'right'; focalX?: number; focalY?: number; link?: string }
  | { id: string; type: 'quote'; text: string; attribution?: string }
  | { id: string; type: 'callout'; title?: string; text?: string; tone?: 'default' | 'navy' | 'teal' | 'cyan' | 'gold' | 'warning' | 'success' }
  | { id: string; type: 'divider' }
  | { id: string; type: 'cta'; label: string; href: string; style?: 'primary' | 'secondary' | 'text' }
  | { id: string; type: 'faq'; items: Array<{ question: string; answer: string }> }
  | { id: string; type: 'steps' | 'features'; items: Array<{ title: string; body: string }> }
  | { id: string; type: 'table'; columns: string[]; rows: string[][] };

export type OpportunityContentDocument = {
  version: 1;
  blocks: OpportunityContentBlock[];
};

export type OpportunityMedia = {
  id: string;
  imageUrl: string | null;
  altText: string;
  caption?: string | null;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type AdminOpportunity = {
  id: string;
  key: string;
  slug: string;
  type: OpportunityType;
  status: OpportunityStatus;
  visibility: OpportunityVisibility;
  applicationMode: OpportunityApplicationMode;
  title: string;
  summary?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
  featuredImage?: OpportunityMedia | null;
  galleryImages?: OpportunityMedia[];
  contentImages?: OpportunityMedia[];
  contentDocument?: OpportunityContentDocument | null;
  contentSchemaVersion?: number;
  contentRevision?: number;
  publishedContentRevision?: number | null;
  showFaq?: boolean;
  tags?: string[];
  referenceCode?: string | null;
  audienceLabel?: string | null;
  commitmentLabel?: string | null;
  commercialLabel?: string | null;
  ctaLabel?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  aeoSummary?: string | null;
  aeoQuestions?: Array<{ question: string; answer: string }> | null;
  discoveryMeta?: Record<string, unknown> | null;
  departmentLabel?: string | null;
  locationMode?: OpportunityLocationMode | null;
  locationLabel?: string | null;
  countryCode?: string | null;
  opensAt?: string | null;
  closesAt?: string | null;
  applicationFormId?: string | null;
  externalApplicationUrl?: string | null;
  featured: boolean;
  sortOrder: number;
  statusReason?: string | null;
  publishedAt?: string | null;
  pausedAt?: string | null;
  closedAt?: string | null;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  applicationForm?: {
    id: string;
    name: string;
    slug: string;
    status: 'ACTIVE' | 'ARCHIVED';
    versions?: Array<{
      id: string;
      versionNumber: number;
      state: string;
      accessMode: string;
      acceptingFrom?: string | null;
      acceptingUntil?: string | null;
      publishedAt?: string | null;
    }>;
  } | null;
};

export const TYPE_LABELS: Record<OpportunityType, string> = {
  CAREER_JOB: 'Career / job',
  INTERNSHIP_GRADUATE: 'Internship / graduate',
  ONBOARDING: 'Onboarding',
  PARTNERSHIP: 'Partnership',
  FRANCHISE: 'Franchise',
  VENDOR_PROVIDER: 'Vendor / provider',
  RESEARCH_PILOT: 'Research / pilot',
  CUSTOM: 'Custom',
};

export const STATUS_LABELS: Record<OpportunityStatus, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  PAUSED: 'Paused',
  CLOSED: 'Closed',
  ARCHIVED: 'Archived',
};

export function opportunityAvailability(opportunity: Pick<AdminOpportunity, 'status' | 'opensAt' | 'closesAt'>, now = new Date()) {
  if (opportunity.status !== 'PUBLISHED') return 'UNAVAILABLE' as const;
  const time = now.getTime();
  if (opportunity.opensAt && new Date(opportunity.opensAt).getTime() > time) return 'UPCOMING' as const;
  if (opportunity.closesAt && new Date(opportunity.closesAt).getTime() <= time) return 'CLOSED' as const;
  return 'OPEN' as const;
}

export function toDatetimeLocal(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

export function datetimeLocalToIso(value: string) {
  if (!value.trim()) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function parseTags(value: string) {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const item of value.split(',')) {
    const tag = item.trim().replace(/\s+/g, ' ').slice(0, 48);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length >= 12) break;
  }
  return tags;
}

export function humanizeOpportunityError(error: unknown) {
  const value = String(error || '').trim();
  const known: Record<string, string> = {
    opportunity_title_required: 'A title is required.',
    invalid_opportunity_key: 'The stable key is invalid.',
    invalid_opportunity_slug: 'The public slug is invalid.',
    invalid_opportunity_image: 'Upload a supported image and provide meaningful alt text, or remove the image.',
    invalid_opportunity_tags: 'Tags must be unique and limited to 12.',
    invalid_opportunity_window: 'The closing date must be later than the opening date.',
    invalid_opportunity_application_target: 'Choose exactly one valid application target for the selected application mode.',
    opportunity_application_form_not_found: 'The selected Enterprise Form no longer exists.',
    opportunity_application_form_not_active: 'The selected Enterprise Form is not active.',
    opportunity_application_form_public_version_required: 'Publish a PUBLIC version of the selected Enterprise Form before publishing this opportunity.',
    opportunity_application_form_submission_window_closed: 'The selected Enterprise Form is no longer accepting submissions.',
    opportunity_closing_time_already_passed: 'The opportunity closing time has already passed.',
    opportunity_pause_before_edit: 'Pause this published opportunity before editing it.',
    invalid_opportunity_state_transition: 'That lifecycle transition is not allowed from the current status.',
    opportunity_state_changed_concurrently: 'The opportunity changed in another session. Refresh before retrying.',
    opportunity_key_or_slug_exists: 'Another opportunity already uses this key or slug.',
    opportunity_image_upload_required: 'Use the image uploader instead of entering an image URL.',
    opportunity_image_alt_required: 'Add alt text describing the image before uploading.',
    opportunity_image_type_invalid: 'Choose a JPEG, PNG or WebP image.',
    enterprise_media_image_type_invalid: 'Choose a JPEG, PNG or WebP image.',
    enterprise_media_image_size_invalid: 'Image files must be 8 MB or smaller.',
    enterprise_media_storage_not_configured: 'Image storage is not configured for this environment. A platform administrator must configure the managed media bucket and region before images can be uploaded.',
    secure_admin_credential_required: 'Please sign in with your password before changing this image.',
    opportunity_image_presign_failed: 'The image upload could not be prepared. Please try again.',
    opportunity_image_confirm_failed: 'The uploaded image could not be saved. Please try again.',
    opportunity_image_delete_failed: 'The image could not be removed. Please try again.',
    opportunity_image_update_failed: 'The featured image details could not be updated. Please try again.',
    opportunity_gallery_limit_reached: 'This opportunity already has the maximum of 8 additional images.',
    opportunity_gallery_alt_required: 'Add meaningful alt text for every additional image before uploading.',
    opportunity_gallery_presign_failed: 'The additional image upload could not be prepared. Please try again.',
    opportunity_gallery_confirm_failed: 'The additional image could not be saved. Please try again.',
    opportunity_gallery_update_failed: 'The additional image details could not be updated. Please try again.',
    opportunity_gallery_delete_failed: 'The additional image could not be removed. Please try again.',
    invalid_opportunity_content_document: 'Publishing Studio content is not valid. Review the highlighted blocks and retry.',
    invalid_opportunity_content_revision: 'The Publishing Studio revision is invalid. Refresh before retrying.',
    opportunity_content_block_limit_reached: 'Publishing Studio supports up to 120 content blocks.',
    opportunity_content_changed_concurrently: 'This publication changed in another session. Refresh before continuing.',
    opportunity_content_save_failed: 'Publishing Studio could not save this revision. Please retry.',
    opportunity_revisions_failed: 'Revision history could not be loaded.',
    opportunity_content_media_limit_reached: 'This publication already has the maximum number of inline images.',
    opportunity_content_media_alt_required: 'Add meaningful alt text before uploading an inline image.',
    opportunity_content_media_presign_failed: 'The inline image upload could not be prepared.',
    opportunity_content_media_confirm_failed: 'The inline image could not be saved.',
    opportunity_content_media_update_failed: 'The inline image details could not be updated.',
    opportunity_content_media_delete_failed: 'The inline image could not be removed.',
    opportunity_content_media_in_use: 'Remove this image block from the publication before deleting its media asset.',
    opportunity_discovery_generation_failed: 'SEO and answer-ready discovery content could not be generated. Please try again.',
    opportunity_delete_not_allowed: 'This opportunity has publication or application history and cannot be permanently deleted. Archive it instead.',
    super_admin_required: 'Only a Super Admin can permanently delete this record.',
  };
  return known[value] || value.replace(/_/g, ' ') || 'The opportunity request could not be completed.';
}
