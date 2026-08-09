import assert from 'node:assert/strict';
import test from 'node:test';
import {
  accessTokenFromFragment,
  canUploadForRequest,
  canWithdrawFromPortal,
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
