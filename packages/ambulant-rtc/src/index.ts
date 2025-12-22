// packages/ambulant-rtc/src/index.ts
import { Room, type RoomConnectOptions } from 'livekit-client';

export async function connectRoom(url: string, token: string, opts?: RoomConnectOptions) {
  const room = new Room();
  await room.connect(url, token, opts);
  return room;
}

export type TelevisitRole = 'patient' | 'clinician' | 'staff' | 'observer' | 'admin';

export function getOrCreateUid(storageKey = 'ambulant_uid') {
  if (typeof window === 'undefined') return 'server-user';
  let v = localStorage.getItem(storageKey);
  if (!v) {
    v = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) + '-u';
    localStorage.setItem(storageKey, v);
  }
  return v;
}

/**
 * Join-ticket storage (JWT)
 * ✅ Prefer sessionStorage (clears on tab close)
 * ✅ Migrate from legacy localStorage keys if found
 */
function ssGet(key: string) {
  if (typeof window === 'undefined') return '';
  try {
    return window.sessionStorage.getItem(key) || '';
  } catch {
    return '';
  }
}
function ssSet(key: string, val: string) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(key, val);
  } catch {
    // ignore
  }
}
function ssRemove(key: string) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function lsGet(key: string) {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}
function lsRemove(key: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function joinKeys(visitId: string, roomId: string) {
  const v = String(visitId || '').trim();
  const r = String(roomId || '').trim();
  const keys = [
    v ? `televisit_join_${v}` : '',
    r ? `televisit_join_${r}` : '',
    v ? `ambulant_join_${v}` : '',
    r ? `ambulant_join_${r}` : '',
    v ? `ambulant_join_token_${v}` : '',
    r ? `ambulant_join_token_${r}` : '',
    'ambulant_join_token',
  ].filter(Boolean);
  return Array.from(new Set(keys));
}

export function storeTelevisitJoinJwt(args: { visitId: string; roomId: string; joinJwt: string }) {
  const jwt = String(args.joinJwt || '').trim();
  if (!jwt) return;

  const keys = joinKeys(args.visitId, args.roomId);
  for (const k of keys) ssSet(k, jwt);

  // Optional: scrub legacy localStorage copies (reduce persistence risk)
  for (const k of keys) lsRemove(k);
}

export function readTelevisitJoinJwt(args: { visitId: string; roomId: string }) {
  const keys = joinKeys(args.visitId, args.roomId);

  // sessionStorage first
  for (const k of keys) {
    const v = ssGet(k);
    if (v && v.trim()) return v.trim();
  }

  // migrate from localStorage if present (legacy)
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

export function clearTelevisitJoinJwt(args: { visitId: string; roomId: string }) {
  const keys = joinKeys(args.visitId, args.roomId);
  for (const k of keys) ssRemove(k);
  for (const k of keys) lsRemove(k);
}

async function postJson<T>(url: string, body: any, headers: Record<string, string>): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body ?? {}),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data || data.ok === false) {
    const msg = (data && (data.error || data.message)) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

export async function getTelevisitStatus(args: {
  roomId: string;
  visitId: string;
  uid: string;
  role: TelevisitRole;
}) {
  return postJson<{
    ok: true;
    nowISO: string;
    joinOpen: boolean;
    hasConsent: boolean;
    hasActiveTicket: boolean;
    activeTicket: { expiresAt: string } | null;
    visit: {
      id: string;
      roomId: string;
      status: string;
      joinOpensAt: string;
      joinClosesAt: string;
      scheduledStartAt: string;
      scheduledEndAt: string;
    };
  }>('/api/televisit/status', { roomId: args.roomId, visitId: args.visitId }, { 'x-uid': args.uid, 'x-role': args.role });
}

export async function logTelevisitConsent(args: {
  roomId: string;
  visitId: string;
  uid: string;
  role: TelevisitRole;
  consentVersion: string;
  scopes: any;
  locale?: string;
}) {
  return postJson<{ ok: true; consent: { id: string; acceptedAt: string; consentVersion: string } }>(
    '/api/televisit/consent',
    { roomId: args.roomId, visitId: args.visitId, consentVersion: args.consentVersion, scopes: args.scopes, locale: args.locale },
    { 'x-uid': args.uid, 'x-role': args.role },
  );
}

export async function issueTelevisitJoinTicket(args: {
  roomId: string;
  visitId: string;
  uid: string;
  role: TelevisitRole;
  force?: boolean;
}) {
  const out = await postJson<{ ok: true; joinToken: string; expiresAt: string }>(
    '/api/televisit/issue',
    { roomId: args.roomId, visitId: args.visitId, force: !!args.force },
    { 'x-uid': args.uid, 'x-role': args.role },
  );

  // Auto-store join JWT into sessionStorage (best UX)
  storeTelevisitJoinJwt({ visitId: args.visitId, roomId: args.roomId, joinJwt: out.joinToken });

  return out;
}

/**
 * Mint a LiveKit access token from APIGW via local /api/rtc/token proxy.
 * IMPORTANT: join JWT must be passed in header x-join-token.
 */
export async function mintRtcToken(args: {
  roomId: string;
  visitId: string;
  uid: string;
  role: TelevisitRole;
  joinToken?: string; // join-ticket JWT; if omitted we'll try sessionStorage
  identity?: string;
  name?: string;
}) {
  const joinJwt = String(args.joinToken || '').trim() || readTelevisitJoinJwt({ visitId: args.visitId, roomId: args.roomId });
  if (!joinJwt) throw new Error('Missing join ticket JWT (no sessionStorage value found)');

  return postJson<{
    ok: true;
    token: string;
    roomId: string;
    visitId?: string;
    identity: string;
    wsUrl?: string;
    ticketExpiresAt?: string;
  }>(
    '/api/rtc/token',
    {
      roomId: args.roomId,
      visitId: args.visitId,
      identity: args.identity || args.uid,
      name: args.name,
    },
    { 'x-uid': args.uid, 'x-role': args.role, 'x-join-token': joinJwt },
  );
}
