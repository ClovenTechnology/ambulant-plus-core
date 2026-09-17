import { CLINICIAN_SESSION_COOKIE, verifyClinicianSessionToken } from '@/src/lib/clinician-session';

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

export function readIdentity(input?: Request | Headers | null) {
  const headers = input instanceof Headers ? input : input?.headers;
  if (!headers) return { uid: '', role: '', orgId: '' };
  const session = verifyClinicianSessionToken(cookieValue(headers, CLINICIAN_SESSION_COOKIE));
  if (!session) return { uid: '', role: '', orgId: '' };
  return { uid: session.clinicianId || session.sub, role: session.role, orgId: typeof session.orgId === 'string' ? session.orgId : '' };
}
