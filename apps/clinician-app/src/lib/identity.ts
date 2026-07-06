import { NextRequest } from 'next/server';

function clean(value: string | null | undefined) {
  return String(value || '').trim();
}

export function readIdentity(input?: NextRequest | Request | Headers | null) {
  const headers = input instanceof Headers ? input : input?.headers;

  return {
    uid:
      clean(headers?.get('x-uid')) ||
      clean(headers?.get('x-user-id')) ||
      clean(headers?.get('x-ambulant-user-id')),
    role:
      clean(headers?.get('x-role')) ||
      clean(headers?.get('x-ambulant-role')) ||
      'clinician',
    orgId:
      clean(headers?.get('x-org-id')) ||
      clean(headers?.get('x-ambulant-org-id')) ||
      clean(headers?.get('x-org')),
  };
}
