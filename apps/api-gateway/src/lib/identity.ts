export type Who = { role: 'patient' | 'clinician' | 'admin' | 'anonymous'; uid?: string | null };

export function readIdentity(h: Headers | Record<string,string | null | undefined>): Who {
  const get = (k: string) =>
    (h instanceof Headers ? h.get(k) : (h?.[k.toLowerCase()] as string | null | undefined)) ?? null;

  const role = (get('x-role') || get('X-Role') || '').toLowerCase() as Who['role'];
  const uid  = get('x-uid') || get('X-Uid');

  if (role === 'patient' || role === 'clinician' || role === 'admin') return { role, uid };
  return { role: 'anonymous', uid: null };
}
