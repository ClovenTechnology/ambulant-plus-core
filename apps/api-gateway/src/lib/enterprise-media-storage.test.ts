import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ENTERPRISE_MEDIA_MAX_IMAGE_BYTES,
  enterpriseMediaObjectBelongsTo,
  enterpriseMediaSignatureMatches,
  isEnterpriseMediaImageType,
  isManagedEnterpriseMediaRef,
  managedEnterpriseMediaKind,
  managedEnterpriseMediaRef,
  objectKeyFromManagedEnterpriseMediaRef,
  validEnterpriseMediaChecksum,
  validEnterpriseMediaSize,
  validateEnterpriseMediaUploadInput,
} from './enterprise-media-storage';

test('enterprise media accepts only bounded JPEG PNG and WebP uploads', () => {
  assert.equal(isEnterpriseMediaImageType('image/jpeg'), true);
  assert.equal(isEnterpriseMediaImageType('image/png'), true);
  assert.equal(isEnterpriseMediaImageType('image/webp'), true);
  assert.equal(isEnterpriseMediaImageType('image/svg+xml'), false);
  assert.equal(validEnterpriseMediaSize(1), true);
  assert.equal(validEnterpriseMediaSize(ENTERPRISE_MEDIA_MAX_IMAGE_BYTES), true);
  assert.equal(validEnterpriseMediaSize(ENTERPRISE_MEDIA_MAX_IMAGE_BYTES + 1), false);
  assert.equal(validEnterpriseMediaChecksum('a'.repeat(64)), true);
  assert.equal(validEnterpriseMediaChecksum('not-a-checksum'), false);
});

test('enterprise media managed references preserve media kind and object ownership', () => {
  const key = 'enterprise-media/opportunity-image/opportunity_1/asset_1';
  const ref = managedEnterpriseMediaRef(key);
  assert.equal(isManagedEnterpriseMediaRef(ref), true);
  assert.equal(objectKeyFromManagedEnterpriseMediaRef(ref), key);
  assert.equal(managedEnterpriseMediaKind(ref), 'opportunity-image');
  assert.equal(enterpriseMediaObjectBelongsTo({ objectKey: key, kind: 'opportunity-image', ownerId: 'opportunity_1' }), true);
  assert.equal(enterpriseMediaObjectBelongsTo({ objectKey: key, kind: 'opportunity-image', ownerId: 'opportunity_2' }), false);

  const staffIdKey = 'enterprise-media/staff-id-template/template_1/asset_1';
  const staffIdRef = managedEnterpriseMediaRef(staffIdKey);
  assert.equal(managedEnterpriseMediaKind(staffIdRef), 'staff-id-template');
  assert.equal(enterpriseMediaObjectBelongsTo({ objectKey: staffIdKey, kind: 'staff-id-template', ownerId: 'template_1' }), true);
});

test('enterprise media validates file signatures for allowed image types', () => {
  assert.equal(enterpriseMediaSignatureMatches('image/jpeg', new Uint8Array([0xff, 0xd8, 0xff, 0x00])), true);
  assert.equal(enterpriseMediaSignatureMatches('image/jpeg', new Uint8Array([0xff, 0xd8, 0x00])), false);
  assert.equal(enterpriseMediaSignatureMatches('image/png', new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), true);
  assert.equal(enterpriseMediaSignatureMatches('image/webp', new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80])), true);
});

test('enterprise media upload input normalises valid metadata and rejects invalid metadata', () => {
  assert.deepEqual(
    validateEnterpriseMediaUploadInput({ contentType: 'IMAGE/PNG', sizeBytes: 1024, checksumSha256: 'A'.repeat(64) }),
    { contentType: 'image/png', sizeBytes: 1024, checksumSha256: 'a'.repeat(64) },
  );
  assert.throws(() => validateEnterpriseMediaUploadInput({ contentType: 'image/svg+xml', sizeBytes: 1024, checksumSha256: 'a'.repeat(64) }));
  assert.throws(() => validateEnterpriseMediaUploadInput({ contentType: 'image/png', sizeBytes: 0, checksumSha256: 'a'.repeat(64) }));
});
