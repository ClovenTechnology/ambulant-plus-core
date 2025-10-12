'use client';

import { useState } from 'react';
import CardioDashboard from './tabs/cardio';
import StressDashboard from './tabs/stress';
import SleepDashboard from './tabs/sleep';
import FertilityDashboard from './tabs/fertility';
import MetabolicDashboard from './tabs/metabolic';
import HistoryDashboard from './tabs/history';

const TABS = [
  { key: 'cardio', label: 'Cardio' },
  { key: 'stress', label: 'Stress' },
  { key: 'sleep', label: 'Sleep' },
  { key: 'fertility', label: 'Fertility' },
  { key: 'metabolic', label: 'Metabolic' },
  { key: 'history', label: 'History' },
];

export default function WellnessPage() {
  const [tab, setTab] = useState('cardio');

  return (
    <main className="max-w-7xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Wellness Analytics</h1>
        <div className="flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded ${
                tab === t.key
                  ? 'bg-black text-white'
                  : 'bg-white border hover:bg-gray-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {tab === 'cardio' && <CardioDashboard />}
      {tab === 'stress' && <StressDashboard />}
      {tab === 'sleep' && <SleepDashboard />}
      {tab === 'fertility' && <FertilityDashboard />}
      {tab === 'metabolic' && <MetabolicDashboard />}
      {tab === 'history' && <HistoryDashboard />}
    </main>
  );
}
