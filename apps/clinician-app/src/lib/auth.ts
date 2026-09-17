import { CLINICIAN_SESSION_COOKIE, verifyClinicianSessionToken } from '@/src/lib/clinician-session';

export type AuthorizedActor = { ok: boolean; uid: string; role: string; orgId?: string | null };

function cookieValue(headers: Headers, name: string) {
  const cookie = String(headers.get('cookie') || '');
  for (const part of cookie.split(';')) {
    const index = part.indexOf('=');
    if (index < 0 || part.slice(0, index).trim() !== name) continue;
    const raw = part.slice(index + 1).trim();
    try { return decodeURIComponent(raw); } catch { return raw; }
  }
  return '';
}

export function authorizeAdminFromHeaders(input: Request | Headers): AuthorizedActor {
  const headers = input instanceof Headers ? input : input.headers;
  const session = verifyClinicianSessionToken(cookieValue(headers, CLINICIAN_SESSION_COOKIE));
  if (!session || !['admin', 'admin_staff'].includes(session.role)) {
    return { ok: false, uid: '', role: '', orgId: null };
  }
  return { ok: true, uid: session.sub, role: session.role, orgId: typeof session.orgId === 'string' ? session.orgId : null };
}
