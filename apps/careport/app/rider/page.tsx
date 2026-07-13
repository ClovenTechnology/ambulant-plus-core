import Link from 'next/link';

export default function RiderHomePage() {
  return (
    <main className="space-y-6">
      <section className="rounded-3xl border bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Rider workspace</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">CarePort delivery console</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Manage assigned deliveries, submit rider identity verification, share live location, confirm pickup, and complete proof of delivery.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Link href="/rider/kyi" className="rounded-3xl border bg-white p-5 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/30">
          <div className="text-sm font-semibold text-slate-950">Rider verification</div>
          <p className="mt-2 text-sm text-slate-600">Submit or review KYI status before accepting delivery work.</p>
          <div className="mt-4 text-sm font-medium text-indigo-700">Open KYI →</div>
        </Link>

        <Link href="/rider/jobs" className="rounded-3xl border bg-white p-5 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50/30">
          <div className="text-sm font-semibold text-slate-950">Assigned jobs</div>
          <p className="mt-2 text-sm text-slate-600">View pickup, delivery, and handover steps for live CarePort jobs.</p>
          <div className="mt-4 text-sm font-medium text-indigo-700">Open jobs →</div>
        </Link>

        <Link href="/rider/pharmacy" className="rounded-3xl border bg-white p-5 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/30">
          <div className="text-sm font-semibold text-slate-950">Pharmacy pickup directory</div>
          <p className="mt-2 text-sm text-slate-600">Switch to pharmacy operations if you are pharmacy staff.</p>
          <div className="mt-4 text-sm font-medium text-emerald-700">Open pickup directory →</div>
        </Link>
      </section>
    </main>
  );
}
