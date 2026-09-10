'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

import { generateHealthReport } from '@/src/analytics/report';

const SECTIONS = [
  { key: 'bp', label: 'Vitals' },
  { key: 'sleep', label: 'Sleep observations' },
  { key: 'fertility', label: 'Reproductive-health observations' },
  { key: 'stress', label: 'Direct stress observations' },
] as const;

export default function ReportsPrintPage() {
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const objectUrl = useRef<string | null>(null);

  useEffect(() => () => {
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
  }, []);

  async function handleGenerate() {
    setLoading(true);
    try {
      const { blob } = await generateHealthReport('', selected);
      const url = URL.createObjectURL(blob);
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = url;
      setPdfUrl(url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main data-p-ui="patient-reports-print-page" className="mx-auto min-h-screen w-full max-w-5xl space-y-5 bg-slate-50 p-4 sm:p-6">
      <header className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
        <Link href="/reports" className="text-sm font-semibold text-cyan-700">← Reports</Link>
        <h1 className="mt-2 text-2xl font-black text-slate-950">Printable health report</h1>
        <p className="mt-2 text-sm text-slate-600">
          Choose sections, then generate an authenticated PDF. A report is not generated automatically on page load.
        </p>
      </header>

      <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-bold text-slate-950">Choose sections</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {SECTIONS.map((section) => (
            <label key={section.key} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={Boolean(selected[section.key])}
                onChange={() => setSelected((prev) => ({ ...prev, [section.key]: !prev[section.key] }))}
              />
              {section.label}
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="mt-4 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? 'Generating…' : 'Generate preview'}
        </button>
      </section>

      {pdfUrl ? (
        <section className="rounded-[26px] border border-slate-200 bg-white p-3 shadow-sm">
          <iframe src={pdfUrl} className="h-[700px] w-full rounded-2xl border" title="Printable health report" />
          <button type="button" onClick={() => window.print()} className="mt-3 rounded-full border px-4 py-2 text-sm font-semibold">
            Print
          </button>
        </section>
      ) : null}
    </main>
  );
}
