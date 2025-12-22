'use client';

import dynamic from 'next/dynamic';
import React from 'react';

// IMPORTANT:
// This wrapper intentionally imports the Fertility workspace *page* and mounts it inside SFU.
// That allows the SFU page to reuse the exact same Fertility UI without duplicating logic.
const FertilityWorkspacePage = dynamic(() => import('../page'), {
  ssr: false,
  loading: () => (
    <div className="rounded-lg border bg-white p-3">
      <div className="text-sm font-semibold text-gray-800">Fertility</div>
      <div className="mt-1 text-xs text-gray-500">Loading fertility workspace…</div>
      <div className="mt-3 h-24 w-full animate-pulse rounded bg-gray-100" />
    </div>
  ),
});

export default function FertilitySFUWorkspace() {
  return (
    <div className="w-full">
      <FertilityWorkspacePage />
    </div>
  );
}
