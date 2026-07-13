import Link from "next/link";

const roleCards = [
  {
    title: "Pharmacy operations",
    description:
      "Manage pharmacy readiness, inventory, offers, active orders, fulfilment handover and settlement visibility.",
    href: "/pharmacy",
    cta: "Open pharmacy workspace",
    items: ["Inventory", "Offers", "Orders", "Payouts"],
  },
  {
    title: "Rider operations",
    description:
      "Track rider KYI, assigned jobs, pharmacy pickup, medicine handover, proof of delivery and payout readiness.",
    href: "/rider",
    cta: "Open rider workspace",
    items: ["KYI", "Jobs", "Pickup", "Delivery"],
  },
  {
    title: "Admin command",
    description:
      "Review CarePort configuration, partner governance, finance, pharmacy/rider oversight and operational queues.",
    href: "/admin",
    cta: "Open admin tools",
    items: ["Config", "Finance", "Orders", "Partners"],
  },
];

const operatingPrinciples = [
  "Applications are reviewed before partners go live.",
  "Only approved pharmacies should fulfil CarePort orders.",
  "Only approved riders should receive medicine delivery jobs.",
  "Payout readiness remains separate from application submission.",
];

export default function CarePortHomePage() {
  return (
    <section data-a4p1="careport-shell-home" className="space-y-6">
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white shadow-xl">
        <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6 p-6 sm:p-8 lg:p-10">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-emerald-700">
                Ambulant+ CarePort
              </p>
              <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">
                Pharmacy fulfilment and rider delivery operations.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                CarePort coordinates pharmacy inventory, eRx fulfilment, OTC marketplace orders,
                rider pickup, delivery status, settlement readiness and operational governance.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/overview"
                className="rounded-2xl bg-emerald-700 px-5 py-3 text-center text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800"
              >
                View CarePort overview
              </Link>
              <Link
                href="/pharmacy"
                className="rounded-2xl border border-slate-200 px-5 py-3 text-center text-sm font-bold text-slate-800 transition hover:bg-slate-50"
              >
                Pharmacy workspace
              </Link>
              <Link
                href="/rider"
                className="rounded-2xl border border-slate-200 px-5 py-3 text-center text-sm font-bold text-slate-800 transition hover:bg-slate-50"
              >
                Rider workspace
              </Link>
            </div>
          </div>

          <div className="bg-slate-950 p-6 text-white sm:p-8 lg:p-10">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-emerald-200">
                Partner activation rule
              </p>
              <h2 className="mt-3 text-2xl font-black">Reviewed before live operations</h2>
              <div className="mt-5 space-y-3">
                {operatingPrinciples.map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-slate-100">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {roleCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg"
          >
            <h2 className="text-lg font-black text-slate-950">{card.title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{card.description}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {card.items.map((item) => (
                <span key={item} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                  {item}
                </span>
              ))}
            </div>
            <div className="mt-6 text-sm font-black text-emerald-700 group-hover:text-emerald-800">
              {card.cta} →
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
