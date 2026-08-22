import Link from 'next/link';

export const metadata = {
  title: 'Clinical Cases | Ambulant+ Admin',
};

export default function ClinicalCasesReadinessPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
          Longitudinal clinical continuity
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950">
          Clinical Cases
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-600">
          A Case is the longitudinal clinical container. One Case may contain
          one or more encounters, investigations, prescriptions, orders,
          follow-ups and escalation events.
        </p>
      </header>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-amber-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-amber-800">
            READINESS
          </span>
          <span className="text-sm font-semibold text-amber-950">
            Persistent longitudinal Case authority is not activated yet
          </span>
        </div>

        <p className="mt-3 text-sm leading-7 text-amber-900">
          The current Gateway exposes case routes, but the exact production
          schema authority captured for this sweep does not contain a persisted
          Case model. Encounters carry a caseId scalar and legacy compatibility
          code can synthesize case identifiers when a Case delegate is absent.
        </p>

        <p className="mt-3 text-sm leading-7 text-amber-900">
          For safety, this page does not present synthetic encounter groupings
          as genuine longitudinal Cases. The next schema-bearing sprint will
          introduce the persistent Case authority, migrate compatible encounter
          relationships and then replace this readiness surface with the real
          searchable register.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Link
          href="/patients"
          className="rounded-2xl border bg-white p-5 shadow-sm"
        >
          <div className="text-sm font-semibold text-gray-950">
            Patients
          </div>
          <div className="mt-2 text-xs leading-6 text-gray-600">
            Review current patient operational context.
          </div>
        </Link>

        <Link
          href="/orders"
          className="rounded-2xl border bg-white p-5 shadow-sm"
        >
          <div className="text-sm font-semibold text-gray-950">
            Orders
          </div>
          <div className="mt-2 text-xs leading-6 text-gray-600">
            Review existing encounter-linked CarePort and MedReach orders.
          </div>
        </Link>

        <Link
          href="/analytics/medical"
          className="rounded-2xl border bg-white p-5 shadow-sm"
        >
          <div className="text-sm font-semibold text-gray-950">
            Medical analytics
          </div>
          <div className="mt-2 text-xs leading-6 text-gray-600">
            Review current clinical and syndromic operational intelligence.
          </div>
        </Link>
      </section>

      <section className="rounded-2xl border bg-slate-50 p-5">
        <div className="text-sm font-semibold text-gray-950">
          Locked target structure
        </div>
        <pre className="mt-3 overflow-x-auto rounded-xl border bg-white p-4 text-xs leading-6 text-gray-700">
{`/cases
  → case register
/cases/[caseId]
  → longitudinal case timeline
/cases/[caseId]/encounters/[encounterId]
  → individual encounter detail`}
        </pre>
      </section>
    </main>
  );
}
