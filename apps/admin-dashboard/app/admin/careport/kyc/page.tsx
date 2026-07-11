const KYC_LINKS = [
  {
    title: 'Pharmacy KYB / KYC review',
    href: '/admin/careport/kyc/pharmacies',
    eyebrow: 'Pharmacy governance',
    description:
      'Review pharmacy partner onboarding submissions, registration evidence, submitted KYC payloads and rejection reasons before pharmacies become operationally trusted.',
    bullets: ['Partner review', 'KYC payloads', 'Approval readiness', 'Rejection reasons'],
  },
  {
    title: 'Rider KYI review',
    href: '/admin/careport/kyc/riders',
    eyebrow: 'Rider governance',
    description:
      'Review rider identity submissions, KYI status, rejection reasons and activation readiness before riders can support CarePort pickup and delivery workflows.',
    bullets: ['Identity review', 'KYI status', 'Activation control', 'Delivery readiness'],
  },
  {
    title: 'CarePort admin hub',
    href: '/admin/careport',
    eyebrow: 'Operations',
    description:
      'Return to the main CarePort command centre for order board, finance, commercial policy, catalogue governance and pharmacy inventory controls.',
    bullets: ['Orders', 'Finance', 'Commercial policy', 'Catalogue'],
  },
];

const GOVERNANCE_STEPS = [
  {
    title: '1. Submission',
    body: 'Pharmacies and riders submit KYC or KYI data through the CarePort onboarding pathways.',
  },
  {
    title: '2. Review',
    body: 'Admins review submitted payloads, operational details, evidence fields and rejection history.',
  },
  {
    title: '3. Decision',
    body: 'Approved providers become operationally eligible; rejected providers retain a reason for remediation.',
  },
  {
    title: '4. Operational readiness',
    body: 'KYC/KYI governance protects marketplace fulfilment, rider dispatch, pharmacy trust and patient safety.',
  },
];

export default function CarePortKycHubPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                CarePort KYC governance
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
                Provider onboarding control centre
              </h1>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
                Govern pharmacy KYB/KYC and rider KYI review before partner pharmacies and riders become trusted
                participants in CarePort marketplace, eRx fulfilment, pickup and delivery operations.
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
                href="/admin/careport/kyc/pharmacies"
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Pharmacy review
              </a>
              <a
                href="/admin/careport/kyc/riders"
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Rider review
              </a>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {KYC_LINKS.map((item) => (
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

              <p className="mt-3 min-h-[120px] text-sm leading-6 text-slate-600">
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
                From submitted evidence to operational approval
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
            CarePort KYC governance should prevent unverified pharmacies and riders from becoming operationally active
            in patient-facing marketplace, prescription fulfilment, pickup or delivery workflows.
          </p>
        </section>
      </div>
    </main>
  );
}