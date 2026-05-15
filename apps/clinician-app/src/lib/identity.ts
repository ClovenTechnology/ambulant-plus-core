import { NextRequest } from 'next/server';

export function readIdentity(input?: NextRequest | Request | Headers | null) {
  const headers = input instanceof Headers ? input : input?.headers;

  return {
    uid: headers?.get('x-uid') || headers?.get('x-user-id') || 'clinician-local',
    role: headers?.get('x-role') || 'clinician',
    orgId: headers?.get('x-org-id') || 'org-default',
  };
}
