// apps/admin-dashboard/app/auth/signup/page.tsx
'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { RoleName } from '@/src/lib/gateway';
import { OrgApi, AuthApi, RoleReqApi } from '@/src/lib/gateway';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Building2,
  Check,
  ChevronRight,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  User,
  Eye,
  EyeOff,
  AlertTriangle,
} from 'lucide-react';

type Touched = {
  name: boolean;
  email: boolean;
  password: boolean;
  department: boolean;
  designation: boolean;
};

function isValidEmail(v: string): boolean {
  const s = v.trim();
  if (!s) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
}

function passwordChecks(pw: string) {
  const v = pw || '';
  const len10 = v.length >= 10;
  const lower = /[a-z]/.test(v);
  const upper = /[A-Z]/.test(v);
  const num = /[0-9]/.test(v);
  const sym = /[^A-Za-z0-9]/.test(v);
  const noSpaces = !/\s/.test(v);

  return { len10, lower, upper, num, sym, noSpaces };
}

function passwordStrength(pw: string) {
  const v = pw || '';
  const c = passwordChecks(v);

  let score = 0;
  if (v.length >= 10) score += 1;
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
        ? 'Getting there—add more variety or length.'
        : score === 3
          ? 'Nice—consider making it a bit longer.'
          : 'Great—this looks strong.';

  return { score, label, hint };
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
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
          <div className="text-xs text-slate-500">Organization</div>
          <div className="mt-0.5 truncate text-sm font-medium text-slate-900">
            {orgName || (loadingOrg ? 'Loading…' : '—')}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border bg-white p-3">
            <div className="text-xs text-slate-500">Department</div>
            <div className="mt-0.5 truncate text-sm font-medium text-slate-900">
              {departmentName || (loadingOrg ? 'Loading…' : '—')}
            </div>
          </div>

          <div className="rounded-xl border bg-white p-3">
            <div className="text-xs text-slate-500">Designation</div>
            <div className="mt-0.5 truncate text-sm font-medium text-slate-900">
              {designationName || (departmentName ? '—' : 'Select a department')}
            </div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border bg-white p-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-500">Auto roles</div>
              <div className="text-xs font-semibold text-slate-700">{effectiveRoles.length}</div>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {effectiveRoles.length ? (
                effectiveRoles.slice(0, 8).map((r) => (
                  <span
                    key={r}
                    className="rounded-full border bg-slate-900 px-2 py-0.5 text-[11px] font-medium text-white"
                  >
                    {r}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-600">No default roles yet.</span>
              )}
              {effectiveRoles.length > 8 ? (
                <span className="text-xs text-slate-500">+{effectiveRoles.length - 8} more</span>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border bg-white p-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-500">Requested roles</div>
              <div className="text-xs font-semibold text-slate-700">{requestedRoleNames.length}</div>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {requestedRoleNames.length ? (
                requestedRoleNames.slice(0, 8).map((r) => (
                  <span
                    key={r}
                    className="rounded-full border bg-indigo-600 px-2 py-0.5 text-[11px] font-medium text-white"
                  >
                    {r}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-600">None</span>
              )}
              {requestedRoleNames.length > 8 ? (
                <span className="text-xs text-slate-500">+{requestedRoleNames.length - 8} more</span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-3 text-xs text-slate-600">
          Your access is logged for security & compliance.
        </div>
      </div>
    </div>
  );
}

export default function AdminSignupPage() {
  const router = useRouter();
  const qs = useSearchParams();
  const next = qs.get('next') || '/';

  const [org, setOrg] = useState<any | null>(null);
  const [loadingOrg, setLoadingOrg] = useState(true);
  const [orgErr, setOrgErr] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(''); // kept for UI parity; gateway dev route ignores it.
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
    (async () => {
      setLoadingOrg(true);
      setOrgErr(null);
      try {
        const j = await OrgApi.structure();
        setOrg(j);

        const firstDept = j?.departments?.find((d: any) => d?.active) ?? j?.departments?.[0];
        if (firstDept?.id) setDepartmentId(firstDept.id);
      } catch (e) {
        console.error(e);
        setOrgErr('Could not load organization structure. Please refresh or try again later.');
      } finally {
        setLoadingOrg(false);
      }
    })();
  }, []);

  const department = useMemo(
    () => org?.departments?.find((d: any) => d.id === departmentId) || null,
    [org, departmentId],
  );

  // Reset designation on department change
  useEffect(() => {
    setDesignationId('');
  }, [departmentId]);

  // Auto-pick first designation when department is available
  useEffect(() => {
    if (!department) return;
    if (designationId) return;
    const first = department?.designations?.[0];
    if (first?.id) setDesignationId(first.id);
  }, [department, designationId]);

  const designation = useMemo(
    () => department?.designations?.find((d: any) => d.id === designationId) || null,
    [department, designationId],
  );

  const inferredRoles = designation?.roleNames ?? [];
  const effectiveRoles = useMemo(() => Array.from(new Set<RoleName>(inferredRoles)), [inferredRoles]);

  // If a role becomes auto-assigned, remove it from requested (prevents redundant requests).
  useEffect(() => {
    if (!effectiveRoles.length) return;
    setRequestedRoleNames((prev) => prev.filter((r) => !effectiveRoles.includes(r)));
  }, [effectiveRoles]);

  const allRoleNames = useMemo(() => {
    const set = new Set<RoleName>();
    for (const d of org?.departments ?? []) {
      for (const z of d.designations ?? []) (z.roleNames ?? []).forEach((r: RoleName) => set.add(r));
    }
    [
      'SuperAdmin',
      'Admin',
      'Medical',
      'TechIT',
      'Finance',
      'HR',
      'Compliance',
      'ReportsResearch',
      'RnD',
    ].forEach((r) => set.add(r as RoleName));
    return [...set] as RoleName[];
  }, [org]);

  const toggleRequested = (r: RoleName) => {
    if (effectiveRoles.includes(r)) return;
    setRequestedRoleNames((prev) => {
      const s = new Set(prev);
      s.has(r) ? s.delete(r) : s.add(r);
      return [...s];
    });
  };

  const pwCheck = useMemo(() => passwordChecks(password), [password]);
  const pwStrength = useMemo(() => passwordStrength(password), [password]);

  const isDeptValid = useMemo(() => Boolean(departmentId), [departmentId]);
  const isDesValid = useMemo(() => {
    if (!department) return false;
    if (!department?.designations || department.designations.length === 0) return false;
    return Boolean(designationId);
  }, [department, designationId]);

  const errors = useMemo(() => {
    const e: Record<string, string | null> = {
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
      const minimumOk = pwCheck.len10 && pwCheck.lower && pwCheck.upper && pwCheck.num && pwCheck.sym;
      if (!minimumOk) e.password = 'Meet all password requirements below.';
    }

    if (!isDeptValid) e.department = 'Please select a department.';
    if (!isDesValid) {
      if (department && (!department.designations || department.designations.length === 0)) {
        e.designation = 'No designations available for this department.';
      } else {
        e.designation = 'Please select a designation.';
      }
    }

    return e;
  }, [name, email, password, pwCheck, isDeptValid, isDesValid, department]);

  const showErr = (k: keyof Touched) => (submitAttempted || touched[k]) && Boolean((errors as any)[k]);

  const canSubmit = useMemo(() => {
    if (loadingOrg) return false;
    const anyErr =
      Boolean(errors.name) ||
      Boolean(errors.email) ||
      Boolean(errors.password) ||
      Boolean(errors.department) ||
      Boolean(errors.designation);
    return !anyErr;
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
      await AuthApi.adminSignup({
        email: email.trim(),
        name: name.trim(),
        departmentId,
        designationId,
      });

      if (requestedRoleNames.length) {
        await RoleReqApi.create({
          email: email.trim(),
          name: name.trim(),
          departmentId,
          designationId,
          roleNames: requestedRoleNames,
        });
      }

      window.location.href = next || '/';
    } catch (err: any) {
      setMsg(err?.message || 'Signup failed');
    } finally {
      setSubmitting(false);
    }
  }

  const orgName = org?.name || org?.orgName || org?.organizationName || null;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Wider container + later breakpoint for 2-column layout (fixes cramped look inside Admin shell) */}
      <div className="mx-auto w-full max-w-6xl px-4 py-8 lg:py-10">
        {/* Only split into 2 big columns on XL+ (prevents “double-splitting” when app shell is narrow) */}
        <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
          {/* Left: Brand / explainer */}
          <section className="rounded-2xl border bg-white/70 p-6 shadow-sm backdrop-blur">
            <div className="flex items-start gap-3">
              <div className="rounded-xl border bg-white p-3 shadow-sm">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Create Admin Account</h1>
                <p className="mt-1 text-sm text-slate-600">
                  Choose your department & designation. We’ll auto-assign default roles. You can request extra roles—HR/Admin may approve later.
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
                  <div className="text-slate-600">Roles are derived from your designation to prevent over-permissioning.</div>
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
              Tip: If you’re unsure which designation to pick, choose the closest match—an admin can update it later.
            </div>
          </section>

          {/* Right: Form card */}
          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Key fix: do NOT split into form + sidebar until 2XL (stops cramped fields) */}
              <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_360px] 2xl:items-start">
                {/* Main column */}
                <div className="space-y-5 min-w-0">
                  {/* Inputs: stack by default; only 2-col on md+ where there’s room */}
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

                      {/* Password strength + requirements (compact layout; no “side-by-side hint” wrapping) */}
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
                          <Req ok={pwCheck.len10} label="10+ chars" />
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

                    {/* Inline errors for name/email */}
                    <div className="md:col-span-2 grid gap-2">
                      {showErr('name') && errors.name ? (
                        <InlineError icon={<AlertTriangle className="h-4 w-4" />} text={errors.name} />
                      ) : null}
                      {showErr('email') && errors.email ? (
                        <InlineError icon={<AlertTriangle className="h-4 w-4" />} text={errors.email} />
                      ) : null}
                    </div>
                  </div>

                  <fieldset className="rounded-xl border bg-white p-4">
                    <legend className="px-1 text-sm font-semibold text-slate-800">Organization</legend>

                    {loadingOrg && (
                      <div className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading org structure…
                      </div>
                    )}

                    {orgErr && <div className="mt-2 text-sm text-rose-600">{orgErr}</div>}

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
                            {(org.departments ?? []).map((d: any) => (
                              <option key={d.id} value={d.id} disabled={!d.active}>
                                {d.name}
                                {!d.active ? ' (inactive)' : ''}
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
                            {(department?.designations?.length ?? 0) === 0 ? (
                              <option value="">No designations</option>
                            ) : null}
                            {(department?.designations ?? []).map((des: any) => (
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

                  {/* Roles Summary inline (visible on <2XL) */}
                  <RolesSummaryCard
                    className="2xl:hidden"
                    orgName={orgName}
                    loadingOrg={loadingOrg}
                    departmentName={department?.name ?? null}
                    designationName={designation?.name ?? null}
                    effectiveRoles={effectiveRoles}
                    requestedRoleNames={requestedRoleNames}
                  />

                  {/* Optional: request extra roles */}
                  <fieldset className="rounded-xl border bg-white p-4">
                    <legend className="px-1 text-sm font-semibold text-slate-800">
                      Request Extra Roles (optional)
                    </legend>

                    {/* Scrollable chip area so this never turns into a “wall of pills” */}
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

                {/* Sidebar Roles Summary (only on 2XL+ where there is enough width) */}
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

              {msg && <div className="text-sm text-rose-600">{msg}</div>}

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  type="submit"
                  disabled={submitting || !canSubmit}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
                  {submitting ? 'Creating…' : 'Create account'}
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
    <label className="text-sm min-w-0">
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
