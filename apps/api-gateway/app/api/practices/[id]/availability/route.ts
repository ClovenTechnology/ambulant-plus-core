// apps/api-gateway/app/api/practices/[id]/availability/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import {
  AvailabilityError,
  isValidAvailabilityDate,
  listAvailabilitySlots,
  normalizeConsultType,
} from '@/src/availability/resolver';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INACTIVE_MEMBER_STATUSES =
  new Set(['inactive', 'disabled', 'removed', 'deleted']);

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'cache-control': 'no-store, max-age=0',
    },
  });
}

function clean(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function clampInt(
  value: string | null,
  fallback: number,
  min: number,
  max: number,
) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function activePracticeMember(member: any) {
  if (!clean(member?.userId)) return false;

  const status = clean(
    member?.status || 'active',
    80,
  ).toLowerCase();

  return !INACTIVE_MEMBER_STATUSES.has(status);
}

function clinicianLabel(
  clinician: any,
  member: any,
) {
  return (
    clean(clinician?.displayName) ||
    clean(member?.fullName) ||
    clean(member?.email) ||
    'Clinician'
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const practiceId = clean(params?.id);

    if (!practiceId) {
      return json(
        {
          ok: false,
          error: 'practice_id_required',
          slots: [],
        },
        400,
      );
    }

    const practice = await (prisma as any).practice.findUnique({
      where: { id: practiceId },
      select: {
        id: true,
        name: true,
        status: true,
      },
    });

    if (!practice) {
      return json(
        {
          ok: false,
          error: 'practice_not_found',
          slots: [],
        },
        404,
      );
    }

    if (
      ['inactive', 'disabled', 'removed', 'deleted'].includes(
        clean(practice.status, 80).toLowerCase(),
      )
    ) {
      return json(
        {
          ok: false,
          error: 'practice_not_available',
          slots: [],
        },
        409,
      );
    }

    const query = req.nextUrl.searchParams;
    const from = clean(
      query.get('from') ||
        query.get('start') ||
        new Date().toISOString().slice(0, 10),
      10,
    ).slice(0, 10);

    if (!isValidAvailabilityDate(from)) {
      return json(
        {
          ok: false,
          error: 'invalid_from',
          slots: [],
        },
        400,
      );
    }

    const days = clampInt(
      query.get('days'),
      14,
      1,
      60,
    );

    const consultType = normalizeConsultType(
      query.get('consultType') ||
        query.get('type') ||
        query.get('kind'),
    );

    const caseId =
      clean(query.get('caseId') || query.get('case_id')) ||
      null;

    const members =
      await (prisma as any).practiceMember.findMany({
        where: { practiceId },
        select: {
          id: true,
          userId: true,
          fullName: true,
          email: true,
          role: true,
          status: true,
        },
      });

    const activeMembers = members.filter(
      activePracticeMember,
    );

    const userIds = Array.from(
      new Set(
        activeMembers
          .map((member: any) => clean(member.userId))
          .filter(Boolean),
      ),
    );

    if (!userIds.length) {
      return json({
        ok: true,
        practiceId,
        practiceName: practice.name,
        slots: [],
        meta: {
          source:
            'api_gateway_canonical_practice_availability_v1',
          from,
          days,
          consultType,
          clinicianCount: 0,
        },
      });
    }

    const clinicians =
      await (prisma as any).clinicianProfile.findMany({
        where: {
          userId: { in: userIds },
        },
        select: {
          id: true,
          userId: true,
          displayName: true,
          specialty: true,
          gender: true,
          ratingAvg: true,
          acceptsMedicalAid: true,
          status: true,
          disabled: true,
          archived: true,
          trainingCompleted: true,
        },
      });

    const memberByUserId = new Map(
      activeMembers.map((member: any) => [
        clean(member.userId),
        member,
      ]),
    );

    const failures: Array<{
      clinicianId: string;
      error: string;
    }> = [];

    const grouped = await Promise.all(
      clinicians.map(async (clinician: any) => {
        try {
          const result = await listAvailabilitySlots({
            clinicianRef: clinician.id,
            from,
            days,
            consultType,
            caseId,
            includeUnavailable: false,
            enforceBookability: true,
            enforceAdvanceWindow: true,
          });

          const member =
            memberByUserId.get(
              clean(clinician.userId),
            );

          const clinicianName =
            clinicianLabel(clinician, member);

          return result.slots.map((slot) => ({
            ...slot,
            clinicianId: clinician.id,
            clinicianUserId: clinician.userId,
            clinicianName,
            specialty:
              clean(clinician.specialty) || undefined,
            gender:
              clean(clinician.gender) || undefined,
            rating:
              Number.isFinite(
                Number(clinician.ratingAvg),
              )
                ? Number(clinician.ratingAvg)
                : undefined,
            acceptsMedicalAid:
              Boolean(clinician.acceptsMedicalAid),
            priceCents: slot.feeCents,
          }));
        } catch (error: any) {
          failures.push({
            clinicianId: clean(clinician.id),
            error:
              error instanceof AvailabilityError
                ? error.code
                : clean(
                    error?.message ||
                      'availability_failed',
                  ),
          });

          return [];
        }
      }),
    );

    const slots = grouped
      .flat()
      .sort((a, b) => {
        const time =
          new Date(a.start).getTime() -
          new Date(b.start).getTime();

        if (time !== 0) return time;

        return String(a.clinicianName || '')
          .localeCompare(
            String(b.clinicianName || ''),
          );
      });

    return json({
      ok: true,
      practiceId,
      practiceName: practice.name,
      slots,
      meta: {
        source:
          'api_gateway_canonical_practice_availability_v1',
        from,
        days,
        consultType,
        clinicianCount: clinicians.length,
        slotCount: slots.length,
        failures,
      },
    });
  } catch (error: any) {
    console.error(
      '[api-gateway] practice availability failed',
      error,
    );

    return json(
      {
        ok: false,
        error:
          error?.message ||
          'practice_availability_failed',
        slots: [],
      },
      500,
    );
  }
}
