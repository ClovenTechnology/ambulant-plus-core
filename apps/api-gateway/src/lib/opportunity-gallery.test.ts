import assert from 'node:assert/strict';
import test from 'node:test';
import {
  OPPORTUNITY_GALLERY_MAX_IMAGES,
  canAddOpportunityGalleryImage,
  normaliseOpportunityGallerySortOrder,
} from './opportunity-gallery';

test('opportunity gallery allows up to eight additional images', () => {
  assert.equal(OPPORTUNITY_GALLERY_MAX_IMAGES, 8);
  assert.equal(canAddOpportunityGalleryImage(0), true);
  assert.equal(canAddOpportunityGalleryImage(7), true);
  assert.equal(canAddOpportunityGalleryImage(8), false);
  assert.equal(canAddOpportunityGalleryImage(-1), false);
});

test('opportunity gallery sort order is bounded and deterministic', () => {
  assert.equal(normaliseOpportunityGallerySortOrder(3), 3);
  assert.equal(normaliseOpportunityGallerySortOrder(2000), 999);
  assert.equal(normaliseOpportunityGallerySortOrder('bad', 4), 4);
});
