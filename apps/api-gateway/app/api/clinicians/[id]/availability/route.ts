// apps/api-gateway/app/api/clinicians/[id]/availability/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  AvailabilityError,
  isValidAvailabilityDate,
  listAvailabilitySlots,
  normalizeConsultType,
} from '@/src/availability/resolver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'cache-control': 'no-store, max-age=0',
    },
  });
}

function clampInt(
  value: string | null,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = Number.parseInt(
    String(value ?? ''),
    10,
  );

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(
    max,
    Math.max(min, parsed),
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const requestedId = decodeURIComponent(
      String(params.id || ''),
    ).trim();

    if (!requestedId) {
      return json(
        {
          ok: false,
          error: 'clinician_id_required',
          slots: [],
        },
        400,
      );
    }

    const url = new URL(req.url);
    const requestedDays = clampInt(
      url.searchParams.get('days'),
      14,
      1,
      60,
    );
    const from =
      url.searchParams.get('from') ||
      new Date().toISOString().slice(0, 10);

    if (!isValidAvailabilityDate(from)) {
      return json(
        {
          ok: false,
          error: 'invalid_from_date',
          slots: [],
        },
        400,
      );
    }

    const includeUnavailable =
      url.searchParams.get(
        'includeUnavailable',
      ) === '1' ||
      url.searchParams.get(
        'includeUnavailable',
      ) === 'true';

    const consultType = normalizeConsultType(
      url.searchParams.get('consultType') ||
        url.searchParams.get('type') ||
        url.searchParams.get('kind'),
    );

    const caseId =
      String(
        url.searchParams.get('caseId') || '',
      ).trim() || null;


    const result = await listAvailabilitySlots({
      clinicianRef: requestedId,
      from,
      days: requestedDays,
      includeUnavailable,
      consultType,
      caseId,
      enforceBookability: true,
      enforceAdvanceWindow: true,
    });

    return json({
      ok: true,
      slots: result.slots,
      meta: {
        source:
          'api_gateway_canonical_availability_v1',
        requestedId,
        ...result.meta,
        statusLegend: {
          available: 'Bookable now',
          limited:
            'Bookable with a time or pathway warning',
          blocked:
            'Not bookable because of clinician or rule state',
          booked: 'Already reserved or booked',
          past: 'Elapsed time',
        },
      },
    });
  } catch (error: any) {
    console.error(
      '[api-gateway] clinician availability failed',
      error,
    );

    if (error instanceof AvailabilityError) {
      return json(
        {
          ok: false,
          error: error.code,
          details: error.details,
          slots: [],
        },
        error.status,
      );
    }

    return json(
      {
        ok: false,
        error: 'availability_failed',
        detail: String(
          error?.message || error,
        ),
        slots: [],
      },
      500,
    );
  }
}