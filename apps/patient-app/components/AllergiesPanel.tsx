// apps/patient-app/components/AllergiesPanel.tsx
'use client';

import React from 'react';

interface Allergy {
  name: string;
  status: string;
  severity: string;
  note?: string;
}

interface Props {
  allergies: Allergy[];
  loading?: boolean;
  onRefresh?: () => void;
  onExport?: () => void;
}

export default function AllergiesPanel({ allergies, loading = false, onRefresh, onExport }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center mb-2">
        <span className="font-medium">Allergies List</span>
        <div className="flex gap-2">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="px-2 py-1 text-xs bg-sky-600 text-white rounded"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            onClick={onExport}
            className="px-2 py-1 text-xs bg-indigo-600 text-white rounded"
          >
            Export
          </button>
        </div>
      </div>
      <ul className="text-sm space-y-1">
        {allergies.map((a, i) => (
          <li key={i} className="border rounded p-2 bg-white">
            <div className="font-medium">{a.name}</div>
            <div className="text-xs text-gray-500">{a.status} • Severity: {a.severity}</div>
            {a.note && <div className="text-xs text-gray-400">Note: {a.note}</div>}
          </li>
        ))}
      </ul>
    </div>
  );
}
