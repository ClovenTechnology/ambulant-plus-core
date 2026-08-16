// apps/api-gateway/app/api/practices/[id]/patient-view/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

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

function activePracticeMember(member: any) {
  if (!clean(member?.userId)) return false;

  const status = clean(
    member?.status || 'active',
    80,
  ).toLowerCase();

  return !INACTIVE_MEMBER_STATUSES.has(status);
}

function clinicianBookable(clinician: any) {
  if (
    clinician?.disabled ||
    clinician?.archived
  ) {
    return false;
  }

  const status = clean(
    clinician?.status,
    80,
  ).toLowerCase();

  if (
    !['active', 'approved', 'verified'].includes(
      status,
    )
  ) {
    return false;
  }

  return clinician?.trainingCompleted !== false;
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
        },
        400,
      );
    }

    const practice =
      await (prisma as any).practice.findUnique({
        where: { id: practiceId },
        include: {
          locations: true,
          members: true,
        },
      });

    if (!practice) {
      return json(
        {
          ok: false,
          error: 'practice_not_found',
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
        },
        409,
      );
    }

    const activeMembers =
      (practice.members || []).filter(
        activePracticeMember,
      );

    const userIds = Array.from(
      new Set(
        activeMembers
          .map((member: any) => clean(member.userId))
          .filter(Boolean),
      ),
    );

    const clinicians = userIds.length
      ? await (prisma as any).clinicianProfile.findMany({
          where: {
            userId: { in: userIds },
          },
          select: {
            id: true,
            userId: true,
            displayName: true,
            specialty: true,
            gender: true,
            feeCents: true,
            currency: true,
            ratingAvg: true,
            ratingCount: true,
            acceptsMedicalAid: true,
            acceptedSchemes: true,
            status: true,
            disabled: true,
            archived: true,
            trainingCompleted: true,
          },
        })
      : [];

    const bookableClinicians =
      clinicians.filter(clinicianBookable);

    const memberByUserId = new Map<string, any>(
      activeMembers.map((member: any) => [
        clean(member.userId),
        member,
      ]),
    );

    const now = new Date();

    const feeRows =
      userIds.length &&
      (prisma as any).clinicianFee?.findMany
        ? await (prisma as any).clinicianFee.findMany({
            where: {
              clinicianUserId: { in: userIds },
              kind: 'STANDARD',
              active: true,
              effectiveFrom: { lte: now },
              OR: [
                { effectiveTo: null },
                { effectiveTo: { gt: now } },
              ],
            },
            orderBy: {
              effectiveFrom: 'desc',
            },
          })
        : [];

    const feeByUserId =
      new Map<string, any>();

    for (const fee of feeRows || []) {
      const userId = clean(fee?.clinicianUserId);
      if (userId && !feeByUserId.has(userId)) {
        feeByUserId.set(userId, fee);
      }
    }

    const viewerUid = clean(
      req.headers.get('x-uid') ||
        req.headers.get('x-user-id') ||
        req.headers.get('x-ambulant-user-id'),
    );

    const profileIds =
      bookableClinicians.map(
        (clinician: any) => clean(clinician.id),
      );

    const seenClinicianIds =
      new Set<string>();

    if (
      viewerUid &&
      profileIds.length
    ) {
      const rows =
        await (prisma as any).appointment.findMany({
          where: {
            hostUserId: viewerUid,
            clinicianId: {
              in: profileIds,
            },
            status: {
              notIn: [
                'canceled',
                'cancelled',
              ],
            },
          },
          select: {
            clinicianId: true,
          },
          distinct: ['clinicianId'],
        });

      for (const row of rows || []) {
        const clinicianId = clean(
          row?.clinicianId,
        );

        if (clinicianId) {
          seenClinicianIds.add(clinicianId);
        }
      }
    }

    const clinicianPayload =
      bookableClinicians
        .map((clinician: any) => {
          const userId = clean(
            clinician.userId,
          );
          const member =
            memberByUserId.get(userId);
          const fee =
            feeByUserId.get(userId);

          const priceCents =
            fee &&
            Number.isFinite(
              Number(fee.amountMinor),
            )
              ? Number(fee.amountMinor)
              : Number.isFinite(
                    Number(clinician.feeCents),
                  )
                ? Number(clinician.feeCents)
                : undefined;

          return {
            id: clinician.id,
            clinicianId: clinician.id,
            clinicianUserId:
              clinician.userId,
            name:
              clean(clinician.displayName) ||
              clean(member?.fullName) ||
              clean(member?.email) ||
              'Clinician',
            specialty:
              clean(clinician.specialty) ||
              undefined,
            gender:
              clean(clinician.gender) ||
              undefined,
            priceCents,
            feeCents: priceCents,
            currency:
              clean(fee?.currency) ||
              clean(clinician.currency) ||
              'ZAR',
            rating:
              Number.isFinite(
                Number(clinician.ratingAvg),
              )
                ? Number(clinician.ratingAvg)
                : undefined,
            ratingCount:
              Number.isFinite(
                Number(clinician.ratingCount),
              )
                ? Number(clinician.ratingCount)
                : undefined,
            acceptsMedicalAid:
              Boolean(
                clinician.acceptsMedicalAid,
              ),
            acceptedSchemes:
              Array.isArray(
                clinician.acceptedSchemes,
              )
                ? clinician.acceptedSchemes
                : [],
            hasEncounter:
              seenClinicianIds.has(
                clean(clinician.id),
              ),
          };
        })
        .sort((a: any, b: any) =>
          String(a.name).localeCompare(
            String(b.name),
          ),
        );

    return json({
      ok: true,
      practice: {
        id: practice.id,
        name: practice.name,
        practiceNumber:
          practice.practiceNumber || null,
        status: practice.status,
        acceptsMedicalAid:
          Boolean(practice.acceptsMedicalAid),
        acceptedSchemes:
          Array.isArray(practice.acceptedSchemes)
            ? practice.acceptedSchemes
            : [],
        locations:
          Array.isArray(practice.locations)
            ? practice.locations
            : [],
      },
      clinicians: clinicianPayload,
      source:
        'api_gateway_practice_patient_view_v1',
    });
  } catch (error: any) {
    console.error(
      '[api-gateway] practice patient view failed',
      error,
    );

    return json(
      {
        ok: false,
        error:
          error?.message ||
          'practice_patient_view_failed',
      },
      500,
    );
  }
}
