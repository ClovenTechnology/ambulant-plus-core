// apps/patient-app/app/api/careport/reprint/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Production-safe disabled endpoint.
 *
 * The previous implementation read/wrote packages/careport/erx.json.
 * Local JSON/file-store behaviour must not be used for production patient eRx.
 *
 * Reprint must be re-enabled only after a real API-gateway/document-store
 * endpoint exists.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const id = String(body?.id || body?.erxOrderId || '').trim();

  if (!id) {
    return NextResponse.json(
      { ok: false, error: 'id_required' },
      { status: 400 },
    );
  }

  return NextResponse.json(
    {
      ok: false,
      error: 'careport_reprint_service_not_configured',
      message:
        'CarePort eRx reprint is disabled until the production document-store workflow is connected.',
    },
    { status: 503 },
  );
}