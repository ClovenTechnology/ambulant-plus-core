'use client';

import { useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function ReorderTestContent() {
  const query = useSearchParams();

  const qs = useMemo(
    () => new URLSearchParams(query?.toString() ?? ''),
    [query],
  );

  const reportId = qs.get('reportId');

  return (
    <main className="p-6 space-y-3">
      <h1 className="text-lg font-semibold">Reorder Test</h1>

      <div className="text-sm">
        We will route this request to another CarePort Pharmacy with confirmed availability.
      </div>

      <div className="text-sm">
        Report: {reportId || '—'}
      </div>

      <div className="text-sm text-gray-500">
        Stub view — integrate with Pharmacy marketplace in next patch.
      </div>
    </main>
  );
}

export default function ReorderTest() {
  return (
    <Suspense fallback={null}>
      <ReorderTestContent />
    </Suspense>
  );
}

