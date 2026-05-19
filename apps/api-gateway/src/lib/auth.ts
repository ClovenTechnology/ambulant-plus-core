// apps/api-gateway/src/lib/auth.ts
import {
  readIdentity as readGatewayIdentity,
  requireTrustedIdentityInProduction,
  type WhoRole,
} from '@/src/lib/identity';

export type Identity = {
  uid?: string;
  role?: WhoRole;
  orgId?: string | null;
  actorRefId?: string | null;
  trusted?: boolean;
};

export function readIdentity(headers: Headers): Identity {
  const who = readGatewayIdentity(headers);
  requireTrustedIdentityInProduction(headers, who);

  return {
    uid: who.uid || undefined,
    role: who.role === 'anonymous' ? undefined : who.role,
    orgId: who.orgId ?? null,
    actorRefId: who.actorRefId ?? null,
    trusted: Boolean(who.trusted),
  };
}
