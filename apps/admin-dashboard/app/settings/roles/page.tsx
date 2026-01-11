// apps/admin-dashboard/app/settings/roles/page.tsx
'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield,
  FileText,
  Wallet,
  Settings as SettingsIcon,
  Truck,
  ClipboardCheck,
  Search,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowRightLeft,
} from 'lucide-react';

import { rolePresets } from '../../../lib/authz';
import { setRoleByForm, setCustomScopesByForm, clearAuthz } from '../../actions/authz';

import {
  SCOPE_GROUPS,
  ALL_SCOPES,
  DANGER_SCOPES,
  SCOPE_META,
  parseScopesText,
  normalizeScope,
} from '../../../lib/authz/scopeCatalog';

const GROUP_ICON: Record<string, React.ReactNode> = {
  settings: <SettingsIcon className="h-4 w-4 text-gray-800" />,
  reports: <FileText className="h-4 w-4 text-gray-800" />,
  finance: <Wallet className="h-4 w-4 text-gray-800" />,
  ops: <Truck className="h-4 w-4 text-gray-800" />,
  compliance: <ClipboardCheck className="h-4 w-4 text-gray-800" />,
};

const RECOMMENDED_OPERATOR_PRESETS: Array<{
  key: string;
  title: string;
  description: string;
  tone: 'high' | 'med' | 'low';
  scopes: string[];
}> = [
  {
    key: 'admin-operator',
    title: 'Admin (Operator)',
    description: 'Full access across settings, reports, finance, ops, compliance.',
    tone: 'high',
    scopes: Array.from(ALL_SCOPES),
  },
  {
    key: 'compliance-operator',
    title: 'Compliance (Operator)',
    description: 'Verification + publishing guardrails, audits, exports.',
    tone: 'high',
    scopes: [
      'settings.read',
      'reports.read',
      'reports.verify',
      'reports.publish',
      'reports.amend',
      'reports.redact',
      'reports.export',
      'reports.share_link',
      'compliance.read',
      'compliance.verify_clinicians',
      'compliance.audit.read',
      'compliance.audit.export',
    ],
  },
  {
    key: 'finance-operator',
    title: 'Finance (Operator)',
    description: 'Payouts, approvals, refunds and finance exports. Read-only elsewhere.',
    tone: 'high',
    scopes: [
      'settings.read',
      'reports.read',
      'reports.export',
      'finance.read',
      'finance.export',
      'finance.payouts.run',
      'finance.payouts.approve',
      'finance.refunds',
    ],
  },
  {
    key: 'ops-operator',
    title: 'Ops (Operator)',
    description: 'Dispatch + support write. Drafting and submitting reports as needed.',
    tone: 'med',
    scopes: [
      'settings.read',
      'reports.read',
      'reports.create',
      'reports.edit_draft',
      'reports.submit',
      'reports.export',
      'ops.read',
      'ops.dispatch.write',
      'ops.support.write',
    ],
  },
];

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function stringifyScopes(scopes: string[]) {
  return scopes.join(' ');
}

function Pill({
  tone,
  children,
  title,
}: {
  tone: 'default' | 'danger' | 'muted' | 'success' | 'warn';
  children: React.ReactNode;
  title?: string;
}) {
  const cls =
    tone === 'danger'
      ? 'border-red-200 bg-red-50 text-red-900'
      : tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : tone === 'warn'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : tone === 'muted'
      ? 'border-gray-200 bg-gray-50 text-gray-700'
      : 'border-gray-200 bg-white text-gray-800';

  return (
    <span
      title={title}
      className={cx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium', cls)}
    >
      {children}
    </span>
  );
}

function Banner({
  kind,
  title,
  description,
  actions,
}: {
  kind: 'info' | 'success' | 'warn' | 'error';
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  const styles =
    kind === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
      : kind === 'warn'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : kind === 'error'
      ? 'border-red-200 bg-red-50 text-red-900'
      : 'border-gray-200 bg-gray-50 text-gray-900';

  const icon =
    kind === 'success' ? (
      <CheckCircle2 className="h-4 w-4" />
    ) : kind === 'warn' || kind === 'error' ? (
      <AlertTriangle className="h-4 w-4" />
    ) : (
      <Sparkles className="h-4 w-4" />
    );

  return (
    <div className={cx('rounded-2xl border p-3 md:p-4', styles)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <div className="mt-0.5">{icon}</div>
          <div className="min-w-0">
            <div className="text-xs md:text-sm font-semibold">{title}</div>
            {description ? <div className="mt-0.5 text-[11px] md:text-xs opacity-90">{description}</div> : null}
          </div>
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
    </div>
  );
}

export default function RolesSettingsPage() {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [customLabel, setCustomLabel] = useState('Custom');
  const [customScopes, setCustomScopes] = useState('');
  const [scopeSearch, setScopeSearch] = useState('');

  const roles = useMemo(
    () =>
      Object.entries(rolePresets) as [
        keyof typeof rolePresets,
        { description: string; scopes: readonly string[] },
      ][],
    []
  );

  const parsedCustom = useMemo(() => parseScopesText(customScopes), [customScopes]);
  const customList = parsedCustom.scopes;

  const unknownScopes = useMemo(
    () => customList.filter((s) => !ALL_SCOPES.has(s)),
    [customList]
  );

  const dangerScopes = useMemo(
    () => customList.filter((s) => DANGER_SCOPES.has(s)),
    [customList]
  );

  const missingReadWarnings = useMemo(() => {
    const has = new Set(customList);

    const needs: Array<{ when: (s: Set<string>) => boolean; warn: string }> = [
      {
        when: (s) => s.has('settings.write') && !s.has('settings.read'),
        warn: 'settings.write usually implies settings.read (add settings.read).',
      },
      {
        when: (s) =>
          Array.from(s).some((x) => x.startsWith('reports.') && x !== 'reports.read') && !s.has('reports.read'),
        warn: 'Most reports actions imply reports.read (add reports.read).',
      },
      {
        when: (s) =>
          Array.from(s).some((x) => x.startsWith('finance.') && x !== 'finance.read') && !s.has('finance.read'),
        warn: 'Most finance actions imply finance.read (add finance.read).',
      },
      {
        when: (s) =>
          Array.from(s).some((x) => x.startsWith('ops.') && x !== 'ops.read') && !s.has('ops.read'),
        warn: 'Most ops actions imply ops.read (add ops.read).',
      },
      {
        when: (s) =>
          Array.from(s).some((x) => x.startsWith('compliance.') && x !== 'compliance.read') && !s.has('compliance.read'),
        warn: 'Most compliance actions imply compliance.read (add compliance.read).',
      },
    ];

    return needs.filter((n) => n.when(has)).map((n) => n.warn);
  }, [customList]);

  const filteredGroups = useMemo(() => {
    const q = scopeSearch.trim().toLowerCase();
    if (!q) return SCOPE_GROUPS;

    return SCOPE_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter((i) => {
        const hay = `${i.scope} ${i.label} ${i.desc || ''}`.toLowerCase();
        return hay.includes(q);
      }),
    })).filter((g) => g.items.length > 0);
  }, [scopeSearch]);

  const setScopesList = (list: string[]) => {
    setCustomScopes(stringifyScopes(list));
  };

  const toggleScope = (scope: string) => {
    const current = new Set(customList);
    if (current.has(scope)) current.delete(scope);
    else current.add(scope);
    setScopesList(Array.from(current).sort());
  };

  const setGroup = (groupKey: string, mode: 'add' | 'remove') => {
    const group = SCOPE_GROUPS.find((g) => g.key === groupKey);
    if (!group) return;
    const current = new Set(customList);
    for (const item of group.items) {
      if (mode === 'add') current.add(item.scope);
      else current.delete(item.scope);
    }
    setScopesList(Array.from(current).sort());
  };

  const applyRecommendedPreset = (presetKey: string) => {
    const p = RECOMMENDED_OPERATOR_PRESETS.find((x) => x.key === presetKey);
    if (!p) return;
    setCustomLabel(p.title);
    setScopesList(Array.from(new Set(p.scopes)).sort());
  };

  const migratePresetToCustom = (role: string, presetScopes: readonly string[]) => {
    const normalized = presetScopes
      .map((s) => normalizeScope(s))
      .filter(Boolean);

    setCustomLabel(`${role} (Migrated)`);
    setScopesList(Array.from(new Set(normalized)).sort());
  };

  const copyScopes = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  return (
    <main className="p-6 space-y-5">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-gray-500">Settings</div>
          <h1 className="mt-0.5 text-xl font-semibold text-gray-900">Roles & Access</h1>
          <p className="mt-1 text-sm text-gray-600">
            Assign a role preset or define custom scopes. Scopes are normalized to the canonical catalog on save.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/settings/general"
            className="inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
            title="Open the policy map (Reports governance)"
          >
            <FileText className="h-3.5 w-3.5" />
            Policy map
          </Link>
          <button
            type="button"
            onClick={() => copyScopes(customList.join(' '))}
            className="inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy scopes
          </button>
        </div>
      </div>

      <Banner
        kind="info"
        title="Canonical catalog + legacy alias normalization enabled"
        description="Legacy scope names are auto-mapped to canonical names where possible. Unknown scopes are surfaced so you can migrate safely."
        actions={
          <span className="inline-flex items-center gap-2">
            <Pill tone="muted">
              <Shield className="h-3.5 w-3.5" />
              RBAC
            </Pill>
            <Pill tone="warn" title="Danger scopes should be audited">
              <AlertTriangle className="h-3.5 w-3.5" />
              Privileged actions must audit
            </Pill>
          </span>
        }
      />

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Presets */}
        <section className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Role Presets</h2>
              <p className="text-xs text-gray-500 mt-1">Presets from lib/authz. You can “migrate to custom” to harmonize.</p>
            </div>
            <Pill tone="muted">{roles.length} presets</Pill>
          </div>

          <ul className="mt-4 space-y-3">
            {roles.map(([role, cfg]) => {
              const raw = cfg.scopes || [];
              const normalized = raw.map((s) => normalizeScope(s)).filter(Boolean);
              const unknown = normalized.filter((s) => !ALL_SCOPES.has(s));
              const knownCount = normalized.length - unknown.length;

              return (
                <li key={String(role)} className="rounded-2xl border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-medium text-gray-900">{String(role)}</div>
                        {unknown.length ? (
                          <Pill tone="warn" title="Some normalized scopes are not in the catalog">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {unknown.length} unknown
                          </Pill>
                        ) : (
                          <Pill tone="success">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Catalog-aligned
                          </Pill>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{cfg.description}</div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        <Pill tone="muted">{normalized.length} scopes</Pill>
                        {knownCount ? <Pill tone="default">{knownCount} known</Pill> : null}
                        {unknown.length ? <Pill tone="warn">{unknown.length} unknown</Pill> : null}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <form
                        action={(fd: FormData) =>
                          start(async () => {
                            await setRoleByForm(fd);
                            router.refresh();
                          })
                        }
                      >
                        <input type="hidden" name="role" value={String(role)} />
                        <button
                          type="submit"
                          className="px-3 py-1.5 rounded-xl border bg-white hover:bg-gray-50 text-sm disabled:opacity-50"
                          disabled={pending}
                        >
                          {pending ? 'Applying…' : 'Apply'}
                        </button>
                      </form>

                      <button
                        type="button"
                        onClick={() => migratePresetToCustom(String(role), raw)}
                        className="px-3 py-1.5 rounded-xl border bg-white hover:bg-gray-50 text-sm"
                        title="Normalize legacy scopes and load into Custom Scopes for saving"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <ArrowRightLeft className="h-4 w-4" />
                          Migrate → Custom
                        </span>
                      </button>
                    </div>
                  </div>

                  <details className="mt-3">
                    <summary className="text-xs text-gray-600 cursor-pointer select-none">View scopes</summary>

                    <div className="mt-2 space-y-2">
                      <div className="rounded-xl border bg-gray-50 p-2">
                        <div className="text-[11px] text-gray-600 mb-1">Normalized</div>
                        <code className="text-[11px] text-gray-800 break-words">{normalized.join(' ')}</code>
                      </div>

                      <div className="rounded-xl border bg-gray-50 p-2">
                        <div className="text-[11px] text-gray-600 mb-1">Raw</div>
                        <code className="text-[11px] text-gray-700 break-words">{raw.join(' ')}</code>
                      </div>

                      {unknown.length ? (
                        <div className="text-[11px] text-amber-800">
                          Unknown scopes won’t match enforcement. Use “Migrate → Custom” then remove/replace unknowns.
                        </div>
                      ) : null}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Custom */}
        <section className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Custom Scopes</h2>
              <p className="text-xs text-gray-500 mt-1">Build scopes using the catalog below. Space or comma separated.</p>
            </div>
            <div className="flex items-center gap-2">
              <Pill tone={dangerScopes.length ? 'warn' : 'muted'}>{customList.length} selected</Pill>
              {dangerScopes.length ? (
                <Pill tone="danger" title="Contains privileged scopes">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {dangerScopes.length} privileged
                </Pill>
              ) : null}
            </div>
          </div>

          {/* Recommended operator presets */}
          <div className="mt-4 rounded-2xl border bg-gray-50 p-3">
            <div className="text-xs font-semibold text-gray-900">Recommended operator presets</div>
            <div className="mt-0.5 text-[11px] text-gray-600">
              Convenience templates aligned to the canonical catalog. They do not alter lib/authz presets.
            </div>

            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
              {RECOMMENDED_OPERATOR_PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => applyRecommendedPreset(p.key)}
                  className="text-left rounded-2xl border bg-white p-3 hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-gray-900">{p.title}</div>
                      <div className="mt-0.5 text-[11px] text-gray-600">{p.description}</div>
                    </div>
                    <Pill tone={p.tone === 'high' ? 'warn' : p.tone === 'med' ? 'default' : 'muted'}>
                      {p.tone === 'high' ? 'High' : p.tone === 'med' ? 'Medium' : 'Low'}
                    </Pill>
                  </div>
                  <div className="mt-2 text-[11px] text-gray-500">{p.scopes.length} scopes</div>
                </button>
              ))}
            </div>
          </div>

          {/* Validation feedback */}
          <div className="mt-4 space-y-2">
            {parsedCustom.report.changed.length ? (
              <Banner
                kind="info"
                title="Normalized legacy scope names"
                description={`Mapped ${parsedCustom.report.changed.length} token(s) to canonical names (saved form will use canonical).`}
              />
            ) : null}

            {unknownScopes.length ? (
              <Banner
                kind="warn"
                title="Unknown scopes detected"
                description={`Not in catalog: ${unknownScopes.slice(0, 8).join(', ')}${
                  unknownScopes.length > 8 ? ` (+${unknownScopes.length - 8} more)` : ''
                }`}
              />
            ) : null}

            {missingReadWarnings.length ? (
              <Banner kind="warn" title="Suggested fixes" description={missingReadWarnings.join(' ')} />
            ) : null}

            {dangerScopes.includes('reports.hard_delete') ? (
              <Banner
                kind="error"
                title="Hard delete selected"
                description="Treat reports.hard_delete as exceptional. Prefer archive + retention policies and require extra approval."
              />
            ) : null}
          </div>

          {/* Custom form */}
          <div className="mt-4">
            <form
              action={(fd: FormData) =>
                start(async () => {
                  const label = (fd.get('label') ?? 'Custom').toString();
                  const scopesRaw = (fd.get('scopes') ?? '').toString();
                  const parsed = parseScopesText(scopesRaw);

                  const out = new FormData();
                  out.set('label', label);
                  out.set('scopes', stringifyScopes(parsed.scopes));

                  await setCustomScopesByForm(out);
                  router.refresh();
                })
              }
              className="space-y-3"
            >
              <label className="block text-sm">
                <span className="text-gray-700">Label</span>
                <input
                  name="label"
                  className="mt-1 w-full rounded-xl border px-3 py-2"
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="Custom Role Name"
                />
              </label>

              <label className="block text-sm">
                <span className="text-gray-700">Scopes</span>
                <textarea
                  name="scopes"
                  className="mt-1 w-full rounded-xl border px-3 py-2 h-32 font-mono text-xs"
                  value={customScopes}
                  onChange={(e) => setCustomScopes(e.target.value)}
                  placeholder="e.g. reports.read reports.create finance.read ops.read"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {dangerScopes.slice(0, 6).map((s) => (
                    <Pill key={s} tone="danger">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {s}
                    </Pill>
                  ))}
                  {dangerScopes.length > 6 ? <Pill tone="danger">+{dangerScopes.length - 6} more</Pill> : null}
                </div>
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  className="px-3 py-2 rounded-xl bg-black text-white hover:bg-black/90 text-sm disabled:opacity-50"
                  disabled={pending}
                >
                  {pending ? 'Saving…' : 'Save custom scopes'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCustomLabel('Custom');
                    setCustomScopes('');
                    setScopeSearch('');
                  }}
                  className="px-3 py-2 rounded-xl border bg-white hover:bg-gray-50 text-sm"
                  disabled={pending}
                >
                  Reset
                </button>
              </div>
            </form>

            <div className="mt-3">
              <form
                action={() =>
                  start(async () => {
                    await clearAuthz();
                    router.refresh();
                  })
                }
              >
                <button
                  type="submit"
                  className="w-full px-3 py-2 rounded-xl border bg-white hover:bg-gray-50 text-sm disabled:opacity-50"
                  disabled={pending}
                >
                  Clear auth
                </button>
              </form>
            </div>
          </div>

          {/* Scope catalog */}
          <div className="mt-5 rounded-2xl border bg-white p-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-gray-900">Scope catalog</div>
                <div className="mt-0.5 text-[11px] text-gray-600">
                  Toggle scopes to build the custom list. These are the canonical names your APIs should enforce.
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative w-full md:w-64">
                  <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={scopeSearch}
                    onChange={(e) => setScopeSearch(e.target.value)}
                    placeholder="Search scopes…"
                    className="w-full rounded-xl border bg-white pl-9 pr-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-300"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => copyScopes(customList.join(' '))}
                  className="inline-flex items-center gap-1.5 rounded-xl border bg-white px-3 py-2 text-sm hover:bg-gray-50"
                  title="Copy current custom scopes"
                >
                  <Copy className="h-4 w-4" />
                  Copy
                </button>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {filteredGroups.map((g) => (
                <div key={g.key} className="rounded-2xl border bg-gray-50 p-3">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl border bg-white">
                        {GROUP_ICON[g.key] ?? <Shield className="h-4 w-4 text-gray-800" />}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-gray-900">{g.title}</div>
                        <div className="mt-0.5 text-[11px] text-gray-600">{g.description}</div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setGroup(g.key, 'add')}
                        className="rounded-full border bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                      >
                        Add group
                      </button>
                      <button
                        type="button"
                        onClick={() => setGroup(g.key, 'remove')}
                        className="rounded-full border bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                      >
                        Remove group
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {g.items.map((i) => {
                      const checked = customList.includes(i.scope);
                      const meta = SCOPE_META.get(i.scope);
                      return (
                        <button
                          key={i.scope}
                          type="button"
                          onClick={() => toggleScope(i.scope)}
                          className={cx(
                            'rounded-2xl border p-3 text-left transition',
                            checked ? 'bg-white border-gray-300' : 'bg-white/60 hover:bg-white border-gray-200'
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="text-xs font-semibold text-gray-900">{i.label}</div>
                                {meta?.danger ? (
                                  <Pill tone="danger">
                                    <AlertTriangle className="h-3.5 w-3.5" />
                                    Privileged
                                  </Pill>
                                ) : (
                                  <Pill tone="muted">Standard</Pill>
                                )}
                              </div>
                              <div className="mt-1 font-mono text-[11px] text-gray-700 break-words">{i.scope}</div>
                              {i.desc ? <div className="mt-1 text-[11px] text-gray-600">{i.desc}</div> : null}
                            </div>

                            <div
                              className={cx(
                                'shrink-0 h-6 w-6 rounded-full border flex items-center justify-center',
                                checked
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                  : 'bg-white border-gray-200 text-gray-300'
                              )}
                              aria-label={checked ? 'Selected' : 'Not selected'}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 text-[11px] text-gray-600">
              Enforcement plan: implement{' '}
              <span className="font-mono">
                requireScope(actor, scope, {"{ tenantId, orgId, practiceId, patientId }"})
              </span>{' '}
              in API routes, and write immutable audit events for privileged actions when admin audit is enabled.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
