const CAREPORT_ADMIN_LINKS = [
  {
    title: 'Order board',
    href: '/admin/careport/orders',
    eyebrow: 'Operations',
    description:
      'Monitor OTC marketplace and eRx fulfilment from payment capture through pharmacy preparation, dispatch and completion.',
    bullets: ['Payment pending', 'Paid and active orders', 'Rider movement', 'Completed orders'],
  },
  {
    title: 'Finance',
    href: '/admin/careport/finance',
    eyebrow: 'Settlement',
    description:
      'Preview pharmacy and rider settlement lines, generate payout batches, and mark reconciled batches as paid or failed.',
    bullets: ['Settlement preview', 'Pharmacy payouts', 'Rider payouts', 'Existing batches'],
  },
  {
    title: 'Commercial policy',
    href: '/admin/careport/commercial-policy',
    eyebrow: 'Commercial controls',
    description:
      'Configure commission, provider-fee handling, pharmacy fees, rider payout rules, settlement cycle and preflight settings.',
    bullets: ['Commission', 'Provider fees', 'Rider share', 'Medical-aid preflight'],
  },
  {
    title: 'Catalogue hub',
    href: '/admin/careport/catalogue',
    eyebrow: 'Catalogue',
    description:
      'Govern global products, SKU normalisation, taxonomy alignment and marketplace eligibility from the catalogue workspace.',
    bullets: ['Global catalogue', 'Normalisation', 'Taxonomy', 'Marketplace safety'],
  },
  {
    title: 'Catalogue normalisation',
    href: '/admin/careport/catalogue/normalisation',
    eyebrow: 'Governance',
    description:
      'Review and normalise pharmacy-uploaded SKUs against the global CarePort catalogue and local inventory rules.',
    bullets: ['SKU matching', 'Taxonomy', 'Governance', 'Review queue'],
  },
  {
    title: 'Pharmacy inventory',
    href: '/admin/careport/pharmacy-inventory',
    eyebrow: 'Provider operations',
    description:
      'Inspect pharmacy inventory surfaces, catalogue uploads, marketplace-ready stock and operational fulfilment readiness.',
    bullets: ['Inventory', 'Marketplace stock', 'Provider catalogue', 'Availability'],
  },
];

export default function CarePortAdminHubPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                CarePort admin
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
                Pharmacy, fulfilment and commercial command centre
              </h1>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
                Manage CarePort operations across OTC marketplace orders, eRx fulfilment, pharmacy inventory,
                settlement visibility, commercial policy and catalogue governance from one admin workspace.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href="/admin/careport/orders"
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Open order board
              </a>
              <a
                href="/admin/careport/finance"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Finance
              </a>
              <a
                href="/admin/careport/commercial-policy"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Commercial policy
              </a>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {CAREPORT_ADMIN_LINKS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {item.eyebrow}
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-slate-950 group-hover:text-slate-700">
                    {item.title}
                  </h2>
                </div>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
                  Open
                </span>
              </div>

              <p className="mt-3 min-h-[72px] text-sm leading-6 text-slate-600">
                {item.description}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {item.bullets.map((bullet) => (
                  <span
                    key={bullet}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600"
                  >
                    {bullet}
                  </span>
                ))}
              </div>
            </a>
          ))}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Operational flow now covered</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Patient flow
              </div>
              <p className="mt-2 text-sm text-slate-700">
                OTC marketplace, checkout reservation, Paystack payment and patient tracking.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Fulfilment flow
              </div>
              <p className="mt-2 text-sm text-slate-700">
                Pharmacy preparation, rider assignment, pickup, delivery and completion visibility.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Commercial flow
              </div>
              <p className="mt-2 text-sm text-slate-700">
                Policy controls, finance preview, payout batches and settlement reconciliation.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}