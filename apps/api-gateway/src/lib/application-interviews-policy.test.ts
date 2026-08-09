import assert from 'node:assert/strict';
import test from 'node:test';
import {
  APPLICATION_INTERVIEW_CONTEXT_TYPE,
  MAX_APPLICATION_INTERVIEWERS,
  applicationInterviewResponseLabel,
  canApplicantRespondToApplicationInterview,
  canCancelApplicationInterview,
  canCreateApplicationInterview,
  canManageApplicationInterview,
  canResendApplicationInterviewInvitation,
  cleanApplicationInterviewText,
  uniqueApplicationInterviewProfileIds,
} from './application-interviews-policy';

test('application interviews use the shared Meeting context namespace', () => {
  assert.equal(APPLICATION_INTERVIEW_CONTEXT_TYPE, 'APPLICATION_INTERVIEW');
});

test('new interviews can be created only from shortlisted applications', () => {
  assert.equal(canCreateApplicationInterview('SHORTLISTED'), true);
  assert.equal(canCreateApplicationInterview('UNDER_REVIEW'), false);
  assert.equal(canCreateApplicationInterview('DOCUMENTS_REQUESTED'), false);
  assert.equal(canCreateApplicationInterview('INTERVIEW_INVITED'), false);
});

test('interview management is limited to invited or scheduled stages', () => {
  assert.equal(canManageApplicationInterview('INTERVIEW_INVITED'), true);
  assert.equal(canManageApplicationInterview('INTERVIEW_SCHEDULED'), true);
  assert.equal(canManageApplicationInterview('SHORTLISTED'), false);
  assert.equal(canManageApplicationInterview('INTERVIEWED'), false);
});

test('interviewer profile identifiers are cleaned deduplicated and bounded', () => {
  assert.deepEqual(
    uniqueApplicationInterviewProfileIds([' a ', 'a', 'b', '', null]),
    ['a', 'b'],
  );
  assert.equal(
    uniqueApplicationInterviewProfileIds(
      Array.from({ length: MAX_APPLICATION_INTERVIEWERS + 5 }, (_, index) => `staff-${index}`),
    ).length,
    MAX_APPLICATION_INTERVIEWERS,
  );
});

test('applicant can respond only to a pending scheduled interview invitation', () => {
  assert.equal(
    canApplicantRespondToApplicationInterview({
      applicationStatus: 'INTERVIEW_INVITED',
      participantState: 'INVITED',
      meetingState: 'SCHEDULED',
    }),
    true,
  );
  assert.equal(
    canApplicantRespondToApplicationInterview({
      applicationStatus: 'INTERVIEW_SCHEDULED',
      participantState: 'ACCEPTED',
      meetingState: 'SCHEDULED',
    }),
    false,
  );
});

test('cancel and resend remain unavailable once the Meeting is live or closed', () => {
  assert.equal(
    canCancelApplicationInterview({
      applicationStatus: 'INTERVIEW_SCHEDULED',
      meetingState: 'SCHEDULED',
    }),
    true,
  );
  assert.equal(
    canCancelApplicationInterview({
      applicationStatus: 'INTERVIEW_SCHEDULED',
      meetingState: 'LIVE',
    }),
    false,
  );
  assert.equal(
    canResendApplicationInterviewInvitation({
      applicationStatus: 'INTERVIEW_INVITED',
      meetingState: 'CANCELLED',
    }),
    false,
  );
});

test('interview text is trimmed and bounded for audit-safe metadata', () => {
  assert.equal(cleanApplicationInterviewText('  panel note  '), 'panel note');
  assert.equal(cleanApplicationInterviewText('x'.repeat(5000), 1000).length, 1000);
});

test('applicant response labels remain stable and human readable', () => {
  assert.equal(applicationInterviewResponseLabel('INVITED'), 'Awaiting response');
  assert.equal(applicationInterviewResponseLabel('ACCEPTED'), 'Accepted');
  assert.equal(applicationInterviewResponseLabel('DECLINED'), 'Declined');
});
