// apps/patient-app/components/iomt/Pane.tsx
'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  Eye,
  Stethoscope,
  Waves,
} from 'lucide-react';
import WearablePane from '@/components/iomt/WearablePane';
import HMPane from '@/components/iomt/HMPane';
import StethoPane from '@/components/iomt/StethoPane';
import OtoPane from '@/components/iomt/OtoPane';

type Tab = 'wearable' | 'hm' | 'stetho' | 'oto';

type IoMTPaneProps = {
  roomId?: string;
  patientId?: string;
  encounterId?: string | null;
  onHealthMonitorResult?: (result: unknown) => void;
};

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
    eyebrow: 'Ring',
    description: 'Wearable trends and activity.',
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
    shortTitle: 'Health',
    eyebrow: 'Vitals',
    description: 'Blood pressure, SpO2, temperature, glucose, ECG, and heart rate.',
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
    eyebrow: 'Audio',
    description: 'Heart and lung sounds.',
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
    eyebrow: 'Camera',
    description: 'Ear imaging capture.',
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
        'group flex min-h-[64px] min-w-0 items-center gap-2 rounded-2xl border px-3 py-2.5 text-left transition',
        active
          ? 'border-slate-900 bg-slate-900 text-white shadow-sm shadow-slate-900/15'
          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
      )}
      aria-pressed={active}
    >
      <span
        className={cx(
          'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border',
          active ? 'border-white/15 bg-white/10' : meta.tone.iconWrap,
        )}
      >
        <Icon className={cx('h-4 w-4', active ? 'text-white' : meta.tone.icon)} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">
          {meta.title}
        </span>
        <span className={cx('mt-0.5 block truncate text-[11px]', active ? 'text-slate-300' : 'text-slate-500')}>
          {meta.eyebrow}
        </span>
      </span>

      <span
        className={cx(
          'hidden rounded-full px-2 py-0.5 text-[10px] font-semibold sm:inline-flex',
          active ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-500',
        )}
      >
        {active ? 'Selected' : 'Open'}
      </span>
    </button>
  );
}

function ActiveSurface({
  tab,
  href,
  roomId,
  patientId,
  onHealthMonitorResult,
}: {
  tab: Tab;
  href: string;
  roomId?: string;
  patientId?: string;
  onHealthMonitorResult?: (result: unknown) => void;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">
            Device workflow
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Use the selected device below, or open its dedicated page for the full workflow.
          </p>
        </div>

        <Link
          href={href}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 sm:w-auto"
        >
          Open full page
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {tab === 'wearable' ? <WearablePane /> : null}
      {tab === 'hm' ? <HMPane roomId={roomId} patientId={patientId} onResult={onHealthMonitorResult} /> : null}
      {tab === 'stetho' ? <StethoPane /> : null}
      {tab === 'oto' ? <OtoPane /> : null}
    </section>
  );
}

export default function IoMTPane({ roomId, patientId, onHealthMonitorResult }: IoMTPaneProps = {}) {
  const [tab, setTab] = useState<Tab>('wearable');

  const activeMeta = useMemo(
    () => TABS.find((item) => item.id === tab) ?? TABS[0],
    [tab],
  );

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">
            Choose device
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Select one device. The workflow opens below.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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

      <ActiveSurface
        tab={tab}
        href={activeMeta.href}
        roomId={roomId}
        patientId={patientId}
        onHealthMonitorResult={onHealthMonitorResult}
      />
    </div>
  );
}