import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeCarePortPharmacyCompliance } from '../../apps/api-gateway/src/lib/careport-pharmacy-compliance';

test('partner login readiness does not replace regulated pharmacy fulfilment evidence', () => {
  const summary=summarizeCarePortPharmacyCompliance({active:true,kycStatus:'APPROVED',kycVerifiedAt:new Date()});
  assert.equal(summary.readyForRegulatedFulfilment,false);
});
test('expired premises and pharmacist evidence continue to block regulated fulfilment', () => {
  const summary=summarizeCarePortPharmacyCompliance({complianceProfile:{premises:{yNumber:'Y-test',premisesLicenceNumber:'L-test',licenceExpiresAt:'2000-01-01'},responsiblePharmacist:{pNumber:'P-test',registrationExpiresAt:'2000-01-01'}}});
  assert.equal(summary.readyForRegulatedFulfilment,false);
});
