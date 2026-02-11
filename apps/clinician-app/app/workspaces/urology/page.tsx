// File: apps/clinician-app/app/workspaces/urology/page.tsx
'use client';

import Link from 'next/link';

export default function UrologyWorkspacePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-6xl px-4 py-5">
          <p className="text-xs text-gray-500">Ambulant+ · Clinical Workspaces</p>
          <h1 className="text-2xl font-semibold">Urology Workspace</h1>
          <p className="text-sm text-gray-600">
            Urologic consults, procedure planning, diagnostics, and follow-up workflows.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="rounded-xl border bg-white p-6">
          <h2 className="text-lg font-semibold">Workspace starter is live</h2>
          <p className="mt-2 text-sm text-gray-600">
            This route is ready. Next step is wiring a dedicated <code>useUrologyWorkspace</code> module
            (same architecture as STD/Surgery) with findings export and encounter persistence.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/workspaces"
              className="rounded border px-3 py-2 text-sm hover:bg-gray-50"
            >
              Back to Workspaces
            </Link>
            <Link
              href="/workspaces/surgery"
              className="rounded border px-3 py-2 text-sm hover:bg-gray-50"
            >
              Open Surgery Workspace
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
