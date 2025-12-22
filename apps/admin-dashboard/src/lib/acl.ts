// apps/admin-dashboard/src/lib/acl.ts
// Slim ACL helpers for the admin dashboard.
//
// Gateway (/api/auth/me) already resolves effective roles & scopes.
// This file just provides tiny utilities consumed by middleware and pages.

export type Scope = string;
export type RoleName = string;

export type SessionUser = {
  id?: string | null;
  email?: string | null;
  name?: string | null;
  departmentId?: string | null;
  designationId?: string | null;
  roles?: RoleName[];   // (optional) effective roles if Gateway included them
  scopes?: Scope[];     // effective scopes computed by Gateway
  pendingRoles?: RoleName[]; // optional
};

function dedup<T extends string>(arr: T[] | undefined | null): T[] {
  return Array.from(new Set((arr ?? []).filter(Boolean))) as T[];
}

/** Prefer roles from the session (Gateway already merged designation + direct). */
export function resolveEffectiveRoles(u: SessionUser | null | undefined): RoleName[] {
  return dedup(u?.roles ?? []);
}

/** Prefer scopes from the session (computed server-side by the Gateway). */
export function resolveEffectiveScopes(u: SessionUser | null | undefined): Scope[] {
  return dedup(u?.scopes ?? []);
}

/** Tiny gate util used by middleware/pages */
export function hasAnyScope(scopes: Scope[] | null | undefined, required: Scope | Scope[]): boolean {
  const set = new Set(dedup(scopes ?? []));
  const req = Array.isArray(required) ? required : [required];
  return req.some((s) => set.has(s));
}
