// apps/patient-app/src/components/ReportPanel.tsx

import React, { useState } from 'react';
import { generateHealthReport } from '@/analytics/report';

type Props = {
  userId: string;
};

export const ReportPanel: React.FC<Props> = ({ userId }) => {
  const [loading, setLoading] = useState(false);
  const [selectedSections, setSelectedSections] = useState<Record<string, boolean>>({
    bp: true,
    sleep: true,
    fertility: true,
    stress: true,
  });

  const toggleSection = (key: string) => {
    setSelectedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleDownload = async () => {
    setLoading(true);
    try {
      const pdfBlob = await generateHealthReport(userId);
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `health_report_${userId}.pdf`;
      link.click();
    } catch (err) {
      console.error('Failed to generate report', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-white shadow rounded-xl space-y-4">
      <h2 className="text-lg font-semibold">Generate Health Report</h2>
      <div className="space-y-2">
        {Object.entries(selectedSections).map(([key, val]) => (
          <label key={key} className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={val}
              onChange={() => toggleSection(key)}
            />
            <span className="capitalize">{key}</span>
          </label>
        ))}
      </div>
      <button
        onClick={handleDownload}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Generating…' : 'Download PDF'}
      </button>
    </div>
  );
};
