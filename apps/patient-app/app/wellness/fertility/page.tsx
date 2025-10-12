'use client';

import { FertilitySetup } from '@/screens/FertilitySetup';

export default function FertilityDashboardPage() {
  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Fertility Analytics</h1>
        <p className="text-gray-600">
          Track cycle phases, ovulation prediction, and temperature variations.
        </p>
      </header>

      <section className="bg-white border rounded-lg p-4">
        <FertilitySetup />
      </section>

      <section className="bg-white border rounded-lg p-4">
        <h2 className="font-semibold mb-2">Coming soon</h2>
        <p className="text-sm text-gray-500">
          Daily probability overlay, fertility calendar, and predictive insights
          based on baseline + LMP input.
        </p>
      </section>
    </main>
  );
}
