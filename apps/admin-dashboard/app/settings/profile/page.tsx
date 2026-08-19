// apps/admin-dashboard/app/settings/profile/page.tsx
import Link from 'next/link';
import { getSessionFromGateway } from '../../../src/lib/session';
import { StaffPasswordForm } from '@/components/StaffPasswordForm';

export const metadata = {
  title: 'My Profile',
};

export default async function ProfilePage() {
  const session =
    await getSessionFromGateway();

  const profile =
    session.user;

  const scopes =
    new Set(
      session.user?.scopes || [],
    );

  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold">
        My Profile
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        Your Staff identity, self-service workspace and security settings.
      </p>

      <div className="mt-5 grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border bg-white p-4">
          <h2 className="text-base font-semibold">
            Account
          </h2>

          <div className="mt-3 grid gap-2 text-sm">
            <div>
              <span className="text-gray-500">
                Name:
              </span>{' '}
              <span className="font-medium">
                {profile?.name || '—'}
              </span>
            </div>

            <div>
              <span className="text-gray-500">
                Email:
              </span>{' '}
              <span className="font-medium">
                {profile?.email || '—'}
              </span>
            </div>

            <div>
              <span className="text-gray-500">
                Effective roles:
              </span>{' '}
              <span className="font-medium">
                {profile?.roles?.join(', ') ||
                  '—'}
              </span>
            </div>
          </div>

          {profile?.profileId ? (
            <Link
              href={`/admin/staff/${encodeURIComponent(profile.profileId)}`}
              className="mt-4 inline-block rounded-xl bg-slate-950 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
            >
              Open my Staff workspace
            </Link>
          ) : (
            <div className="mt-4 text-sm text-amber-700">
              Your Staff profile identifier could not be resolved.
            </div>
          )}

          <form
            action="/auth/signout"
            method="post"
            className="mt-4"
          >
            <button
              type="submit"
              className="rounded border bg-white px-3 py-2 text-sm hover:bg-gray-50"
            >
              Sign out
            </button>
          </form>
        </section>

        <section className="rounded-2xl border bg-white p-4">
          <h2 className="text-base font-semibold">
            Access
          </h2>

          <p className="text-xs text-gray-500">
            Effective permissions are derived from your designation roles and
            any direct RBAC roles assigned by an authorised administrator.
          </p>

          <div className="mt-3">
            {scopes.size === 0 ? (
              <div className="text-sm text-gray-600">
                No scopes found.
              </div>
            ) : (
              <div className="text-xs font-mono break-words">
                {Array.from(scopes)
                  .sort()
                  .join(' ')}
              </div>
            )}
          </div>

          <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
            Roles and scopes cannot be changed from self-service. Department,
            designation, reporting line and RBAC assignments are controlled by
            authorised HR or role administrators.
          </div>
        </section>

        <StaffPasswordForm />
      </div>
    </main>
  );
}
