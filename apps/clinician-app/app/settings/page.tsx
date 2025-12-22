// apps/clinician-app/app/settings/page.tsx
'use client';

import { useRouter, usePathname } from 'next/navigation';

const SETTINGS_TABS = [
  { href: '/settings/profile', label: 'Profile' },
  { href: '/settings/schedule', label: 'Schedule' },
  { href: '/settings/consult', label: 'Consult' },
  { href: '/settings/fees', label: 'Fees' },
  { href: '/payout', label: 'Payout & Plan' },
];

export default function ClinicianSettingsHomePage() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <nav className="border-b border-gray-200 mb-2 flex flex-wrap gap-2">
        {SETTINGS_TABS.map((tab) => {
          const active =
            pathname === tab.href ||
            (tab.href === '/settings/profile' &&
              (pathname === '/settings' || pathname === '/settings/profile'));
          return (
            <button
              key={tab.href}
              type="button"
              onClick={() => router.push(tab.href)}
              className={
                'px-3 py-2 text-xs font-medium border-b-2 -mb-px transition ' +
                (active
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-black hover:border-gray-300')
              }
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">
          Settings
        </h1>
        <p className="text-sm text-gray-500">
          Manage your profile, schedule, consult rules, fees and payouts from a
          single place. Use the tabs above to jump into each section.
        </p>
      </header>

      <section className="grid md:grid-cols-2 gap-4 mt-4 text-sm">
        <SettingsCard
          title="Profile & Identity"
          body="View locked identity details (name, DOB, gender, HPCSA) and update your contact details and additional qualifications."
          action="Open profile"
          onClick={() => router.push('/settings/profile')}
        />
        <SettingsCard
          title="Schedule & Calendar"
          body="Configure weekly templates, exceptions and working windows, then preview how patients see your availability."
          action="Open schedule"
          onClick={() => router.push('/settings/schedule')}
        />
        <SettingsCard
          title="Consult Rules"
          body="Fine-tune telehealth consult durations, buffers and booking windows, with patient-view preview."
          action="Open consult settings"
          onClick={() => router.push('/settings/consult')}
        />
        <SettingsCard
          title="Fees"
          body="Set your standard and follow-up consult fees in your billing currency. Used for bookings and payout calculations."
          action="Open fees"
          onClick={() => router.push('/settings/fees')}
        />
        <SettingsCard
          title="Payout & Plan"
          body="See your earnings, payout schedule and plan tier, including how many admin staff you can attach."
          action="Open payouts"
          onClick={() => router.push('/payout')}
        />
      </section>
    </main>
  );
}

function SettingsCard({
  title,
  body,
  action,
  onClick,
}: {
  title: string;
  body: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left border rounded-lg bg-white p-4 hover:shadow-sm transition flex flex-col justify-between gap-2"
    >
      <div>
        <h2 className="text-sm font-semibold text-gray-900 mb-1">
          {title}
        </h2>
        <p className="text-xs text-gray-600">{body}</p>
      </div>
      <span className="text-xs text-indigo-700 mt-1">
        {action} →
      </span>
    </button>
  );
}
