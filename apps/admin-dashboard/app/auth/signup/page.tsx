// apps/admin-dashboard/app/auth/signup/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import type { RoleName } from '@/src/lib/gateway';
import { OrgApi, AuthApi, RoleReqApi } from '@/src/lib/gateway';
import { useRouter, useSearchParams } from 'next/navigation';

export default function AdminSignupPage() {
  const router = useRouter();
  const qs = useSearchParams();
  const next = qs.get('next') || '/';

  const [org, setOrg] = useState<any | null>(null);
  const [loadingOrg, setLoadingOrg] = useState(true);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(''); // kept for UI parity; gateway dev route ignores it.

  const [departmentId, setDepartmentId] = useState('');
  const [designationId, setDesignationId] = useState('');
  const [requestedRoleNames, setRequestedRoleNames] = useState<RoleName[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoadingOrg(true);
      try {
        const j = await OrgApi.structure();
        setOrg(j);
        if (j?.departments?.[0]) setDepartmentId(j.departments[0].id);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingOrg(false);
      }
    })();
  }, []);

  const department = useMemo(
    () => org?.departments.find((d: any) => d.id === departmentId) || null,
    [org, departmentId]
  );
  const designation = useMemo(
    () => department?.designations.find((d: any) => d.id === designationId) || null,
    [department, designationId]
  );

  const inferredRoles = designation?.roleNames ?? [];
  const effectiveRoles = useMemo(() => Array.from(new Set<RoleName>(inferredRoles)), [inferredRoles]);

  const allRoleNames = useMemo(() => {
    // best effort: union of all roles found in structure (if presets aren't shipped client-side)
    const set = new Set<RoleName>();
    for (const d of org?.departments ?? []) {
      for (const z of d.designations ?? []) (z.roleNames ?? []).forEach((r: RoleName) => set.add(r));
    }
    // Fallback common roles (optional)
    ['SuperAdmin','Admin','Medical','TechIT','Finance','HR','Compliance','ReportsResearch','RnD'].forEach((r) => set.add(r as RoleName));
    return [...set] as RoleName[];
  }, [org]);

  const toggleRequested = (r: RoleName) => {
    setRequestedRoleNames((prev) => {
      const s = new Set(prev);
      s.has(r) ? s.delete(r) : s.add(r);
      return [...s];
    });
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!name.trim() || !email.trim() || !password) {
      setMsg('Please complete all required fields.');
      return;
    }
    if (!departmentId || !designationId) {
      setMsg('Please select department and designation.');
      return;
    }

    setSubmitting(true);
    try {
      await AuthApi.adminSignup({ email, name, departmentId, designationId });

      // Optional: raise role request for extras
      if (requestedRoleNames.length) {
        await RoleReqApi.create({
          email,
          name,
          departmentId,
          designationId,
          roleNames: requestedRoleNames,
        });
      }

      // Redirect (gateway set the session cookie)
      window.location.href = next || '/';
    } catch (e: any) {
      setMsg(e?.message || 'Signup failed');
    } finally {
      setSubmitting(false);
    }
  }

  // Reset designation on department change
  useEffect(() => { setDesignationId(''); }, [departmentId]);

  return (
    <main className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Create Admin Account</h1>
      <p className="text-sm text-gray-600">
        Choose your Department & Designation. We’ll auto-assign default roles. You can request extra roles—HR/Admin may approve later.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Full Name *" value={name} onChange={setName} />
          <Field label="Email *" type="email" value={email} onChange={setEmail} />
          <Field label="Password *" type="password" value={password} onChange={setPassword} />
        </div>

        <fieldset className="border rounded p-3 bg-white">
          <legend className="px-1 text-sm font-semibold">Organization</legend>
          {loadingOrg && <div className="text-sm text-gray-600">Loading org structure…</div>}
          {org && (
            <div className="grid md:grid-cols-2 gap-3">
              <label className="text-sm">
                <div className="text-gray-600 mb-1">Department *</div>
                <select
                  className="border rounded p-2 w-full"
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                >
                  {org.departments.map((d: any) => (
                    <option key={d.id} value={d.id} disabled={!d.active}>
                      {d.name}{!d.active ? ' (inactive)' : ''}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm">
                <div className="text-gray-600 mb-1">Designation *</div>
                <select
                  className="border rounded p-2 w-full"
                  value={designationId}
                  onChange={(e) => setDesignationId(e.target.value)}
                  disabled={!department}
                >
                  <option value="">Select…</option>
                  {department?.designations.map((des: any) => (
                    <option key={des.id} value={des.id}>{des.name}</option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </fieldset>

        {/* Auto role preview */}
        <fieldset className="border rounded p-3 bg-white">
          <legend className="px-1 text-sm font-semibold">Auto-assigned Roles (from designation)</legend>
          {designation ? (
            <div className="flex flex-wrap gap-2">
              {effectiveRoles.length > 0 ? effectiveRoles.map((r) => (
                <span key={r} className="text-xs px-2 py-1 rounded-full border bg-black text-white">{r}</span>
              )) : <span className="text-sm text-gray-600">No default roles mapped yet.</span>}
            </div>
          ) : (
            <div className="text-sm text-gray-600">Choose a designation to preview roles.</div>
          )}
        </fieldset>

        {/* Optional: request extra roles */}
        <fieldset className="border rounded p-3 bg-white">
          <legend className="px-1 text-sm font-semibold">Request Extra Roles (optional)</legend>
          <div className="flex flex-wrap gap-2">
            {allRoleNames.map((r) => {
              const on = requestedRoleNames.includes(r);
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => toggleRequested(r)}
                  className={`px-2 py-1 rounded-full border text-xs ${on ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white hover:bg-black/5'}`}
                >
                  {r}
                </button>
              );
            })}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            These are stored as requests; HR/Admin may approve later.
          </div>
        </fieldset>

        {msg && <div className="text-sm text-rose-600">{msg}</div>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded bg-black text-white"
          >
            {submitting ? 'Creating…' : 'Create account'}
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded border"
            onClick={() => router.push(`/auth/signin?next=${encodeURIComponent(next)}`)}
          >
            Have an account? Sign in
          </button>
        </div>
      </form>
    </main>
  );
}

function Field({
  label, value, onChange, type = 'text',
}: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="text-sm">
      <div className="text-gray-600 mb-1">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border rounded p-2 w-full"
      />
    </label>
  );
}
