// apps/admin-dashboard/app/settings/people/departments/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import type { RoleName } from '@/src/lib/gateway';
import { OrgApi } from '@/src/lib/gateway';

type Department = { id: string; name: string; active: boolean };
type Designation = { id: string; departmentId: string; name: string; roleNames: RoleName[] };
type OrgStructure = { departments: Array<Department & { designations: Designation[] }> };

export default function DepartmentsSettingsPage() {
  const [structure, setStructure] = useState<OrgStructure | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [newDeptName, setNewDeptName] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState<string>('');
  const [newDesigName, setNewDesigName] = useState('');
  const [newDesigRoles, setNewDesigRoles] = useState<RoleName[]>([]);

  const allRoleNames = useMemo<RoleName[]>(() => {
    const set = new Set<RoleName>();
    (structure?.departments ?? []).forEach((d) =>
      (d.designations ?? []).forEach((z) => (z.roleNames ?? []).forEach((r) => set.add(r)))
    );
    // Add expected defaults so UX isn't empty on day 1
    ['SuperAdmin','Admin','Medical','TechIT','Finance','HR','Compliance','ReportsResearch','RnD'].forEach((r) => set.add(r as RoleName));
    return [...set];
  }, [structure]);

  const refresh = async () => {
    setLoading(true);
    setErr(null);
    try {
      const j = await OrgApi.structure();
      setStructure(j as OrgStructure);
      if (!selectedDeptId && j?.departments?.[0]) setSelectedDeptId(j.departments[0].id);
    } catch (e: any) {
      setErr(e?.message || 'failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, []);

  const selectedDept = useMemo(
    () => structure?.departments.find((d) => d.id === selectedDeptId) || null,
    [structure, selectedDeptId]
  );

  async function addDepartment() {
    const name = newDeptName.trim();
    if (!name) return;
    await OrgApi.createDepartment({ name, active: true });
    setNewDeptName('');
    await refresh();
  }
  async function toggleDeptActive(dep: Department) {
    await OrgApi.updateDepartment(dep.id, { active: !dep.active });
    await refresh();
  }
  async function deleteDept(dep: Department) {
    if (!confirm(`Delete department "${dep.name}" (and its designations)?`)) return;
    await OrgApi.deleteDepartment(dep.id);
    if (selectedDeptId === dep.id) setSelectedDeptId('');
    await refresh();
  }
  async function addDesignation() {
    if (!selectedDept) return;
    const name = newDesigName.trim();
    if (!name) return;
    await OrgApi.createDesignation({ departmentId: selectedDept.id, name });
    if (newDesigRoles.length) {
      // refresh & then set roles on the created designation
      const list = await OrgApi.listDesignations();
      const created = (list.items || list || []).find((d: any) => d.departmentId === selectedDept.id && d.name === name);
      if (created) await OrgApi.setDesignationRoles(created.id, undefined, newDesigRoles);
    }
    setNewDesigName('');
    setNewDesigRoles([]);
    await refresh();
  }
  async function updateDesigRoles(des: Designation, roles: RoleName[]) {
    await OrgApi.setDesignationRoles(des.id, undefined, roles);
    await refresh();
  }
  async function deleteDesignation(des: Designation) {
    if (!confirm(`Delete designation "${des.name}"?`)) return;
    await OrgApi.deleteDesignation(des.id);
    await refresh();
  }

  return (
    <main className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Departments & Designations</h1>
      <p className="text-sm text-gray-600">
        Organize your org structure and map designations to default roles. Users selecting a designation at sign-up will automatically receive these roles (admins can override later).
      </p>

      {err && <div className="p-3 border bg-rose-50 text-rose-700 rounded text-sm">{err}</div>}
      {loading && <div className="text-sm text-gray-600">Loading…</div>}

      {structure && (
        <div className="grid md:grid-cols-3 gap-6">
          {/* Left: Departments */}
          <section className="border rounded bg-white">
            <div className="p-3 border-b flex items-center justify-between">
              <h2 className="font-semibold">Departments</h2>
            </div>
            <div className="p-3 space-y-2">
              <div className="flex gap-2">
                <input
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  placeholder="New department"
                  className="border rounded p-2 text-sm flex-1"
                />
                <button onClick={addDepartment} className="px-3 py-2 rounded bg-black text-white text-sm">Add</button>
              </div>

              <ul className="space-y-1">
                {structure.departments.map((dep) => (
                  <li key={dep.id}>
                    <button
                      className={`w-full text-left px-3 py-2 rounded text-sm flex items-center justify-between ${selectedDeptId === dep.id ? 'bg-black/5' : 'hover:bg-black/5'}`}
                      onClick={() => setSelectedDeptId(dep.id)}
                    >
                      <span className="truncate">{dep.name}</span>
                      <span className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${dep.active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-gray-50 text-gray-600'}`}>
                          {dep.active ? 'Active' : 'Inactive'}
                        </span>
                      </span>
                    </button>
                    <div className="flex gap-2 px-3 pb-2">
                      <button onClick={() => toggleDeptActive(dep)} className="text-xs underline">Toggle active</button>
                      <button onClick={() => deleteDept(dep)} className="text-xs text-rose-600 underline">Delete</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Right: Designations */}
          <section className="md:col-span-2 border rounded bg-white">
            <div className="p-3 border-b flex items-center justify-between">
              <h2 className="font-semibold">Designations {selectedDept ? `— ${selectedDept.name}` : ''}</h2>
            </div>

            {!selectedDept && (
              <div className="p-3 text-sm text-gray-600">Select a department to manage its designations.</div>
            )}

            {selectedDept && (
              <div className="p-3 space-y-4">
                {/* Add form */}
                <div className="border rounded p-3 bg-gray-50 space-y-2">
                  <div className="grid md:grid-cols-3 gap-2">
                    <input
                      value={newDesigName}
                      onChange={(e) => setNewDesigName(e.target.value)}
                      placeholder="Designation (e.g., Software Engineer)"
                      className="border rounded p-2 text-sm md:col-span-1"
                    />
                    <div className="md:col-span-2">
                      <RoleSelector
                        label="Default Roles"
                        value={newDesigRoles}
                        onChange={setNewDesigRoles}
                        options={allRoleNames}
                      />
                    </div>
                  </div>
                  <div>
                    <button onClick={addDesignation} className="px-3 py-2 rounded bg-black text-white text-sm">Add designation</button>
                  </div>
                </div>

                {/* List */}
                <ul className="space-y-2">
                  {selectedDept.designations.length === 0 && (
                    <li className="text-sm text-gray-600">No designations yet.</li>
                  )}
                  {selectedDept.designations.map((des) => (
                    <li key={des.id} className="border rounded p-3 bg-white">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-medium">{des.name}</div>
                          <div className="text-xs text-gray-500">ID: <span className="font-mono">{des.id}</span></div>
                        </div>
                        <button onClick={() => deleteDesignation(des)} className="text-xs text-rose-600 underline">Delete</button>
                      </div>

                      <div className="mt-2">
                        <RoleSelector
                          label="Default Roles"
                          value={des.roleNames}
                          onChange={(v) => updateDesigRoles(des, v)}
                          options={allRoleNames}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

function RoleSelector({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: RoleName[];
  onChange: (v: RoleName[]) => void;
  options: RoleName[];
}) {
  const toggle = (r: RoleName) => {
    const set = new Set(value);
    set.has(r) ? set.delete(r) : set.add(r);
    onChange([...set]);
  };
  return (
    <div>
      <div className="text-xs text-gray-600 mb-1">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((r) => {
          const on = value.includes(r);
          return (
            <button
              key={r}
              type="button"
              onClick={() => toggle(r)}
              className={`px-2 py-1 rounded-full border text-xs ${on ? 'bg-black text-white border-black' : 'bg-white hover:bg-black/5'}`}
            >
              {r}
            </button>
          );
        })}
      </div>
    </div>
  );
}
