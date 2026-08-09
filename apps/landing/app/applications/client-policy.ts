import type {
  ApplicationDocumentRequestStatus,
  ApplicationStatus,
} from './types';

const REFERENCE = /^APP-[A-F0-9]{20}$/;

export function normalisePortalReference(value: unknown) {
  const reference = String(value ?? '').trim().toUpperCase().slice(0, 40);
  return REFERENCE.test(reference) ? reference : '';
}

export function accessTokenFromFragment(fragment: string) {
  const params = new URLSearchParams(String(fragment || '').replace(/^#/, ''));
  const token = String(params.get('access') || '').trim();
  return /^[A-Za-z0-9_-]{32,500}$/.test(token) ? token : '';
}

export function portalSessionStorageKey(reference: string) {
  return `ambulant:application-portal:${normalisePortalReference(reference) || 'invalid'}`;
}

export function canWithdrawFromPortal(status: ApplicationStatus) {
  return !['DRAFT', 'DECLINED', 'WITHDRAWN', 'EXPIRED'].includes(status);
}

export function canUploadForRequest(status: ApplicationDocumentRequestStatus) {
  return status === 'REQUESTED' || status === 'RECEIVED';
}

export function portalDocumentRequestExpired(
  dueAt: string | null | undefined,
  nowMs = Date.now(),
) {
  if (!dueAt) return false;
  const due = new Date(dueAt);
  return Number.isNaN(due.getTime()) || due.getTime() < nowMs;
}

export function requestStatusLabel(status: ApplicationDocumentRequestStatus) {
  const labels: Record<ApplicationDocumentRequestStatus, string> = {
    REQUESTED: 'Action required',
    RECEIVED: 'Submitted for review',
    ACCEPTED: 'Accepted',
    REJECTED: 'Rejected',
    CANCELLED: 'Closed',
  };
  return labels[status];
}

export function canRespondToInterview(input: {
  applicationStatus: ApplicationStatus;
  intervieweeState?: string | null;
  meetingState?: string | null;
}) {
  return (
    input.applicationStatus === 'INTERVIEW_INVITED' &&
    input.intervieweeState === 'INVITED' &&
    input.meetingState === 'SCHEDULED'
  );
}

export function canResendInterviewInvite(input: {
  applicationStatus: ApplicationStatus;
  meetingState?: string | null;
}) {
  return (
    (input.applicationStatus === 'INTERVIEW_INVITED' || input.applicationStatus === 'INTERVIEW_SCHEDULED') &&
    (input.meetingState === 'SCHEDULED' || input.meetingState === 'RINGING')
  );
}

export function interviewResponseLabel(state: string | null | undefined) {
  const labels: Record<string, string> = {
    INVITED: 'Awaiting your response',
    ACCEPTED: 'Accepted',
    DECLINED: 'Declined',
    JOINED: 'Joined',
    LEFT: 'Attended',
    REMOVED: 'Closed',
  };
  return labels[String(state || '')] || 'No response recorded';
}

export function formatPortalInterviewDate(
  value: string | null | undefined,
  timezone: string | null | undefined,
) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const zone = String(timezone || 'Africa/Johannesburg').trim() || 'Africa/Johannesburg';
  try {
    return `${new Intl.DateTimeFormat('en-ZA', {
      timeZone: zone,
      dateStyle: 'medium',
      timeStyle: 'short',
      hourCycle: 'h23',
    }).format(date)} (${zone})`;
  } catch {
    return `${date.toISOString()} (${zone})`;
  }
}

export function humanizePortalError(code: unknown) {
  const value = String(code || '');
  const labels: Record<string, string> = {
    application_portal_not_found: 'This secure access link is invalid or has expired. Request a new link.',
    application_portal_rate_limited: 'Too many requests. Please wait a few minutes and try again.',
    application_document_request_expired: 'This document request has passed its deadline. Please contact Ambulant+ for assistance.',
    application_document_content_type_rejected: 'That file type is not accepted for this request.',
    application_document_size_rejected: 'That file is larger than the permitted size.',
    application_document_checksum_required: 'The file integrity check could not be generated. Please try again.',
    application_document_signature_mismatch: 'The file contents do not match the selected PDF, JPEG or PNG type.',
    application_document_upload_pending: 'A file upload is already being prepared for this request. Please wait and retry.',
    application_document_upload_not_allowed: 'This document request is not currently accepting uploads.',
    application_withdrawal_not_available: 'This application can no longer be withdrawn through the portal.',
    application_interview_response_invalid: 'Choose Accept or Decline for this interview invitation.',
    application_interview_response_not_available: 'This interview invitation can no longer be accepted or declined.',
    application_interview_resend_not_available: 'A secure interview link cannot be resent for this interview state.',
    application_interview_not_found: 'No application interview is currently available.',
  };
  return labels[value] || 'The request could not be completed. Please try again.';
}
