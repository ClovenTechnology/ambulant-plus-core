// apps/api-gateway/app/api/schedule/slots/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  addAvailabilityDays,
  AvailabilityError,
  isValidAvailabilityDate,
  listAvailabilitySlots,
} from '@/src/availability/resolver';

export const dynamic = 'force-dynamic';

type BatchParams = {
  start?: string;
  days?: number;
  clinicianId?: string;
};

async function parseParams(
  req: NextRequest,
): Promise<BatchParams> {
  if (req.method === 'GET') {
    const query = req.nextUrl.searchParams;

    return {
      start: query.get('start') ?? undefined,
      days: query.get('days')
        ? Number(query.get('days'))
        : undefined,
      clinicianId:
        query.get('clinicianId') ??
        query.get('clinician_id') ??
        undefined,
    };
  }

  const body = await req
    .json()
    .catch(() => ({} as any));

  return {
    start: body.start,
    days:
      typeof body.days === 'number'
        ? body.days
        : undefined,
    clinicianId:
      body.clinicianId ||
      body.clinician_id,
  };
}

function groupSlots(
  from: string,
  days: number,
  slots: Array<{
    localDate: string;
    start: string;
    end: string;
    status?: string;
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
      ...(slot.status
        ? { status: slot.status }
        : {}),
    });
  }

  return output;
}

async function handleBatch(req: NextRequest) {
  const {
    start,
    days = 42,
    clinicianId,
  } = await parseParams(req);

  const from = String(start || '').slice(0, 10);

  if (
    !from ||
    !clinicianId ||
    !isValidAvailabilityDate(from)
  ) {
    return NextResponse.json(
      {
        error:
          !start || !clinicianId
            ? 'missing_start_or_clinicianId'
            : 'invalid_start',
      },
      { status: 400 },
    );
  }

  const safeDays = Math.max(
    1,
    Math.min(
      62,
      Math.floor(Number(days || 42)),
    ),
  );

  try {
    const result = await listAvailabilitySlots({
      clinicianRef: clinicianId,
      from,
      days: safeDays,
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
    console.error(
      'schedule/slots error',
      error,
    );

    if (error instanceof AvailabilityError) {
      return NextResponse.json(
        {
          error: error.code,
          details: error.details,
        },
        { status: error.status },
      );
    }

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

export async function GET(req: NextRequest) {
  return handleBatch(req);
}

export async function POST(req: NextRequest) {
  return handleBatch(req);
}