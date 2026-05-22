import Link from 'next/link';

const cards = [
  {
    href: '/admin/pharmacies',
    title: 'Pharmacy approvals',
    text: 'Review pharmacy KYC, approve network access, and manage pending pharmacy partners.',
  },
  {
    href: '/admin/riders',
    title: 'Rider approvals',
    text: 'Review rider KYI submissions and approve delivery access.',
  },
  {
    href: '/admin/orders',
    title: 'Order operations',
    text: 'Monitor CarePort orders, stuck workflows, pharmacy fulfilment, and dispatch progress.',
  },
  {
    href: '/admin/config',
    title: 'Configuration',
    text: 'Manage broadcast radius, expansion timing, coverage thresholds, delivery fees, and COD limits.',
  },
  {
    href: '/admin/finance',
    title: 'Finance and settlements',
    text: 'Manage commercial policy, pharmacy fees, payment-provider fees, rider payouts, and payout batches.',
  },
];

export default function CarePortAdminPage() {
  return (
    <main className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">CarePort admin</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">Operational control centre</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Manage the pharmacy network, rider network, stuck orders, fulfilment configuration, and commercial settlement from one production workspace.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="rounded-3xl border bg-white p-5 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/30">
            <h2 className="text-lg font-semibold text-slate-950">{card.title}</h2>
            <p className="mt-2 text-sm text-slate-600">{card.text}</p>
            <div className="mt-4 text-sm font-semibold text-emerald-700">Open →</div>
          </Link>
        ))}
      </section>
    </main>
  );
}