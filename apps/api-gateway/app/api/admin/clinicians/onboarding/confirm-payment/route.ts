// apps/api-gateway/app/api/admin/clinicians/onboarding/confirm-payment/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { getClinicianOnboardingSettings } from '@/src/clinicians/onboarding/settings';
import { verifyAdminRequest } from '../../../utils/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cleanStr(
  value: unknown,
  max = 500,
): string | null {
  const text = String(value ?? '').trim();

  if (!text) return null;

  return text.length > max
    ? text.slice(0, max)
    : text;
}

function jsonSafe(value: unknown) {
  return JSON.parse(
    JSON.stringify(value ?? null),
  );
}

function jsonObject(
  value: unknown,
): Record<string, unknown> {
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value)
  ) {
    return jsonSafe(value);
  }

  return {};
}

function parseDate(
  value: unknown,
): Date | null {
  const text = cleanStr(value, 80);

  if (!text) return null;

  const date = new Date(text);

  return Number.isFinite(date.getTime())
    ? date
    : null;
}

function amountFromBody(
  value: unknown,
) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return null;
  }

  return Math.max(
    0,
    Math.round(amount),
  );
}

function errorResponse(
  error: string,
  status: number,
) {
  return NextResponse.json(
    {
      ok: false,
      error,
    },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  );
}

export async function POST(
  req: NextRequest,
) {
  try {
    const isAdmin =
      await verifyAdminRequest(req);

    if (isAdmin.ok === false) {
      return isAdmin.response;
    }

    const body =
      (await req
        .json()
        .catch(() => ({}))) as any;

    const paymentId =
      cleanStr(body.paymentId, 120);

    const clinicianId =
      cleanStr(body.clinicianId, 120);

    const requestedOnboardingId =
      cleanStr(body.onboardingId, 120);

    const slotId =
      cleanStr(
        body.slotId ||
          body.trainingSlotId,
        120,
      );

    const paymentReference =
      cleanStr(
        body.paymentReference ||
          body.reference,
        180,
      );

    const payerName =
      cleanStr(body.payerName, 240);

    const originBank =
      cleanStr(body.originBank, 240);

    const suppliedProofOfPaymentUrl =
      cleanStr(
        body.proofOfPaymentUrl,
        1000,
      );

    const suppliedPaymentDate =
      parseDate(body.paymentDate);

    const requestedProvider =
      cleanStr(
        body.provider ||
          body.paymentMethod ||
          'eft',
        40,
      )?.toLowerCase() || 'eft';

    if (!clinicianId) {
      return errorResponse(
        'clinicianId_required',
        400,
      );
    }

    if (!slotId) {
      return errorResponse(
        'slotId_required',
        400,
      );
    }

    if (!paymentReference) {
      return errorResponse(
        'paymentReference_required',
        400,
      );
    }

    if (!payerName) {
      return errorResponse(
        'payerName_required',
        400,
      );
    }

    const settings =
      await getClinicianOnboardingSettings();

    if (!settings.manualPaymentEnabled) {
      return errorResponse(
        'manual_payment_disabled',
        409,
      );
    }

    if (settings.trainingFeeCents <= 0) {
      return errorResponse(
        'training_fee_not_configured',
        409,
      );
    }

    const clinician =
      await prisma.clinicianProfile
        .findUnique({
          where: {
            id: clinicianId,
          },
        });

    if (!clinician) {
      return errorResponse(
        'clinician_not_found',
        404,
      );
    }

    const slot =
      await prisma.clinicianTrainingSlot
        .findUnique({
          where: {
            id: slotId,
          },
        });

    if (!slot) {
      return errorResponse(
        'training_slot_not_found',
        404,
      );
    }

    const onboarding =
      await prisma.clinicianOnboarding
        .upsert({
          where: {
            clinicianId,
          },
          update: {},
          create: {
            clinicianId,
            status: 'pending',
            depositPaid: false,
          },
        });

    if (
      requestedOnboardingId &&
      requestedOnboardingId !== onboarding.id &&
      !requestedOnboardingId.startsWith(
        'virtual-onboarding-',
      )
    ) {
      return errorResponse(
        'onboarding_mismatch',
        409,
      );
    }

    const adminUid =
      cleanStr(
        (isAdmin as any)?.uid ||
          (isAdmin as any)?.userId ||
          body.confirmedByUserId,
        120,
      );

    const confirmedAt =
      new Date();

    let payment: any = null;
    let created = false;

    if (paymentId) {
      const existing =
        await prisma
          .clinicianOnboardingPayment
          .findUnique({
            where: {
              id: paymentId,
            },
          });

      if (!existing) {
        return errorResponse(
          'payment_not_found',
          404,
        );
      }

      if (
        existing.clinicianId !==
        clinicianId
      ) {
        return errorResponse(
          'payment_clinician_mismatch',
          409,
        );
      }

      if (
        existing.onboardingId !==
        onboarding.id
      ) {
        return errorResponse(
          'payment_onboarding_mismatch',
          409,
        );
      }

      const existingProvider =
        String(existing.provider || '')
          .trim()
          .toLowerCase();

      if (
        existingProvider !== 'eft' &&
        existingProvider !== 'manual'
      ) {
        return errorResponse(
          'payment_provider_not_reviewable',
          409,
        );
      }

      const existingStatus =
        String(existing.status || '')
          .trim()
          .toLowerCase();

      if (existingStatus !== 'pending') {
        return errorResponse(
          'payment_not_pending',
          409,
        );
      }

      const amountCents =
        amountFromBody(
          body.amountCents,
        ) ??
        Math.max(
          0,
          Math.round(
            Number(
              existing.amountCents || 0,
            ),
          ),
        );

      if (amountCents <= 0) {
        return errorResponse(
          'payment_amount_required',
          400,
        );
      }

      const currency =
        cleanStr(
          body.currency ||
            existing.currency ||
            settings.currency,
          8,
        )?.toUpperCase() ||
        settings.currency;

      const proofOfPaymentUrl =
        suppliedProofOfPaymentUrl ||
        cleanStr(
          existing.proofOfPaymentUrl,
          1000,
        );

      const existingMeta =
        jsonObject(existing.meta);

      const updateResult =
        await prisma
          .clinicianOnboardingPayment
          .updateMany({
            where: {
              id: existing.id,
              clinicianId,
              onboardingId:
                onboarding.id,
              status: 'pending',
            },
            data: {
              amountCents,
              currency,
              provider:
                existingProvider,
              status: 'confirmed',
              paymentReference,
              payerName,
              originBank,
              paymentDate:
                suppliedPaymentDate ||
                existing.paymentDate ||
                confirmedAt,
              proofOfPaymentUrl,
              confirmedByUserId:
                adminUid,
              confirmedAt,
              meta: jsonSafe({
                ...existingMeta,
                source:
                  'admin_confirm_uploaded_pop',
                review: {
                  reviewedAt:
                    confirmedAt.toISOString(),
                  reviewedByUserId:
                    adminUid,
                  notes:
                    cleanStr(
                      body.notes,
                      2000,
                    ),
                  decision:
                    'confirmed',
                },
                slotId,
                settings: {
                  trainingFeeCents:
                    settings.trainingFeeCents,
                  currency:
                    settings.currency,
                },
              }),
            },
          });

      if (updateResult.count !== 1) {
        return errorResponse(
          'payment_review_conflict',
          409,
        );
      }

      payment =
        await prisma
          .clinicianOnboardingPayment
          .findUnique({
            where: {
              id: existing.id,
            },
          });
    } else {
      const amountCents =
        amountFromBody(
          body.amountCents,
        ) ??
        settings.trainingFeeCents;

      if (amountCents <= 0) {
        return errorResponse(
          'payment_amount_required',
          400,
        );
      }

      const currency =
        cleanStr(
          body.currency ||
            settings.currency,
          8,
        )?.toUpperCase() ||
        settings.currency;

      const provider =
        requestedProvider ===
          'manual' ||
        requestedProvider ===
          'manual_bank_transfer'
          ? 'manual'
          : 'eft';

      payment =
        await prisma
          .clinicianOnboardingPayment
          .create({
            data: {
              clinicianId,
              onboardingId:
                onboarding.id,
              amountCents,
              currency,
              provider,
              status: 'confirmed',
              paymentReference,
              payerName,
              originBank,
              paymentDate:
                suppliedPaymentDate ||
                confirmedAt,
              proofOfPaymentUrl:
                suppliedProofOfPaymentUrl,
              confirmedByUserId:
                adminUid,
              confirmedAt,
              meta: jsonSafe({
                source:
                  'admin_confirm_payment',
                slotId,
                notes:
                  cleanStr(
                    body.notes,
                    2000,
                  ),
                settings: {
                  trainingFeeCents:
                    settings.trainingFeeCents,
                  currency:
                    settings.currency,
                },
              }),
            },
          });

      created = true;
    }

    if (!payment) {
      return errorResponse(
        'confirmed_payment_not_found',
        500,
      );
    }

    return NextResponse.json(
      {
        ok: true,
        created,
        payment: {
          id: payment.id,
          status: payment.status,
          provider: payment.provider,
          amountCents:
            payment.amountCents,
          currency:
            payment.currency,
          paymentReference:
            payment.paymentReference,
          payerName:
            payment.payerName,
          originBank:
            payment.originBank,
          paymentDate:
            payment.paymentDate
              ?.toISOString() ??
            null,
          proofOfPaymentAttached:
            Boolean(
              payment.proofOfPaymentUrl,
            ),
        },
        next: {
          generateAuthorisation: true,
          endpoint:
            '/api/admin/clinicians/onboarding/generate-authorisation',
        },
      },
      {
        status: created ? 201 : 200,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (err: any) {
    console.error(
      '[admin-confirm-clinician-payment] error',
      err,
    );

    return errorResponse(
      err?.message ||
        'confirm_payment_failed',
      500,
    );
  }
}