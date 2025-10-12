// apps/clinician-app/app/televisit/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function TelevisitIndex() {
  const router = useRouter();
  const sp = useSearchParams();
  const seed = sp.get('id') || '';
  const [id, setId] = useState(seed);

  useEffect(() => {
    if (seed) router.replace(`/televisit/${encodeURIComponent(seed)}`);
  }, [seed, router]);

  return (
    <main className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Televisit</h1>
      <div className="text-sm text-gray-600">Provide an appointment/session id to open the workspace.</div>
      <div className="flex gap-2">
        <input
          className="border rounded px-3 py-2 w-80"
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder="Enter appointment id…"
        />
        <button
          onClick={() => { if (id.trim()) router.push(`/televisit/${encodeURIComponent(id.trim())}`); }}
          className="px-3 py-2 border rounded"
        >
          Open
        </button>
      </div>
    </main>
  );
}
