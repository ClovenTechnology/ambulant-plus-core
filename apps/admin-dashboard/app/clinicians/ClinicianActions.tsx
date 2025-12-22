// apps/admin-dashboard/app/clinicians/ClinicianActions.tsx
'use client';

import React from 'react';
import Link from 'next/link';

export default function ClinicianActions({
  clinicianId,
  mode,
}: {
  clinicianId: string;
  mode: 'pending' | 'active';
}) {
  if (mode === 'pending') {
    return (
      <div className="flex gap-2">
        <button
          className="px-3 py-1 text-sm rounded bg-emerald-600 text-white"
          onClick={async () => {
            const res = await fetch('/api/admin/clinicians/approve', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ id: clinicianId }),
            });
            if (res.ok) location.reload();
            else {
              const txt = await res.text().catch(() => 'error');
              alert('Approve failed: ' + txt);
            }
          }}
        >
          Approve
        </button>

        <button
          className="px-3 py-1 text-sm rounded bg-rose-600 text-white"
          onClick={async () => {
            const res = await fetch('/api/admin/clinicians/reject', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ id: clinicianId }),
            });
            if (res.ok) location.reload();
            else alert('Reject failed');
          }}
        >
          Reject
        </button>

        <Link href={`/admin/clinicians/${clinicianId}`} className="px-3 py-1 rounded border text-sm">
          View
        </Link>
      </div>
    );
  }

  // active
  return (
    <div className="flex gap-2">
      {/* Disable (compliance / overdue docs) */}
      <button
        onClick={async () => {
          const res = await fetch('/api/admin/clinicians/disable', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: clinicianId }),
          });
          if (res.ok) location.reload();
          else alert('Disable failed');
        }}
        className="px-3 py-1 rounded bg-amber-600 text-white text-sm"
      >
        Disable
      </button>

      {/* Mark as on disciplinary action */}
      <button
        onClick={async () => {
          const res = await fetch('/api/admin/clinicians/discipline', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: clinicianId }),
          });
          if (res.ok) location.reload();
          else alert('Update failed');
        }}
        className="px-3 py-1 rounded bg-rose-600 text-white text-sm"
      >
        Disciplinary
      </button>

      {/* Archive (full off-boarding) */}
      <button
        onClick={async () => {
          const res = await fetch('/api/admin/clinicians/archive', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: clinicianId }),
          });
          if (res.ok) location.reload();
          else alert('Archive failed');
        }}
        className="px-3 py-1 rounded bg-slate-600 text-white text-sm"
      >
        Archive
      </button>

      <Link href={`/admin/clinicians/${clinicianId}`} className="px-3 py-1 rounded border text-sm">
        Manage
      </Link>
    </div>
  );
}
