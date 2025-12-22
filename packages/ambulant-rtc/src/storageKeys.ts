// packages/ambulant-rtc/src/storageKeys.ts
export type TelevisitRole = 'patient' | 'clinician' | 'staff' | 'observer' | 'admin';

/** Single place to manage all browser storage key conventions (sessionStorage / localStorage) */
export const STORAGE_KEYS = {
  /** Stable per-browser user id (base uid, not role-scoped) */
  UID: 'ambulant_uid',

  /** Optional legacy fallback key some older builds used */
  LEGACY_JOIN_TOKEN: 'ambulant_join_token',
} as const;

/** Safe sessionStorage get */
export function ssGet(key: string): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.sessionStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

/** Safe sessionStorage set */
export function ssSet(key: string, value: string) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // ignore quota / privacy mode
  }
}

/** Safe sessionStorage remove */
export function ssRemove(key: string) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/** Safe localStorage get */
export function lsGet(key: string): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

/** Safe localStorage remove */
export function lsRemove(key: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function cleanId(x?: string) {
  return String(x || '').trim();
}

/**
 * Canonical join-token keys.
 * We include both visitId + roomId variants because older routes sometimes used roomId.
 * We also include role-scoped keys to avoid collisions when multiple roles share a browser/device.
 */
export function joinTokenKeys(params: {
  visitId?: string;
  roomId?: string;
  role?: TelevisitRole;
}) {
  const v = cleanId(params.visitId);
  const r = cleanId(params.roomId);
  const role = cleanId(params.role);

  const keys = [
    // ✅ NEW canonical (role-scoped)
    role && v ? `televisit_join_${role}_${v}` : '',
    role && r ? `televisit_join_${role}_${r}` : '',

    // ✅ Back-compat (unscoped)
    v ? `televisit_join_${v}` : '',
    r ? `televisit_join_${r}` : '',

    // ✅ Older app variants you already have in the repo
    v ? `ambulant_join_${v}` : '',
    r ? `ambulant_join_${r}` : '',
    v ? `ambulant_join_token_${v}` : '',
    r ? `ambulant_join_token_${r}` : '',

    // ✅ Old global key
    STORAGE_KEYS.LEGACY_JOIN_TOKEN,
  ].filter(Boolean);

  // Deduplicate while preserving order
  return Array.from(new Set(keys));
}

/**
 * Store join JWT in sessionStorage (and scrub any legacy localStorage copies).
 * Call this whenever you see ?jt= / ?joinToken= in the URL.
 */
export function storeJoinToken(args: {
  visitId?: string;
  roomId?: string;
  role?: TelevisitRole;
  token: string;
}) {
  if (typeof window === 'undefined') return;
  const t = cleanId(args.token);
  if (!t) return;

  const keys = joinTokenKeys(args);
  for (const k of keys) ssSet(k, t);
  // Scrub legacy localStorage copies if any
  for (const k of keys) lsRemove(k);
}

/**
 * Read join JWT from sessionStorage first, then migrate from localStorage if present.
 */
export function readJoinToken(args: {
  visitId?: string;
  roomId?: string;
  role?: TelevisitRole;
}) {
  if (typeof window === 'undefined') return '';
  const keys = joinTokenKeys(args);

  for (const k of keys) {
    const v = ssGet(k);
    if (v && v.trim()) return v.trim();
  }

  // Migrate from localStorage if present
  for (const k of keys) {
    const v = lsGet(k);
    if (v && v.trim()) {
      const jwt = v.trim();
      for (const kk of keys) ssSet(kk, jwt);
      for (const kk of keys) lsRemove(kk);
      return jwt;
    }
  }

  return '';
}

/**
 * Canonical identity: always role-scoped to prevent collisions in LiveKit.
 * Example: "patient:abcd-uid" vs "clinician:abcd-uid"
 */
export function roleIdentity(uid: string, role: TelevisitRole) {
  const u = cleanId(uid) || 'anon';
  const r = (cleanId(role) as TelevisitRole) || 'observer';
  return `${r}:${u}`;
}
