// apps/patient-app/src/lib/config.ts

// Base URL for clinician app (used elsewhere in patient app for CLIN links)
export const CLIN = (
  process.env.NEXT_PUBLIC_CLINICIAN_BASE_URL ||
  (process as any).env?.CLIN ||
  'http://localhost:3001'
).replace(/\/$/, '');

// Canonical API base for api-gateway calls
export const API = (
  process.env.NEXT_PUBLIC_APIGW_BASE || // 👈 matches .env.local
  (process as any).env?.APIGW_BASE ||
  process.env.NEXT_PUBLIC_GATEWAY_BASE || // fallback if you used that
  (process as any).env?.CLIN ||           // last-ditch fallback
  'http://localhost:3010'
).replace(/\/$/, '');

// Patient app's own base (optional, rarely used directly)
export const BASE = (
  process.env.NEXT_PUBLIC_BASE_URL ||
  'http://localhost:3000'
).replace(/\/$/, '');
