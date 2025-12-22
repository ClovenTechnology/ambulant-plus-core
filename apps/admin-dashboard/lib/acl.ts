// apps/admin-dashboard/lib/acl.ts
import { ROLE_PRESETS, type Scope, type RoleName } from './org';
import { orgdb } from './orgdb';

export type SessionUser = {
  id: string;
  email: string;
  name?: string;
  // optional, if your auth service doesn't return these you can enrich server-side
  departmentId?: string | null;
  designationId?: string | null;
  roles?: RoleName[];            // direct roles on user (approved)
  pendingRoles?: RoleName[];     // optional: requested roles awaiting approval
};

export function expandScopesFromRoles(roleNames: RoleName[]): Scope[] {
  const set = new Set<Scope>();
  for (const r of roleNames) {
    for (const s of (ROLE_PRESETS[r] ?? [])) set.add(s);
  }
  return [...set];
}

/**
 * Effective roles = designation default roles + direct roles
 * (pending roles explicitly excluded)
 */
export function resolveEffectiveRoles(u: SessionUser): RoleName[] {
  const fromDesignation: RoleName[] = (() => {
    if (!u.designationId) return [];
    const des = orgdb.getDesignation(u.designationId);
    return des?.roleNames ?? [];
  })();

  const direct = u.roles ?? [];
  return [...new Set<RoleName>([...fromDesignation, ...direct])];
}

export function resolveEffectiveScopes(u: SessionUser): Scope[] {
  const roles = resolveEffectiveRoles(u);
  return expandScopesFromRoles(roles);
}

/** Tiny gate util for server/middleware use */
export function hasAnyScope(scopes: Scope[], required: Scope | Scope[]): boolean {
  const req = Array.isArray(required) ? required : [required];
  const set = new Set(scopes);
  return req.some(s => set.has(s));
}
