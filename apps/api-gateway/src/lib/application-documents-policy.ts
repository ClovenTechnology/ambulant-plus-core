import { canTransitionApplication, type ApplicationStatus } from './applications-policy';

export const APPLICATION_DOCUMENT_CONTENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
] as const;

export type ApplicationDocumentContentType =
  (typeof APPLICATION_DOCUMENT_CONTENT_TYPES)[number];

export const APPLICATION_DOCUMENT_DEFAULT_MAX_BYTES = 15 * 1024 * 1024;
export const APPLICATION_DOCUMENT_HARD_MAX_BYTES = 25 * 1024 * 1024;
export const APPLICATION_PORTAL_TOKEN_BYTES = 32;
export const APPLICATION_PORTAL_TOKEN_HOURS = 24;

const APPLICATION_REFERENCE = /^APP-[A-F0-9]{20}$/;
const HEX_SHA256 = /^[a-f0-9]{64}$/;

export type ApplicationDocumentRequestStatus =
  | 'REQUESTED'
  | 'RECEIVED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'CANCELLED';

export type ApplicationDocumentDecision = 'ACCEPT' | 'REJECT' | 'REREQUEST';

export function cleanApplicationDocumentText(value: unknown, max = 1000) {
  return String(value ?? '').trim().slice(0, max);
}

export function normaliseApplicationReference(value: unknown) {
  const reference = cleanApplicationDocumentText(value, 40).toUpperCase();
  return APPLICATION_REFERENCE.test(reference) ? reference : '';
}

export function normaliseApplicationPortalEmail(value: unknown) {
  const email = cleanApplicationDocumentText(value, 320).toLowerCase();
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

export function validDocumentChecksum(value: unknown) {
  return HEX_SHA256.test(cleanApplicationDocumentText(value, 64).toLowerCase());
}

function startsWithBytes(bytes: Uint8Array, signature: number[]) {
  return (
    bytes.length >= signature.length &&
    signature.every((value, index) => bytes[index] === value)
  );
}

export function applicationDocumentSignatureMatches(
  contentType: unknown,
  bytes: Uint8Array,
) {
  const normalized = cleanApplicationDocumentText(contentType, 160).toLowerCase();
  if (normalized === 'application/pdf') {
    return startsWithBytes(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);
  }
  if (normalized === 'image/jpeg') {
    return startsWithBytes(bytes, [0xff, 0xd8, 0xff]);
  }
  if (normalized === 'image/png') {
    return startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }
  return false;
}

export function canStartApplicationDocumentCycle(status: ApplicationStatus) {
  return (
    (status === 'UNDER_REVIEW' || status === 'SHORTLISTED') &&
    canTransitionApplication(status, 'DOCUMENTS_REQUESTED')
  );
}

export function canApplicantUploadDocument(status: ApplicationDocumentRequestStatus) {
  return status === 'REQUESTED' || status === 'RECEIVED';
}

export function applicationDocumentRequestExpired(
  dueAt: Date | string | null | undefined,
  nowMs = Date.now(),
) {
  if (!dueAt) return false;
  const due = dueAt instanceof Date ? dueAt : new Date(dueAt);
  return Number.isNaN(due.getTime()) || due.getTime() < nowMs;
}

export function canReviewApplicationDocument(
  status: ApplicationDocumentRequestStatus,
  decision: ApplicationDocumentDecision,
) {
  if (decision === 'ACCEPT' || decision === 'REJECT') return status === 'RECEIVED';
  return (
    decision === 'REREQUEST' &&
    (status === 'REQUESTED' || status === 'RECEIVED' || status === 'REJECTED')
  );
}

export function canApplicantWithdrawApplication(status: ApplicationStatus) {
  return canTransitionApplication(status, 'WITHDRAWN');
}

export function canCompleteDocumentCycle(
  requests: Array<{ required: boolean; status: ApplicationDocumentRequestStatus }>,
) {
  if (!requests.length) return false;
  if (requests.some((request) => request.status === 'RECEIVED')) return false;
  return requests
    .filter((request) => request.required)
    .every((request) => request.status === 'ACCEPTED');
}

export function normaliseDocumentContentTypes(value: unknown) {
  const source = Array.isArray(value) ? value : [];
  const allowed = new Set<string>(APPLICATION_DOCUMENT_CONTENT_TYPES);
  const output: ApplicationDocumentContentType[] = [];

  for (const item of source) {
    const contentType = cleanApplicationDocumentText(item, 160).toLowerCase();
    if (!allowed.has(contentType) || output.includes(contentType as ApplicationDocumentContentType)) {
      continue;
    }
    output.push(contentType as ApplicationDocumentContentType);
  }

  return output.length ? output : [...APPLICATION_DOCUMENT_CONTENT_TYPES];
}

export function normaliseDocumentMaxBytes(value: unknown) {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed) || parsed < 1) return APPLICATION_DOCUMENT_DEFAULT_MAX_BYTES;
  return Math.min(APPLICATION_DOCUMENT_HARD_MAX_BYTES, parsed);
}

export function normaliseDocumentDecision(value: unknown): ApplicationDocumentDecision | '' {
  const decision = cleanApplicationDocumentText(value, 40).toUpperCase();
  return decision === 'ACCEPT' || decision === 'REJECT' || decision === 'REREQUEST'
    ? decision
    : '';
}
