// apps/admin-dashboard/app/admin/training-materials/page.tsx
import Link from 'next/link';
import { getSessionFromGateway } from '@/src/lib/session';
import TrainingContentManager from '../training/TrainingContentManager';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


function canonicalAuthority(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s&_.:-]+/g, '');
}

function isSuperAdminSession(session: Awaited<ReturnType<typeof getSessionFromGateway>>) {
  const roles = Array.isArray(session?.user?.roles)
    ? session.user.roles
    : [];
  const scopes = Array.isArray(session?.user?.scopes)
    ? session.user.scopes
    : [];

  const values = new Set(
    [...roles, ...scopes]
      .map(canonicalAuthority)
      .filter(Boolean),
  );

  return (
    values.has('superadmin') ||
    values.has('adminall') ||
    values.has('*')
  );
}

export default async function AdminTrainingMaterialsPage() {
  const session = await getSessionFromGateway();
  const allowPermanentPurge = isSuperAdminSession(session);

  if (!session?.authenticated) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <h1 className="text-2xl font-black text-slate-950">
          Training materials
        </h1>
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          An authenticated Admin session is required.
        </div>
        <Link
          href="/auth/signin?next=/admin/training-materials"
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
              Global governed content library
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight">
              Training materials
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-300">
              Create reusable resources once, version and publish them centrally,
              bundle them into modules, and attach those modules to training
              programmes without duplicating source content.
            </p>
          </div>

          <nav className="flex flex-wrap gap-2">
            <Link
              href="/admin/training"
              className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/15"
            >
              Training control plane
            </Link>
            <Link
              href="/admin/calendar"
              className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/15"
            >
              Training calendar
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

      <TrainingContentManager
        trainingSlotId={null}
        sessions={[]}
        allowPermanentPurge={allowPermanentPurge}
      />
    </main>
  );
}
