import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canTransitionStaffLifecycle,
  effectivePresence,
  hasStaffCapability,
} from './admin-staff-policy';

test('staff directory keeps legacy HR and role-management visibility without conflating HR authority', () => {
  assert.equal(hasStaffCapability({ scopes: ['hr'] }, 'staff.directory.read'), true);
  assert.equal(hasStaffCapability({ scopes: ['manageRoles'] }, 'staff.directory.read'), true);
  assert.equal(hasStaffCapability({ scopes: ['manageRoles'] }, 'staff.manage'), false);
  assert.equal(hasStaffCapability({ scopes: ['manageRoles'] }, 'staff.hr.manage'), false);
  assert.equal(hasStaffCapability({ scopes: ['hr'] }, 'staff.hr.manage'), true);
});

test('HR authority does not implicitly grant compensation, payroll, banking, or credential access', () => {
  const hr = { scopes: ['hr'] };
  assert.equal(hasStaffCapability(hr, 'staff.compensation.read'), false);
  assert.equal(hasStaffCapability(hr, 'staff.compensation.manage'), false);
  assert.equal(hasStaffCapability(hr, 'staff.payroll.read'), false);
  assert.equal(hasStaffCapability(hr, 'staff.bank.manage'), false);
  assert.equal(hasStaffCapability(hr, 'staff.credentials.manage'), false);
  assert.equal(hasStaffCapability(hr, 'staff.documents.manage'), true);
  assert.equal(hasStaffCapability(hr, 'staff.leave.manage'), true);
  assert.equal(hasStaffCapability(hr, 'staff.employment-change.manage'), true);
});


test('fine-grained Staff authorities remain independently assignable', () => {
  assert.equal(
    hasStaffCapability({ scopes: ['staff.hr.manage'] }, 'staff.hr.manage'),
    true,
  );
  assert.equal(
    hasStaffCapability({ scopes: ['staff.hr.manage'] }, 'staff.compensation.read'),
    false,
  );
  assert.equal(
    hasStaffCapability({ scopes: ['staff.compensation.manage'] }, 'staff.compensation.read'),
    false,
  );
  assert.equal(
    hasStaffCapability({ scopes: ['staff.compensation.manage'] }, 'staff.compensation.manage'),
    true,
  );
  assert.equal(
    hasStaffCapability({ scopes: ['staff.payroll.manage'] }, 'staff.payroll.manage'),
    true,
  );
  assert.equal(
    hasStaffCapability({ scopes: ['staff.bank.manage'] }, 'staff.bank.manage'),
    true,
  );
  assert.equal(
    hasStaffCapability({ scopes: ['staff.credentials.manage'] }, 'staff.credentials.manage'),
    true,
  );
  assert.equal(
    hasStaffCapability({ scopes: ['staff.hr.read'] }, 'staff.directory.read'),
    true,
  );
  assert.equal(
    hasStaffCapability({ scopes: ['staff.hr.manage'] }, 'staff.hr.read'),
    true,
  );
  assert.equal(
    hasStaffCapability({ scopes: ['staff.roles.manage'] }, 'staff.directory.read'),
    true,
  );
  assert.equal(
    hasStaffCapability({ scopes: ['staff.compensation.manage'] }, 'staff.compensation.read'),
    true,
  );
  assert.equal(
    hasStaffCapability({ scopes: ['staff.payroll.manage'] }, 'staff.payroll.read'),
    true,
  );
  assert.equal(
    hasStaffCapability({ scopes: ['staff.bank.manage'] }, 'staff.bank.read'),
    true,
  );
  assert.equal(
    hasStaffCapability({ scopes: ['staff.documents.manage'] }, 'staff.documents.read'),
    true,
  );
  assert.equal(
    hasStaffCapability({ scopes: ['staff.leave.manage'] }, 'staff.leave.read'),
    true,
  );
  assert.equal(
    hasStaffCapability(
      { scopes: ['staff.employment-change.manage'] },
      'staff.employment-change.read',
    ),
    true,
  );
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
