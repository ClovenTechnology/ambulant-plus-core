import Link from 'next/link';

export const metadata = {
  title: 'Consult Control Center | Ambulant+ Admin',
};

const SURFACES = [
  {
    href: '/consult/policy',
    title: 'Consultation policy',
    body: 'Review consultation workflow and policy controls.',
  },
  {
    href: '/settings/consult',
    title: 'Consult engine settings',
    body: 'Manage minimum duration, join grace windows and post-consult buffers.',
  },
  {
    href: '/cases',
    title: 'Clinical cases',
    body: 'Longitudinal case authority and encounter continuity.',
  },
  {
    href: '/admin/forms',
    title: 'Enterprise forms',
    body: 'Governed clinical and operational forms that support care workflows.',
  },
  {
    href: '/admin/meetings',
    title: 'Meetings',
    body: 'Internal and governed meeting workflows separate from patient consultations.',
  },
];

export default function ConsultControlCenterPage() {
  return (
    <main className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="rounded-3xl border bg-white p-6 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
          Clinical operations
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950">
          Consult Control Center
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-600">
          Administrative entry point for consultation policy, timing rules,
          case continuity and governed supporting workflows. This page does not
          create a second booking or consultation authority.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {SURFACES.map((surface) => (
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
              Open →
            </div>
          </Link>
        ))}
      </section>

      <section className="rounded-2xl border bg-slate-50 p-5">
        <div className="text-sm font-semibold text-gray-950">
          Architecture invariant
        </div>
        <p className="mt-2 text-xs leading-6 text-gray-700">
          Appointment scheduling, consultation admission, RTC sessions and
          clinical encounter state must continue to use their existing canonical
          authorities. This control center is navigation and governance, not a
          shadow consultation engine.
        </p>
      </section>
    </main>
  );
}
