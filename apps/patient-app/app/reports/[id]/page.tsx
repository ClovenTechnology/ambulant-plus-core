import { redirect } from 'next/navigation';

export default function LegacyReportDetailPage() {
  // Direct identifier-based report-file URLs are retired. Authenticated report
  // generation now happens through the governed report endpoints.
  redirect('/reports');
}
