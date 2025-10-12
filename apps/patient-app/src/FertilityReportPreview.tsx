import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { generateHealthReport } from '../analytics/report';

export default function FertilityReportPreview() {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    try {
      // Only generate fertility section
      const { blob, filename } = await generateHealthReport('demoUser', {
        fertility: true,
      });
      const pdfUrl = URL.createObjectURL(blob);
      setUrl(pdfUrl);
      console.log(`Report generated: ${filename}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Fertility Report Preview</h1>
      <p className="text-sm text-gray-600">
        Generate a fertility PDF report with your latest NexRing data, including
        calendar, line chart, and ovulation marker.
      </p>

      <Button onClick={handleGenerate} disabled={loading}>
        {loading ? 'Generating…' : 'Preview Report'}
      </Button>

      {url && (
        <iframe
          src={url}
          className="w-full h-[600px] border rounded"
          title="Fertility Report PDF"
        />
      )}
    </div>
  );
}
