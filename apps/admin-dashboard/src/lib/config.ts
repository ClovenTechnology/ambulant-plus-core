// apps/admin-dashboard/src/lib/config.ts
// Centralized env reads for browser-safe URLs.
// Only NEXT_PUBLIC_* values are safe to use in client components.

export const PATIENT  = process.env.NEXT_PUBLIC_PATIENT_BASE_URL   || 'http://localhost:3000';
export const CLIN     = process.env.NEXT_PUBLIC_CLINICIAN_BASE_URL || 'http://localhost:3001';
export const ADMIN    = process.env.NEXT_PUBLIC_ADMIN_BASE_URL     || 'http://localhost:3002';
export const CAREPORT = process.env.NEXT_PUBLIC_CAREPORT_BASE_URL  || 'http://localhost:3003';
export const MEDREACH = process.env.NEXT_PUBLIC_MEDREACH_BASE_URL  || 'http://localhost:3004';

// Gateway (all admin auth/org APIs)
export const APIGW    = process.env.NEXT_PUBLIC_APIGW_BASE         || 'http://localhost:3010';

/**
 * Server-only configuration (do NOT import into client components).
 * These are read at runtime on the server ONLY.
 */
export const serverConfig = {
  // Auth0 (optional — used only if you wire SSO back in)
  AUTH0_DOMAIN:   process.env.AUTH0_DOMAIN   || process.env.NEXT_PUBLIC_AUTH0_DOMAIN || '',
  AUTH0_AUDIENCE: process.env.AUTH0_AUDIENCE || '',
  AUTH0_CLIENT_ID:     process.env.AUTH0_CLIENT_ID     || '',
  AUTH0_CLIENT_SECRET: process.env.AUTH0_CLIENT_SECRET || '',

  // Messaging providers (optional)
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
  TWILIO_AUTH_TOKEN:  process.env.TWILIO_AUTH_TOKEN  || '',
  TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER || '',

  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY || '',
  SENDGRID_FROM:    process.env.SENDGRID_FROM    || '',

  // Direct server-to-gateway base (useful for Route Handlers / server actions)
  APIGW_BASE: process.env.APIGW_BASE || 'http://localhost:3010',
} as const;
