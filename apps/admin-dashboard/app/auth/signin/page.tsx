// apps/admin-dashboard/app/auth/signin/page.tsx
import AdminSignIn from '../../../components/AdminSignIn';

export const metadata = { title: 'Admin Sign In' };

export default function SignInPage() {
  return (
    <main className="min-h-[calc(100vh-64px)] bg-gradient-to-b from-gray-50 to-white">
      <section className="mx-auto max-w-5xl px-6 py-10">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="text-sm text-gray-600">
            Sign in to manage operations, clinicians, analytics, and more.
          </p>
        </header>

        <div className="grid items-start gap-8 lg:grid-cols-[1fr_420px]">
          <div className="rounded-2xl border bg-white p-6">
            <h2 className="text-base font-semibold">Access levels at a glance</h2>
            <ul className="mt-3 grid gap-2 text-sm text-gray-700">
              <li>• <b>Super Admin</b>: Full platform control</li>
              <li>• <b>Admin</b>: Operational administration</li>
              <li>• <b>Medical</b>: Clinical data & care ops</li>
              <li>• <b>Tech & IT</b>: Devices, SDK, InsightCore</li>
              <li>• <b>Finance</b>: Payouts, orders & analytics</li>
              <li>• <b>HR</b>: People administration</li>
              <li>• <b>Compliance</b>: Read-only oversight</li>
              <li>• <b>Reports & Research</b>: Data insights</li>
              <li>• <b>R&D</b>: Experiments & innovation</li>
            </ul>

            <div className="mt-4 rounded-xl border bg-gray-50 p-4 text-xs text-gray-600">
              Your access is enforced by middleware at request time and by server actions on writes.
            </div>
          </div>

          <div className="lg:sticky lg:top-8">
            <AdminSignIn />
            <div className="mt-3 text-center">
              <a href="/" className="text-sm text-blue-600 hover:underline">Back to dashboard</a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
