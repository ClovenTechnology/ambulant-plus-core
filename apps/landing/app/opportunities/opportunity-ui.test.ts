import assert from 'node:assert/strict';
import test from 'node:test';
import { applicationCta, publicAvailabilityLabel } from './opportunity-ui';
import type { PublicOpportunity } from '@/lib/public-opportunities';

function opportunity(overrides: Partial<PublicOpportunity> = {}): PublicOpportunity {
  return {
    slug: 'graduate-programme',
    type: 'INTERNSHIP_GRADUATE',
    visibility: 'PUBLIC',
    title: 'Graduate programme',
    tags: [],
    featured: false,
    availability: 'OPEN',
    application: { mode: 'ENTERPRISE_FORM', available: true, href: '/forms/graduate-programme', formSlug: 'graduate-programme' },
    ...overrides,
  };
}

test('enterprise-form CTA uses configured label and canonical relative form href', () => {
  const cta = applicationCta(opportunity({ ctaLabel: 'Start application' }));
  assert.equal(cta.label, 'Start application');
  assert.equal(cta.href, '/forms/graduate-programme');
  assert.equal(cta.external, false);
  assert.equal(cta.disabled, false);
});

test('external application CTA is marked external', () => {
  const cta = applicationCta(opportunity({
    application: { mode: 'EXTERNAL_URL', available: true, href: 'https://example.org/apply' },
  }));
  assert.equal(cta.external, true);
  assert.equal(cta.href, 'https://example.org/apply');
});

test('upcoming opportunity cannot expose an application CTA', () => {
  const cta = applicationCta(opportunity({ availability: 'UPCOMING', application: { mode: 'ENTERPRISE_FORM', available: false, href: null, formSlug: 'graduate-programme' } }));
  assert.equal(cta.disabled, true);
  assert.equal(cta.href, null);
  assert.equal(cta.label, 'Applications not open yet');
});

test('closed opportunity cannot expose an application CTA', () => {
  const cta = applicationCta(opportunity({ availability: 'CLOSED', application: { mode: 'EXTERNAL_URL', available: false, href: null } }));
  assert.equal(cta.disabled, true);
  assert.equal(cta.label, 'Applications closed');
});

test('NONE mode explains that no online application is required', () => {
  const cta = applicationCta(opportunity({ application: { mode: 'NONE', available: false, href: null } }));
  assert.equal(cta.disabled, true);
  assert.equal(cta.label, 'No online application required');
});

test('availability labels remain explicit and non-ambiguous', () => {
  assert.equal(publicAvailabilityLabel('OPEN'), 'Open for applications');
  assert.equal(publicAvailabilityLabel('UPCOMING'), 'Opening soon');
  assert.equal(publicAvailabilityLabel('CLOSED'), 'Applications closed');
  assert.equal(publicAvailabilityLabel('UNAVAILABLE'), 'Not currently accepting applications');
});
