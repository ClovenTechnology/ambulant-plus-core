'use client';

import dynamic from 'next/dynamic';
import React from 'react';

// IMPORTANT:
// This wrapper intentionally imports the Paediatric workspace *page* and mounts it inside SFU.
// That allows the SFU page to reuse the exact same Paediatric UI without duplicating logic.
const PaediatricWorkspacePage = dynamic(() => import('../page'), {
  ssr: false,
  loading: () => (
    <div className="rounded-lg border bg-white p-3">
      <div className="text-sm font-semibold text-gray-800">Paediatric</div>
      <div className="mt-1 text-xs text-gray-500">Loading paediatric workspace…</div>
      <div className="mt-3 h-24 w-full animate-pulse rounded bg-gray-100" />
    </div>
  ),
});

export default function PaediatricSFUWorkspace() {
  return (
    <div className="w-full">
      <PaediatricWorkspacePage />
    </div>
  );
}
