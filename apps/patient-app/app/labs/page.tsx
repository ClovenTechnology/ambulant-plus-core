// apps/patient-app/app/labs/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';

type LabRow = {
  id: string;
  test: string;
  date: string; // ISO
  status: 'Pending' | 'Completed' | 'Cancelled';
  result?: string;
  unit?: string;
  reference?: string;
  performer?: string;
  sample?: string;
};

const StatusBadge = ({ s }: { s: LabRow['status'] }) => {
  const cls =
    s === 'Completed'
      ? 'bg-green-50 text-green-700 border-green-200'
      : s === 'Pending'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-gray-100 text-gray-600 border-gray-200';
  return <span className={`text-xs px-2 py-0.5 rounded border ${cls}`}>{s}</span>;
};

function Drawer({
  open,
  onClose,
  lab,
}: {
  open: boolean;
  onClose: () => void;
  lab: LabRow | null;
}) {
  if (!open || !lab) return null;
  return (
    <div className="fixed inset-0 z-40">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-hidden
      />
      {/* Panel */}
      <div
        className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl border-l animate-in slide-in-from-right duration-200"
        role="dialog"
        aria-modal="true"
        aria-label="Lab details"
      >
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">Lab Details</h3>
          <button
            onClick={onClose}
            className="px-2 py-1 text-sm border rounded bg-white hover:bg-gray-50"
          >
            Close
          </button>
        </div>

        <div className="p-4 space-y-4 text-sm">
          <div>
            <div className="text-xs text-gray-500">Test</div>
            <div className="font-medium">{lab.test}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-gray-500">Collected / Date</div>
              <div>{new Date(lab.date).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Status</div>
              <div><StatusBadge s={lab.status} /></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-gray-500">Sample</div>
              <div>{lab.sample ?? <span className="text-gray-400">â€”</span>}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Performer</div>
              <div>{lab.performer ?? <span className="text-gray-400">â€”</span>}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-gray-500">Result</div>
              <div>
                {lab.result ? (
                  <>
                    {lab.result}
                    {lab.unit ? <span className="text-gray-500"> {lab.unit}</span> : null}
                  </>
                ) : (
                  <span className="text-gray-400">â€”</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Reference</div>
              <div>{lab.reference ?? <span className="text-gray-400">â€”</span>}</div>
            </div>
          </div>

          <div className="pt-2">
            <div className="text-xs text-gray-500">Notes</div>
            <div className="text-gray-500">
              Demo-only mock data. Add real interpretation or attachments in the clinician app.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LabsPage() {
  const [rows, setRows] = useState<LabRow[] | null>(null);
  const [filter, setFilter] = useState<'All' | 'Pending' | 'Completed' | 'Cancelled'>('All');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<LabRow | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/labs', { cache: 'no-store' });
        const data = (await res.json()) as LabRow[];
        setRows(data);
      } catch {
        setRows([]);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    return rows.filter((r) => {
      const statusOk = filter === 'All' || r.status === filter;
      const textOk =
        !q.trim() ||
        r.test.toLowerCase().includes(q.toLowerCase()) ||
        (r.result ?? '').toLowerCase().includes(q.toLowerCase());
      return statusOk && textOk;
    });
  }, [rows, filter, q]);

  const onRowOpen = (r: LabRow) => {
    setSelected(r);
    setOpen(true);
  };

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Lab Results</h1>
        <div className="flex items-center gap-2">
          <a
            href="/labs/print"
            className="px-3 py-2 border rounded bg-white text-sm hover:bg-gray-50"
          >
            Print Labs
          </a>
          <div className="text-sm text-gray-500">Mock data â€¢ Demo-only</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex gap-2">
          {(['All', 'Pending', 'Completed', 'Cancelled'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 border rounded text-sm ${
                filter === f ? 'bg-gray-900 text-white border-gray-900' : 'bg-white hover:bg-gray-50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tests or resultsâ€¦"
            className="border rounded px-3 py-2 text-sm w-64"
          />
          <button
            onClick={() => setQ('')}
            className="px-3 py-2 border rounded bg-white text-sm hover:bg-gray-50"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Table / empty state */}
      <section className="bg-white border rounded-lg overflow-hidden">
        {rows === null ? (
          <div className="p-6 text-gray-600">Loadingâ€¦</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-gray-500">No labs match your filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 border-b">
                <tr>
                  <th className="text-left font-medium px-4 py-3">Test</th>
                  <th className="text-left font-medium px-4 py-3">Date</th>
                  <th className="text-left font-medium px-4 py-3">Status</th>
                  <th className="text-left font-medium px-4 py-3">Result</th>
                  <th className="text-left font-medium px-4 py-3">Ref</th>
                  <th className="text-left font-medium px-4 py-3">Sample</th>
                  <th className="text-left font-medium px-4 py-3">Performer</th>
                  <th className="text-left font-medium px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-4 py-3">{r.test}</td>
                    <td className="px-4 py-3">{new Date(r.date).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <StatusBadge s={r.status} />
                    </td>
                    <td className="px-4 py-3">
                      {r.result ? (
                        <>
                          {r.result}
                          {r.unit ? <span className="text-gray-500"> {r.unit}</span> : null}
                        </>
                      ) : (
                        <span className="text-gray-400">â€”</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{r.reference ?? <span className="text-gray-400">â€”</span>}</td>
                    <td className="px-4 py-3">{r.sample ?? <span className="text-gray-400">â€”</span>}</td>
                    <td className="px-4 py-3">{r.performer ?? <span className="text-gray-400">â€”</span>}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onRowOpen(r)}
                        className="px-2 py-1 border rounded bg-white hover:bg-gray-50"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Drawer open={open} onClose={() => setOpen(false)} lab={selected} />
    </main>
  );
}
