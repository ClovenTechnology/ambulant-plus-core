// apps/admin-dashboard/lib/org.ts
export type RoleName =
  | 'Super Admin'
  | 'Admin'
  | 'Medical'
  | 'Tech & IT'
  | 'Finance'
  | 'HR'
  | 'Compliance'
  | 'Reports & Research'
  | 'R&D';

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

export const ROLE_PRESETS: Record<RoleName, Scope[]> = {
  'Super Admin': ['manageRoles','finance','tech','reports','admin','medical','hr','compliance','rnd'],
  'Admin': ['admin','reports'],
  'Medical': ['medical','reports'],
  'Tech & IT': ['tech','reports'],
  'Finance': ['finance','reports'],
  'HR': ['hr','reports'],
  'Compliance': ['compliance','reports'],
  'Reports & Research': ['reports'],
  'R&D': ['rnd','reports'],
};

export type Department = {
  id: string;
  name: string;
  active: boolean;
};

export type Designation = {
  id: string;
  departmentId: string;
  name: string;
  roleNames: RoleName[]; // default roles for this designation
};

export type OrgStructure = {
  departments: Array<Department & { designations: Designation[] }>;
};

// Utility
export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
