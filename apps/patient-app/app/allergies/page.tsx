// apps/patient-app/app/allergies/page.tsx
import AllergiesClient from './allergies-client';

export const dynamic = 'force-dynamic';

export default async function AllergiesPage() {
  // Let the client component fetch; avoids BASE_URL pitfalls in dev
  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Allergies</h1>
        <a
          href="/allergies/print"
          className="px-3 py-2 border rounded bg-white hover:bg-gray-50 text-sm"
        >
          Print Allergies
        </a>
      </header>

      <AllergiesClient />
    </main>
  );
}
