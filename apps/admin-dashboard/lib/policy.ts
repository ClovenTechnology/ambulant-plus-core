// apps/admin-dashboard/lib/policy.ts
// Legacy policy helper retained for older admin-dashboard pages.
// Gateway /api/auth/me is now the canonical source for effective roles/scopes.

export type Scope =
  | 'manageRoles'
  | 'finance'
  | 'tech'
  | 'reports'
  | 'admin'
  | 'medical'
  | 'hr'
  | 'compliance'
  | 'rnd';

export type RoleName =
  | 'Super Admin'
  | 'SuperAdmin'
  | 'Admin'
  | 'Medical'
  | 'Tech & IT'
  | 'TechIT'
  | 'Finance'
  | 'HR'
  | 'Compliance'
  | 'Reports & Research'
  | 'ReportsResearch'
  | 'R&D'
  | 'RnD';

export const ROLE_PRESETS: Record<RoleName, Scope[]> = {
  'Super Admin': ['manageRoles', 'finance', 'tech', 'reports', 'admin', 'medical', 'hr', 'compliance', 'rnd'],
  SuperAdmin: ['manageRoles', 'finance', 'tech', 'reports', 'admin', 'medical', 'hr', 'compliance', 'rnd'],
  Admin: ['admin', 'reports'],
  Medical: ['medical', 'reports'],
  'Tech & IT': ['tech', 'reports'],
  TechIT: ['tech', 'reports'],
  Finance: ['finance', 'reports'],
  HR: ['hr', 'reports'],
  Compliance: ['compliance', 'reports'],
  'Reports & Research': ['reports'],
  ReportsResearch: ['reports'],
  'R&D': ['rnd', 'reports'],
  RnD: ['rnd', 'reports'],
};

function normaliseRoleName(value: string): RoleName | null {
  const s = String(value || '').trim();
  if ((s as RoleName) in ROLE_PRESETS) return s as RoleName;

  const compact = s.replace(/[\s&]+/g, '').toLowerCase();
  const map: Record<string, RoleName> = {
    superadmin: 'SuperAdmin',
    techit: 'TechIT',
    reportsresearch: 'ReportsResearch',
    rnd: 'RnD',
  };
  return map[compact] ?? null;
}

// Optional roles can be supplied by callers that still use this helper.
// When no roles are supplied, return an empty Set instead of referencing a non-existent local db.
export async function getEffectiveScopes(_userId: string, roles: Array<RoleName | string> = []): Promise<Set<Scope>> {
  const scopes = new Set<Scope>();
  const uniqueRoles = Array.from(new Set(roles.map((r) => String(r || '').trim()).filter(Boolean)));

  for (const raw of uniqueRoles) {
    const role = normaliseRoleName(raw);
    if (!role) continue;
    for (const scope of ROLE_PRESETS[role] || []) scopes.add(scope);
  }

  return scopes;
}
