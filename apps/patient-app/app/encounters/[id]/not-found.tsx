// apps/patient-app/app/encounters/[id]/not-found.tsx
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="max-w-3xl mx-auto p-10">
      <div className="p-6 border rounded bg-white text-center space-y-3">
        <h1 className="text-xl font-semibold">Encounter not found</h1>
        <p className="text-sm text-gray-600">The encounter you’re looking for doesn’t exist.</p>
        <Link href="/encounters" className="inline-block px-3 py-2 border rounded bg-white hover:bg-gray-50 text-sm">
          Back to Encounters
        </Link>
      </div>
    </main>
  );
}
