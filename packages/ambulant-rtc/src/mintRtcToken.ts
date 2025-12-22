// packages/ambulant-rtc/src/mintRtcToken.ts
export type TelevisitRole = 'patient' | 'clinician' | 'staff' | 'observer' | 'admin';

export type MintRtcArgs = {
  baseUrl: string; // NEXT_PUBLIC_APIGW_BASE in browser
  uid: string;
  role: TelevisitRole;
  joinToken?: string; // JWT join-ticket; optional (will try sessionStorage)
  roomId: string;
  visitId: string;
  identity?: string;
  name?: string;
};

function trimSlash(s: string) {
  return String(s || '').replace(/\/+$/, '');
}

function ssGet(key: string) {
  if (typeof window === 'undefined') return '';
  try {
    return window.sessionStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function joinKeys(visitId: string, roomId: string) {
  const v = String(visitId || '').trim();
  const r = String(roomId || '').trim();
  return [
    v ? `televisit_join_${v}` : '',
    r ? `televisit_join_${r}` : '',
    v ? `ambulant_join_${v}` : '',
    r ? `ambulant_join_${r}` : '',
    v ? `ambulant_join_token_${v}` : '',
    r ? `ambulant_join_token_${r}` : '',
    'ambulant_join_token',
  ].filter(Boolean);
}

function readJoinJwtFromSession(visitId: string, roomId: string) {
  for (const k of joinKeys(visitId, roomId)) {
    const v = ssGet(k);
    if (v && v.trim()) return v.trim();
  }
  return '';
}

export async function mintRtcToken(args: MintRtcArgs) {
  const base = trimSlash(args.baseUrl || '');
  if (!base) throw new Error('Missing baseUrl for APIGW');

  const joinJwt = String(args.joinToken || '').trim() || readJoinJwtFromSession(args.visitId, args.roomId);
  if (!joinJwt) throw new Error('Missing joinToken (and none found in sessionStorage)');

  const res = await fetch(`${base}/api/rtc/token`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-uid': args.uid,
      'x-role': args.role,
      'x-join-token': joinJwt,
    },
    body: JSON.stringify({
      roomId: args.roomId,
      visitId: args.visitId,
      identity: args.identity || args.uid,
      name: args.name,
    }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) throw new Error(data?.error || data?.message || 'RTC token mint failed');
  return data as { ok: true; token: string; roomId: string; visitId: string; identity: string; expiresIn?: number; wsUrl?: string };
}
