export type ApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'SHORTLISTED'
  | 'DOCUMENTS_REQUESTED'
  | 'INTERVIEW_INVITED'
  | 'INTERVIEW_SCHEDULED'
  | 'INTERVIEWED'
  | 'SUCCESSFUL'
  | 'OFFERED'
  | 'ONBOARDING'
  | 'DECLINED'
  | 'WITHDRAWN'
  | 'EXPIRED';

export type ApplicationDocumentRequestStatus =
  | 'REQUESTED'
  | 'RECEIVED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'CANCELLED';

export type ApplicationPortalFile = {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  state: 'PENDING' | 'AVAILABLE' | 'SUPERSEDED' | 'REJECTED' | 'REMOVED';
  availableAt?: string | null;
  createdAt: string;
};

export type ApplicationPortalDocumentRequest = {
  id: string;
  requestKey: string;
  title: string;
  instructions?: string | null;
  required: boolean;
  dueAt?: string | null;
  status: ApplicationDocumentRequestStatus;
  allowedContentTypes: string[];
  maxFileSizeBytes: number;
  requestedAt: string;
  reviewedAt?: string | null;
  reviewReason?: string | null;
  files: ApplicationPortalFile[];
};

export type ApplicationPortal = {
  referenceCode: string;
  status: ApplicationStatus;
  submittedAt?: string | null;
  statusChangedAt: string;
  opportunity: {
    slug: string;
    title: string;
    referenceCode?: string | null;
    type: string;
  };
  statusHistory: Array<{
    id: string;
    fromStatus?: ApplicationStatus | null;
    toStatus: ApplicationStatus;
    createdAt: string;
  }>;
  documentCycles: Array<{
    id: string;
    cycleNumber: number;
    returnStatus: ApplicationStatus;
    status: 'OPEN' | 'COMPLETED' | 'CANCELLED';
    requestedAt: string;
    completedAt?: string | null;
    requests: ApplicationPortalDocumentRequest[];
  }>;
};
