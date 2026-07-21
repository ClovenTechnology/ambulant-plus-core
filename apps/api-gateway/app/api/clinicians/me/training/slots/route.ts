import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import {
  resolveAuthenticatedClinician,
} from '@/src/clinicians/onboarding/auth';
import {
  publicTrainingSlot,
} from '@/src/clinicians/onboarding/training';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const requestedClinicianId =
      request.nextUrl.searchParams.get('clinicianId');

    const identity =
      await resolveAuthenticatedClinician(
        request,
        requestedClinicianId,
      );

    if (!identity.ok) {
      return identity.response;
    }

    const now = new Date();

    const slots =
      await prisma.clinicianTrainingSlot.findMany({
        where: {
          status: 'published',
          endsAt: {
            gt: now,
          },
          AND: [
            {
              OR: [
                { bookingOpensAt: null },
                { bookingOpensAt: { lte: now } },
              ],
            },
            {
              OR: [
                { bookingClosesAt: null },
                { bookingClosesAt: { gt: now } },
              ],
            },
          ],
        },
        orderBy: [
          { startsAt: 'asc' },
          { createdAt: 'asc' },
        ],
        take: 100,
      });

    const publicSlots = slots
      .map(publicTrainingSlot)
      .filter((slot) => slot.seatsLeft > 0);

    return NextResponse.json(
      {
        ok: true,
        slots: publicSlots,
        count: publicSlots.length,
      },
      {
        headers: {
          'cache-control': 'no-store',
        },
      },
    );
  } catch (error: any) {
    console.error('[clinician-training-slots] error', error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message ||
          'training_slots_fetch_failed',
      },
      { status: 500 },
    );
  }
}
