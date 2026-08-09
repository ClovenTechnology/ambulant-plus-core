export const APPLICATION_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'SHORTLISTED',
  'DOCUMENTS_REQUESTED',
  'INTERVIEW_INVITED',
  'INTERVIEW_SCHEDULED',
  'INTERVIEWED',
  'SUCCESSFUL',
  'OFFERED',
  'ONBOARDING',
  'DECLINED',
  'WITHDRAWN',
  'EXPIRED',
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under review',
  SHORTLISTED: 'Shortlisted',
  DOCUMENTS_REQUESTED: 'Documents requested',
  INTERVIEW_INVITED: 'Interview invited',
  INTERVIEW_SCHEDULED: 'Interview scheduled',
  INTERVIEWED: 'Interviewed',
  SUCCESSFUL: 'Successful',
  OFFERED: 'Offered',
  ONBOARDING: 'Onboarding',
  DECLINED: 'Declined',
  WITHDRAWN: 'Withdrawn',
  EXPIRED: 'Expired',
};

export type AdminApplicationListItem = {
  id: string;
  referenceCode: string;
  source: string;
  status: ApplicationStatus;
  applicantEmailNormalized: string | null;
  statusReason: string | null;
  statusChangedAt: string;
  submittedAt: string | null;
  lastReviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  opportunity: {
    id: string;
    key: string;
    slug: string;
    title: string;
    type: string;
    referenceCode: string | null;
  };
  formVersion: {
    id: string;
    versionNumber: number;
    title: string | null;
  };
  assignedReviewer: {
    id: string;
    name: string | null;
    email: string;
    staffIdentifier: string | null;
    lifecycleState: string;
  } | null;
};

export type AdminApplicationDetail = AdminApplicationListItem & {
  submission: null | {
    id: string;
    status: string;
    locale: string;
    startedAt: string;
    submittedAt: string | null;
    identityEmailNormalized: string | null;
    canRead: boolean;
    canReadSensitive: boolean;
    answers: Array<{
      id: string;
      fieldId: string;
      fieldKey: string;
      label: string;
      type: string | null;
      required: boolean;
      sensitive: boolean;
      redacted: boolean;
      value: unknown;
      page: { id: string; title: string; order: number } | null;
      section: { id: string; title: string; order: number } | null;
      order: number;
    }>;
    files: Array<{
      id: string;
      fieldId: string;
      fieldKey: string;
      label: string;
      sensitive: boolean;
      redacted: boolean;
      state: string;
      fileName: string | null;
      contentType: string | null;
      sizeBytes: number | null;
      checksumSha256: string | null;
      availableAt: string | null;
      createdAt: string;
    }>;
    consents: Array<{
      id: string;
      fieldId: string;
      fieldKey: string;
      label: string;
      sensitive: boolean;
      redacted: boolean;
      accepted: boolean | null;
      acceptedAt: string | null;
      consentTextHash: string | null;
    }>;
  };
  statusHistory: Array<{
    id: string;
    fromStatus: ApplicationStatus | null;
    toStatus: ApplicationStatus;
    actorType: string;
    actorRefId: string | null;
    reason: string | null;
    createdAt: string;
  }>;
  documents: {
    canRead: boolean;
    canRequest: boolean;
    canReview: boolean;
    cycles: Array<{
      id: string;
      cycleNumber: number;
      returnStatus: ApplicationStatus;
      status: 'OPEN' | 'COMPLETED' | 'CANCELLED';
      requestedByProfileId: string | null;
      requestedAt: string;
      completedByProfileId: string | null;
      completedAt: string | null;
      createdAt: string;
      updatedAt: string;
      requests: Array<{
        id: string;
        requestKey: string;
        title: string;
        instructions: string | null;
        required: boolean;
        dueAt: string | null;
        status: 'REQUESTED' | 'RECEIVED' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
        allowedContentTypes: string[];
        maxFileSizeBytes: number;
        requestedAt: string;
        reviewedAt: string | null;
        reviewedByProfileId: string | null;
        reviewReason: string | null;
        files: Array<{
          id: string;
          fileName: string;
          contentType: string;
          sizeBytes: number;
          checksumSha256: string;
          state: 'PENDING' | 'AVAILABLE' | 'SUPERSEDED' | 'REJECTED' | 'REMOVED';
          availableAt: string | null;
          createdAt: string;
        }>;
      }>;
      events: Array<{
        id: string;
        requestId: string | null;
        fileId: string | null;
        action: string;
        actorType: string;
        actorRefId: string | null;
        note: string | null;
        createdAt: string;
      }>;
    }>;
  };
};

export type ReviewerOption = {
  id: string;
  name: string | null;
  email: string;
  staffIdentifier: string | null;
  department?: { id: string; name: string } | null;
  designation?: { id: string; name: string } | null;
};

export function humanizeApplicationError(value: unknown) {
  const code = String(value || '').trim();
  const map: Record<string, string> = {
    application_scope_required: 'You do not have permission for this application action.',
    application_not_found: 'This application could not be found.',
    application_list_failed: 'Applications could not be loaded.',
    application_detail_failed: 'Application details could not be loaded.',
    application_status_changed_concurrently: 'The application status changed elsewhere. Refresh before trying again.',
    application_changed_concurrently: 'The application changed elsewhere. Refresh before assigning a reviewer.',
    application_transition_not_available_in_review_workspace: 'That stage is controlled by a later governed workflow and cannot be set manually here.',
    application_decline_reason_required: 'Add an internal reason before declining the application.',
    application_reviewer_not_assignable: 'That staff member is not currently assignable as a reviewer.',
    application_reviewer_list_failed: 'Reviewer options could not be loaded.',
    application_assignment_failed: 'Reviewer assignment failed.',
    application_transition_failed: 'Application status update failed.',
    application_document_title_required: 'Add a document title before sending the request.',
    application_document_due_date_invalid: 'Enter a valid document deadline.',
    application_document_due_date_must_be_future: 'The document deadline must be in the future.',
    application_document_request_not_available: 'Document requests can only start from an under-review or shortlisted application.',
    application_document_cycle_state_mismatch: 'The application document workflow changed elsewhere. Refresh before continuing.',
    application_document_review_reason_required: 'Add an applicant-facing reason before rejecting or requesting a resubmission.',
    application_document_new_due_date_required: 'This request deadline has passed. Add a new future deadline before reopening it.',
    application_document_review_not_available: 'That document review action is not available in the current request state.',
    application_document_file_not_available: 'No current uploaded file is available for this review action.',
    application_document_cycle_incomplete: 'All required documents must be accepted and no received document may remain unreviewed.',
    application_document_download_failed: 'The secure document download could not be prepared.',
  };
  return map[code] || code.replace(/_/g, ' ') || 'Something went wrong.';
}

export function reviewActions(status: ApplicationStatus) {
  if (status === 'SUBMITTED') {
    return [
      { toStatus: 'UNDER_REVIEW' as const, label: 'Start review', kind: 'primary' as const },
      { toStatus: 'DECLINED' as const, label: 'Decline', kind: 'danger' as const },
    ];
  }
  if (status === 'UNDER_REVIEW') {
    return [
      { toStatus: 'SHORTLISTED' as const, label: 'Shortlist', kind: 'primary' as const },
      { toStatus: 'DECLINED' as const, label: 'Decline', kind: 'danger' as const },
    ];
  }
  if (status === 'SHORTLISTED') {
    return [
      { toStatus: 'DECLINED' as const, label: 'Decline', kind: 'danger' as const },
    ];
  }
  return [];
}

export function stageGovernanceNote(status: ApplicationStatus) {
  if (status === 'SHORTLISTED') {
    return 'Use the governed Applicant documents section below for document requests. Interview invitation remains owned by the shared Meetings and Interview workflow.';
  }
  if (status === 'DOCUMENTS_REQUESTED') {
    return 'Document-request progression is governed by the secure applicant-document workflow.';
  }
  if (status === 'INTERVIEW_INVITED' || status === 'INTERVIEW_SCHEDULED') {
    return 'Interview progression is governed by the shared Meetings and Interview workspace.';
  }
  if (status === 'INTERVIEWED' || status === 'SUCCESSFUL' || status === 'OFFERED') {
    return 'Decision and onboarding progression is governed by the evaluation and staff-conversion workflows.';
  }
  return '';
}

export function formatApplicationValue(value: unknown) {
  if (value == null) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function formatApplicationDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

export function adminDocumentRequestExpired(
  dueAt: string | null | undefined,
  nowMs = Date.now(),
) {
  if (!dueAt) return false;
  const due = new Date(dueAt);
  return Number.isNaN(due.getTime()) || due.getTime() < nowMs;
}

export function documentRequestStatusLabel(status: string) {
  const labels: Record<string, string> = {
    REQUESTED: 'Requested',
    RECEIVED: 'Received',
    ACCEPTED: 'Accepted',
    REJECTED: 'Rejected',
    CANCELLED: 'Closed',
  };
  return labels[status] || status.replace(/_/g, ' ').toLowerCase();
}

export function canCompleteAdminDocumentCycle(requests: Array<{ required: boolean; status: string }>) {
  if (!requests.length) return false;
  if (requests.some((request) => request.status === 'RECEIVED')) return false;
  return requests.filter((request) => request.required).every((request) => request.status === 'ACCEPTED');
}
