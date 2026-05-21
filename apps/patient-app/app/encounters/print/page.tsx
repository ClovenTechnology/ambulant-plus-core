// apps/patient-app/app/encounters/print/page.tsx
'use client';

import React, { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

function PrintRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams?.get('id') || searchParams?.get('encounterId') || '';

  useEffect(() => {
    if (id) router.replace(`/encounters/${encodeURIComponent(id)}/print`);
  }, [id, router]);

  if (id) {
    return <main className="p-6 text-sm text-slate-600">Opening encounter print view…</main>;
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-black text-slate-950">Choose an encounter to print</h1>
        <p className="mt-2 text-sm text-slate-600">The legacy print URL now requires an encounter id. Open a specific encounter and use Print summary.</p>
        <Link href="/encounters" className="mt-5 inline-flex rounded-full bg-slate-950 px-5 py-2.5 text-sm font-black text-white">Back to encounters</Link>
      </div>
    </main>
  );
}

export default function EncounterPrintRedirectPage() {
  return (
    <Suspense fallback={null}>
      <PrintRedirectContent />
    </Suspense>
  );
}
