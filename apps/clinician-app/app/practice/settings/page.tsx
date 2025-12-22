// apps/clinician-app/app/practice/settings/page.tsx
'use client';

export default function PracticeSettingsPage() {
  return (
    <main className="space-y-4">
      <header>
        <h2 className="text-sm md:text-base font-semibold text-gray-900">
          Practice Settings
        </h2>
        <p className="text-xs text-gray-600">
          Global rules for this practice (splits, claims rules, fees templates, staff access).
        </p>
      </header>

      <section className="border rounded-xl bg-white p-4 text-xs text-gray-700 space-y-2">
        <p>
          Placeholder for now. You can reuse much of the logic from Fees &amp; Consult Settings
          and lift it to the practice level when you&apos;re ready.
        </p>
      </section>
    </main>
  );
}
