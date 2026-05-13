// apps/admin-dashboard/app/auth/signin/page.tsx
import { Suspense } from 'react';
import Link from 'next/link';
import AdminSignIn from '../../../components/AdminSignIn';

export const metadata = {
  title: 'Sign in | Ambulant+ Admin',
};

export const dynamic = 'force-dynamic';

function SignInFallback() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="h-5 w-32 animate-pulse rounded bg-slate-100" />
      <div className="mt-4 h-10 w-full animate-pulse rounded-lg bg-slate-100" />
      <div className="mt-3 h-10 w-full animate-pulse rounded-lg bg-slate-100" />
    </div>
  );
}

export default function SignInPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#eff6ff,transparent_34%),linear-gradient(to_bottom,#f8fafc,#ffffff)]">
      <section className="mx-auto flex min-h-screen max-w-6xl items-center px-6 py-10">
        <div className="grid w-full items-center gap-10 lg:grid-cols-[1fr_430px]">
          <div className="max-w-2xl">
            <div className="mb-6 inline-flex rounded-full border border-blue-100 bg-white/80 px-3 py-1 text-xs font-medium text-blue-700 shadow-sm">
              Ambulant+ Admin Console
            </div>

            <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Secure operational access for your care network.
            </h1>

            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
              Sign in to manage clinicians, onboarding, training, payouts,
              CarePort, MedReach, devices, analytics, and platform settings.
            </p>

            <div className="mt-8 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                <div className="font-semibold text-slate-900">Role-based</div>
                <div className="mt-1 text-xs leading-5">
                  Access is scoped by your admin permissions.
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                <div className="font-semibold text-slate-900">Auditable</div>
                <div className="mt-1 text-xs leading-5">
                  Sensitive actions should be traceable.
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
                <div className="font-semibold text-slate-900">Production</div>
                <div className="mt-1 text-xs leading-5">
                  Connected to the API Gateway.
                </div>
              </div>
            </div>
          </div>

          <div className="w-full">
            <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-xl shadow-slate-200/70 backdrop-blur">
              <div className="mb-5">
                <h2 className="text-xl font-semibold text-slate-950">
                  Sign in
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Use your authorised admin credentials.
                </p>
              </div>

              <Suspense fallback={<SignInFallback />}>
                <AdminSignIn />
              </Suspense>

              <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs leading-5 text-slate-500">
                Access is monitored. Only authorised Ambulant+ administrators
                should continue.
              </div>
            </div>

            <div className="mt-4 text-center">
              <Link href="/" className="text-sm text-blue-700 hover:underline">
                Back to dashboard
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}