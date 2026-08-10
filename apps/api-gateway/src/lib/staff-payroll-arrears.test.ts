import assert from 'node:assert/strict';
import test from 'node:test';

import {
  automaticSalaryArrearsId,
  payablePayslip,
} from '@/lib/staff-payroll-arrears';

test('automatic salary arrears IDs are deterministic and scoped to the payslip', () => {
  assert.equal(
    automaticSalaryArrearsId('payslip_123'),
    'salary-arrear:payslip:payslip_123',
  );
});

test('only approved, issued or explicitly payable payslips become salary liabilities', () => {
  const date = new Date('2026-08-10T12:00:00.000Z');

  assert.equal(
    payablePayslip({ status: 'draft', approvedAt: date, issuedAt: null }),
    false,
  );
  assert.equal(
    payablePayslip({ status: 'cancelled', approvedAt: date, issuedAt: date }),
    false,
  );
  assert.equal(
    payablePayslip({ status: 'approved', approvedAt: null, issuedAt: null }),
    true,
  );
  assert.equal(
    payablePayslip({ status: 'custom_status', approvedAt: date, issuedAt: null }),
    true,
  );
  assert.equal(
    payablePayslip({ status: 'custom_status', approvedAt: null, issuedAt: null }),
    false,
  );
});
