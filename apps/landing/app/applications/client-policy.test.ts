import assert from 'node:assert/strict';
import test from 'node:test';
import {
  accessTokenFromFragment,
  canUploadForRequest,
  canWithdrawFromPortal,
  canRespondToInterview,
  canResendInterviewInvite,
  interviewResponseLabel,
  formatPortalInterviewDate,
  normalisePortalReference,
  portalSessionStorageKey,
  portalDocumentRequestExpired,
  requestStatusLabel,
} from './client-policy';

test('application reference normalization is strict', () => {
  assert.equal(normalisePortalReference('app-0123456789abcdefabcd'), 'APP-0123456789ABCDEFABCD');
  assert.equal(normalisePortalReference('APP-123'), '');
});

test('portal access credential is accepted only from an access fragment', () => {
  const token = 'a'.repeat(43);
  assert.equal(accessTokenFromFragment(`#access=${token}`), token);
  assert.equal(accessTokenFromFragment(`#token=${token}`), '');
});

test('session storage is isolated by canonical application reference', () => {
  assert.equal(
    portalSessionStorageKey('APP-0123456789ABCDEFABCD'),
    'ambulant:application-portal:APP-0123456789ABCDEFABCD',
  );
});

test('withdrawal remains unavailable for terminal states', () => {
  assert.equal(canWithdrawFromPortal('SHORTLISTED'), true);
  assert.equal(canWithdrawFromPortal('DOCUMENTS_REQUESTED'), true);
  assert.equal(canWithdrawFromPortal('DECLINED'), false);
  assert.equal(canWithdrawFromPortal('WITHDRAWN'), false);
});

test('document upload is permitted only while a request is open to applicant action and before deadline', () => {
  assert.equal(canUploadForRequest('REQUESTED'), true);
  assert.equal(canUploadForRequest('RECEIVED'), true);
  assert.equal(canUploadForRequest('ACCEPTED'), false);
  assert.equal(canUploadForRequest('REJECTED'), false);
  assert.equal(portalDocumentRequestExpired('2030-01-01T00:00:00.000Z', Date.parse('2029-01-01T00:00:00.000Z')), false);
  assert.equal(portalDocumentRequestExpired('2028-01-01T00:00:00.000Z', Date.parse('2029-01-01T00:00:00.000Z')), true);
});

test('request labels distinguish action required, review and terminal request states', () => {
  assert.equal(requestStatusLabel('REQUESTED'), 'Action required');
  assert.equal(requestStatusLabel('RECEIVED'), 'Submitted for review');
  assert.equal(requestStatusLabel('ACCEPTED'), 'Accepted');
});

test('interview response is available only for a pending scheduled invitation', () => {
  assert.equal(canRespondToInterview({ applicationStatus: 'INTERVIEW_INVITED', intervieweeState: 'INVITED', meetingState: 'SCHEDULED' }), true);
  assert.equal(canRespondToInterview({ applicationStatus: 'INTERVIEW_SCHEDULED', intervieweeState: 'ACCEPTED', meetingState: 'SCHEDULED' }), false);
  assert.equal(canRespondToInterview({ applicationStatus: 'INTERVIEW_INVITED', intervieweeState: 'INVITED', meetingState: 'CANCELLED' }), false);
});

test('secure interview invite resend stays limited to active invited or scheduled interviews', () => {
  assert.equal(canResendInterviewInvite({ applicationStatus: 'INTERVIEW_INVITED', meetingState: 'SCHEDULED' }), true);
  assert.equal(canResendInterviewInvite({ applicationStatus: 'INTERVIEW_SCHEDULED', meetingState: 'RINGING' }), true);
  assert.equal(canResendInterviewInvite({ applicationStatus: 'SHORTLISTED', meetingState: 'SCHEDULED' }), false);
  assert.equal(canResendInterviewInvite({ applicationStatus: 'INTERVIEW_SCHEDULED', meetingState: 'LIVE' }), false);
});

test('interview response labels are applicant friendly', () => {
  assert.equal(interviewResponseLabel('INVITED'), 'Awaiting your response');
  assert.equal(interviewResponseLabel('ACCEPTED'), 'Accepted');
  assert.equal(interviewResponseLabel('DECLINED'), 'Declined');
});

test('interview schedule is rendered in the declared IANA timezone', () => {
  const rendered = formatPortalInterviewDate('2026-08-09T12:00:00.000Z', 'Africa/Johannesburg');
  assert.match(rendered, /14:00/);
  assert.match(rendered, /Africa\/Johannesburg/);
});
