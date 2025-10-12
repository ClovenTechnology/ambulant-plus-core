'use client';

export default function StressDashboard() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold">Stress Analytics</h2>
      <p className="text-gray-600">
        Stress index, HRV metrics, and recovery score over time.
      </p>

      <div className="p-4 border rounded-lg bg-white">
        <p className="text-sm text-gray-500">
          Coming soon: daily stress heatmaps, HRV distributions, and recovery
          prediction.
        </p>
      </div>
    </section>
  );
}
