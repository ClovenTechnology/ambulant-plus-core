import Link from 'next/link';

export const metadata = {
  title: 'Reports | Ambulant+ Admin',
};

const REPORT_SURFACES = [
  {
    href: '/analytics',
    title: 'Platform analytics',
    body: 'Cross-platform operational, revenue and partner analytics.',
  },
  {
    href: '/analytics/medical',
    title: 'Medical & syndromic analytics',
    body: 'Clinical, diagnostic and InsightCore-supported population signals.',
  },
  {
    href: '/analytics/clinicians',
    title: 'Clinician analytics',
    body: 'Clinician activity, utilisation, performance and operational trends.',
  },
  {
    href: '/analytics/labs',
    title: 'Laboratory analytics',
    body: 'Laboratory activity and diagnostic operations reporting.',
  },
  {
    href: '/analytics/patient-engagement',
    title: 'Patient engagement',
    body: 'Activation, retention, feature use and adherence-oriented reporting.',
  },
  {
    href: '/insightcore',
    title: 'InsightCore intelligence',
    body: 'Clinical-intelligence runtime, cohort, evaluation and governance signals.',
  },
  {
    href: '/admin/enterprise-finance',
    title: 'Enterprise Finance',
    body: 'Finance command centre, payroll, expenditure and enterprise reporting.',
  },
];

export default function ReportsHubPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
          Admin reporting
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950">
          Reports &amp; Research Hub
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-600">
          One entry point for the reporting surfaces that already exist across
          Ambulant+. The current Gateway authority does not expose a standalone
          <code className="mx-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs">
            /api/reports
          </code>
          service, so this page does not invent report data or fake exports.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {REPORT_SURFACES.map((surface) => (
          <Link
            key={surface.href}
            href={surface.href}
            className="rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <h2 className="text-sm font-semibold text-gray-950">
              {surface.title}
            </h2>
            <p className="mt-2 text-xs leading-6 text-gray-600">
              {surface.body}
            </p>
            <div className="mt-4 text-xs font-medium text-teal-700">
              Open surface →
            </div>
          </Link>
        ))}
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <div className="text-sm font-semibold text-amber-950">
          Developer note — dedicated report artifacts
        </div>
        <p className="mt-2 text-xs leading-6 text-amber-900">
          READINESS: a future governed report service should own scheduled
          reports, saved report definitions, exports, immutable generated
          artifacts and report-level audit history. Until that authority exists,
          this hub points only to real existing data surfaces.
        </p>
      </section>
    </main>
  );
}
