// apps/patient-app/app/fertility-report/page.tsx
import Link from 'next/link';

export default function FertilityReportPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-5 p-6">
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Fertility report
        </div>

        <h1 className="mt-2 text-2xl font-semibold text-slate-950">
          Fertility report is not connected yet
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          This page is disabled until the production fertility analytics and
          report-preview workflow is connected. No sample or demo fertility
          report will be shown.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/wellness/fertility"
            className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-black/90"
          >
            Open fertility wellness
          </Link>

          <Link
            href="/"
            className="rounded-lg border bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Back to dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}