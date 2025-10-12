// 9) PATH: tests/e2e/booking.spec.ts  (NEW)
// Notes: first test hits UI for policy/checkbox; conflict tests call API directly.
// ============================================================================
import { test, expect, request } from '@playwright/test';

test('refund policy modal gates submit', async ({ page }) => {
  await page.goto('/appointments/new');
  const submit = page.getByRole('button', { name: /Create Appointment/i });
  await expect(submit).toBeDisabled();
  await page.getByRole('button', { name: /refund policy/i }).click();
  await page.getByRole('button', { name: /^OK$/ }).click();
  await page.getByRole('checkbox').check();
  await expect(submit).toBeEnabled();
});

test('booking success then 409 on overlap (API-level)', async ({}) => {
  const api = await request.newContext();
  const base = 'http://localhost:3010';
  const t0 = new Date(Date.now() + 10 * 60 * 1000);
  const t1 = new Date(t0.getTime() + 30 * 60 * 1000);
  const slot = { startsAt: t0.toISOString(), endsAt: t1.toISOString() };
  const body = {
    encounterId: 'enc-a', sessionId: 'sess-a', caseId: 'case-a',
    clinicianId: 'clin-za-001', patientId: 'pt-za-001',
    ...slot, priceCents: 10000, currency: 'ZAR',
    platformFeeCents: 500, clinicianTakeCents: 9500, paymentProvider: 'manual',
  };

  const ok = await api.post(`${base}/api/appointments`, { data: body });
  expect(ok.status()).toBe(201);

  // Same patient tries to book another clinician on same time -> 409 (patient_conflict)
  const patConflict = await api.post(`${base}/api/appointments`, { data: { ...body, clinicianId: 'clin-za-002' } });
  expect(patConflict.status()).toBe(409);
  const pj = await patConflict.json();
  expect(pj.error).toBe('conflict_patient');

  // Another patient tries to book same clinician same slot -> 409 (clinician_conflict)
  const clinConflict = await api.post(`${base}/api/appointments`, { data: { ...body, patientId: 'pt-za-002' } });
  expect(clinConflict.status()).toBe(409);
  const cj = await clinConflict.json();
  expect(cj.error).toBe('conflict_clinician');
});