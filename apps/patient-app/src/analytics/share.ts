// ============================================================================
// apps/patient-app/src/analytics/share.ts
// ++ role-based tokens (partner/provider) with masked fields.
// ============================================================================
export type ShareRole = 'partner' | 'provider';
export type AntenatalSharePayload = {
  edd: string;
  role: ShareRole;
  name?: string;
  v?: number;
};

function toBase64Url(s: string) {
  if (typeof window !== 'undefined' && window.btoa) {
    return window.btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }
  // @ts-ignore
  return Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function fromBase64Url(s: string) {
  const pad = s + '==='.slice((s.length + 3) % 4);
  const norm = pad.replace(/-/g, '+').replace(/_/g, '/');
  if (typeof window !== 'undefined' && window.atob) return window.atob(norm);
  // @ts-ignore
  return Buffer.from(norm, 'base64').toString('utf8');
}

export function encodeAntenatalShareToken(data: Omit<AntenatalSharePayload,'v'>): string {
  return toBase64Url(JSON.stringify({ ...data, v: 2 }));
}
export function decodeAntenatalShareToken(token: string): AntenatalSharePayload | null {
  try {
    const obj = JSON.parse(fromBase64Url(token));
    if (!obj?.edd || !obj?.role) return null;
    return obj;
  } catch { return null; }
}
