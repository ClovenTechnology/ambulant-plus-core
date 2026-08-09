import assert from 'node:assert/strict';
import test from 'node:test';
import {
  APPLICATION_DOCUMENT_CONTENT_TYPES,
  APPLICATION_DOCUMENT_DEFAULT_MAX_BYTES,
  APPLICATION_DOCUMENT_HARD_MAX_BYTES,
  applicationDocumentRequestExpired,
  applicationDocumentSignatureMatches,
  canApplicantUploadDocument,
  canApplicantWithdrawApplication,
  canCompleteDocumentCycle,
  canReviewApplicationDocument,
  canStartApplicationDocumentCycle,
  normaliseApplicationPortalEmail,
  normaliseApplicationReference,
  normaliseDocumentContentTypes,
  normaliseDocumentDecision,
  normaliseDocumentMaxBytes,
  validDocumentChecksum,
} from './application-documents-policy';

test('application portal reference and email normalization are strict', () => {
  assert.equal(normaliseApplicationReference('app-0123456789abcdefabcd'), 'APP-0123456789ABCDEFABCD');
  assert.equal(normaliseApplicationReference('APP-123'), '');
  assert.equal(normaliseApplicationPortalEmail(' Applicant@Example.COM '), 'applicant@example.com');
  assert.equal(normaliseApplicationPortalEmail('not-an-email'), '');
});

test('document content types are allowlisted and deduplicated', () => {
  assert.deepEqual(normaliseDocumentContentTypes(['application/pdf', 'text/html', 'application/pdf']), ['application/pdf']);
  assert.deepEqual(normaliseDocumentContentTypes([]), [...APPLICATION_DOCUMENT_CONTENT_TYPES]);
});

test('document size policy defaults and hard caps', () => {
  assert.equal(normaliseDocumentMaxBytes('bad'), APPLICATION_DOCUMENT_DEFAULT_MAX_BYTES);
  assert.equal(normaliseDocumentMaxBytes(APPLICATION_DOCUMENT_HARD_MAX_BYTES * 2), APPLICATION_DOCUMENT_HARD_MAX_BYTES);
});

test('document cycle starts only from governed review states', () => {
  assert.equal(canStartApplicationDocumentCycle('UNDER_REVIEW'), true);
  assert.equal(canStartApplicationDocumentCycle('SHORTLISTED'), true);
  assert.equal(canStartApplicationDocumentCycle('SUBMITTED'), false);
  assert.equal(canStartApplicationDocumentCycle('DOCUMENTS_REQUESTED'), false);
});

test('applicant uploads only into requested or received document slots and before deadline', () => {
  assert.equal(canApplicantUploadDocument('REQUESTED'), true);
  assert.equal(canApplicantUploadDocument('RECEIVED'), true);
  assert.equal(canApplicantUploadDocument('ACCEPTED'), false);
  assert.equal(canApplicantUploadDocument('REJECTED'), false);
  assert.equal(applicationDocumentRequestExpired('2030-01-01T00:00:00.000Z', Date.parse('2029-01-01T00:00:00.000Z')), false);
  assert.equal(applicationDocumentRequestExpired('2028-01-01T00:00:00.000Z', Date.parse('2029-01-01T00:00:00.000Z')), true);
  assert.equal(applicationDocumentRequestExpired(null, Date.now()), false);
});

test('review decisions respect the document request state machine', () => {
  assert.equal(canReviewApplicationDocument('RECEIVED', 'ACCEPT'), true);
  assert.equal(canReviewApplicationDocument('RECEIVED', 'REJECT'), true);
  assert.equal(canReviewApplicationDocument('REJECTED', 'REREQUEST'), true);
  assert.equal(canReviewApplicationDocument('REQUESTED', 'REREQUEST'), true);
  assert.equal(canReviewApplicationDocument('REQUESTED', 'ACCEPT'), false);
  assert.equal(normaliseDocumentDecision('reRequest'), 'REREQUEST');
});

test('cycle completion requires all required documents accepted and no unreviewed received file', () => {
  assert.equal(canCompleteDocumentCycle([{ required: true, status: 'ACCEPTED' }, { required: false, status: 'REQUESTED' }]), true);
  assert.equal(canCompleteDocumentCycle([{ required: true, status: 'REJECTED' }]), false);
  assert.equal(canCompleteDocumentCycle([{ required: true, status: 'ACCEPTED' }, { required: false, status: 'RECEIVED' }]), false);
});

test('withdrawal, checksum and file-signature rules preserve canonical integrity', () => {
  assert.equal(canApplicantWithdrawApplication('SHORTLISTED'), true);
  assert.equal(canApplicantWithdrawApplication('DECLINED'), false);
  assert.equal(validDocumentChecksum('a'.repeat(64)), true);
  assert.equal(validDocumentChecksum('z'.repeat(64)), false);
  assert.equal(applicationDocumentSignatureMatches('application/pdf', new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])), true);
  assert.equal(applicationDocumentSignatureMatches('image/jpeg', new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), true);
  assert.equal(applicationDocumentSignatureMatches('image/png', new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), true);
  assert.equal(applicationDocumentSignatureMatches('application/pdf', new TextEncoder().encode('<html>')), false);
});
