// apps/admin-dashboard/app/auth/signup/page.tsx
'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { RoleName } from '@/src/lib/gateway';
import { AuthApi } from '@/src/lib/gateway';
import {
  AlertTriangle,
  Building2,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  User,
} from 'lucide-react';

type Department = {
  id: string;
  name: string;
  active?: boolean;
  designations?: Designation[];
};

type Designation = {
  id: string;
  departmentId?: string;
  name: string;
  roleNames?: RoleName[];
};

type OrgStructure = {
  name?: string;
  orgName?: string;
  departments: Department[];
};

type Touched = {
  name: boolean;
  email: boolean;
  password: boolean;
  department: boolean;
  designation: boolean;
};

const FALLBACK_ORG_STRUCTURE: OrgStructure = {
  name: 'Ambulant+',
  orgName: 'Ambulant+',
  departments: [
    {
      id: 'local-platform-admin-dept',
      name: 'Platform Administration',
      active: true,
      designations: [
        {
          id: 'local-platform-admin-designation',
          departmentId: 'local-platform-admin-dept',
          name: 'Platform Admin',
          roleNames: ['SuperAdmin', 'Admin'] as RoleName[],
        },
      ],
    },
  ],
};

const DEFAULT_ROLE_NAMES: RoleName[] = [
  'SuperAdmin',
  'Admin',
  'Medical',
  'TechIT',
  'Finance',
  'HR',
  'Compliance',
  'ReportsResearch',
  'RnD',
];

function isValidEmail(v: string): boolean {
  const s = v.trim();
  if (!s) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

function passwordChecks(pw: string) {
  const v = pw || '';
  return {
    len12: v.length >= 12,
    lower: /[a-z]/.test(v),
    upper: /[A-Z]/.test(v),
    num: /[0-9]/.test(v),
    sym: /[^A-Za-z0-9]/.test(v),
    noSpaces: !/\s/.test(v),
  };
}

function passwordStrength(pw: string) {
  const v = pw || '';
  const c = passwordChecks(v);

  let score = 0;
  if (v.length >= 12) score += 1;
  if (v.length >= 14) score += 1;
  if (/[a-z]/.test(v) && /[A-Z]/.test(v)) score += 1;
  if (/[0-9]/.test(v) && /[^A-Za-z0-9]/.test(v)) score += 1;

  const lowered = v.toLowerCase();
  const looksCommon =
    lowered.includes('password') ||
    lowered.includes('admin') ||
    lowered.includes('qwerty') ||
    lowered.includes('12345') ||
    lowered.includes('11111');

  if (looksCommon && score > 0) score -= 1;
  if (!c.noSpaces && score > 0) score -= 1;

  score = Math.max(0, Math.min(4, score));

  const label = score <= 1 ? 'Weak' : score === 2 ? 'Fair' : score === 3 ? 'Good' : 'Strong';
  const hint =
    score <= 1
      ? 'Add length and mix letters, numbers, and symbols.'
      : score === 2
        ? 'Getting there - add more variety or length.'
        : score === 3
          ? 'Nice - consider making it a bit longer.'
          : 'Great - this looks strong.';

  return { score, label, hint };
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function normaliseOrg(value: any): OrgStructure {
  const departments = Array.isArray(value?.departments) ? value.departments : [];
  if (!departments.length) return FALLBACK_ORG_STRUCTURE;

  return {
    name: value?.name || value?.orgName || value?.organizationName || 'Ambulant+',
    orgName: value?.orgName || value?.name || value?.organizationName || 'Ambulant+',
    departments: departments.map((d: any) => ({
      id: String(d?.id || ''),
      name: String(d?.name || 'Department'),
      active: d?.active !== false,
      designations: Array.isArray(d?.designations)
        ? d.designations.map((z: any) => ({
            id: String(z?.id || ''),
            departmentId: String(z?.departmentId || d?.id || ''),
            name: String(z?.name || 'Designation'),
            roleNames: Array.isArray(z?.roleNames) ? z.roleNames.map(String) : [],
          }))
        : [],
    })),
  };
}

async function loadSignupOrgStructure(): Promise<{ org: OrgStructure; warning: string | null }> {
  try {
    const res = await fetch('/api/org/structure', {
      method: 'GET',
      cache: 'no-store',
      headers: { accept: 'application/json' },
    });

    if (!res.ok) throw new Error(`local_org_structure_${res.status}`);
    const json = await res.json();
    return { org: normaliseOrg(json), warning: null };
  } catch (err: any) {
    console.warn('[auth/signup] local org structure unavailable; using fallback', err);
    return {
      org: FALLBACK_ORG_STRUCTURE,
      warning:
        'Organisation structure could not be loaded, so a safe Platform Admin fallback was used. You can update departments and designations after signing in.',
    };
  }
}

type RolesSummaryProps = {
  orgName: string | null;
  loadingOrg: boolean;
  departmentName: string | null;
  designationName: string | null;
  effectiveRoles: RoleName[];
  requestedRoleNames: RoleName[];
  className?: string;
};

function RolesSummaryCard({
  orgName,
  loadingOrg,
  departmentName,
  designationName,
  effectiveRoles,
  requestedRoleNames,
  className,
}: RolesSummaryProps) {
  return (
    <div className={cx('rounded-2xl border bg-slate-50 p-4', className)}>
      <div className="flex items-start gap-2">
        <div className="rounded-lg border bg-white p-2">
          <ShieldCheck className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">Roles Summary</div>
          <div className="text-xs text-slate-600">Live preview of your access.</div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div className="rounded-xl border bg-white p-3">
          <div className="text-xs text-slate-500">Organisation</div>
          <div className="mt-0.5 truncate text-sm font-medium text-slate-900">
            {orgName || (loadingOrg ? 'Loading...' : '-')}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border bg-white p-3">
            <div className="text-xs text-slate-500">Department</div>
            <div className="mt-0.5 truncate text-sm font-medium text-slate-900">
              {departmentName || (loadingOrg ? 'Loading...' : '-')}
            </div>
          </div>
          <div className="rounded-xl border bg-white p-3">
            <div className="text-xs text-slate-500">Designation</div>
            <div className="mt-0.5 truncate text-sm font-medium text-slate-900">
              {designationName || (departmentName ? '-' : 'Select a department')}
            </div>
          </div>
        </div>

        <RolePills title="Auto roles" roles={effectiveRoles} tone="dark" />
        <RolePills title="Requested roles" roles={requestedRoleNames} tone="indigo" empty="None" />

        <div className="rounded-xl border bg-white p-3 text-xs text-slate-600">
          Your access is logged for security and compliance.
        </div>
      </div>
    </div>
  );
}

function RolePills({
  title,
  roles,
  tone,
  empty = 'No default roles yet.',
}: {
  title: string;
  roles: RoleName[];
  tone: 'dark' | 'indigo';
  empty?: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-3">
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500">{title}</div>
        <div className="text-xs font-semibold text-slate-700">{roles.length}</div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {roles.length ? (
          roles.slice(0, 8).map((r) => (
            <span
              key={r}
              className={cx(
                'rounded-full border px-2 py-0.5 text-[11px] font-medium text-white',
                tone === 'dark' ? 'bg-slate-900' : 'bg-indigo-600',
              )}
            >
              {r}
            </span>
          ))
        ) : (
          <span className="text-xs text-slate-600">{empty}</span>
        )}
        {roles.length > 8 ? <span className="text-xs text-slate-500">+{roles.length - 8} more</span> : null}
      </div>
    </div>
  );
}

export default function AdminSignupPage() {
  const router = useRouter();
  const qs = useSearchParams();
  const next = qs?.get('next') || '/';

  const [org, setOrg] = useState<OrgStructure | null>(null);
  const [loadingOrg, setLoadingOrg] = useState(true);
  const [orgWarning, setOrgWarning] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [departmentId, setDepartmentId] = useState('');
  const [designationId, setDesignationId] = useState('');
  const [requestedRoleNames, setRequestedRoleNames] = useState<RoleName[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const [touched, setTouched] = useState<Touched>({
    name: false,
    email: false,
    password: false,
    department: false,
    designation: false,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoadingOrg(true);
      setOrgWarning(null);
      const result = await loadSignupOrgStructure();
      if (cancelled) return;

      setOrg(result.org);
      setOrgWarning(result.warning);

      const firstDept = result.org.departments.find((d) => d?.active !== false) ?? result.org.departments[0];
      if (firstDept?.id) setDepartmentId(firstDept.id);
      setLoadingOrg(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const department = useMemo(
    () => org?.departments?.find((d) => d.id === departmentId) || null,
    [org, departmentId],
  );

  useEffect(() => {
    setDesignationId('');
  }, [departmentId]);

  useEffect(() => {
    if (!department || designationId) return;
    const first = department.designations?.[0];
    if (first?.id) setDesignationId(first.id);
  }, [department, designationId]);

  const designation = useMemo(
    () => department?.designations?.find((d) => d.id === designationId) || null,
    [department, designationId],
  );

  const inferredRoles = designation?.roleNames ?? [];
  const effectiveRoles = useMemo(() => Array.from(new Set<RoleName>(inferredRoles)), [inferredRoles]);

  useEffect(() => {
    if (!effectiveRoles.length) return;
    setRequestedRoleNames((prev) => prev.filter((r) => !effectiveRoles.includes(r)));
  }, [effectiveRoles]);

  const allRoleNames = useMemo(() => {
    const set = new Set<RoleName>();
    for (const d of org?.departments ?? []) {
      for (const z of d.designations ?? []) {
        for (const r of z.roleNames ?? []) set.add(r);
      }
    }
    for (const r of DEFAULT_ROLE_NAMES) set.add(r);
    return Array.from(set).sort() as RoleName[];
  }, [org]);

  const toggleRequested = (r: RoleName) => {
    if (effectiveRoles.includes(r)) return;
    setRequestedRoleNames((prev) => {
      const s = new Set(prev);
      if (s.has(r)) s.delete(r);
      else s.add(r);
      return Array.from(s);
    });
  };

  const pwCheck = useMemo(() => passwordChecks(password), [password]);
  const pwStrength = useMemo(() => passwordStrength(password), [password]);

  const isDeptValid = Boolean(departmentId);
  const isDesValid = Boolean(department && designationId);

  const errors = useMemo(() => {
    const e: Record<keyof Touched, string | null> = {
      name: null,
      email: null,
      password: null,
      department: null,
      designation: null,
    };

    if (!name.trim()) e.name = 'Full name is required.';
    if (!email.trim()) e.email = 'Email is required.';
    else if (!isValidEmail(email)) e.email = 'Please enter a valid email address.';

    if (!password) e.password = 'Password is required.';
    else if (!pwCheck.noSpaces) e.password = 'Password must not contain spaces.';
    else {
      const minimumOk = pwCheck.len12 && pwCheck.lower && pwCheck.upper && pwCheck.num && pwCheck.sym;
      if (!minimumOk) e.password = 'Meet all password requirements below.';
    }

    if (!isDeptValid) e.department = 'Please select a department.';
    if (!isDesValid) e.designation = 'Please select a designation.';

    return e;
  }, [name, email, password, pwCheck, isDeptValid, isDesValid]);

  const showErr = (k: keyof Touched) => (submitAttempted || touched[k]) && Boolean(errors[k]);

  const canSubmit = useMemo(() => {
    if (loadingOrg) return false;
    return !errors.name && !errors.email && !errors.password && !errors.department && !errors.designation;
  }, [errors, loadingOrg]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setSubmitAttempted(true);

    if (!canSubmit) {
      setMsg('Please fix the highlighted fields before continuing.');
      return;
    }

    setSubmitting(true);
    try {
      const adminSignup = AuthApi.adminSignup as (input: {
        email: string;
        password: string;
        name?: string;
        departmentId?: string;
        designationId?: string;
        roleNames?: RoleName[];
      }) => Promise<unknown>;

      await adminSignup({
        email: email.trim(),
        password,
        name: name.trim(),
        departmentId,
        designationId,
        roleNames: Array.from(new Set([...effectiveRoles, ...requestedRoleNames])),
      });

      window.location.href =
        '/auth/signin?approval=pending';
    } catch (err: any) {
      setMsg(err?.message || 'Signup failed');
    } finally {
      setSubmitting(false);
    }
  }

  const orgName = org?.name || org?.orgName || null;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 lg:py-10">
        <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
          <section className="rounded-2xl border bg-white/70 p-6 shadow-sm backdrop-blur">
            <div className="flex items-start gap-3">
              <div className="rounded-xl border bg-white p-3 shadow-sm">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Create Admin Account</h1>
                <p className="mt-1 text-sm text-slate-600">
                  Choose your department and designation. We will auto-assign default roles. You can request extra roles for HR/Admin approval.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4 text-sm text-slate-700">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-lg border bg-white p-2">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-medium">Org-aware onboarding</div>
                  <div className="text-slate-600">Roles are derived from designation to prevent over-permissioning.</div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-lg border bg-white p-2">
                  <Check className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-medium">Fast access, controlled approvals</div>
                  <div className="text-slate-600">Extra roles are stored as requests and can be audited/approved.</div>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-xl border bg-white p-4 text-xs text-slate-600">
              Tip: Choose the closest designation. An admin can update it later.
            </div>
          </section>

          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_360px] 2xl:items-start">
                <div className="min-w-0 space-y-5">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Field
                      label="Full Name *"
                      value={name}
                      onChange={setName}
                      onBlur={() => setTouched((t) => ({ ...t, name: true }))}
                      icon={<User className="h-4 w-4" />}
                      placeholder="e.g., Jane Doe"
                      autoComplete="name"
                      invalid={showErr('name')}
                    />
                    <Field
                      label="Email *"
                      type="email"
                      value={email}
                      onChange={setEmail}
                      onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                      icon={<Mail className="h-4 w-4" />}
                      placeholder="name@company.com"
                      autoComplete="email"
                      invalid={showErr('email')}
                    />

                    <div className="md:col-span-2">
                      <Field
                        label="Password *"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={setPassword}
                        onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                        icon={<Lock className="h-4 w-4" />}
                        placeholder="Create a strong password"
                        autoComplete="new-password"
                        invalid={showErr('password')}
                        rightAction={
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        }
                      />

                      <div className="mt-2 rounded-xl border bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs font-medium text-slate-700">
                            Strength:{' '}
                            <span
                              className={cx(
                                'ml-1 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                                pwStrength.score <= 1 && 'border-rose-200 bg-rose-50 text-rose-700',
                                pwStrength.score === 2 && 'border-amber-200 bg-amber-50 text-amber-800',
                                pwStrength.score === 3 && 'border-sky-200 bg-sky-50 text-sky-800',
                                pwStrength.score >= 4 && 'border-emerald-200 bg-emerald-50 text-emerald-800',
                              )}
                            >
                              {pwStrength.label}
                            </span>
                          </div>
                        </div>

                        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                          <div
                            className={cx(
                              'h-full rounded-full transition-all',
                              pwStrength.score <= 1 && 'bg-rose-500',
                              pwStrength.score === 2 && 'bg-amber-500',
                              pwStrength.score === 3 && 'bg-sky-500',
                              pwStrength.score >= 4 && 'bg-emerald-500',
                            )}
                            style={{ width: `${(pwStrength.score / 4) * 100}%` }}
                          />
                        </div>

                        <div className="mt-2 text-xs text-slate-600">{pwStrength.hint}</div>

                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                          <Req ok={pwCheck.len12} label="12+ chars" />
                          <Req ok={pwCheck.noSpaces} label="No spaces" />
                          <Req ok={pwCheck.lower} label="Lowercase" />
                          <Req ok={pwCheck.upper} label="Uppercase" />
                          <Req ok={pwCheck.num} label="Number" />
                          <Req ok={pwCheck.sym} label="Symbol" />
                        </div>

                        {showErr('password') && errors.password ? (
                          <div className="mt-2 text-xs text-rose-600">{errors.password}</div>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid gap-2 md:col-span-2">
                      {showErr('name') && errors.name ? (
                        <InlineError icon={<AlertTriangle className="h-4 w-4" />} text={errors.name} />
                      ) : null}
                      {showErr('email') && errors.email ? (
                        <InlineError icon={<AlertTriangle className="h-4 w-4" />} text={errors.email} />
                      ) : null}
                    </div>
                  </div>

                  <fieldset className="rounded-xl border bg-white p-4">
                    <legend className="px-1 text-sm font-semibold text-slate-800">Organisation</legend>

                    {loadingOrg && (
                      <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading organisation structure...
                      </div>
                    )}

                    {orgWarning && (
                      <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        {orgWarning}
                      </div>
                    )}

                    {org && (
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <label className="text-sm">
                          <div className="mb-1 text-slate-600">Department *</div>
                          <select
                            className={cx(
                              'w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-slate-400',
                              showErr('department') && 'border-rose-300 focus:border-rose-400',
                            )}
                            value={departmentId}
                            onChange={(e) => setDepartmentId(e.target.value)}
                            onBlur={() => setTouched((t) => ({ ...t, department: true }))}
                            disabled={loadingOrg}
                          >
                            {(org.departments ?? []).map((d) => (
                              <option key={d.id} value={d.id} disabled={d.active === false}>
                                {d.name}
                                {d.active === false ? ' (inactive)' : ''}
                              </option>
                            ))}
                          </select>
                          {showErr('department') && errors.department ? (
                            <div className="mt-1 text-xs text-rose-600">{errors.department}</div>
                          ) : null}
                        </label>

                        <label className="text-sm">
                          <div className="mb-1 text-slate-600">Designation *</div>
                          <select
                            className={cx(
                              'w-full rounded-lg border px-3 py-2 text-sm outline-none transition focus:border-slate-400 disabled:bg-slate-50',
                              showErr('designation') && 'border-rose-300 focus:border-rose-400',
                            )}
                            value={designationId}
                            onChange={(e) => setDesignationId(e.target.value)}
                            onBlur={() => setTouched((t) => ({ ...t, designation: true }))}
                            disabled={!department}
                          >
                            {(department?.designations?.length ?? 0) === 0 ? <option value="">No designations</option> : null}
                            {(department?.designations ?? []).map((des) => (
                              <option key={des.id} value={des.id}>
                                {des.name}
                              </option>
                            ))}
                          </select>
                          {showErr('designation') && errors.designation ? (
                            <div className="mt-1 text-xs text-rose-600">{errors.designation}</div>
                          ) : null}
                        </label>
                      </div>
                    )}
                  </fieldset>

                  <RolesSummaryCard
                    className="2xl:hidden"
                    orgName={orgName}
                    loadingOrg={loadingOrg}
                    departmentName={department?.name ?? null}
                    designationName={designation?.name ?? null}
                    effectiveRoles={effectiveRoles}
                    requestedRoleNames={requestedRoleNames}
                  />

                  <fieldset className="rounded-xl border bg-white p-4">
                    <legend className="px-1 text-sm font-semibold text-slate-800">Request Extra Roles (optional)</legend>
                    <div className="mt-3 max-h-40 overflow-auto pr-1">
                      <div className="flex flex-wrap gap-2">
                        {allRoleNames.map((r) => {
                          const on = requestedRoleNames.includes(r);
                          const locked = effectiveRoles.includes(r);
                          return (
                            <button
                              key={r}
                              type="button"
                              onClick={() => toggleRequested(r)}
                              disabled={locked}
                              className={cx(
                                'rounded-full border px-2.5 py-1 text-xs transition',
                                locked
                                  ? 'cursor-not-allowed bg-slate-50 text-slate-400'
                                  : on
                                    ? 'border-indigo-600 bg-indigo-600 text-white'
                                    : 'bg-white text-slate-800 hover:bg-slate-50',
                              )}
                              title={locked ? 'Already assigned by designation' : 'Request this role'}
                            >
                              {r}
                              {locked ? ' ✓' : ''}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      These are stored as requests; HR/Admin may approve later.
                    </div>
                  </fieldset>
                </div>

                <aside className="hidden 2xl:block 2xl:sticky 2xl:top-6">
                  <div className="max-h-[calc(100vh-8rem)] overflow-auto">
                    <RolesSummaryCard
                      orgName={orgName}
                      loadingOrg={loadingOrg}
                      departmentName={department?.name ?? null}
                      designationName={designation?.name ?? null}
                      effectiveRoles={effectiveRoles}
                      requestedRoleNames={requestedRoleNames}
                    />
                  </div>
                </aside>
              </div>

              {msg ? <div className="text-sm text-rose-600">{msg}</div> : null}

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  type="submit"
                  disabled={submitting || !canSubmit}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
                  {submitting ? 'Creating...' : 'Create account'}
                </button>

                <button
                  type="button"
                  className="rounded-lg border px-4 py-2 text-sm font-medium transition hover:bg-slate-50"
                  onClick={() => router.push(`/auth/signin?next=${encodeURIComponent(next)}`)}
                >
                  Have an account? Sign in
                </button>
              </div>

              <div className="pt-2 text-xs text-slate-500">
                By creating an account, you acknowledge your access will be logged for security and compliance.
              </div>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}

function InlineError({ icon, text }: { icon?: ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
      <span className="mt-0.5">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function Req({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={cx('flex items-center gap-2 text-xs', ok ? 'text-emerald-700' : 'text-slate-600')}>
      <span
        className={cx(
          'inline-flex h-4 w-4 items-center justify-center rounded-full border',
          ok ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white',
        )}
        aria-hidden="true"
      >
        {ok ? <Check className="h-3 w-3" /> : null}
      </span>
      <span className="truncate">{label}</span>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  onBlur,
  type = 'text',
  placeholder,
  autoComplete,
  icon,
  rightAction,
  invalid,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  icon?: ReactNode;
  rightAction?: ReactNode;
  invalid?: boolean;
}) {
  return (
    <label className="min-w-0 text-sm">
      <div className="mb-1 text-slate-600">{label}</div>
      <div
        className={cx(
          'flex h-11 items-center gap-2 rounded-xl border bg-white px-3 transition focus-within:border-slate-400',
          invalid && 'border-rose-300 focus-within:border-rose-400',
        )}
      >
        {icon ? <span className="text-slate-500">{icon}</span> : null}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          autoComplete={autoComplete}
          aria-invalid={invalid ? 'true' : 'false'}
          className="min-w-0 w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
        />
        {rightAction ? <span className="shrink-0">{rightAction}</span> : null}
      </div>
    </label>
  );
}
