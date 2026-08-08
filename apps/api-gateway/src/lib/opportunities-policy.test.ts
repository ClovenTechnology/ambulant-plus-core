import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canEditOpportunity,
  canTransitionOpportunity,
  isPublicOpportunityDetailVisible,
  isPublicOpportunityListVisible,
  normaliseOpportunityKey,
  normaliseOpportunitySlug,
  opportunityAvailability,
  validateOpportunityApplicationTarget,
  validOpportunityKey,
  validOpportunitySlug,
  validOpportunityWindow,
} from './opportunities-policy';

test('opportunity key and slug normalisation are deterministic', () => {
  assert.equal(normaliseOpportunityKey(' Senior GP / Gauteng '), 'senior_gp_gauteng');
  assert.equal(normaliseOpportunitySlug(' Senior GP / Gauteng '), 'senior-gp-gauteng');
  assert.equal(validOpportunityKey('senior_gp_gauteng'), true);
  assert.equal(validOpportunitySlug('senior-gp-gauteng'), true);
  assert.equal(validOpportunitySlug('Senior GP'), false);
});

test('opportunity application targets are mutually exclusive and HTTPS-only', () => {
  assert.equal(
    validateOpportunityApplicationTarget({
      applicationMode: 'ENTERPRISE_FORM',
      applicationFormId: 'form_1',
      externalApplicationUrl: null,
    }),
    true,
  );
  assert.equal(
    validateOpportunityApplicationTarget({
      applicationMode: 'EXTERNAL_URL',
      applicationFormId: null,
      externalApplicationUrl: 'https://example.com/apply',
    }),
    true,
  );
  assert.equal(
    validateOpportunityApplicationTarget({
      applicationMode: 'EXTERNAL_URL',
      applicationFormId: null,
      externalApplicationUrl: 'http://example.com/apply',
    }),
    false,
  );
  assert.equal(
    validateOpportunityApplicationTarget({
      applicationMode: 'NONE',
      applicationFormId: null,
      externalApplicationUrl: null,
    }),
    true,
  );
});

test('publication window must be strictly increasing when both bounds exist', () => {
  const start = new Date('2026-08-10T10:00:00.000Z');
  const end = new Date('2026-08-10T11:00:00.000Z');
  assert.equal(validOpportunityWindow({ opensAt: start, closesAt: end }), true);
  assert.equal(validOpportunityWindow({ opensAt: end, closesAt: start }), false);
  assert.equal(validOpportunityWindow({ opensAt: start, closesAt: start }), false);
});

test('opportunity state machine is explicit and terminal states cannot reopen', () => {
  assert.equal(canEditOpportunity('DRAFT'), true);
  assert.equal(canEditOpportunity('PAUSED'), true);
  assert.equal(canEditOpportunity('PUBLISHED'), false);
  assert.equal(canTransitionOpportunity('DRAFT', 'PUBLISH'), true);
  assert.equal(canTransitionOpportunity('PUBLISHED', 'PAUSE'), true);
  assert.equal(canTransitionOpportunity('PAUSED', 'PUBLISH'), true);
  assert.equal(canTransitionOpportunity('PAUSED', 'CLOSE'), true);
  assert.equal(canTransitionOpportunity('CLOSED', 'ARCHIVE'), true);
  assert.equal(canTransitionOpportunity('CLOSED', 'PUBLISH'), false);
  assert.equal(canTransitionOpportunity('ARCHIVED', 'PUBLISH'), false);
});

test('public availability derives from state and opening/closing bounds', () => {
  const now = new Date('2026-08-10T10:00:00.000Z');
  assert.equal(
    opportunityAvailability({ status: 'DRAFT', now }),
    'UNAVAILABLE',
  );
  assert.equal(
    opportunityAvailability({
      status: 'PUBLISHED',
      opensAt: new Date('2026-08-10T11:00:00.000Z'),
      now,
    }),
    'UPCOMING',
  );
  assert.equal(
    opportunityAvailability({
      status: 'PUBLISHED',
      opensAt: new Date('2026-08-10T09:00:00.000Z'),
      closesAt: new Date('2026-08-10T11:00:00.000Z'),
      now,
    }),
    'OPEN',
  );
  assert.equal(
    opportunityAvailability({
      status: 'PUBLISHED',
      closesAt: new Date('2026-08-10T10:00:00.000Z'),
      now,
    }),
    'CLOSED',
  );
});

test('public listing excludes unlisted, internal and expired opportunities', () => {
  const now = new Date('2026-08-10T10:00:00.000Z');
  assert.equal(
    isPublicOpportunityListVisible({
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      closesAt: new Date('2026-08-10T11:00:00.000Z'),
      now,
    }),
    true,
  );
  assert.equal(
    isPublicOpportunityListVisible({
      status: 'PUBLISHED',
      visibility: 'UNLISTED',
      now,
    }),
    false,
  );
  assert.equal(
    isPublicOpportunityListVisible({
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      closesAt: new Date('2026-08-10T09:00:00.000Z'),
      now,
    }),
    false,
  );
  assert.equal(
    isPublicOpportunityDetailVisible({
      status: 'PUBLISHED',
      visibility: 'UNLISTED',
    }),
    true,
  );
  assert.equal(
    isPublicOpportunityDetailVisible({
      status: 'PUBLISHED',
      visibility: 'INTERNAL',
    }),
    false,
  );
});
