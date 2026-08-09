import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatApplicationValue,
  humanizeApplicationError,
  reviewActions,
  stageGovernanceNote,
  adminDocumentRequestExpired,
  canCompleteAdminDocumentCycle,
  documentRequestStatusLabel,
} from './application-ui';

test('submitted applications expose only governed review actions', () => {
  assert.deepEqual(reviewActions('SUBMITTED').map((item) => item.toStatus), [
    'UNDER_REVIEW',
    'DECLINED',
  ]);
});

test('under-review applications can shortlist or decline without downstream shortcuts', () => {
  assert.deepEqual(reviewActions('UNDER_REVIEW').map((item) => item.toStatus), [
    'SHORTLISTED',
    'DECLINED',
  ]);
  assert.equal(reviewActions('SHORTLISTED').some((item) => item.toStatus === 'INTERVIEW_INVITED'), false);
});

test('governance notes make downstream workspace ownership explicit', () => {
  assert.match(stageGovernanceNote('SHORTLISTED'), /Interview invitation/);
  assert.match(stageGovernanceNote('DOCUMENTS_REQUESTED'), /document/i);
  assert.match(stageGovernanceNote('INTERVIEW_SCHEDULED'), /Meetings/);
});

test('application values render primitives and structured answers predictably', () => {
  assert.equal(formatApplicationValue(true), 'Yes');
  assert.equal(formatApplicationValue(42), '42');
  assert.match(formatApplicationValue({ score: 5 }), /"score": 5/);
});

test('concurrency and permission errors are humanized for reviewers', () => {
  assert.match(humanizeApplicationError('application_status_changed_concurrently'), /Refresh/);
  assert.match(humanizeApplicationError('application_scope_required'), /permission/);
});


test('document-cycle completion requires accepted required requests and no unreviewed received file', () => {
  assert.equal(canCompleteAdminDocumentCycle([{ required: true, status: 'ACCEPTED' }]), true);
  assert.equal(canCompleteAdminDocumentCycle([{ required: true, status: 'REQUESTED' }]), false);
  assert.equal(canCompleteAdminDocumentCycle([{ required: true, status: 'ACCEPTED' }, { required: false, status: 'RECEIVED' }]), false);
});

test('document request status labels remain reviewer-readable', () => {
  assert.equal(documentRequestStatusLabel('REQUESTED'), 'Requested');
  assert.equal(documentRequestStatusLabel('ACCEPTED'), 'Accepted');
});


test('document request deadline helper flags only expired or invalid deadlines', () => {
  const now = Date.parse('2029-01-01T00:00:00.000Z');
  assert.equal(adminDocumentRequestExpired('2030-01-01T00:00:00.000Z', now), false);
  assert.equal(adminDocumentRequestExpired('2028-01-01T00:00:00.000Z', now), true);
  assert.equal(adminDocumentRequestExpired('not-a-date', now), true);
  assert.equal(adminDocumentRequestExpired(null, now), false);
});
