import { NextRequest, NextResponse } from 'next/server';
import {
  resolveAuthenticatedClinician,
} from '@/src/clinicians/onboarding/auth';
import {
  bookClinicianTrainingSlot,
  normaliseTrainingMode,
} from '@/src/clinicians/onboarding/training';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body =
      await request.json().catch(() => ({} as any));

    const requestedClinicianId =
      String(body?.clinicianId || '').trim();

    const slotId =
      String(
        body?.slotId ||
        body?.trainingSlotId ||
        '',
      ).trim();

    if (!slotId) {
      return NextResponse.json(
        {
          ok: false,
          error: 'slotId_required',
        },
        { status: 400 },
      );
    }

    const identity =
      await resolveAuthenticatedClinician(
        request,
        requestedClinicianId,
      );

    if (!identity.ok) {
      return identity.response;
    }

    const result =
      await bookClinicianTrainingSlot({
        clinicianId: String(identity.clinician.id),
        slotId,
        mode: normaliseTrainingMode(
          body?.mode ||
          body?.trainingMode,
        ),
      });

    return NextResponse.json(
      result.body,
      {
        status: result.status,
        headers: {
          'cache-control': 'no-store',
        },
      },
    );
  } catch (error: any) {
    console.error('[clinician-training-book] error', error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          'training_booking_failed',
      },
      { status: 500 },
    );
  }
}
