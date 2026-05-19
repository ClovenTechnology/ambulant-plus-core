// apps/patient-app/app/api/medreach/reports/file/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Production-safe disabled report file route.
 *
 * Previous implementation served files from local .data/public sample folders.
 * Patient lab files must come from a real document store or signed URL service.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const name = (url.searchParams.get('name') || url.searchParams.get('fileKey') || '').trim();

  if (!name) {
    return NextResponse.json(
      { ok: false, error: 'fileKey_required' },
      { status: 400 },
    );
  }

  return NextResponse.json(
    {
      ok: false,
      error: 'medreach_report_file_store_not_configured',
      message:
        'MedReach report file delivery is disabled until the production document store is connected.',
    },
    { status: 503 },
  );
}