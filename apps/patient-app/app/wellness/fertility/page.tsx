'use client';

import { FertilitySetup } from '@/src/screens/FertilitySetup';

export default function FertilityDashboardPage() {
  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Cycle Tracking</h1>
        <p className="text-gray-600">
          Record cycle information and review tracked data without claiming ovulation or pregnancy prediction.
        </p>
      </header>

      <section className="bg-white border rounded-lg p-4">
        <FertilitySetup />
      </section>

      <section className="bg-white border rounded-lg p-4">
        <h2 className="font-semibold mb-2">Coming soon</h2>
        <p className="text-sm text-gray-500">
          Additional clinician-reviewed cycle visualisations can be added once validated data sources are available.
        </p>
      </section>
    </main>
  );
}
