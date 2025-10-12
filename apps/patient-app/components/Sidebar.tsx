// apps/patient-app/components/Sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  Home,
  Users,
  HeartPulse,
  LineChart,
  ClipboardList,
  ShoppingCart,
  Hospital,
  Radio,
  Video,
  Calendar,
  Activity,
  Settings,
  ChevronLeft,
  ChevronRight,
  Brain,
  Moon,
} from 'lucide-react';

type Item = {
  href: string;
  label: string;
  icon: any;
};

const NAV: Item[] = [
  { href: '/',             label: 'Home',          icon: Home },
  { href: '/clinicians',   label: 'Clinicians',    icon: Users },
  { href: '/vitals',       label: 'Vitals',        icon: HeartPulse },
  { href: '/charts',       label: 'Charts',        icon: LineChart },
  { href: '/encounters',   label: 'Encounters',    icon: ClipboardList },
  { href: '/orders',       label: 'Orders',        icon: ShoppingCart },
  { href: '/careport',     label: 'CarePort',      icon: Hospital },
  { href: '/medreach',     label: 'MedReach',      icon: Radio },
  { href: '/rtc',          label: 'RTC (raw)',     icon: Activity },
  { href: '/sfu/demo',     label: 'SFU Demo',      icon: Activity },
  { href: '/appointments', label: 'Appointments',  icon: Calendar },
  { href: '/televisit',    label: 'Televisit',     icon: Video },
  { href: '/self-check',   label: 'myCare',        icon: ClipboardList },
];

const ANALYTICS: Item[] = [
  { href: '/reports',          label: 'Reports',          icon: ClipboardList },
  { href: '/wellness',         label: 'Wellness',         icon: LineChart },
  { href: '/fertility-report', label: 'Fertility Report', icon: Activity },
  { href: '/reports/stress',   label: 'Stress Report',    icon: Brain },
  { href: '/reports/sleep',    label: 'Sleep Report',     icon: Moon },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(true);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  return (
    <aside
      className={`h-screen shrink-0 border-r bg-white transition-all duration-300 flex flex-col ${
        collapsed ? 'w-16' : 'w-56'
      }`}
    >
      {/* Header with collapse toggle */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        {!collapsed && (
          <span className="text-xs font-semibold uppercase text-gray-500">
            Navigation
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded hover:bg-gray-100"
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5 text-gray-600" />
          ) : (
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          )}
        </button>
      </div>

      {/* Main nav */}
      <nav className="px-2 py-3 flex-1 overflow-y-auto">
        <ul className="space-y-1">
          {NAV.map((it) => {
            const active = isActive(it.href);
            const Icon = it.icon;
            return (
              <li key={it.href}>
                <Link
                  href={it.href}
                  className={[
                    'flex items-center gap-2 rounded px-3 py-2 text-sm',
                    active
                      ? 'bg-gray-100 font-medium text-gray-900'
                      : 'text-gray-700 hover:bg-gray-50',
                  ].join(' ')}
                >
                  <Icon className="h-4 w-4 text-gray-500" />
                  {!collapsed && it.label}
                </Link>
              </li>
            );
          })}

          {/* Analytics group */}
          <li>
            <button
              onClick={() => setAnalyticsOpen(!analyticsOpen)}
              className="w-full flex justify-between items-center px-3 py-2 text-sm rounded text-gray-700 hover:bg-gray-50"
            >
              <span className="flex items-center gap-2">
                <LineChart className="h-4 w-4 text-gray-500" />
                {!collapsed && <span className="font-medium">Analytics</span>}
              </span>
              {!collapsed && (
                <span className="text-xs text-gray-400">
                  {analyticsOpen ? '▾' : '▸'}
                </span>
              )}
            </button>
            {analyticsOpen && !collapsed && (
              <ul className="ml-6 mt-1 space-y-1">
                {ANALYTICS.map((it) => {
                  const active = isActive(it.href);
                  const Icon = it.icon;
                  return (
                    <li key={it.href}>
                      <Link
                        href={it.href}
                        className={[
                          'flex items-center gap-2 rounded px-3 py-2 text-sm',
                          active
                            ? 'bg-gray-100 font-medium text-gray-900'
                            : 'text-gray-700 hover:bg-gray-50',
                        ].join(' ')}
                      >
                        <Icon className="h-4 w-4 text-gray-500" />
                        {it.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        </ul>
      </nav>

      {/* Bottom Settings */}
      <div className="p-2 border-t">
        <Link
          href="/settings"
          className={`flex items-center gap-2 rounded px-3 py-2 text-sm ${
            isActive('/settings')
              ? 'bg-gray-100 font-medium text-gray-900'
              : 'text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Settings className="h-4 w-4 text-gray-500" />
          {!collapsed && 'Settings'}
        </Link>
      </div>
    </aside>
  );
}
