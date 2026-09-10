// apps/patient-app/src/analytics/report.ts

export type HealthReportSections = {
  bp?: boolean;
  sleep?: boolean;
  fertility?: boolean;
  stress?: boolean;
  antenatal?: boolean;
  antenatalHandoff?: boolean;
  ladyCenter?: boolean;
};

function safeFilename(response: Response): string {
  const disposition = response.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="?([^";]+)"?/i);
  return match?.[1] || `ambulant-health-report-${Date.now()}.pdf`;
}

export async function generateHealthReport(
  _legacySubject: string,
  sections: HealthReportSections = {},
): Promise<{ blob: Blob; filename: string }> {
  if (sections.antenatal || sections.antenatalHandoff || sections.ladyCenter) {
    throw new Error('unsupported_report_section_use_dedicated_server_report');
  }

  const response = await fetch('/api/reports/sleep', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sections }),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`health_report_failed_${response.status}`);
  }

  return {
    blob: await response.blob(),
    filename: safeFilename(response),
  };
}
