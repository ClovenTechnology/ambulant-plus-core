// apps/clinician-app/app/workspaces/dental/sfu/page.tsx
'use client';

import dynamic from 'next/dynamic';
import React from 'react';

// IMPORTANT:
// This wrapper intentionally imports the Dental workspace *page* and mounts it inside SFU.
// That allows the SFU page to reuse the exact same Dental UI without duplicating logic.
const DentalWorkspacePage = dynamic(() => import('../page'), {
  ssr: false,
  loading: () => (
    <div className="rounded-lg border bg-white p-3">
      <div className="text-sm font-semibold text-gray-800">Dental</div>
      <div className="mt-1 text-xs text-gray-500">Loading dental workspace…</div>
      <div className="mt-3 h-24 w-full animate-pulse rounded bg-gray-100" />
    </div>
  ),
});

export default function DentalSFUWorkspace() {
  return (
    <div className="w-full">
      <DentalWorkspacePage />
    </div>
  );
}
