'use client';

export default function HistoryDashboard() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold">Health History</h2>
      <p className="text-gray-600">
        Consolidated logs of past vitals, sleep, stress, fertility, and
        metabolic data.
      </p>

      <div className="p-4 border rounded-lg bg-white">
        <p className="text-sm text-gray-500">
          Coming soon: timeline charts, condition flags, and clinician-facing
          exports.
        </p>
      </div>
    </section>
  );
}
