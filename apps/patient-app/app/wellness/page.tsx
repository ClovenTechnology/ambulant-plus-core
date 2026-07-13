// apps/patient-app/app/wellness/page.tsx
'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
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

type TabDefinition = {
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const TABS: TabDefinition[] = [
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

function normalizeTab(value: string | null | undefined): TabKey {
  const raw = String(value || '').trim().toLowerCase();
  const hit = TABS.find((tab) => tab.key === raw);
  return hit?.key ?? 'cardio';
}

function searchParamValue(
  params: ReturnType<typeof useSearchParams>,
  key: string,
): string | null {
  return params?.get(key) ?? null;
}

function cloneSearchParams(params: ReturnType<typeof useSearchParams>) {
  if (!params) return new URLSearchParams();
  return new URLSearchParams(Array.from(params.entries()));
}

function WellnessPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialTab = useMemo(
    () => normalizeTab(searchParamValue(searchParams, 'tab')),
    [searchParams],
  );

  const [tab, setTab] = useState<TabKey>(initialTab);

  /*
   * Keep component state aligned with browser back/forward navigation.
   * `useSearchParams()` can be null in this app's current Next/TS setup,
   * so all reads must go through nullable-safe helpers.
   */
  useEffect(() => {
    const queryTab = normalizeTab(searchParamValue(searchParams, 'tab'));

    setTab((current) => (current === queryTab ? current : queryTab));
  }, [searchParams]);

  /*
   * Keep URL canonical with ?tab=...
   * Preserve unrelated query parameters.
   */
  useEffect(() => {
    const params = cloneSearchParams(searchParams);
    const currentTab = normalizeTab(params.get('tab'));

    if (currentTab === tab && params.get('tab') === tab) return;

    params.set('tab', tab);

    const query = params.toString();
    router.replace(query ? `?${query}` : '?tab=cardio', { scroll: false });
  }, [router, searchParams, tab]);

  const active = useMemo(
    () => TABS.find((item) => item.key === tab) ?? TABS[0],
    [tab],
  );

  const ActiveIcon = active.icon;

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
    <main data-p-ui="patient-wellness-page" className="min-w-0 overflow-x-clip min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6">
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
                A clean, insight-first view across your wellness domains. Use
                tabs to switch dashboards.
              </p>
            </div>

            <div className="w-full sm:hidden">
              <label className="mb-2 block text-xs font-medium text-slate-600">
                Section
              </label>

              <div className="relative">
                <select
                  value={tab}
                  onChange={(event) => setTab(normalizeTab(event.target.value))}
                  className="w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 py-3 pr-10 text-sm text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                >
                  {TABS.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.label}
                    </option>
                  ))}
                </select>

                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            <nav
              className="hidden w-full sm:flex lg:w-auto"
              aria-label="Wellness analytics sections"
            >
              <div
                role="tablist"
                aria-orientation="horizontal"
                className="flex flex-wrap items-center gap-1 rounded-2xl border border-slate-200 bg-slate-50 p-1"
              >
                {TABS.map((item) => {
                  const Icon = item.icon;
                  const isActive = tab === item.key;

                  return (
                    <button
                      key={item.key}
                      role="tab"
                      aria-selected={isActive}
                      aria-controls={`panel-${item.key}`}
                      id={`tab-${item.key}`}
                      type="button"
                      onClick={() => setTab(item.key)}
                      className={cx(
                        'group inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition',
                        isActive
                          ? 'border border-slate-200 bg-white text-slate-900 shadow-sm'
                          : 'text-slate-600 hover:bg-white/70 hover:text-slate-900',
                      )}
                    >
                      <Icon
                        className={cx(
                          'h-4 w-4',
                          isActive
                            ? 'text-slate-700'
                            : 'text-slate-400 group-hover:text-slate-600',
                        )}
                      />
                      <span className="font-medium">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </nav>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <ActiveIcon className="h-4 w-4 text-slate-500" />
              <span className="font-medium">{active.label}</span>
              <span className="text-slate-400">â€¢</span>
              <span className="text-slate-600">Dashboard</span>
            </div>

            <div className="text-xs text-slate-500">
              Tip: share a specific view by sending this URL. The selected tab
              is saved in the query string.
            </div>
          </div>
        </header>

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

export default function WellnessPage() {
  return (
    <Suspense fallback={null}>
      <WellnessPageContent />
    </Suspense>
  );
}

