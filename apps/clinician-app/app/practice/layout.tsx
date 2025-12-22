'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClinicianShell } from '@/components/ClinicianShell';

const NAV = [
  { href: '/practice', label: 'Overview' },
  { href: '/practice/members', label: 'Members' },
  { href: '/practice/claims', label: 'Claims & Funding' },
  { href: '/practice/settings', label: 'Settings' },
];

export default function PracticeLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <ClinicianShell>
      <div className="w-full max-w-6xl mx-auto px-4 py-6 space-y-4">
        {/* Header */}
        <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-lg md:text-2xl font-semibold text-gray-900">
              My Practice
            </h1>
            <p className="text-xs md:text-sm text-gray-600">
              Host view of practice identity, locations, members, funding and
              Smart ID routing.
            </p>
          </div>
        </header>

        {/* Tabs */}
        <nav className="border-b border-gray-200">
          <ul className="flex flex-wrap gap-2 text-xs md:text-sm">
            {NAV.map((item) => {
              const active =
                pathname === item.href ||
                pathname.startsWith(item.href + '/');
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={
                      'inline-flex items-center rounded-full px-3 py-1.5 transition-colors ' +
                      (active
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200')
                    }
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Page content */}
        <section className="space-y-4">{children}</section>
      </div>
    </ClinicianShell>
  );
}
