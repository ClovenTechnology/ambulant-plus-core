'use client';

import dynamic from 'next/dynamic';
import React from 'react';

// IMPORTANT:
// This wrapper intentionally imports the Occupational Therapy workspace *page* and mounts it inside SFU.
// That allows the SFU page to reuse the exact same Occupational Therapy UI without duplicating logic.
const OccupationalTherapyWorkspacePage = dynamic(() => import('../page'), {
  ssr: false,
  loading: () => (
    <div className="rounded-lg border bg-white p-3">
      <div className="text-sm font-semibold text-gray-800">Occupational Therapy</div>
      <div className="mt-1 text-xs text-gray-500">Loading occupational therapy workspace…</div>
      <div className="mt-3 h-24 w-full animate-pulse rounded bg-gray-100" />
    </div>
  ),
});

export default function OccupationalTherapySFUWorkspace() {
  return (
    <div className="w-full">
      <OccupationalTherapyWorkspacePage />
    </div>
  );
}
