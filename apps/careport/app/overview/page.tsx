import Link from "next/link";

const sections = [
  {
    title: "Pharmacy fulfilment",
    description: "Inventory, marketplace orders, eRx fulfilment, generic links and pharmacy settlement readiness.",
    links: [
      { href: "/pharmacy/inventory", label: "Inventory" },
      { href: "/pharmacy/offers", label: "Offers" },
      { href: "/pharmacy/orders", label: "Orders" },
      { href: "/admin/pharmacies/payouts", label: "Payouts" },
    ],
  },
  {
    title: "Rider delivery",
    description: "KYI readiness, assigned jobs, pharmacy pickup, proof of delivery and rider settlement visibility.",
    links: [
      { href: "/rider/kyi", label: "KYI" },
      { href: "/rider/jobs", label: "Jobs" },
      { href: "/rider/pharmacy", label: "Pharmacy pickup" },
      { href: "/admin/riders/payouts", label: "Payouts" },
    ],
  },
  {
    title: "Admin operations",
    description: "Operational configuration, order board, finance policy, pharmacy oversight and rider oversight.",
    links: [
      { href: "/admin/config", label: "Config" },
      { href: "/admin/orders", label: "Orders" },
      { href: "/admin/finance", label: "Finance" },
      { href: "/admin/pharmacies", label: "Pharmacies" },
      { href: "/admin/riders", label: "Riders" },
    ],
  },
];

export default function CarePortOverviewPage() {
  return (
    <section data-a4p1="careport-overview" className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-700">
          CarePort overview
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
          Partner operations command surface
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Use this overview as the clean entry point for CarePort pharmacy, rider and admin workflows.
          It prevents dead-end navigation and gives each partner role a clear operational path.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {sections.map((section) => (
          <article key={section.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">{section.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{section.description}</p>
            <div className="mt-5 flex flex-col gap-2">
              {section.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-800 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
