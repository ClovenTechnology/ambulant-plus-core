import assert from 'node:assert/strict';
import test from 'node:test';
import {
  APPLICATION_STATUSES,
  canTransitionApplication,
  normaliseApplicationOpportunitySlug,
  publicApplicationContext,
} from './applications-policy';

test('application status catalogue contains the full governed recruitment pipeline', () => {
  assert.deepEqual(APPLICATION_STATUSES, [
    'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'DOCUMENTS_REQUESTED',
    'INTERVIEW_INVITED', 'INTERVIEW_SCHEDULED', 'INTERVIEWED', 'SUCCESSFUL',
    'OFFERED', 'ONBOARDING', 'DECLINED', 'WITHDRAWN', 'EXPIRED',
  ]);
});

test('draft application can submit, withdraw or expire but cannot skip into review', () => {
  assert.equal(canTransitionApplication('DRAFT', 'SUBMITTED'), true);
  assert.equal(canTransitionApplication('DRAFT', 'WITHDRAWN'), true);
  assert.equal(canTransitionApplication('DRAFT', 'EXPIRED'), true);
  assert.equal(canTransitionApplication('DRAFT', 'UNDER_REVIEW'), false);
});

test('review pipeline permits document and interview progression without arbitrary jumps', () => {
  assert.equal(canTransitionApplication('UNDER_REVIEW', 'DOCUMENTS_REQUESTED'), true);
  assert.equal(canTransitionApplication('SHORTLISTED', 'INTERVIEW_INVITED'), true);
  assert.equal(canTransitionApplication('INTERVIEW_INVITED', 'INTERVIEW_SCHEDULED'), true);
  assert.equal(canTransitionApplication('INTERVIEW_SCHEDULED', 'INTERVIEWED'), true);
  assert.equal(canTransitionApplication('SUBMITTED', 'OFFERED'), false);
});

test('decision states progress into offer/onboarding while terminal states stay terminal', () => {
  assert.equal(canTransitionApplication('INTERVIEWED', 'SUCCESSFUL'), true);
  assert.equal(canTransitionApplication('SUCCESSFUL', 'OFFERED'), true);
  assert.equal(canTransitionApplication('SUCCESSFUL', 'ONBOARDING'), true);
  assert.equal(canTransitionApplication('OFFERED', 'ONBOARDING'), true);
  assert.equal(canTransitionApplication('DECLINED', 'UNDER_REVIEW'), false);
  assert.equal(canTransitionApplication('WITHDRAWN', 'SUBMITTED'), false);
  assert.equal(canTransitionApplication('EXPIRED', 'SUBMITTED'), false);
});

test('public application context accepts only canonical opportunity slugs', () => {
  assert.equal(normaliseApplicationOpportunitySlug('  Clinical-Pilot-2026  '), 'clinical-pilot-2026');
  assert.equal(normaliseApplicationOpportunitySlug('../admin'), '');
  assert.deepEqual(publicApplicationContext({ opportunitySlug: 'clinical-pilot-2026' }), {
    opportunitySlug: 'clinical-pilot-2026',
  });
  assert.equal(publicApplicationContext({ opportunitySlug: 'not valid!' }), null);
  assert.equal(publicApplicationContext(null), null);
});
