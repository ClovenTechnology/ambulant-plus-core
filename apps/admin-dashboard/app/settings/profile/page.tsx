// apps/admin-dashboard/app/settings/profile/page.tsx
import Link from 'next/link';
import {
  BriefcaseBusiness,
  History,
  KeyRound,
  ShieldCheck,
  UserRoundCog,
} from 'lucide-react';
import { getSessionFromGateway } from '../../../src/lib/session';
import { StaffPasswordForm } from '@/components/StaffPasswordForm';
import { StaffEmploymentWorkspace } from '@/components/StaffEmploymentWorkspace';

export const metadata = {
  title: 'My Profile',
};

function SummaryCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-2 break-words text-sm font-semibold text-slate-900">
        {value}
      </div>
      <div className="mt-2 text-xs leading-5 text-slate-500">
        {helper}
      </div>
    </div>
  );
}

export default async function ProfilePage() {
  const session = await getSessionFromGateway();
  const profile = session.user;
  const profileId = String(profile?.profileId || '').trim();
  const scopes = Array.from(new Set(session.user?.scopes || [])).sort();
  const roles = Array.from(new Set(profile?.roles || [])).sort();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
                <UserRoundCog className="h-4 w-4" />
                Ambulant+ People
              </div>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
                My Profile
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Your Staff identity, employment self-service, payroll and bank visibility,
                security controls and your own Admin activity intelligence in one governed workspace.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {profileId ? (
                <Link
                  href={`/admin/staff/${encodeURIComponent(profileId)}`}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Open full Staff record
                </Link>
              ) : null}
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Identity"
            value={profile?.name || profile?.email || 'Staff member'}
            helper={profile?.email || 'No email returned by the current session.'}
          />
          <SummaryCard
            label="Staff profile"
            value={profileId || 'Not resolved'}
            helper="Canonical AdminUserProfile identifier used across Staff self-service."
          />
          <SummaryCard
            label="Effective roles"
            value={roles.length ? roles.join(', ') : 'No roles returned'}
            helper="Derived from authorised designation and direct RBAC assignments."
          />
          <SummaryCard
            label="Effective scopes"
            value={String(scopes.length)}
            helper="Capabilities are enforced server-side; this count is informational."
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-teal-700" />
              <h2 className="text-lg font-semibold text-slate-950">
                Access & governance
              </h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Roles and scopes cannot be changed from self-service. Department,
              designation, reporting line and RBAC assignments remain controlled by
              authorised HR or role administrators.
            </p>

            <div className="mt-4 rounded-2xl bg-slate-50 p-4">
              {scopes.length === 0 ? (
                <div className="text-sm text-slate-600">No scopes returned.</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {scopes.map((scope) => (
                    <span
                      key={scope}
                      className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
                    >
                      {scope}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <History className="h-4 w-4" />
                  My activity
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Your own Staff Activity Intelligence is available below. Manager,
                  HR and audit access to another Staff member remains separately governed.
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <BriefcaseBusiness className="h-4 w-4" />
                  Audit history
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Governance audit trails are not ordinary self-service telemetry.
                  They remain restricted to authorised HR, compliance/audit or Super Admin access.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-teal-700" />
              <h2 className="text-lg font-semibold text-slate-950">
                Security
              </h2>
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Change the password used for your Ambulant+ Staff sign-in. Credential
              changes remain separate from role and organisational authority.
            </p>
            <div className="mt-4">
              <StaffPasswordForm />
            </div>
          </section>
        </section>

        {profileId ? (
          <section>
            <div className="mb-3">
              <h2 className="text-xl font-bold text-slate-950">
                Employment & self-service
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                This reuses the canonical Staff employment workspace. Sensitive fields
                appear only when your effective permissions allow them.
              </p>
            </div>
            <StaffEmploymentWorkspace staffProfileId={profileId} />
          </section>
        ) : (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
            Your Staff profile identifier could not be resolved, so employment self-service
            cannot be loaded in this session.
          </section>
        )}
      </div>
    </main>
  );
}
