// apps/patient-app/app/api/practices/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PRACTICES_BY_COUNTRY, getMockPracticesForCountry } from '@/mock/practices';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Patient-facing practices listing.
 *
 * Accepts optional query param `country=XX` (ISO 2-letter code)
 * to return practices for that country. Defaults to South Africa (ZA).
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const country = (url.searchParams.get('country') ?? 'ZA').toUpperCase();

    const practices = getMockPracticesForCountry(country) || PRACTICES_BY_COUNTRY.ZA;

    return NextResponse.json({ ok: true, country, practices });
  } catch (err: any) {
    console.error('[patient-api][practices] GET error, returning mock fallback', err);

    return NextResponse.json(
      {
        ok: true,
        country: 'ZA',
        practices: PRACTICES_BY_COUNTRY.ZA,
        error: err?.message ?? 'Using mock practices fallback',
      },
      { status: 200 }
    );
  }
}
