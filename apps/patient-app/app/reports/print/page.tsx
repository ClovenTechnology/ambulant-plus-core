'use client';

import { useEffect, useState } from 'react';
import { generateHealthReport } from '@/src/analytics/report';

const SECTIONS = [
  { key: 'bp', label: 'Vitals (BP, HR, Temp, Glucose, SpO₂)' },
  { key: 'sleep', label: 'Sleep' },
  { key: 'fertility', label: 'Fertility' },
  { key: 'stress', label: 'Stress & HRV' },
];

export default function ReportsPrintPage() {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const toggle = (key: string) => {
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  async function handleGenerate() {
    setLoading(true);

    const { blob } = await generateHealthReport('current-user', selected);
    const url = URL.createObjectURL(blob);
    setPdfUrl(url);

    setLoading(false);
  }

  // Auto-generate with defaults on mount
  useEffect(() => {
    handleGenerate();
  }, []);

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Print Report</h1>
        <button
          onClick={() => window.print()}
          className="px-3 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
        >
          Print
        </button>
      </header>

      {/* Section toggles */}
      <section className="p-4 border rounded-lg bg-white space-y-2">
        <h2 className="font-semibold mb-2">Choose sections</h2>
        {SECTIONS.map((s) => (
          <label key={s.key} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!selected[s.key]}
              onChange={() => toggle(s.key)}
            />
            {s.label}
          </label>
        ))}
        <button
          onClick={handleGenerate}
          className="mt-3 px-3 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700"
        >
          Generate Preview
        </button>
      </section>

      {/* Preview */}
      <section>
        {loading && <p className="text-gray-500">Generating PDF…</p>}
        {pdfUrl && (
          <iframe
            src={pdfUrl}
            className="w-full h-[700px] border rounded"
            title="Printable Report"
          />
        )}
      </section>
    </main>
  );
}
