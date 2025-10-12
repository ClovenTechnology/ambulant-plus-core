// apps/patient-app/src/lib/active-enc.ts
// Tiny utility to persist a single "active encounter id" in localStorage (client-only).

const KEY = 'ambulant.activeEncounterId';

export function getActiveEncounterId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(KEY);
    return v && v.trim() ? v : null;
  } catch {
    return null;
  }
}

export function setActiveEncounterId(id: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (id) window.localStorage.setItem(KEY, id);
    else window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
