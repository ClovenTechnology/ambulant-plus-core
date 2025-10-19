// apps/patient-app/components/ReportsBlockWrapper.tsx
'use client';

import React, { useEffect, useState } from 'react';

type ReportSummary = { id: string; title: string; date?: string; module?: string };

export default function ReportsBlockWrapper() {
  const [reports, setReports] = useState<ReportSummary[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      // example: pull vitals-derived reports and also list of files (if you create a list endpoint)
      const res = await fetch('/api/reports/vitals', { cache: 'no-store' });
      if (!res.ok) throw new Error('no reports');
      const vitals = await res.json();
      // Build a small list — you should replace with a /api/reports/list if you implement one
      const items: ReportSummary[] = [
        { id: 'RPT-1001', title: 'Blood Test Results', date: new Date().toISOString(), module: 'medreach' },
        { id: 'RPT-1002', title: 'Chest X-Ray', date: new Date().toISOString(), module: 'careport' },
      ];
      // optionally include vitals summary snippet as a pseudo-report
      if (vitals?.latest) {
        items.unshift({ id: 'vitals-summary', title: 'Vitals summary', date: vitals.lastUpdated });
      }
      setReports(items);
    } catch (err) {
      console.error(err);
      setReports([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-2">
      {loading && <div className="text-sm text-gray-500">Loading reports…</div>}
      {!loading && (!reports || reports.length === 0) && <div className="text-sm text-gray-500">No reports found.</div>}

      <ul className="text-sm space-y-2">
        {reports?.map(r => (
          <li key={r.id} className="flex items-center justify-between border rounded p-2 bg-white">
            <div>
              <div className="font-medium">{r.title}</div>
              <div className="text-xs text-gray-500">{r.date ? new Date(r.date).toLocaleDateString() : ''}</div>
            </div>
            <div className="flex gap-2">
              {r.id === 'vitals-summary' ? (
                <a href="/insights" className="text-xs px-2 py-1 border rounded">View</a>
              ) : (
                <>
                  <a href={`/api/reports/file?id=${encodeURIComponent(r.id)}`} target="_blank" rel="noreferrer" className="text-xs px-2 py-1 border rounded">Preview</a>
                  <a href={`/reports/view?id=${encodeURIComponent(r.id)}`} className="text-xs px-2 py-1 border rounded bg-white">Open</a>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
