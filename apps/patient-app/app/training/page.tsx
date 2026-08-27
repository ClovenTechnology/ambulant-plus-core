import PatientTrainingInvitations from './PatientTrainingInvitations';

export const dynamic = 'force-dynamic';

export default function PatientTrainingPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="rounded-3xl bg-gradient-to-r from-emerald-950 to-slate-950 p-6 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Training &amp; simulation</p>
          <h1 className="mt-2 text-3xl font-black">Training &amp; simulation</h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-emerald-50/80">Manage invited training participation and scheduled contactless medicine simulation sessions from one place. Fresh room admission is issued only when you enter an authorised session.</p>
        </header>
        <PatientTrainingInvitations />
      </div>
    </main>
  );
}
