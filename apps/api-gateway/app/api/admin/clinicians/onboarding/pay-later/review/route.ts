import { NextRequest, NextResponse } from 'next/server';

import {
  adminClinicianPayLaterRequest,
  normaliseClinicianPayLaterRequestStatus,
} from '@/src/clinicians/onboarding/pay-later';
import {
  getClinicianOnboardingSettings,
} from '@/src/clinicians/onboarding/settings';
import { prisma } from '@/src/lib/prisma';
import { verifyAdminRequest } from '../../../../utils/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ReviewDecision =
  | 'approved'
  | 'rejected';

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

function parseDate(
  value: unknown,
): Date | null {
  const text = cleanStr(
    value,
    80,
  );

  if (!text) {
    return null;
  }

  const date =
    new Date(text);

  return Number.isFinite(
    date.getTime(),
  )
    ? date
    : null;
}

function objectMeta(
  value: unknown,
): Record<string, unknown> {
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value)
  ) {
    return value as Record<string, unknown>;
  }

  return {};
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

function appendNote(
  existing: unknown,
  next: string,
) {
  return [
    cleanStr(existing, 8000),
    next,
  ]
    .filter(Boolean)
    .join('\n');
}

function normaliseDecision(
  value: unknown,
): ReviewDecision | null {
  const decision =
    String(value || '')
      .trim()
      .toLowerCase();

  if (
    decision === 'approved' ||
    decision === 'rejected'
  ) {
    return decision;
  }

  return null;
}

function fail(
  code: string,
  status: number,
): never {
  const error: any =
    new Error(code);

  error.status = status;
  throw error;
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

export async function POST(
  req: NextRequest,
) {
  try {
    const admin =
      await verifyAdminRequest(req);

    if (!admin.ok) {
      return admin.response;
    }

    const body =
      await req.json().catch(
        () => ({} as any),
      );

    const requestId =
      cleanStr(
        body.requestId ||
          body.payLaterRequestId,
        120,
      );

    const decision =
      normaliseDecision(
        body.decision ||
          body.action,
      );

    const reviewNotes =
      cleanStr(
        body.reviewNotes ||
          body.reason ||
          body.notes,
        2000,
      );

    const tncAcceptedByAdmin =
      body.tncAcceptedByAdmin ===
        true ||
      body.termsAccepted === true;

    const nextPaymentAt =
      parseDate(
        body.nextPaymentAt,
      );

    const expiresInDays =
      Math.max(
        1,
        Math.min(
          90,
          Math.round(
            Number(
              body.expiresInDays ||
                30,
            ),
          ),
        ),
      );

    if (!requestId) {
      return json(
        {
          ok: false,
          error:
            'pay_later_request_id_required',
        },
        400,
      );
    }

    if (!decision) {
      return json(
        {
          ok: false,
          error:
            'pay_later_review_decision_invalid',
        },
        400,
      );
    }

    if (
      decision === 'approved' &&
      !tncAcceptedByAdmin
    ) {
      return json(
        {
          ok: false,
          error:
            'pay_later_terms_must_be_confirmed_by_admin',
        },
        400,
      );
    }

    const actorId =
      cleanStr(
        admin.uid,
        120,
      ) || 'admin';

    const settings =
      decision === 'approved'
        ? await getClinicianOnboardingSettings()
        : null;

    const db: any = prisma;

    const result =
      await db.$transaction(
        async (tx: any) => {
          const requestRow =
            await tx.clinicianOnboardingPayLaterRequest.findUnique({
              where: {
                id: requestId,
              },
            });

          if (!requestRow) {
            fail(
              'pay_later_request_not_found',
              404,
            );
          }

          const currentStatus =
            normaliseClinicianPayLaterRequestStatus(
              requestRow.status,
            );

          const existingOnboarding =
            await tx.clinicianOnboarding.findUnique({
              where: {
                id:
                  String(
                    requestRow.onboardingId,
                  ),
              },
            });

          if (!existingOnboarding) {
            fail(
              'clinician_onboarding_not_found',
              409,
            );
          }

          if (
            String(
              existingOnboarding.clinicianId,
            ) !==
            String(
              requestRow.clinicianId,
            )
          ) {
            fail(
              'pay_later_request_onboarding_mismatch',
              409,
            );
          }

          if (
            currentStatus !==
            'pending'
          ) {
            if (
              currentStatus ===
              decision
            ) {
              const existingPayment =
                requestRow.approvalPaymentId
                  ? await tx.clinicianOnboardingPayment.findUnique({
                      where: {
                        id:
                          String(
                            requestRow.approvalPaymentId,
                          ),
                      },
                    })
                  : null;

              return {
                idempotent: true,
                request:
                  requestRow,
                onboarding:
                  existingOnboarding,
                payment:
                  existingPayment,
              };
            }

            fail(
              'pay_later_request_already_reviewed_with_different_decision',
              409,
            );
          }

          const clinician =
            await tx.clinicianProfile.findUnique({
              where: {
                id:
                  String(
                    requestRow.clinicianId,
                  ),
              },
            });

          if (!clinician) {
            fail(
              'clinician_not_found',
              404,
            );
          }

          const now =
            new Date();

          const requestMeta =
            objectMeta(
              requestRow.meta,
            );

          const reviewMeta =
            jsonSafe({
              ...requestMeta,
              review: {
                decision,
                reviewedByUserId:
                  actorId,
                reviewerRole:
                  admin.role,
                reviewerSource:
                  admin.source ||
                  null,
                reviewedAt:
                  now.toISOString(),
                reviewNotes,
                tncAcceptedByAdmin:
                  decision ===
                  'approved'
                    ? tncAcceptedByAdmin
                    : null,
              },
            });

          const claimed =
            await tx.clinicianOnboardingPayLaterRequest.updateMany({
              where: {
                id: requestId,
                status: 'pending',
              },
              data: {
                status: decision,
                activeRequestKey:
                  null,
                reviewedByUserId:
                  actorId,
                reviewedAt: now,
                reviewNotes,
                meta: reviewMeta,
              },
            });

          if (
            Number(
              claimed.count || 0,
            ) !== 1
          ) {
            const latest =
              await tx.clinicianOnboardingPayLaterRequest.findUnique({
                where: {
                  id: requestId,
                },
              });

            const latestStatus =
              normaliseClinicianPayLaterRequestStatus(
                latest?.status,
              );

            if (
              latest &&
              latestStatus ===
                decision
            ) {
              const existingPayment =
                latest.approvalPaymentId
                  ? await tx.clinicianOnboardingPayment.findUnique({
                      where: {
                        id:
                          String(
                            latest.approvalPaymentId,
                          ),
                      },
                    })
                  : null;

              return {
                idempotent: true,
                request: latest,
                onboarding:
                  existingOnboarding,
                payment:
                  existingPayment,
              };
            }

            fail(
              'pay_later_request_review_conflict',
              409,
            );
          }

          if (
            decision === 'rejected'
          ) {
            const rejectedRequest =
              await tx.clinicianOnboardingPayLaterRequest.findUnique({
                where: {
                  id: requestId,
                },
              });

            return {
              idempotent: false,
              request:
                rejectedRequest,
              onboarding:
                existingOnboarding,
              payment: null,
            };
          }

          const currentPlan =
            String(
              existingOnboarding.paymentPlan ||
                '',
            )
              .trim()
              .toUpperCase();

          if (
            existingOnboarding.depositPaid ===
              true ||
            currentPlan ===
              'QUALIFYING_DEPOSIT' ||
            currentPlan ===
              'FULL_PAYMENT'
          ) {
            fail(
              'pay_later_approval_blocked_by_qualifying_payment',
              409,
            );
          }

          const confirmedPayments =
            await tx.clinicianOnboardingPayment.findMany({
              where: {
                onboardingId:
                  String(
                    existingOnboarding.id,
                  ),
                status: {
                  in: [
                    'confirmed',
                    'paid',
                    'captured',
                  ],
                },
              },
              select: {
                amountCents: true,
                provider: true,
              },
            });

          const paidAmountCents =
            confirmedPayments.reduce(
              (
                total: number,
                payment: any,
              ) => {
                const provider =
                  String(
                    payment?.provider ||
                      '',
                  )
                    .trim()
                    .toLowerCase();

                if (
                  provider ===
                    'waiver' ||
                  provider ===
                    'deferred'
                ) {
                  return total;
                }

                return (
                  total +
                  Math.max(
                    0,
                    Math.round(
                      Number(
                        payment?.amountCents ||
                          0,
                      ),
                    ),
                  )
                );
              },
              0,
            );

          if (
            paidAmountCents > 0
          ) {
            fail(
              'pay_later_approval_blocked_by_qualifying_payment',
              409,
            );
          }

          const providerReference =
            'PAY-LATER-REQUEST-' +
            requestId;

          let payment =
            await tx.clinicianOnboardingPayment.findUnique({
              where: {
                providerReference,
              },
            });

          if (
            payment &&
            (
              String(
                payment.clinicianId,
              ) !==
                String(
                  requestRow.clinicianId,
                ) ||
              String(
                payment.onboardingId,
              ) !==
                String(
                  existingOnboarding.id,
                )
            )
          ) {
            fail(
              'pay_later_approval_payment_reference_conflict',
              409,
            );
          }

          const selectedSlotId =
            cleanStr(
              requestMeta.selectedSlotId,
              120,
            );

          const effectiveNextPaymentAt =
            nextPaymentAt ||
            existingOnboarding.nextPaymentAt ||
            null;

          const note = [
            'PAY-LATER REQUEST APPROVED ' +
              now.toISOString(),
            'Request: ' +
              requestId,
            requestRow.requestReason
              ? 'Clinician reason: ' +
                  String(
                    requestRow.requestReason,
                  )
              : null,
            reviewNotes
              ? 'Admin review: ' +
                  reviewNotes
              : null,
            effectiveNextPaymentAt
              ? 'Next payment review: ' +
                  new Date(
                    effectiveNextPaymentAt,
                  ).toISOString()
              : null,
            'Temporary training devices may be issued for training only and must be retrieved.',
            'Permanent starter kit/device release requires the qualifying deposit or full payment.',
          ]
            .filter(Boolean)
            .join(' | ');

          const updatedOnboarding =
            await tx.clinicianOnboarding.update({
              where: {
                id:
                  String(
                    existingOnboarding.id,
                  ),
              },
              data: {
                paymentPlan:
                  'WAIVER_TRAIN_NOW_PAY_LATER',
                depositPaid: false,
                nextPaymentAt:
                  effectiveNextPaymentAt,
                trainingNotes:
                  appendNote(
                    existingOnboarding.trainingNotes,
                    note,
                  ),
              },
            });

          if (!payment) {
            payment =
              await tx.clinicianOnboardingPayment.create({
                data: {
                  clinicianId:
                    String(
                      requestRow.clinicianId,
                    ),
                  onboardingId:
                    String(
                      existingOnboarding.id,
                    ),
                  amountCents: 0,
                  currency:
                    settings?.currency ||
                    'ZAR',
                  provider: 'waiver',
                  status: 'confirmed',
                  providerReference,
                  paymentReference:
                    providerReference,
                  payerName:
                    cleanStr(
                      clinician.displayName,
                      240,
                    ) ||
                    cleanStr(
                      clinician.email,
                      240,
                    ) ||
                    'Clinician',
                  paymentDate: now,
                  confirmedByUserId:
                    actorId,
                  confirmedAt: now,
                  authorisationExpiresAt:
                    new Date(
                      now.getTime() +
                        expiresInDays *
                          24 *
                          60 *
                          60 *
                          1000,
                    ),
                  meta: jsonSafe({
                    source:
                      'clinician_pay_later_request_approval',
                    requestId,
                    clinicianRequest:
                      true,
                    waiver: true,
                    deferredPayment:
                      true,
                    paymentPlan:
                      'WAIVER_TRAIN_NOW_PAY_LATER',
                    selectedSlotId,
                    trainingMode:
                      cleanStr(
                        requestMeta.trainingMode,
                        40,
                      ),
                    requestReason:
                      cleanStr(
                        requestRow.requestReason,
                        2000,
                      ),
                    reviewNotes,
                    reviewedByUserId:
                      actorId,
                    reviewedAt:
                      now.toISOString(),
                    tncAcceptedByAdmin,
                    nextPaymentAt:
                      effectiveNextPaymentAt
                        ? new Date(
                            effectiveNextPaymentAt,
                          ).toISOString()
                        : null,
                    devicePolicy: {
                      temporaryTrainingDevicesAllowed:
                        true,
                      temporaryDevicesMustBeReturned:
                        true,
                      permanentStarterKitRequiresDepositOrFullPayment:
                        true,
                      minimumInitialPaymentCents:
                        settings?.minimumInitialPaymentCents ||
                        0,
                      trainingFeeCents:
                        settings?.trainingFeeCents ||
                        0,
                      starterKitItems:
                        settings?.starterKitItems ||
                        [],
                    },
                  }),
                },
              });
          }

          const approvedRequest =
            await tx.clinicianOnboardingPayLaterRequest.update({
              where: {
                id: requestId,
              },
              data: {
                approvalPaymentId:
                  String(payment.id),
              },
            });

          return {
            idempotent: false,
            request:
              approvedRequest,
            onboarding:
              updatedOnboarding,
            payment,
          };
        },
      );

    return json(
      {
        ok: true,
        idempotent:
          result.idempotent === true,
        decision,
        request:
          adminClinicianPayLaterRequest(
            result.request,
          ),
        onboarding:
          result.onboarding
            ? {
                id:
                  String(
                    result.onboarding.id,
                  ),
                clinicianId:
                  String(
                    result.onboarding.clinicianId,
                  ),
                status:
                  String(
                    result.onboarding.status ||
                      '',
                  ),
                paymentPlan:
                  cleanStr(
                    result.onboarding.paymentPlan,
                    120,
                  ),
                depositPaid:
                  result.onboarding.depositPaid ===
                  true,
                nextPaymentAt:
                  result.onboarding.nextPaymentAt
                    ? new Date(
                        result.onboarding.nextPaymentAt,
                      ).toISOString()
                    : null,
              }
            : null,
        payment:
          result.payment
            ? {
                id:
                  String(
                    result.payment.id,
                  ),
                provider:
                  String(
                    result.payment.provider ||
                      '',
                  ),
                status:
                  String(
                    result.payment.status ||
                      '',
                  ),
                amountCents:
                  Number(
                    result.payment.amountCents ||
                      0,
                  ),
                currency:
                  String(
                    result.payment.currency ||
                      '',
                  ),
                providerReference:
                  cleanStr(
                    result.payment.providerReference,
                    240,
                  ),
              }
            : null,
        message:
          decision === 'approved'
            ? 'The clinician Pay Later request has been approved.'
            : 'The clinician Pay Later request has been rejected.',
      },
      result.idempotent === true
        ? 200
        : decision === 'approved'
          ? 201
          : 200,
    );
  } catch (error: any) {
    const code = String(
      error?.message ||
        'pay_later_review_failed',
    );

    const explicitStatus =
      Number(
        error?.status ||
          0,
      );

    if (
      Number.isFinite(
        explicitStatus,
      ) &&
      explicitStatus >= 400 &&
      explicitStatus <= 599
    ) {
      return json(
        {
          ok: false,
          error: code,
        },
        explicitStatus,
      );
    }

    if (
      String(
        error?.code ||
          '',
      ) === 'P2021' ||
      String(
        error?.code ||
          '',
      ) === 'P2022' ||
      code.includes(
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
      '[api-gateway][admin][clinicians][onboarding][pay-later][review] failed',
      { code },
    );

    return json(
      {
        ok: false,
        error: code,
      },
      500,
    );
  }
}
