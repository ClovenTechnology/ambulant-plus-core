import { NextRequest, NextResponse } from 'next/server';

import {
  CLINICIAN_PAY_LATER_PATHWAY_KEY,
  clinicianPayLaterActiveRequestKey,
  publicClinicianPayLaterRequest,
} from '@/src/clinicians/onboarding/pay-later';
import {
  getClinicianOnboardingSettings,
} from '@/src/clinicians/onboarding/settings';
import {
  readIdentity,
  requireTrustedIdentityInProduction,
} from '@/src/lib/identity';
import { prisma } from '@/src/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cleanStr(
  value: unknown,
  max = 2000,
): string | null {
  const text = String(
    value ?? '',
  ).trim();

  if (!text) {
    return null;
  }

  return text.length > max
    ? text.slice(0, max)
    : text;
}

function json(
  body: unknown,
  status = 200,
) {
  return NextResponse.json(
    body,
    {
      status,
      headers: {
        'cache-control':
          'no-store, max-age=0',
      },
    },
  );
}

function jsonSafe(
  value: unknown,
) {
  return JSON.parse(
    JSON.stringify(
      value ?? null,
    ),
  );
}

async function resolveAuthenticatedClinician(
  req: NextRequest,
  requestedClinicianId: string | null,
) {
  const who = readIdentity(
    req.headers,
  );

  requireTrustedIdentityInProduction(
    req.headers,
    who,
  );

  if (!who.uid) {
    return {
      ok: false as const,
      response: json(
        {
          ok: false,
          error: 'unauthorized',
        },
        401,
      ),
    };
  }

  if (who.role !== 'clinician') {
    return {
      ok: false as const,
      response: json(
        {
          ok: false,
          error:
            'clinician_identity_required',
        },
        403,
      ),
    };
  }

  const db: any = prisma;

  let clinician =
    await db.clinicianProfile.findFirst({
      where: {
        OR: [
          {
            userId: who.uid,
          },
          {
            id: who.uid,
          },
        ],
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

  if (
    !clinician &&
    who.actorRefId
  ) {
    clinician =
      await db.clinicianProfile.findFirst({
        where: {
          OR: [
            {
              id: who.actorRefId,
            },
            {
              userId: who.actorRefId,
            },
          ],
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
  }

  if (!clinician) {
    return {
      ok: false as const,
      response: json(
        {
          ok: false,
          error: 'clinician_not_found',
        },
        404,
      ),
    };
  }

  if (
    requestedClinicianId &&
    requestedClinicianId !==
      String(clinician.id) &&
    requestedClinicianId !==
      String(clinician.userId || '')
  ) {
    return {
      ok: false as const,
      response: json(
        {
          ok: false,
          error:
            'clinician_identity_mismatch',
        },
        403,
      ),
    };
  }

  return {
    ok: true as const,
    clinician,
    who,
  };
}

export async function POST(
  req: NextRequest,
) {
  try {
    const body =
      await req.json().catch(
        () => ({} as any),
      );

    const requestedClinicianId =
      cleanStr(
        body.clinicianId,
        120,
      );

    const requestedPathwayKey =
      String(
        body.pathwayKey ||
          CLINICIAN_PAY_LATER_PATHWAY_KEY,
      )
        .trim()
        .toUpperCase();

    if (
      requestedPathwayKey !==
      CLINICIAN_PAY_LATER_PATHWAY_KEY
    ) {
      return json(
        {
          ok: false,
          error:
            'invalid_pay_later_pathway',
        },
        400,
      );
    }

    const identity =
      await resolveAuthenticatedClinician(
        req,
        requestedClinicianId,
      );

    if (!identity.ok) {
      return identity.response;
    }

    const { clinician, who } =
      identity;

    const settings =
      await getClinicianOnboardingSettings();

    const configuredPathway =
      settings.commercialPathways.find(
        (pathway) =>
          pathway.key ===
          CLINICIAN_PAY_LATER_PATHWAY_KEY,
      );

    if (
      !configuredPathway ||
      configuredPathway.enabled !== true
    ) {
      return json(
        {
          ok: false,
          error:
            'pay_later_pathway_disabled',
        },
        409,
      );
    }

    const db: any = prisma;

    const onboarding =
      await db.clinicianOnboarding.findFirst({
        where: {
          clinicianId:
            String(clinician.id),
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

    if (!onboarding) {
      return json(
        {
          ok: false,
          error:
            'clinician_onboarding_not_found',
        },
        409,
      );
    }

    const paymentPlan =
      String(
        onboarding.paymentPlan || '',
      )
        .trim()
        .toUpperCase();

    if (
      onboarding.depositPaid === true ||
      paymentPlan ===
        'QUALIFYING_DEPOSIT' ||
      paymentPlan ===
        'FULL_PAYMENT'
    ) {
      return json(
        {
          ok: false,
          error:
            'pay_later_not_available_after_qualifying_payment',
        },
        409,
      );
    }

    if (
      paymentPlan ===
      'WAIVER_TRAIN_NOW_PAY_LATER'
    ) {
      const approvedRequest =
        await db.clinicianOnboardingPayLaterRequest.findFirst({
          where: {
            clinicianId:
              String(clinician.id),
            status: 'approved',
          },
          orderBy: [
            {
              reviewedAt: 'desc',
            },
            {
              requestedAt: 'desc',
            },
          ],
        });

      return json({
        ok: true,
        created: false,
        alreadyApproved: true,
        request:
          publicClinicianPayLaterRequest(
            approvedRequest,
          ),
        approvalSource:
          approvedRequest
            ? 'clinician_request'
            : 'manual_admin_waiver',
        message:
          'Pay Later training access has already been approved.',
      });
    }

    const activeRequestKey =
      clinicianPayLaterActiveRequestKey(
        clinician.id,
      );

    const activeRequest =
      await db.clinicianOnboardingPayLaterRequest.findUnique({
        where: {
          activeRequestKey,
        },
      });

    if (activeRequest) {
      return json({
        ok: true,
        created: false,
        request:
          publicClinicianPayLaterRequest(
            activeRequest,
          ),
        message:
          'Your Pay Later request is already awaiting Admin review.',
      });
    }

    const requestReason =
      cleanStr(
        body.requestReason ||
          body.reason ||
          body.message,
        2000,
      );

    const selectedSlotId =
      cleanStr(
        body.slotId ||
          body.trainingSlotId,
        120,
      );

    const rawTrainingMode =
      String(
        body.trainingMode ||
          body.mode || '',
      )
        .trim()
        .toLowerCase();

    const trainingMode =
      rawTrainingMode ===
        'virtual' ||
      rawTrainingMode ===
        'in_person'
        ? rawTrainingMode
        : null;

    let requestRow;

    try {
      requestRow =
        await db.clinicianOnboardingPayLaterRequest.create({
          data: {
            clinicianId:
              String(clinician.id),
            onboardingId:
              String(onboarding.id),
            pathwayKey:
              CLINICIAN_PAY_LATER_PATHWAY_KEY,
            status: 'pending',
            requestReason,
            requestedByUserId:
              String(who.uid),
            activeRequestKey,
            meta: jsonSafe({
              source:
                'clinician_training_pay_later_request',
              selectedSlotId,
              trainingMode,
              identitySource:
                who.source || null,
              identityTrusted:
                who.trusted === true,
              submittedFrom:
                'clinician-app',
            }),
          },
        });
    } catch (error: any) {
      if (
        String(error?.code || '') ===
        'P2002'
      ) {
        requestRow =
          await db.clinicianOnboardingPayLaterRequest.findUnique({
            where: {
              activeRequestKey,
            },
          });
      } else {
        throw error;
      }
    }

    if (!requestRow) {
      throw new Error(
        'pay_later_request_not_persisted',
      );
    }

    return json(
      {
        ok: true,
        created: true,
        request:
          publicClinicianPayLaterRequest(
            requestRow,
          ),
        message:
          'Your Pay Later request has been submitted for Ambulant+ Admin review.',
      },
      201,
    );
  } catch (error: any) {
    const message = String(
      error?.message ||
        'pay_later_request_failed',
    );

    if (
      message === 'Unauthorized' ||
      message === 'unauthorized'
    ) {
      return json(
        {
          ok: false,
          error: 'unauthorized',
        },
        401,
      );
    }

    if (
      String(error?.code || '') ===
        'P2021' ||
      String(error?.code || '') ===
        'P2022' ||
      message.includes(
        'ClinicianOnboardingPayLaterRequest',
      )
    ) {
      return json(
        {
          ok: false,
          error:
            'pay_later_request_storage_unavailable',
          message:
            'The Pay Later request service is awaiting its database migration.',
        },
        503,
      );
    }

    console.error(
      '[api-gateway][clinicians/onboarding/pay-later/request] failed',
      {
        message,
      },
    );

    return json(
      {
        ok: false,
        error: message,
      },
      500,
    );
  }
}
