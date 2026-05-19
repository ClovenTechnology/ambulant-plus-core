// apps/patient-app/src/lib/notify.ts

export type NotifyResult = {
  ok: boolean;
  error?: string;
  successCount?: number;
  failureCount?: number;
};

/**
 * Production-safe notification shim.
 *
 * Firebase Admin is not installed/configured in patient-app. Do not import
 * firebase-admin here and do not use demo tokens. When push notifications are
 * production-ready, route this through api-gateway or add a real provider module
 * with proper server-side credentials.
 */
export async function notifyClinicianFCM(
  _tokens: string[],
  _title: string,
  _body: string,
  _data: Record<string, string> = {},
): Promise<NotifyResult> {
  return {
    ok: false,
    error: 'push_notifications_not_configured',
    successCount: 0,
    failureCount: 0,
  };
}