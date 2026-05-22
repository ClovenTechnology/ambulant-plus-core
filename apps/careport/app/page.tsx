// apps/careport/app/page.tsx
import { ArrowRightIcon, BuildingStorefrontIcon, ShieldCheckIcon, TruckIcon } from '@heroicons/react/24/outline';

const tiles = [
  {
    href: '/pharmacy',
    title: 'Pharmacy workspace',
    description: 'Review CarePort invitations, respond with availability, manage dispensing, and prepare pickup or delivery orders.',
    icon: BuildingStorefrontIcon,
    tone: 'text-teal-700 bg-teal-50 ring-teal-100',
    cta: 'Open pharmacy workspace',
  },
  {
    href: '/rider',
    title: 'Rider console',
    description: 'View assigned jobs, update delivery milestones, and keep patients informed with live delivery state.',
    icon: TruckIcon,
    tone: 'text-indigo-700 bg-indigo-50 ring-indigo-100',
    cta: 'Open rider jobs',
  },
  {
    href: '/pharmacy/offers',
    title: 'Incoming pharmacy requests',
    description: 'Respond to patient eRx requests only when stock coverage and fulfilment mode are clinically sensible.',
    icon: ShieldCheckIcon,
    tone: 'text-emerald-700 bg-emerald-50 ring-emerald-100',
    cta: 'Review invitations',
  },
];

export default function CarePortHome() {
  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 text-white shadow-xl">
        <div className="p-6 md:p-8">
          <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-teal-50">
            CarePort Operations
          </div>
          <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight md:text-4xl">
            Pharmacy and last-mile fulfilment for contactless medicine.
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200">
            This operational app is for pharmacies, riders, and CarePort operations teams. Patient order creation and marketplace choice happen in the patient app; this workspace handles verified pharmacy responses, stock availability, fulfilment, and dispatch.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {tiles.map((tile) => {
          const Icon = tile.icon;
          return (
            <a
              key={tile.href}
              href={tile.href}
              className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <div className={`inline-flex rounded-2xl p-3 ring-1 ${tile.tone}`}>
                <Icon className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-base font-semibold text-slate-950">{tile.title}</h2>
              <p className="mt-2 min-h-[72px] text-sm leading-6 text-slate-600">{tile.description}</p>
              <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-teal-700">
                {tile.cta}
                <ArrowRightIcon className="h-4 w-4 transition group-hover:translate-x-1" />
              </div>
            </a>
          );
        })}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Fulfilment policy</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xl font-semibold text-slate-950">10 km</div>
            <div className="mt-1 text-xs text-slate-500">Initial invitation radius</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xl font-semibold text-slate-950">3 min</div>
            <div className="mt-1 text-xs text-slate-500">Expansion interval</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xl font-semibold text-slate-950">60%+</div>
            <div className="mt-1 text-xs text-slate-500">Minimum stock coverage</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xl font-semibold text-slate-950">Patient</div>
            <div className="mt-1 text-xs text-slate-500">Makes final pharmacy choice</div>
          </div>
        </div>
      </section>
    </main>
  );
}
