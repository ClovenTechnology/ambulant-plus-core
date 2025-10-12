'use client';

import { FertilitySetup } from '@/src/screens/FertilitySetup';

export default function FertilityDashboard() {
  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-semibold">Fertility Analytics</h2>
      <p className="text-gray-600">
        Cycle phases, ovulation prediction, and probability overlays.
      </p>

      <div className="p-4 border rounded-lg bg-white">
        <FertilitySetup />
      </div>

      <div className="p-4 border rounded-lg bg-white">
        <h3 className="text-lg font-semibold">Upcoming</h3>
        <p className="text-sm text-gray-500">
          Calendar with fertile window confidence %, baseline establishment tips,
          and report accuracy notices.
        </p>
      </div>
    </section>
  );
}
