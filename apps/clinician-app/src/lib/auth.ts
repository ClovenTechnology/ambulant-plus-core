import { NextRequest } from 'next/server';

export type AuthorizedActor = {
  ok: boolean;
  uid: string;
  role: string;
  orgId?: string | null;
};

export function authorizeAdminFromHeaders(input: NextRequest | Request | Headers): AuthorizedActor {
  const headers = input instanceof Headers ? input : input.headers;

  const uid =
    headers.get('x-uid') ||
    headers.get('x-user-id') ||
    headers.get('x-admin-id') ||
    'admin-local';

  const role =
    headers.get('x-role') ||
    headers.get('x-actor-role') ||
    'admin';

  const orgId = headers.get('x-org-id') || headers.get('x-org') || null;

  return {
    ok: role === 'admin' || role === 'owner' || role === 'ops',
    uid,
    role,
    orgId,
  };
}
