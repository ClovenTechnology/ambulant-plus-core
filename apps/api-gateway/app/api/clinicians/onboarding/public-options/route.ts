import { NextResponse } from 'next/server';
import {
  getClinicianOnboardingSettings,
  publicClinicianOnboardingCommercialOffer,
} from '@/src/clinicians/onboarding/settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const settings = await getClinicianOnboardingSettings();
    return NextResponse.json(
      {
        ok: true,
        offer: publicClinicianOnboardingCommercialOffer(settings),
      },
      {
        headers: {
          'cache-control': 'no-store',
        },
      },
    );
  } catch (error) {
    console.error('[clinician public C-Med options] failed', error);
    return NextResponse.json(
      { ok: false, error: 'clinician_commercial_options_unavailable' },
      { status: 500 },
    );
  }
}
