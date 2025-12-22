// apps/clinician-app/app/practice/profile/page.tsx
'use client';

export default function PracticeProfilePage() {
  return (
    <main className="space-y-4">
      <header>
        <h2 className="text-sm md:text-base font-semibold text-gray-900">
          Practice Profile
        </h2>
        <p className="text-xs text-gray-600">
          Basic details about your hosted practice. This is a placeholder; we&apos;ll wire it to Practice &amp; PracticeMember.
        </p>
      </header>

      <section className="border rounded-xl bg-white p-4 text-xs text-gray-700 space-y-2">
        <p>
          Coming soon: legal name, practice number, tax details, banking &amp; billing contacts,
          and links to clinician splits.
        </p>
      </section>
    </main>
  );
}
