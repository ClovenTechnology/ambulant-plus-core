// apps/admin-dashboard/lib/policy.ts
export type Scope =
  | 'manageRoles' | 'finance' | 'tech' | 'reports' | 'admin'
  | 'medical' | 'hr' | 'compliance' | 'rnd';

export type RoleName =
  | 'Super Admin' | 'Admin' | 'Medical' | 'Tech & IT'
  | 'Finance' | 'HR' | 'Compliance' | 'Reports & Research' | 'R&D';

export const ROLE_PRESETS: Record<RoleName, Scope[]> = {
  'Super Admin': ['manageRoles','finance','tech','reports','admin','medical','hr','compliance','rnd'],
  'Admin':       ['admin','reports'],
  'Medical':     ['medical','reports'],
  'Tech & IT':   ['tech','reports'],
  'Finance':     ['finance','reports'],
  'HR':          ['hr','reports'],
  'Compliance':  ['compliance','reports'],
  'Reports & Research': ['reports'],
  'R&D':         ['rnd','reports'],
};

// Fetch roles directly assigned + via designation, then union scopes.
export async function getEffectiveScopes(userId: string): Promise<Set<Scope>> {
  // Pseudocode: replace with your DB calls
  const directRoles: RoleName[] = await db.userRoles(userId);               // via user_roles
  const desigRoles: RoleName[]  = await db.rolesForUserDesignation(userId); // via designation_roles

  const scopes = new Set<Scope>();
  for (const r of [...new Set([...directRoles, ...desigRoles])]) {
    for (const s of ROLE_PRESETS[r] || []) scopes.add(s);
  }
  return scopes;
}
