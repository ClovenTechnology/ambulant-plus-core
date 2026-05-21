// apps/patient-app/components/iomt/Pane.tsx
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  Bluetooth,
  Eye,
  Stethoscope,
  Waves,
} from 'lucide-react';
import WearablePane from '@/components/iomt/WearablePane';
import HMPane from '@/components/iomt/HMPane';
import StethoPane from '@/components/iomt/StethoPane';
import OtoPane from '@/components/iomt/OtoPane';

type Tab = 'wearable' | 'hm' | 'stetho' | 'oto';

type TabMeta = {
  id: Tab;
  title: string;
  shortTitle: string;
  eyebrow: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  tone: {
    shell: string;
    activeShell: string;
    iconWrap: string;
    icon: string;
    badge: string;
    glow: string;
  };
};

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

const TABS: TabMeta[] = [
  {
    id: 'wearable',
    title: 'NexRing',
    shortTitle: 'Wearable',
    eyebrow: 'CRM / RPM',
    description: 'Continuous wearable telemetry, trends, and passive patient insight.',
    icon: Waves,
    href: '/myCare/devices/nexring',
    tone: {
      shell: 'border-violet-200/70 bg-violet-50/70',
      activeShell:
        'border-violet-300 bg-gradient-to-br from-violet-500/15 via-indigo-500/10 to-white',
      iconWrap: 'border-violet-200 bg-violet-100',
      icon: 'text-violet-700',
      badge: 'border-violet-200 bg-violet-50 text-violet-700',
      glow: 'shadow-[0_18px_55px_rgba(139,92,246,0.18)]',
    },
  },
  {
    id: 'hm',
    title: 'Health Monitor',
    shortTitle: 'Vitals',
    eyebrow: 'Spot-check vitals',
    description: 'Blood pressure, SpO₂, temperature, glucose, ECG, and heart rate.',
    icon: Activity,
    href: '/myCare/devices/health-monitor',
    tone: {
      shell: 'border-rose-200/70 bg-rose-50/70',
      activeShell:
        'border-rose-300 bg-gradient-to-br from-rose-500/15 via-pink-500/10 to-white',
      iconWrap: 'border-rose-200 bg-rose-100',
      icon: 'text-rose-700',
      badge: 'border-rose-200 bg-rose-50 text-rose-700',
      glow: 'shadow-[0_18px_55px_rgba(244,63,94,0.16)]',
    },
  },
  {
    id: 'stetho',
    title: 'Digital Stethoscope',
    shortTitle: 'Stethoscope',
    eyebrow: 'Auscultation',
    description: 'Record, review, and export heart and lung audio quickly.',
    icon: Stethoscope,
    href: '/myCare/devices/stethoscope',
    tone: {
      shell: 'border-emerald-200/70 bg-emerald-50/70',
      activeShell:
        'border-emerald-300 bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-white',
      iconWrap: 'border-emerald-200 bg-emerald-100',
      icon: 'text-emerald-700',
      badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
      glow: 'shadow-[0_18px_55px_rgba(16,185,129,0.16)]',
    },
  },
  {
    id: 'oto',
    title: 'HD Otoscope',
    shortTitle: 'Otoscope',
    eyebrow: 'Imaging',
    description: 'Preview and capture otoscopy media for review and documentation.',
    icon: Eye,
    href: '/myCare/devices/otoscope',
    tone: {
      shell: 'border-cyan-200/70 bg-cyan-50/70',
      activeShell:
        'border-cyan-300 bg-gradient-to-br from-cyan-500/15 via-sky-500/10 to-white',
      iconWrap: 'border-cyan-200 bg-cyan-100',
      icon: 'text-cyan-700',
      badge: 'border-cyan-200 bg-cyan-50 text-cyan-700',
      glow: 'shadow-[0_18px_55px_rgba(6,182,212,0.16)]',
    },
  },
];

function ConsoleTabCard({
  meta,
  active,
  onClick,
}: {
  meta: TabMeta;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = meta.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'group relative overflow-hidden rounded-[24px] border p-4 text-left transition-all duration-200',
        active
          ? `${meta.tone.activeShell} ${meta.tone.glow}`
          : `${meta.tone.shell} hover:-translate-y-0.5 hover:shadow-md`,
      )}
      aria-pressed={active}
    >
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(15,23,42,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.05)_1px,transparent_1px)] [background-size:20px_20px]" />

      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div
            className={cx(
              'rounded-2xl border p-3 shadow-sm transition-transform duration-200',
              meta.tone.iconWrap,
              active ? 'scale-105' : 'group-hover:scale-105',
            )}
          >
            <Icon className={cx('h-5 w-5', meta.tone.icon)} />
          </div>

          <span
            className={cx(
              'inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]',
              meta.tone.badge,
            )}
          >
            {meta.eyebrow}
          </span>
        </div>

        <div className="mt-4">
          <div className="text-base font-semibold tracking-tight text-slate-900">
            {meta.title}
          </div>
          <p className="mt-1.5 text-sm leading-6 text-slate-600">{meta.description}</p>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="inline-flex items-center gap-2 text-xs text-slate-500">
            <Bluetooth className="h-3.5 w-3.5" />
            Integrated device
          </div>

          {active ? (
            <div className="inline-flex items-center gap-1 text-sm font-medium text-slate-900">
              Active panel
            </div>
          ) : (
            <div className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition group-hover:text-slate-800">
              Switch
              <ArrowRight className="h-4 w-4" />
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

function ActiveSurface({
  tab,
  href,
}: {
  tab: Tab;
  href: string;
}) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm md:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">
            Active device surface
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Use the quick console here, or open the dedicated page for the fuller workflow.
          </p>
        </div>

        <Link
          href={href}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
        >
          Open dedicated page
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {tab === 'wearable' ? <WearablePane /> : null}
      {tab === 'hm' ? <HMPane /> : null}
      {tab === 'stetho' ? <StethoPane /> : null}
      {tab === 'oto' ? <OtoPane /> : null}
    </section>
  );
}

export default function IoMTPane() {
  const [tab, setTab] = useState<Tab>('wearable');

  const activeMeta = useMemo(
    () => TABS.find((item) => item.id === tab) ?? TABS[0],
    [tab],
  );

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">
            Quick device switching
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Switch cleanly between integrated device surfaces without stacked ribbons or duplicate wrappers.
          </p>
        </div>

        <div className="grid gap-3 xl:grid-cols-4">
          {TABS.map((meta) => (
            <ConsoleTabCard
              key={meta.id}
              meta={meta}
              active={meta.id === tab}
              onClick={() => setTab(meta.id)}
            />
          ))}
        </div>
      </section>

      <ActiveSurface tab={tab} href={activeMeta.href} />
    </div>
  );
}