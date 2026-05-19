// apps/patient-app/src/components/ReportPanel.tsx
'use client';

import React, { useState } from 'react';
import { generateHealthReport } from '@/src/analytics/report';

type ReportSectionKey = 'bp' | 'sleep' | 'fertility' | 'stress';

type Props = {
  userId: string;
};

const REPORT_SECTIONS: Array<{ key: ReportSectionKey; label: string }> = [
  { key: 'bp', label: 'Blood pressure / health monitor' },
  { key: 'sleep', label: 'Sleep' },
  { key: 'fertility', label: 'Fertility' },
  { key: 'stress', label: 'Stress' },
];

export const ReportPanel: React.FC<Props> = ({ userId }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedSections, setSelectedSections] = useState<
    Record<ReportSectionKey, boolean>
  >({
    bp: true,
    sleep: true,
    fertility: true,
    stress: true,
  });

  const toggleSection = (key: ReportSectionKey) => {
    setSelectedSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleDownload = async () => {
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      const { blob, filename } = await generateHealthReport(userId, selectedSections);

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = filename;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to generate report', err);
      setError('Failed to generate report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const hasSelectedSection = Object.values(selectedSections).some(Boolean);

  return (
    <div className="space-y-4 rounded-xl bg-white p-4 shadow">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          Generate Health Report
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Select the sections to include, then download the PDF report.
        </p>
      </div>

      <div className="space-y-2">
        {REPORT_SECTIONS.map((section) => (
          <label
            key={section.key}
            className="flex items-center gap-2 text-sm text-slate-700"
          >
            <input
              type="checkbox"
              checked={selectedSections[section.key]}
              onChange={() => toggleSection(section.key)}
              className="h-4 w-4 rounded border-slate-300"
            />
            <span>{section.label}</span>
          </label>
        ))}
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={handleDownload}
        disabled={loading || !hasSelectedSection}
        className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? 'Generating…' : 'Download PDF'}
      </button>
    </div>
  );
};

export default ReportPanel;