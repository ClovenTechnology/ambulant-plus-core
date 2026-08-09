export const APPLICATION_INTERVIEW_CONTEXT_TYPE = 'APPLICATION_INTERVIEW' as const;
export const MAX_APPLICATION_INTERVIEWERS = 12;
export const DEFAULT_APPLICATION_INTERVIEW_DURATION_MINUTES = 60;

export type ApplicationInterviewApplicationStatus =
  | 'SHORTLISTED'
  | 'INTERVIEW_INVITED'
  | 'INTERVIEW_SCHEDULED';

export type ApplicationInterviewParticipantState =
  | 'INVITED'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'JOINED'
  | 'LEFT'
  | 'REMOVED';

export type ApplicationInterviewMeetingState =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'RINGING'
  | 'LIVE'
  | 'ENDED'
  | 'CANCELLED'
  | 'EXPIRED';

export function cleanApplicationInterviewText(value: unknown, max = 4000) {
  return String(value ?? '').trim().slice(0, max);
}

export function uniqueApplicationInterviewProfileIds(
  value: unknown,
  max = MAX_APPLICATION_INTERVIEWERS,
) {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];
  return Array.from(
    new Set(
      values
        .map((item) => cleanApplicationInterviewText(item, 240))
        .filter(Boolean),
    ),
  ).slice(0, Math.max(1, Math.min(MAX_APPLICATION_INTERVIEWERS, max)));
}

export function canCreateApplicationInterview(status: string) {
  return status === 'SHORTLISTED';
}

export function canManageApplicationInterview(status: string) {
  return status === 'INTERVIEW_INVITED' || status === 'INTERVIEW_SCHEDULED';
}

export function canApplicantRespondToApplicationInterview(input: {
  applicationStatus: string;
  participantState: string;
  meetingState: string;
}) {
  return (
    input.applicationStatus === 'INTERVIEW_INVITED' &&
    input.participantState === 'INVITED' &&
    input.meetingState === 'SCHEDULED'
  );
}

export function canResendApplicationInterviewInvitation(input: {
  applicationStatus: string;
  meetingState: string;
}) {
  return (
    canManageApplicationInterview(input.applicationStatus) &&
    (input.meetingState === 'SCHEDULED' || input.meetingState === 'RINGING')
  );
}

export function canCancelApplicationInterview(input: {
  applicationStatus: string;
  meetingState: string;
}) {
  return (
    canManageApplicationInterview(input.applicationStatus) &&
    (input.meetingState === 'SCHEDULED' || input.meetingState === 'RINGING')
  );
}

export function applicationInterviewResponseLabel(state: string) {
  const labels: Record<string, string> = {
    INVITED: 'Awaiting response',
    ACCEPTED: 'Accepted',
    DECLINED: 'Declined',
    JOINED: 'Joined',
    LEFT: 'Attended',
    REMOVED: 'Closed',
  };
  return labels[state] || state.replace(/_/g, ' ').toLowerCase();
}
