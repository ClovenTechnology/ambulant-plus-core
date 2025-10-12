'use client';

export default function MetabolicDashboard() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold">Metabolic Analytics</h2>
      <p className="text-gray-600">
        Glucose, BMI, temperature, energy expenditure, and activity balance.
      </p>

      <div className="p-4 border rounded-lg bg-white">
        <p className="text-sm text-gray-500">
          Coming soon: glucose variability index, metabolic age estimate, and
          weight management insights.
        </p>
      </div>
    </section>
  );
}
