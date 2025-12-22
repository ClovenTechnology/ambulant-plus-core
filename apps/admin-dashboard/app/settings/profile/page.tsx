//apps/admin-dashboard/app/settings/profile/page.tsx
import { cookies } from 'next/headers';
import { NEXT_AUTHZ_COOKIE, NEXT_PROFILE_COOKIE, parseAuthzCookie, parseProfileCookie, normalizeScopes } from '../../../lib/authz';
import { clearAuthz } from '../../actions/authz';

export const metadata = {
  title: 'My Profile',
};

export default async function ProfilePage() {
  const rawAuth = cookies().get(NEXT_AUTHZ_COOKIE)?.value;
  const rawProf = cookies().get(NEXT_PROFILE_COOKIE)?.value;

  const authz = parseAuthzCookie(rawAuth);
  const profile = parseProfileCookie(rawProf);
  const scopes = normalizeScopes(authz?.scopes || []);

  async function signOut() {
    'use server';
    await clearAuthz();
  }

  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold">My Profile</h1>
      <p className="text-sm text-gray-600 mt-1">View your account details and access.</p>

      <div className="mt-5 grid md:grid-cols-2 gap-6">
        <section className="rounded-2xl border bg-white p-4">
          <h2 className="text-base font-semibold">Account</h2>
          <div className="mt-3 grid gap-2 text-sm">
            <div><span className="text-gray-500">Name:</span> <span className="font-medium">{profile?.name || '—'}</span></div>
            <div><span className="text-gray-500">Email:</span> <span className="font-medium">{profile?.email || '—'}</span></div>
            <div><span className="text-gray-500">Role:</span> <span className="font-medium">{authz?.role || '—'}</span></div>
          </div>

          <form action={signOut} className="mt-4">
            <button className="px-3 py-2 rounded border bg-white hover:bg-gray-50 text-sm">
              Sign out (clear auth)
            </button>
          </form>
        </section>

        <section className="rounded-2xl border bg-white p-4">
          <h2 className="text-base font-semibold">Scopes</h2>
          <p className="text-xs text-gray-500">Effective access derived from your current role.</p>
          <div className="mt-3">
            {scopes.size === 0 ? (
              <div className="text-sm text-gray-600">No scopes found.</div>
            ) : (
              <div className="text-xs font-mono break-words">
                {[...scopes].sort().join(' ')}
              </div>
            )}
          </div>
          <div className="mt-3">
            <a href="/settings/roles" className="inline-block px-3 py-2 rounded bg-black text-white hover:bg-black/90 text-sm">
              Manage my role
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
