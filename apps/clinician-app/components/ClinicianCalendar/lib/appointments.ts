// lib/appointments.ts
/**
 * Stub helpers for optimistic UI and server patching
 */

export function createOptimisticAppointment(appt: any) {
  return { ...appt, id: 'tmp-' + Date.now(), optimistic: true };
}

export function rollbackOptimisticAppointment(appt: any) {
  // In production, remove from local state
  return null;
}

export function applyServerPatch(local: any, server: any) {
  // Only overwrite if server is newer or local was optimistic
  return { ...local, ...server, optimistic: false };
}
