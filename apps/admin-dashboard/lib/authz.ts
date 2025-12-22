//apps/admin-dashboard/lib/authz.ts
export const NEXT_AUTHZ_COOKIE = 'adm_scopes';
export const NEXT_PROFILE_COOKIE = 'adm_profile';

export type Scope =
  // Top nav
  | 'dashboard.view'
  | 'patients.read'
  | 'clinicians.read'
  | 'cases.read'
  | 'orders.read'
  // Singles
  | 'analytics.view'
  | 'reports.view'
  | 'insurance.view'
  | 'promotions.manage'
  | 'consult.view'
  // Care Ops
  | 'ops.labs'
  | 'ops.pharmacies'
  | 'ops.careport'
  | 'ops.medreach'
  // Field Teams
  | 'logistics.riders'
  | 'logistics.phlebs'
  // Devices & SDK
  | 'devices.view'
  | 'dev.sdk'
  | 'dev.upload'
  // Admin
  | 'admin.clinicians'
  | 'admin.patients'
  | 'admin.shop'
  // Settings
  | 'settings.general'
  | 'settings.roles'
  | 'settings.plans'
  | 'settings.consult'
  | 'settings.insurance'
  | 'settings.payouts'
  | 'settings.insightcore'
  | 'settings.shop';

export type AuthzPayload = {
  role: string;
  scopes: string[];
  ts?: number;
};

export function parseAuthzCookie(raw: string | undefined | null): AuthzPayload | null {
  try {
    if (!raw) return null;
    const json = JSON.parse(raw);
    if (!Array.isArray(json?.scopes)) return null;
    return json as AuthzPayload;
  } catch {
    return null;
  }
}

export type ProfilePayload = {
  name: string;
  email: string;
  createdAt?: number;
};

export function parseProfileCookie(raw: string | undefined | null): ProfilePayload | null {
  try {
    if (!raw) return null;
    const json = JSON.parse(raw);
    if (!json?.email) return null;
    return json as ProfilePayload;
  } catch {
    return null;
  }
}

export function normalizeScopes(list: string[] | Set<string>) {
  const set = new Set<string>();
  (Array.isArray(list) ? list : Array.from(list)).forEach(s => {
    const v = String(s || '').trim();
    if (v) set.add(v);
  });
  return set;
}

export function hasScope(scopes: Set<string>, needed: string | string[]) {
  const needs = Array.isArray(needed) ? needed : [needed];
  return needs.every(n => scopes.has(n));
}

/** Map path → required scope (prefix-aware). Extend here as routes grow. */
export function requiredScopeForRoute(pathname: string): Scope | null {
  const p = pathname.replace(/\/+$/, '') || '/';

  // Top
  if (p === '/' || p.startsWith('/dashboard')) return 'dashboard.view';
  if (p.startsWith('/patients')) return 'patients.read';
  if (p.startsWith('/clinicians') && !p.startsWith('/admin/')) return 'clinicians.read';
  if (p.startsWith('/cases')) return 'cases.read';
  if (p.startsWith('/orders')) return 'orders.read';

  // Singles
  if (p.startsWith('/analytics')) return 'analytics.view';
  if (p.startsWith('/reports')) return 'reports.view';
  if (p.startsWith('/insurance') && !p.startsWith('/settings')) return 'insurance.view';
  if (p.startsWith('/promotions')) return 'promotions.manage';
  if (p.startsWith('/consult')) return 'consult.view';

  // Care Ops
  if (p.startsWith('/labs')) return 'ops.labs';
  if (p.startsWith('/pharmacies')) return 'ops.pharmacies';
  if (p.startsWith('/careport')) return 'ops.careport';
  if (p.startsWith('/medreach')) return 'ops.medreach';

  // Field Teams
  if (p.startsWith('/rider')) return 'logistics.riders';
  if (p.startsWith('/phleb')) return 'logistics.phlebs';

  // Devices & SDK
  if (p.startsWith('/devices')) return 'devices.view';
  if (p.startsWith('/sdk')) return 'dev.sdk';
  if (p.startsWith('/sdkupload')) return 'dev.upload';

  // Admin
  if (p.startsWith('/admin/clinicians')) return 'admin.clinicians';
  if (p.startsWith('/admin/patients')) return 'admin.patients';
  if (p.startsWith('/admin/shop')) return 'admin.shop';

  // Settings
  if (p.startsWith('/settings/roles')) return 'settings.roles';
  if (p.startsWith('/settings/plans')) return 'settings.plans';
  if (p.startsWith('/settings/consult')) return 'settings.consult';
  if (p.startsWith('/settings/insurance')) return 'settings.insurance';
  if (p.startsWith('/settings/payouts')) return 'settings.payouts';
  if (p.startsWith('/settings/insightcore')) return 'settings.insightcore';
  if (p.startsWith('/settings/shop')) return 'settings.shop';
  if (p.startsWith('/settings')) return 'settings.general';

  return null;
}

/** Role → preset scopes (aligns to your sidebar) */
export const rolePresets = {
  'Super Admin': {
    description: 'Full platform access.',
    scopes: [
      'dashboard.view',
      'patients.read', 'clinicians.read', 'cases.read', 'orders.read',
      'analytics.view', 'reports.view', 'insurance.view', 'promotions.manage', 'consult.view',
      'ops.labs', 'ops.pharmacies', 'ops.careport', 'ops.medreach',
      'logistics.riders', 'logistics.phlebs',
      'devices.view', 'dev.sdk', 'dev.upload',
      'admin.clinicians', 'admin.patients', 'admin.shop',
      'settings.general', 'settings.roles', 'settings.plans', 'settings.consult',
      'settings.insurance', 'settings.payouts', 'settings.insightcore', 'settings.shop',
    ] as const,
  },
  'Admin': {
    description: 'Operational administration.',
    scopes: [
      'dashboard.view',
      'patients.read', 'clinicians.read', 'cases.read', 'orders.read',
      'analytics.view', 'reports.view', 'insurance.view', 'consult.view',
      'ops.labs', 'ops.pharmacies', 'ops.careport', 'ops.medreach',
      'devices.view',
      'admin.clinicians', 'admin.patients',
      'settings.general', 'settings.roles', 'settings.consult',
    ] as const,
  },
  'Medical': {
    description: 'Clinical view & ops.',
    scopes: [
      'dashboard.view',
      'patients.read', 'clinicians.read', 'cases.read', 'orders.read',
      'consult.view',
      'ops.labs', 'ops.pharmacies', 'ops.careport', 'ops.medreach',
      'analytics.view', 'reports.view',
      'devices.view',
    ] as const,
  },
  'Tech & IT': {
    description: 'Devices, SDK, InsightCore.',
    scopes: [
      'dashboard.view',
      'devices.view', 'dev.sdk', 'dev.upload',
      'settings.insightcore', 'analytics.view',
    ] as const,
  },
  'Finance': {
    description: 'Financial analytics & payouts.',
    scopes: [
      'dashboard.view',
      'analytics.view', 'reports.view',
      'settings.payouts',
      'orders.read',
    ] as const,
  },
  'HR': {
    description: 'People admin.',
    scopes: [
      'dashboard.view',
      'admin.clinicians', 'clinicians.read',
      'reports.view',
    ] as const,
  },
  'Compliance': {
    description: 'Read-only oversight & reports.',
    scopes: [
      'dashboard.view',
      'reports.view', 'analytics.view',
      'patients.read', 'cases.read', 'orders.read',
    ] as const,
  },
  'Reports & Research': {
    description: 'Data access for insights.',
    scopes: [
      'dashboard.view',
      'reports.view', 'analytics.view',
      'patients.read', 'cases.read',
    ] as const,
  },
  'R&D': {
    description: 'Innovation & experiments.',
    scopes: [
      'dashboard.view',
      'settings.insightcore', 'analytics.view',
      'dev.sdk',
    ] as const,
  },
} as const;
