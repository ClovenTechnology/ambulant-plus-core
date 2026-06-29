import { cookies, headers } from 'next/headers';

function cleanId(value: string | null | undefined): string | null {
  const s = String(value ?? '').trim();
  return s.length ? s : null;
}

export async function getUserId(): Promise<string | null> {
  // Primary future path: replace this with the platform session helper once all
  // patient routes share the same signed session identity reader.
  const h = headers();

  const headerUid =
    cleanId(h.get('x-user-id')) ||
    cleanId(h.get('x-uid')) ||
    cleanId(h.get('x-patient-id')) ||
    cleanId(h.get('x-actor-ref-id'));

  if (headerUid) return headerUid;

  const jar = cookies();
  const cookieUid =
    cleanId(jar.get('uid')?.value) ||
    cleanId(jar.get('ambulant_uid')?.value) ||
    cleanId(jar.get('ambulant.uid')?.value);

  return cookieUid;
}
