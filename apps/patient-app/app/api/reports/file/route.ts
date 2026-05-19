// apps/patient-app/app/api/reports/file/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

/**
 * Production-safe report file endpoint.
 *
 * The previous implementation served local sample PDFs from /sample-reports
 * and optionally watermarked them with pdf-lib. That is not acceptable for
 * production patient records because it can expose fake/demo reports.
 *
 * Wire this endpoint to a real report/document store before enabling downloads.
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id') || '';

  if (!id) {
    return json({ ok: false, error: 'report_id_required' }, 400);
  }

  return json(
    {
      ok: false,
      error: 'report_file_store_not_configured',
      message:
        'Report file delivery is disabled until the production document store is connected.',
    },
    503,
  );
}