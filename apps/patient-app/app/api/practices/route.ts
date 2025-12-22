// apps/patient-app/app/api/practices/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PRACTICES } from '@/mock/practices';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Patient-facing practices listing.
 *
 * For now this returns the mock PRACTICES list.
 * Later we can:
 *   - call API Gateway (/api/practices) here
 *   - and fall back to PRACTICES on failure.
 */
export async function GET(_req: NextRequest) {
  try {
    return NextResponse.json({ ok: true, practices: PRACTICES });
  } catch (err: any) {
    console.error('[patient-api][practices] GET error, returning mock fallback', err);
    // Even if something goes wrong, keep the UI usable with mocks.
    return NextResponse.json(
      {
        ok: true,
        practices: PRACTICES,
        error: err?.message ?? 'Using mock practices fallback',
      },
      { status: 200 },
    );
  }
}
