// apps/api-gateway/src/lib/auth.ts
export type Identity = { uid?: string; role?: 'patient'|'clinician'|'admin' };
export function readIdentity(headers: Headers): Identity {
  const uid = headers.get('x-uid') || undefined;
  const role = headers.get('x-role') as Identity['role'] || undefined;
  return { uid, role };
}
// TODO: add HMAC/JWT verification here
