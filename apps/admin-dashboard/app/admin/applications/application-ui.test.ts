import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatApplicationValue,
  formatApplicationInterviewDate,
  applicationInterviewLocalInputValue,
  humanizeApplicationError,
  reviewActions,
  stageGovernanceNote,
  adminDocumentRequestExpired,
  canCompleteAdminDocumentCycle,
  documentRequestStatusLabel,
  applicationInterviewResponseLabel,
  applicationInterviewStateLabel,
  canManageInterviewFromApplication,
  canScheduleInterviewFromApplication,
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
  assert.match(stageGovernanceNote('SHORTLISTED'), /Interview section/);
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

test('interview controls become available only at governed application stages', () => {
  assert.equal(canScheduleInterviewFromApplication('SHORTLISTED'), true);
  assert.equal(canScheduleInterviewFromApplication('UNDER_REVIEW'), false);
  assert.equal(canManageInterviewFromApplication('INTERVIEW_INVITED', 'SCHEDULED'), true);
  assert.equal(canManageInterviewFromApplication('INTERVIEW_SCHEDULED', 'RINGING'), true);
  assert.equal(canManageInterviewFromApplication('INTERVIEW_SCHEDULED', 'LIVE'), false);
});

test('interview meeting and applicant response labels remain reviewer-readable', () => {
  assert.equal(applicationInterviewStateLabel('SCHEDULED'), 'Scheduled');
  assert.equal(applicationInterviewStateLabel('CANCELLED'), 'Cancelled');
  assert.equal(applicationInterviewResponseLabel('INVITED'), 'Awaiting applicant response');
  assert.equal(applicationInterviewResponseLabel('ACCEPTED'), 'Applicant accepted');
});

test('interview workflow errors are humanized without exposing internal implementation details', () => {
  assert.match(humanizeApplicationError('application_interview_interviewer_required'), /interviewer/i);
  assert.match(humanizeApplicationError('application_interview_start_must_be_future'), /future/i);
  assert.match(humanizeApplicationError('application_interview_cancel_reason_required'), /reason/i);
});

test('interview scheduling displays and hydrates in the declared IANA timezone', () => {
  const instant = '2026-08-09T12:00:00.000Z';
  assert.match(formatApplicationInterviewDate(instant, 'Africa/Johannesburg'), /14:00/);
  assert.match(formatApplicationInterviewDate(instant, 'Africa/Johannesburg'), /Africa\/Johannesburg/);
  assert.equal(applicationInterviewLocalInputValue(instant, 'Africa/Johannesburg'), '2026-08-09T14:00');
});
