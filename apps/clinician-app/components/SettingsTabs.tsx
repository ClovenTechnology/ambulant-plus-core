// apps/clinician-app/components/SettingsTabs.tsx
'use client';

import { usePathname, useRouter } from 'next/navigation';

const TABS = [
  { href: '/settings/profile', label: 'Profile' },
  { href: '/settings/schedule', label: 'Schedule' },
  { href: '/settings/consult', label: 'Consult' },
  { href: '/settings/fees', label: 'Fees' },
  { href: '/payout', label: 'Payout & Plan' },
];

export function SettingsTabs({ className = '' }: { className?: string }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav
      className={
        'border-b border-gray-200 mb-2 flex flex-wrap gap-2 ' + className
      }
    >
      {TABS.map((tab) => {
        const isRootSettings =
          pathname === '/settings' && tab.href === '/settings/profile';

        const active = pathname === tab.href || isRootSettings;

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
  );
}
