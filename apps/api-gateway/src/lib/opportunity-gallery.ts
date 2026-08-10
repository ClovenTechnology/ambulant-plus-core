export const OPPORTUNITY_GALLERY_MAX_IMAGES = 8;

export function canAddOpportunityGalleryImage(count: unknown) {
  const value = Number(count);
  return Number.isInteger(value) && value >= 0 && value < OPPORTUNITY_GALLERY_MAX_IMAGES;
}

export function normaliseOpportunityGallerySortOrder(value: unknown, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    const safeFallback = Number(fallback);
    return Number.isFinite(safeFallback) && safeFallback >= 0
      ? Math.min(999, Math.floor(safeFallback))
      : 0;
  }
  return Math.min(999, Math.floor(parsed));
}
