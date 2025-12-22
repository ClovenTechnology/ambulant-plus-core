//apps/admin-dashboard/app/settings/roles/page.tsx
'use client';

import { useMemo, useState, useTransition } from 'react';
import { rolePresets } from '../../../lib/authz';
import { setRoleByForm, setCustomScopesByForm, clearAuthz } from '../../actions/authz';
import { useRouter } from 'next/navigation';

export default function RolesSettingsPage() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [customLabel, setCustomLabel] = useState('Custom');
  const [customScopes, setCustomScopes] = useState('');

  const roles = useMemo(() => Object.entries(rolePresets) as [keyof typeof rolePresets, {description: string, scopes: readonly string[]}][], []);

  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold">Roles & Access</h1>
      <p className="text-sm text-gray-600 mt-1">
        Assign a role preset or define custom scopes. Changes take effect immediately.
      </p>

      <div className="mt-5 grid lg:grid-cols-2 gap-6">
        {/* Presets */}
        <section className="rounded-2xl border bg-white p-4">
          <h2 className="text-base font-semibold">Role Presets</h2>
          <p className="text-xs text-gray-500 mb-3">Click a preset to apply.</p>

          <ul className="space-y-3">
            {roles.map(([role, cfg]) => (
              <li key={role} className="rounded-xl border p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{role}</div>
                    <div className="text-xs text-gray-500">{cfg.description}</div>
                  </div>
                  <form action={(fd: FormData) => start(async () => {
                    await setRoleByForm(fd);
                    router.refresh();
                  })}>
                    <input type="hidden" name="role" value={role} />
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-lg border bg-white hover:bg-gray-50 text-sm disabled:opacity-50"
                      disabled={pending}
                    >
                      {pending ? 'Applying…' : 'Apply'}
                    </button>
                  </form>
                </div>
                <details className="mt-2">
                  <summary className="text-xs text-gray-600 cursor-pointer">View scopes</summary>
                  <div className="mt-2">
                    <code className="text-[11px]">
                      {cfg.scopes.join(' ')}
                    </code>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>

        {/* Custom */}
        <section className="rounded-2xl border bg-white p-4">
          <h2 className="text-base font-semibold">Custom Scopes</h2>
          <p className="text-xs text-gray-500 mb-3">Space or comma separated scope list.</p>

          <form action={(fd: FormData) => start(async () => {
            await setCustomScopesByForm(fd);
            router.refresh();
          })}>
            <label className="block text-sm mb-2">
              <span className="text-gray-700">Label</span>
              <input
                name="label"
                className="mt-1 w-full rounded border px-3 py-2"
                value={customLabel}
                onChange={(e) => setCustomLabel(e.target.value)}
                placeholder="Custom Role Name"
              />
            </label>

            <label className="block text-sm">
              <span className="text-gray-700">Scopes</span>
              <textarea
                name="scopes"
                className="mt-1 w-full rounded border px-3 py-2 h-32 font-mono text-xs"
                value={customScopes}
                onChange={(e) => setCustomScopes(e.target.value)}
                placeholder="e.g. dashboard.view patients.read reports.view"
              />
            </label>

            <div className="mt-3 flex gap-2">
              <button
                type="submit"
                className="px-3 py-2 rounded bg-black text-white hover:bg-black/90 text-sm disabled:opacity-50"
                disabled={pending}
              >
                {pending ? 'Saving…' : 'Save custom scopes'}
              </button>

              <form action={() => start(async () => {
                await clearAuthz();
                router.refresh();
              })}>
                <button
                  type="submit"
                  className="px-3 py-2 rounded border bg-white hover:bg-gray-50 text-sm"
                  disabled={pending}
                >
                  Clear auth
                </button>
              </form>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
