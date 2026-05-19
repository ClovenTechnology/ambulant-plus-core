// FILE: apps/api-gateway/src/lib/identity.ts
export type WhoRole =
  | 'patient'
  | 'clinician'
  | 'admin'
  | 'admin_staff'
  | 'clinician_staff_medical'
  | 'clinician_staff_non_medical'
  | 'pharmacy'
  | 'pharmacy_staff'
  | 'rider'
  | 'phleb'
  | 'lab'
  | 'anonymous';

export type Who = {
  role: WhoRole;
  uid: string | null;
  orgId?: string | null;
};

function headerGet(
  h: Headers | Record<string, string | null | undefined>,
  key: string,
): string | null {
  if (h instanceof Headers) return h.get(key);
  const direct = h?.[key];
  if (typeof direct === 'string') return direct;
  const lower = h?.[key.toLowerCase()];
  return typeof lower === 'string' ? lower : null;
}

export function readIdentity(h: Headers | Record<string, string | null | undefined>): Who {
  const rawRole = String(headerGet(h, 'x-role') || '').trim().toLowerCase();
  const uid = String(headerGet(h, 'x-uid') || '').trim() || null;
  const orgId = String(headerGet(h, 'x-org-id') || '').trim() || null;

  const role: WhoRole =
    rawRole === 'patient' ? 'patient'
    : rawRole === 'clinician' ? 'clinician'
    : rawRole === 'admin' ? 'admin'
    : rawRole === 'admin_staff' || rawRole === 'staff' || rawRole === 'support' ? 'admin_staff'
    : rawRole === 'clinician_staff_medical' ? 'clinician_staff_medical'
    : rawRole === 'clinician_staff_non_medical' ? 'clinician_staff_non_medical'
    : rawRole === 'pharmacy' ? 'pharmacy'
    : rawRole === 'pharmacy_staff' ? 'pharmacy_staff'
    : rawRole === 'rider' ? 'rider'
    : rawRole === 'phleb' ? 'phleb'
    : rawRole === 'lab' ? 'lab'
    : 'anonymous';

  return { role, uid, orgId };
}

export function hasTrustedAuthCarrier(
  h: Headers | Record<string, string | null | undefined>,
): boolean {
  const cookie = String(headerGet(h, 'cookie') || '').trim();
  const authorization = String(headerGet(h, 'authorization') || '').trim();
  const ambulantIdentity = String(headerGet(h, 'x-ambulant-identity') || '').trim();

  return Boolean(cookie || authorization || ambulantIdentity);
}

export function isAuthenticatedWho(who: Who): boolean {
  return Boolean(who.uid && who.role !== 'anonymous');
}

export function requireTrustedIdentityInProduction(
  h: Headers | Record<string, string | null | undefined>,
  who: Who,
) {
  if (process.env.NODE_ENV !== 'production') return;

  const trusted = hasTrustedAuthCarrier(h);
  const authenticated = isAuthenticatedWho(who);

  if (!trusted || !authenticated) {
    throw new Error('Unauthorized');
  }
}