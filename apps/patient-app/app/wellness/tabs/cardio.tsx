'use client';

export default function CardioDashboard() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold">Cardio Analytics</h2>
      <p className="text-gray-600">
        Heart rate, blood pressure, ECG, and cardiovascular risk insights.
      </p>

      <div className="p-4 border rounded-lg bg-white">
        <p className="text-sm text-gray-500">
          Coming soon: integration with hypertension index, ECG strip previews,
          and cardio trend reports.
        </p>
      </div>
    </section>
  );
}
