// apps/admin-dashboard/app/admin/training/page.tsx
import Link from 'next/link';
import {getSessionFromGateway} from '@/src/lib/session';
import TrainingControlPlaneClient from './TrainingControlPlaneClient';
import OnboardingSettingsPanel from '../clinicians/onboarding/OnboardingSettingsPanel';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function AdminTrainingPage() {
  const session =
    await getSessionFromGateway();

  if (!session?.authenticated) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <h1 className="text-2xl font-black text-slate-950">
          Training control plane
        </h1>
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          An authenticated Admin session is required.
        </div>
        <Link
          href="/auth/signin?next=/admin/training"
          className="mt-4 inline-flex rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white"
        >
          Sign in
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1600px] space-y-7 p-4 sm:p-6">
      <header className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.2em] text-indigo-200">
              Clinician onboarding operations
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight">
              Training control plane
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">
              Create multi-day programmes, allocate one or more sessions per day, set capacity and booking windows, then publish eligible slots directly to clinicians.
            </p>
          </div>

          <nav className="flex flex-wrap gap-2">
            <Link
              href="/admin/clinicians/onboarding"
              className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/15"
            >
              Onboarding board
            </Link>
            <Link
              href="/admin/calendar"
              className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/15"
            >
              Training calendar
            </Link>
            <Link
              href="/admin/legal"
              className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/15"
            >
              Legal notices
            </Link>
          </nav>
        </div>

        <div className="mt-5 border-t border-white/10 pt-4 text-xs text-slate-400">
          Signed in as{' '}
          <span className="font-bold text-slate-200">
            {session.user?.email || 'Admin'}
          </span>
        </div>
      </header>

      <TrainingControlPlaneClient />

      <section>
        <div className="mb-3">
          <h2 className="text-xl font-black text-slate-950">
            Commercial and training policy
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Configure programme defaults, modes, payment pathways, privileges, notices and C-Med fulfilment.
          </p>
        </div>
        <OnboardingSettingsPanel />
      </section>
    </main>
  );
}
