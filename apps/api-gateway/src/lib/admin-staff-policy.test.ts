import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canTransitionStaffLifecycle,
  effectivePresence,
  hasStaffCapability,
} from './admin-staff-policy';

test('staff directory keeps legacy HR and manageRoles access', () => {
  assert.equal(hasStaffCapability({ scopes: ['hr'] }, 'staff.directory.read'), true);
  assert.equal(hasStaffCapability({ scopes: ['manageRoles'] }, 'staff.manage'), true);
});

test('new communication capabilities are not implied by HR', () => {
  assert.equal(hasStaffCapability({ scopes: ['hr'] }, 'communications.use'), false);
  assert.equal(hasStaffCapability({ scopes: ['communications.use'] }, 'communications.use'), true);
});

test('super admin override remains authoritative', () => {
  assert.equal(hasStaffCapability({ scopes: ['admin:all'] }, 'meetings.record'), true);
});

test('staff lifecycle state machine rejects invalid jumps', () => {
  assert.equal(canTransitionStaffLifecycle('ACTIVE', 'SUSPENDED'), true);
  assert.equal(canTransitionStaffLifecycle('SUSPENDED', 'LEAVE'), false);
  assert.equal(canTransitionStaffLifecycle('ARCHIVED', 'ACTIVE'), true);
});

test('expired presence becomes offline', () => {
  const now = new Date('2026-08-08T12:00:00.000Z');
  assert.equal(effectivePresence({ state: 'AVAILABLE', expiresAt: '2026-08-08T11:59:59.000Z' }, now), 'OFFLINE');
  assert.equal(effectivePresence({ state: 'BUSY', expiresAt: '2026-08-08T12:01:00.000Z' }, now), 'BUSY');
});
