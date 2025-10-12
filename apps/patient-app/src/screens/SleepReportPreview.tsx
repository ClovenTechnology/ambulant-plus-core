'use client';

import { useEffect, useState } from 'react';
import { generateHealthReport } from '@/src/analytics/report';

export default function SleepReportPreview() {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadPdf() {
    setLoading(true);
    const { blob, filename } = await generateHealthReport('patient-123', {
      sleep: true,
    });
    const url = URL.createObjectURL(blob);
    setPdfUrl(url);
    (blob as any).filename = filename;
    setLoading(false);
  }

  useEffect(() => {
    loadPdf();
  }, []);

  async function handleDownload() {
    if (!pdfUrl) return;
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = 'sleep_report.pdf';
    link.click();
  }

  async function handleShare() {
    if (!pdfUrl) return;
    const res = await fetch(pdfUrl);
    const blob = await res.blob();
    const file = new File([blob], 'sleep_report.pdf', { type: 'application/pdf' });

    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        title: 'Sleep Report',
        text: 'Here is my sleep report.',
        files: [file],
      });
    } else {
      alert('Sharing is not supported on this device/browser.');
    }
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Sleep Report for Patient-123</h1>
      <p className="text-gray-500 text-sm">Generated: {new Date().toLocaleString()}</p>
      {loading && <p className="text-gray-500">Generating PDF…</p>}
      {pdfUrl && (
        <>
          <iframe src={pdfUrl} className="w-full h-[80vh] border rounded" title="Sleep Report" />
          <div className="flex gap-3">
            <button onClick={handleDownload} className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">
              Download PDF
            </button>
            <button onClick={handleShare} className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700">
              Share
            </button>
          </div>
        </>
      )}
    </div>
  );
}
