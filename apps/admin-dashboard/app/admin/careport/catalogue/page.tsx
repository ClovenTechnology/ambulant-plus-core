const CATALOGUE_LINKS = [
  {
    title: 'Global product catalogue',
    href: '/admin/careport/catalogue/global-products',
    eyebrow: 'Canonical layer',
    description:
      'Inspect the canonical product layer created from pharmacy-supplied SKUs, including NAPPI, RxNorm, barcode and marketplace visibility signals.',
    bullets: ['Canonical products', 'OTC visibility', 'Prescription flags', 'Product governance'],
  },
  {
    title: 'Catalogue normalisation',
    href: '/admin/careport/catalogue/normalisation',
    eyebrow: 'Governance queue',
    description:
      'Review pharmacy-uploaded SKUs, map products to canonical records, verify matches, reject unsafe entries and manage review-required inventory.',
    bullets: ['Review queue', 'SKU matching', 'Admin verification', 'Rejected items'],
  },
  {
    title: 'Pharmacy inventory',
    href: '/admin/careport/pharmacy-inventory',
    eyebrow: 'Provider catalogue',
    description:
      'Create and import pharmacy SKUs against the CarePort taxonomy, with every save flowing into catalogue normalisation governance.',
    bullets: ['Inventory import', 'Taxonomy headers', 'Marketplace stock', 'Provider readiness'],
  },
];

const GOVERNANCE_STEPS = [
  {
    title: '1. Pharmacy SKU capture',
    body: 'Pharmacy stock is created or imported with product type, category, OTC/prescription flags, pricing and marketplace controls.',
  },
  {
    title: '2. Taxonomy normalisation',
    body: 'Uploaded SKUs are standardised against CarePort taxonomy values while still allowing custom local attributes where needed.',
  },
  {
    title: '3. Global catalogue matching',
    body: 'Suitable products are mapped to canonical global product records using names, codes, barcodes, NAPPI, RxNorm and review decisions.',
  },
  {
    title: '4. Marketplace eligibility',
    body: 'Only safe, approved and marketplace-allowed items should become visible to patients for OTC purchase or fulfilment workflows.',
  },
];

export default function CarePortCatalogueHubPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                CarePort catalogue
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
                Catalogue governance command centre
              </h1>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
                Govern the full CarePort product catalogue pathway: pharmacy inventory intake, taxonomy alignment,
                global product matching, OTC marketplace visibility and prescription-only fulfilment separation.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href="/admin/careport"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                CarePort hub
              </a>
              <a
                href="/admin/careport/catalogue/global-products"
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Global catalogue
              </a>
              <a
                href="/admin/careport/catalogue/normalisation"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Normalisation queue
              </a>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {CATALOGUE_LINKS.map((item) => (
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

              <p className="mt-3 min-h-[96px] text-sm leading-6 text-slate-600">
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
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Governance pathway
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">
                From local pharmacy stock to patient-facing marketplace safety
              </h2>
            </div>
            <a
              href="/admin/careport/orders"
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              View order board
            </a>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {GOVERNANCE_STEPS.map((step) => (
              <div key={step.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-semibold text-slate-950">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-amber-950">Safety principle</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-amber-900">
            CarePort catalogue governance should keep prescription-required products out of the patient OTC marketplace,
            while allowing safe non-prescription medication and non-medication merchandise to become visible only after
            pharmacy inventory, taxonomy and normalisation controls are satisfied.
          </p>
        </section>
      </div>
    </main>
  );
}