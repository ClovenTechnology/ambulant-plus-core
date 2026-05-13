// apps/admin-dashboard/lib/orgdb.ts
import { Department, Designation, OrgStructure, RoleName, uid } from './org';

type DB = {
  departments: Map<string, Department>;
  designations: Map<string, Designation>;
};

const _db: DB = {
  departments: new Map(),
  designations: new Map(),
};

function uniqueRoleNames(values: unknown): RoleName[] {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.filter(Boolean).map((v) => String(v)))) as RoleName[];
}

(function seed() {
  if (_db.departments.size > 0) return;

  const exec: Department = { id: uid('dept'), name: 'Executive', active: true };
  const fin: Department = { id: uid('dept'), name: 'Finance', active: true };
  const tech: Department = { id: uid('dept'), name: 'Tech & IT', active: true };
  const med: Department = { id: uid('dept'), name: 'Medical', active: true };
  const hr: Department = { id: uid('dept'), name: 'HR', active: true };
  const compliance: Department = { id: uid('dept'), name: 'Compliance', active: true };

  [exec, fin, tech, med, hr, compliance].forEach((d) => _db.departments.set(d.id, d));

  const d = (name: string, deptId: string, roles: RoleName[]) => {
    const des: Designation = { id: uid('desig'), departmentId: deptId, name, roleNames: roles };
    _db.designations.set(des.id, des);
    return des;
  };

  d('Platform Admin', exec.id, ['Super Admin', 'Admin', 'Compliance', 'Finance', 'HR']);
  d('CEO', exec.id, ['Super Admin']);
  d('CFO', exec.id, ['Finance', 'Admin']);
  d('CTO', exec.id, ['Tech & IT', 'Admin']);
  d('CMO', exec.id, ['Medical', 'Admin']);

  d('Chief Accountant', fin.id, ['Finance']);
  d('Accountant', fin.id, ['Finance']);
  d('Auditor', fin.id, ['Finance']);

  d('Software Engineer', tech.id, ['Tech & IT']);
  d('Scrum Master', tech.id, ['Tech & IT']);
  d('Cyber Security Specialist', tech.id, ['Tech & IT']);

  d('Chief Medical Officer', med.id, ['Medical', 'Admin']);
  d('Clinician Operations Admin', med.id, ['Medical', 'Admin']);
  d('Clinician', med.id, ['Medical']);

  d('HR Manager', hr.id, ['HR']);
  d('Recruiter', hr.id, ['HR']);

  d('Compliance Officer', compliance.id, ['Compliance']);
})();

export const orgdb = {
  listDepartments(): Department[] {
    return Array.from(_db.departments.values()).sort((a, b) => a.name.localeCompare(b.name));
  },
  getDepartment(id: string): Department | undefined {
    return _db.departments.get(id);
  },
  createDepartment(input: { name: string; active?: boolean }): Department {
    const name = String(input.name || '').trim();
    if (!name) throw new Error('Department name required');
    const dep: Department = { id: uid('dept'), name, active: input.active ?? true };
    _db.departments.set(dep.id, dep);
    return dep;
  },
  updateDepartment(id: string, patch: Partial<Pick<Department, 'name' | 'active'>>): Department {
    const cur = _db.departments.get(id);
    if (!cur) throw new Error('Department not found');
    const next = { ...cur, ...patch, name: String(patch.name ?? cur.name).trim() };
    _db.departments.set(id, next);
    return next;
  },
  deleteDepartment(id: string): void {
    for (const des of Array.from(_db.designations.values())) {
      if (des.departmentId === id) _db.designations.delete(des.id);
    }
    _db.departments.delete(id);
  },

  listDesignations(): Designation[] {
    return Array.from(_db.designations.values()).sort((a, b) => a.name.localeCompare(b.name));
  },
  listDesignationsByDept(deptId: string): Designation[] {
    return this.listDesignations().filter((d) => d.departmentId === deptId);
  },
  getDesignation(id: string): Designation | undefined {
    return _db.designations.get(id);
  },
  createDesignation(input: { departmentId: string; name: string; roleNames?: RoleName[] }): Designation {
    const dep = _db.departments.get(input.departmentId);
    if (!dep) throw new Error('Department not found');
    const name = String(input.name || '').trim();
    if (!name) throw new Error('Designation name required');
    const des: Designation = {
      id: uid('desig'),
      departmentId: input.departmentId,
      name,
      roleNames: uniqueRoleNames(input.roleNames),
    };
    _db.designations.set(des.id, des);
    return des;
  },
  updateDesignation(id: string, patch: Partial<Pick<Designation, 'name' | 'roleNames' | 'departmentId'>>): Designation {
    const cur = _db.designations.get(id);
    if (!cur) throw new Error('Designation not found');
    if (patch.departmentId && !_db.departments.get(patch.departmentId)) throw new Error('Department not found');
    const next: Designation = {
      ...cur,
      ...patch,
      name: String(patch.name ?? cur.name).trim(),
      roleNames: patch.roleNames ? uniqueRoleNames(patch.roleNames) : cur.roleNames,
    };
    _db.designations.set(id, next);
    return next;
  },
  deleteDesignation(id: string): void {
    _db.designations.delete(id);
  },

  structure(): OrgStructure & { name: string; orgName: string } {
    const departments = this.listDepartments().map((d) => ({
      ...d,
      designations: this.listDesignationsByDept(d.id),
    }));
    return { name: 'Ambulant+', orgName: 'Ambulant+', departments };
  },
};
