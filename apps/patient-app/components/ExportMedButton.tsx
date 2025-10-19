// apps/patient-app/components/ExportMedButton.tsx
'use client';

import React, { useState } from 'react';

export default function ExportMedButton() {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    try {
      setLoading(true);
      // fire analytics event (best-effort)
      fetch('/api/analytics', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ event: 'export_med_list', ts: Date.now() }),
      }).catch(() => undefined);

      // open print view in new tab/window
      window.open('/medications/print', '_blank');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      className="px-2 py-1 text-xs border rounded bg-blue-600 text-white hover:bg-blue-700"
      title="Export current medication list to clinician / print"
      disabled={loading}
    >
      {loading ? 'Exporting…' : 'Export to Clinician'}
    </button>
  );
}
