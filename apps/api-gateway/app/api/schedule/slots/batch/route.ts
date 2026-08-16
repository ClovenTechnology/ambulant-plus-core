// (Alternate) apps/api-gateway/app/api/schedule/slots/batch/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  addAvailabilityDays,
  AvailabilityError,
  isValidAvailabilityDate,
  listAvailabilitySlots,
} from '@/src/availability/resolver';

export const dynamic = 'force-dynamic';

function groupSlots(
  from: string,
  days: number,
  slots: Array<{
    localDate: string;
    start: string;
    end: string;
  }>,
) {
  const output: Record<string, any[]> = {};

  for (let index = 0; index < days; index += 1) {
    output[addAvailabilityDays(from, index)] = [];
  }

  for (const slot of slots) {
    const key = slot.localDate;

    if (!output[key]) {
      output[key] = [];
    }

    output[key].push({
      start: slot.start,
      end: slot.end,
      label: 'Available',
    });
  }

  return output;
}

export async function POST(req: NextRequest) {
  const body = await req
    .json()
    .catch(() => ({} as any));

  const from = String(
    body.start || '',
  ).slice(0, 10);

  const days = Math.max(
    1,
    Math.min(
      62,
      Math.floor(Number(body.days || 42)),
    ),
  );

  const clinicianId = String(
    body.clinicianId ||
      body.clinician_id ||
      '',
  ).trim();

  if (!from || !clinicianId) {
    return NextResponse.json(
      { error: 'missing_start_or_clinicianId' },
      { status: 400 },
    );
  }

  if (!isValidAvailabilityDate(from)) {
    return NextResponse.json(
      { error: 'invalid_start' },
      { status: 400 },
    );
  }

  try {
    const result = await listAvailabilitySlots({
      clinicianRef: clinicianId,
      from,
      days,
      consultType: 'standard',
      includeUnavailable: false,
      enforceBookability: false,
      enforceAdvanceWindow: true,
    });

    return NextResponse.json({
      slots: groupSlots(
        from,
        result.meta.days,
        result.slots,
      ),
    });
  } catch (error: any) {
    if (error instanceof AvailabilityError) {
      return NextResponse.json(
        {
          error: error.code,
          details: error.details,
        },
        { status: error.status },
      );
    }

    console.error(
      'schedule/slots/batch error',
      error,
    );

    return NextResponse.json(
      {
        error: 'server_error',
        message: String(
          error?.message || error,
        ),
      },
      { status: 500 },
    );
  }
}