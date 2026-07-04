// apps/patient-app/src/lib/config.ts

function isProductionRuntime() {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
}

// Base URL for clinician app links.
export const CLIN = (
  process.env.NEXT_PUBLIC_CLINICIAN_BASE_URL ||
  process.env.NEXT_PUBLIC_CLINICIAN_APP_URL ||
  (process as any).env?.CLIN ||
  (isProductionRuntime() ? 'https://clinician.ambulantplus.co.za' : 'http://localhost:3001')
).replace(/\/$/, '');

// Canonical API base for api-gateway calls.
export const API = (
  process.env.NEXT_PUBLIC_APIGW_BASE ||
  process.env.NEXT_PUBLIC_API_GATEWAY_BASE_URL ||
  process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
  process.env.NEXT_PUBLIC_GATEWAY_BASE ||
  (process as any).env?.APIGW_BASE ||
  (isProductionRuntime() ? 'https://api-gateway.ambulantplus.co.za' : 'http://localhost:3010')
).replace(/\/$/, '');

// Patient app's own base.
export const BASE = (
  process.env.NEXT_PUBLIC_PATIENT_BASE_URL ||
  process.env.NEXT_PUBLIC_PATIENT_APP_URL ||
  process.env.NEXT_PUBLIC_BASE_URL ||
  (isProductionRuntime() ? 'https://patient.ambulantplus.co.za' : 'http://localhost:3000')
).replace(/\/$/, '');
