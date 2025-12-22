'use client';

import dynamic from 'next/dynamic';
import React from 'react';

// IMPORTANT:
// This wrapper intentionally imports the Speech Therapy workspace *page* and mounts it inside SFU.
// That allows the SFU page to reuse the exact same Speech Therapy UI without duplicating logic.
const SpeechTherapyWorkspacePage = dynamic(() => import('../page'), {
  ssr: false,
  loading: () => (
    <div className="rounded-lg border bg-white p-3">
      <div className="text-sm font-semibold text-gray-800">Speech Therapy</div>
      <div className="mt-1 text-xs text-gray-500">Loading speech therapy workspace…</div>
      <div className="mt-3 h-24 w-full animate-pulse rounded bg-gray-100" />
    </div>
  ),
});

export default function SpeechTherapySFUWorkspace() {
  return (
    <div className="w-full">
      <SpeechTherapyWorkspacePage />
    </div>
  );
}
