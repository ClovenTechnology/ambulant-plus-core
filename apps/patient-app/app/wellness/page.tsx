'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Activity,
  Brain,
  HeartPulse,
  History,
  Leaf,
  Moon,
  Sparkles,
  ChevronDown,
} from 'lucide-react';

import CardioDashboard from './tabs/cardio';
import StressDashboard from './tabs/stress';
import SleepDashboard from './tabs/sleep';
import FertilityDashboard from './tabs/fertility';
import MetabolicDashboard from './tabs/metabolic';
import HistoryDashboard from './tabs/history';

type TabKey = 'cardio' | 'stress' | 'sleep' | 'fertility' | 'metabolic' | 'history';

const TABS: Array<{ key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: 'cardio', label: 'Cardio', icon: HeartPulse },
  { key: 'stress', label: 'Stress', icon: Brain },
  { key: 'sleep', label: 'Sleep', icon: Moon },
  { key: 'fertility', label: 'Fertility', icon: Sparkles },
  { key: 'metabolic', label: 'Metabolic', icon: Leaf },
  { key: 'history', label: 'History', icon: History },
];

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function normalizeTab(v: string | null | undefined): TabKey {
  const raw = String(v || '').toLowerCase();
  const hit = TABS.find((t) => t.key === raw);
  return (hit?.key || 'cardio') as TabKey;
}

export default function WellnessPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const initial = useMemo(() => normalizeTab(sp.get('tab')), [sp]);
  const [tab, setTab] = useState<TabKey>(initial);

  // Keep URL canonical (?tab=) and support back/forward navigation
  useEffect(() => {
    const q = normalizeTab(sp.get('tab'));
    if (q !== tab) setTab(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  useEffect(() => {
    const qs = new URLSearchParams(Array.from(sp.entries()));
    qs.set('tab', tab);
    router.replace(`?${qs.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const active = useMemo(() => TABS.find((t) => t.key === tab) ?? TABS[0], [tab]);

  const Panel = useMemo(() => {
    const map: Record<TabKey, React.ComponentType> = {
      cardio: CardioDashboard,
      stress: StressDashboard,
      sleep: SleepDashboard,
      fertility: FertilityDashboard,
      metabolic: MetabolicDashboard,
      history: HistoryDashboard,
    };
    return map[tab] ?? CardioDashboard;
  }, [tab]);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 space-y-6">
        {/* Header */}
        <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-slate-400" />
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                  Wellness Analytics
                </h1>
              </div>
              <p className="mt-1 max-w-2xl text-sm text-slate-600">
                A clean, insight-first view across your wellness domains. Use tabs to switch dashboards.
              </p>
            </div>

            {/* Mobile: select */}
            <div className="w-full sm:hidden">
              <label className="block text-xs font-medium text-slate-600 mb-2">
                Section
              </label>
              <div className="relative">
                <select
                  value={tab}
                  onChange={(e) => setTab(normalizeTab(e.target.value))}
                  className="w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 py-3 pr-10 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                >
                  {TABS.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            {/* Desktop: tabs */}
            <nav className="hidden sm:flex w-full lg:w-auto" aria-label="Wellness analytics sections">
              <div
                role="tablist"
                aria-orientation="horizontal"
                className="flex flex-wrap items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1"
              >
                {TABS.map((t) => {
                  const Icon = t.icon;
                  const isActive = tab === t.key;
                  return (
                    <button
                      key={t.key}
                      role="tab"
                      aria-selected={isActive}
                      aria-controls={`panel-${t.key}`}
                      id={`tab-${t.key}`}
                      type="button"
                      onClick={() => setTab(t.key)}
                      className={cx(
                        'group inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition',
                        isActive
                          ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                      )}
                    >
                      <Icon className={cx('h-4 w-4', isActive ? 'text-slate-700' : 'text-slate-400 group-hover:text-slate-600')} />
                      <span className="font-medium">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </nav>
          </div>

          {/* Active context strip */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <active.icon className="h-4 w-4 text-slate-500" />
              <span className="font-medium">{active.label}</span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-600">Dashboard</span>
            </div>

            <div className="text-xs text-slate-500">
              Tip: share a specific view by sending this URL (tab is saved in the query string).
            </div>
          </div>
        </header>

        {/* Content */}
        <section
          role="tabpanel"
          id={`panel-${tab}`}
          aria-labelledby={`tab-${tab}`}
          className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <Panel />
        </section>
      </div>
    </main>
  );
}
