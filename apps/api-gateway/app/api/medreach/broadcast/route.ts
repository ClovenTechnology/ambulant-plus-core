// apps/api-gateway/app/api/medreach/broadcast/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import { emitEvent } from '@/src/lib/events';
import { push, sseKeys } from '@/src/lib/sse';
import {
  MEDREACH_ELIGIBILITY_STATUSES,
  MEDREACH_ORDER_STATUSES,
  normalizeMedReachPayload,
} from '@shared/medreach';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function nowIso() {
  return new Date().toISOString();
}

function cleanString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function safeJson(v: unknown) {
  try {
    return JSON.parse(JSON.stringify(v ?? null));
  } catch {
    return null;
  }
}

function asBool(v: unknown, fallback = false) {
  return typeof v === 'boolean' ? v : fallback;
}

function asInt(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function isAuthorizedServerActor(req: NextRequest) {
  const expected = process.env.MEDREACH_BROADCAST_KEY || '';
  const provided = req.headers.get('x-medreach-broadcast-key') || '';
  const actorFlag = req.headers.get('x-medreach-server-actor') || '';

  return Boolean(expected && provided && actorFlag === '1' && expected === provided);
}

function isAllowedRole(role: string) {
  return ['admin', 'patient'].includes(role);
}

export async function POST(req: NextRequest) {
  const who = readIdentity(req.headers);
  const role = String(who.role || '').toLowerCase();

  if (!isAllowedRole(role) && !isAuthorizedServerActor(req)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  let rawBody: unknown;

  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  let body: any;

  try {
    body = normalizeMedReachPayload(rawBody);
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: 'invalid_payload',
        detail: String(err?.message || err),
      },
      { status: 400 },
    );
  }

  const initiatedByRole =
    cleanString(body.initiatedByRole || who.role || '').toLowerCase() || null;

  const patientInitiated = initiatedByRole === 'patient' || role === 'patient';
  const candidateLabIds = Array.isArray(body.candidateLabIds)
    ? body.candidateLabIds.map(cleanString).filter(Boolean)
    : [];

  if (patientInitiated) {
    if (!asBool(body.billingConsentCaptured, false)) {
      return NextResponse.json(
        { ok: false, error: 'billing_consent_required' },
        { status: 400 },
      );
    }

    if (!asBool(body.patientConsentToShareWithLab, false)) {
      return NextResponse.json(
        { ok: false, error: 'patient_consent_to_share_with_lab_required' },
        { status: 400 },
      );
    }
  }

  const activeLabs = await prisma.labPartner.findMany({
    where: {
      id: { in: candidateLabIds },
      active: true,
      status: 'ACTIVE',
    },
    select: {
      id: true,
      name: true,
      active: true,
      status: true,
    },
  });

  const validLabIds = activeLabs.map((l) => l.id);

  if (validLabIds.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'no_active_candidate_labs' },
      { status: 400 },
    );
  }

  const now = new Date();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existingDraw = body.orderId
        ? await tx.draw.findFirst({
            where: { orderId: body.orderId },
            orderBy: { createdAt: 'desc' },
          })
        : null;

      if (existingDraw?.partnerId) {
        throw new Error('cannot_broadcast_already_assigned_order');
      }

      const orderId =
        cleanString(body.orderId) ||
        `medreach-${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const drawData = {
        orderId,
        encounterId: body.encounterId,
        patientId: body.patientId,
        clinicianId: body.clinicianId,
        phlebId: null,
        partnerId: null,
        status: MEDREACH_ORDER_STATUSES.MARKETPLACE_OPEN,
        scheduledAt: null,

        initiatedByRole: body.initiatedByRole,
        initiatedByUserId: body.initiatedByUserId,
        createdFromApp: body.createdFromApp,

        releasePolicy: body.releasePolicy,
        payerType: body.payerType,
        urgency: body.urgency ?? null,
        prepNotes: body.prepNotes ?? null,

        clientId: cleanString(body.clientId) || null,
        clientMemberId: cleanString(body.clientMemberId) || null,
        coveragePlanId: cleanString(body.coveragePlanId) || null,
        coverageAuthorizationId: cleanString(body.coverageAuthorizationId) || null,
        sponsorAmountMinor:
          body.sponsorAmountMinor == null ? null : asInt(body.sponsorAmountMinor, 0),
        patientCopayMinor:
          body.patientCopayMinor == null ? null : asInt(body.patientCopayMinor, 0),

        testsSnapshot: safeJson({
          tests: body.tests,
          panels: body.panels,
          fulfillmentMode: body.fulfillmentMode ?? null,
        }),

        collectionWindow: safeJson(body.collectionWindow),

        patientSnapshot: safeJson({
          patientName: body.patientName,
          patientDob: body.patientDob ?? null,
          patientGender: body.patientGender ?? null,
          patientIdentifier: body.patientIdentifier,
          patientPhone: body.patientPhone ?? null,
          patientAddress: body.patientAddress,
          patientArea: body.patientArea,
          destinationLat: body.destinationLat ?? null,
          destinationLng: body.destinationLng ?? null,
        }),

        payerSnapshot: safeJson({
          payerType: body.payerType,
          preferredPaymentMethod: body.preferredPaymentMethod ?? null,
          gapPaymentMethod: body.gapPaymentMethod ?? null,
          sponsorRequested: asBool(body.sponsorRequested, false),

          medicalAidPolicyId: body.medicalAidPolicyId ?? null,
          medicalAidSchemeName: body.medicalAidSchemeName ?? null,
          medicalAidPlanName: body.medicalAidPlanName ?? null,
          membershipNumber: body.membershipNumber ?? null,
          dependentCode: body.dependentCode ?? null,
          authorizationLetterFileKey: body.authorizationLetterFileKey ?? null,
          voucherId: body.voucherId ?? null,
          promoTokenId: body.promoTokenId ?? null,
          cashFallbackAllowed: body.cashFallbackAllowed,
        }),

        consentSnapshot: safeJson({
          billingConsentCaptured: body.billingConsentCaptured,
          patientConsentToShareWithLab: body.patientConsentToShareWithLab,
          patientConsentToShareWithMedicalAid: body.patientConsentToShareWithMedicalAid,
          patientConsentVersion: body.patientConsentVersion ?? null,
        }),

        sponsorPricingSnapshot: safeJson(body.sponsorPricingSnapshot ?? null),
        broadcastedAt: now,
        updatedAt: now,
      } as any;

      const draw = existingDraw
        ? await tx.draw.update({
            where: { id: existingDraw.id },
            data: drawData,
          })
        : await tx.draw.create({
            data: {
              ...drawData,
              broadcastedAt: now,
            },
          });

      await tx.medReachOrderEligibleLab.updateMany({
        where: {
          orderId,
          labId: { notIn: validLabIds },
          status: {
            in: [
              MEDREACH_ELIGIBILITY_STATUSES.ELIGIBLE,
              MEDREACH_ELIGIBILITY_STATUSES.DECLINED,
              MEDREACH_ELIGIBILITY_STATUSES.EXPIRED,
              MEDREACH_ELIGIBILITY_STATUSES.REMOVED,
            ],
          },
        },
        data: {
          status: MEDREACH_ELIGIBILITY_STATUSES.REMOVED,
          respondedAt: now,
          respondedByUserId: who.uid ?? body.initiatedByUserId ?? null,
          responseActorRole: who.role ?? body.initiatedByRole ?? null,
          expiredAt: now,
        },
      });

      for (const labId of validLabIds) {
        const notes = safeJson({
          source: body.createdFromApp,
          orderId,
          encounterId: body.encounterId,
          patientId: body.patientId,
          clinicianId: body.clinicianId,
          tests: body.tests,
          panels: body.panels,
          urgency: body.urgency ?? null,
          prepNotes: body.prepNotes ?? null,
          fulfillmentMode: body.fulfillmentMode ?? null,

          patientSnapshot: {
            patientName: body.patientName,
            patientDob: body.patientDob ?? null,
            patientGender: body.patientGender ?? null,
            patientIdentifier: body.patientIdentifier,
            patientPhone: body.patientPhone ?? null,
            patientAddress: body.patientAddress,
            patientArea: body.patientArea,
            destinationLat: body.destinationLat ?? null,
            destinationLng: body.destinationLng ?? null,
          },

          payerSnapshot: {
            payerType: body.payerType,
            preferredPaymentMethod: body.preferredPaymentMethod ?? null,
            gapPaymentMethod: body.gapPaymentMethod ?? null,
            sponsorRequested: asBool(body.sponsorRequested, false),

            medicalAidPolicyId: body.medicalAidPolicyId ?? null,
            medicalAidSchemeName: body.medicalAidSchemeName ?? null,
            medicalAidPlanName: body.medicalAidPlanName ?? null,
            membershipNumber: body.membershipNumber ?? null,
            dependentCode: body.dependentCode ?? null,
            authorizationLetterFileKey: body.authorizationLetterFileKey ?? null,
            voucherId: body.voucherId ?? null,
            promoTokenId: body.promoTokenId ?? null,
            cashFallbackAllowed: body.cashFallbackAllowed,
          },

          sponsorContext: {
            clientId: cleanString(body.clientId) || null,
            clientMemberId: cleanString(body.clientMemberId) || null,
            coveragePlanId: cleanString(body.coveragePlanId) || null,
            coverageAuthorizationId: cleanString(body.coverageAuthorizationId) || null,
            sponsorAmountMinor:
              body.sponsorAmountMinor == null
                ? null
                : asInt(body.sponsorAmountMinor, 0),
            patientCopayMinor:
              body.patientCopayMinor == null
                ? null
                : asInt(body.patientCopayMinor, 0),
            sponsorPricingSnapshot: body.sponsorPricingSnapshot ?? null,
          },

          consentSnapshot: {
            billingConsentCaptured: body.billingConsentCaptured,
            patientConsentToShareWithLab: body.patientConsentToShareWithLab,
            patientConsentToShareWithMedicalAid:
              body.patientConsentToShareWithMedicalAid,
            patientConsentVersion: body.patientConsentVersion ?? null,
          },

          releasePolicy: body.releasePolicy,
          collectionWindow: body.collectionWindow ?? null,
        });

        await tx.medReachOrderEligibleLab.upsert({
          where: {
            orderId_labId: {
              orderId,
              labId,
            },
          },
          update: {
            status: MEDREACH_ELIGIBILITY_STATUSES.ELIGIBLE,
            invitedAt: now,
            invitedByUserId: who.uid ?? body.initiatedByUserId ?? null,
            respondedAt: null,
            respondedByUserId: null,
            responseActorRole: null,
            acceptedAt: null,
            declinedAt: null,
            expiredAt: null,
            notes,
          },
          create: {
            orderId,
            labId,
            status: MEDREACH_ELIGIBILITY_STATUSES.ELIGIBLE,
            invitedAt: now,
            invitedByUserId: who.uid ?? body.initiatedByUserId ?? null,
            notes,
          },
        });
      }

      await tx.auditEvent.create({
        data: {
          kind: existingDraw ? 'lab_order_rebroadcasted' : 'lab_order_broadcasted',
          actorId: who.uid ?? body.initiatedByUserId ?? null,
          actorRole: who.role ?? body.initiatedByRole ?? null,
          subjectId: orderId,
          meta: {
            drawId: draw.id,
            encounterId: body.encounterId,
            patientId: body.patientId,
            clinicianId: body.clinicianId,
            candidateLabIds: validLabIds,
            releasePolicy: body.releasePolicy,
            payerType: body.payerType,
            source: body.createdFromApp,
            status: draw.status,
            fulfillmentMode: body.fulfillmentMode ?? null,
            sponsorRequested: asBool(body.sponsorRequested, false),
            preferredPaymentMethod: body.preferredPaymentMethod ?? null,
            gapPaymentMethod: body.gapPaymentMethod ?? null,
            clientId: cleanString(body.clientId) || null,
            clientMemberId: cleanString(body.clientMemberId) || null,
            coveragePlanId: cleanString(body.coveragePlanId) || null,
            coverageAuthorizationId: cleanString(body.coverageAuthorizationId) || null,
          },
        },
      });

      return {
        orderId,
        drawId: draw.id,
        encounterId: draw.encounterId,
        patientId: draw.patientId,
        clinicianId: draw.clinicianId,
        status: draw.status,
        candidateLabIds: validLabIds,
      };
    });

    emitEvent({
      kind: 'lab_order_broadcasted',
      encounterId: result.encounterId,
      patientId: result.patientId,
      clinicianId: result.clinicianId,
      payload: {
        orderId: result.orderId,
        drawId: result.drawId,
        candidateLabIds: result.candidateLabIds,
        status: result.status,
      },
      targets: {
        admin: true,
        patientId: result.patientId,
        clinicianId: result.clinicianId,
      },
    });

    const evt = {
      kind: 'lab_order_broadcasted',
      at: nowIso(),
      orderId: result.orderId,
      drawId: result.drawId,
      encounterId: result.encounterId,
      patientId: result.patientId,
      clinicianId: result.clinicianId,
      candidateLabIds: result.candidateLabIds,
      status: result.status,
    };

    const sseJobs: Promise<unknown>[] = [
      push(sseKeys.order(result.orderId), evt),
      push(sseKeys.draw(result.drawId), evt),
    ];

    for (const labId of result.candidateLabIds) {
      sseJobs.push(
        push(sseKeys.lab(labId), {
          ...evt,
          labId,
        }),
      );
    }

    await Promise.allSettled(sseJobs);

    return NextResponse.json({
      ok: true,
      data: {
        orderId: result.orderId,
        drawId: result.drawId,
        encounterId: result.encounterId,
        patientId: result.patientId,
        clinicianId: result.clinicianId,
        status: result.status,
        candidateLabIds: result.candidateLabIds,
      },
      meta: {
        action: 'broadcast',
        actorRole: who.role ?? body.initiatedByRole,
        actorId: who.uid ?? body.initiatedByUserId ?? null,
        at: nowIso(),
      },
    });
  } catch (err: any) {
    const msg = String(err?.message || err);
    const status = msg === 'cannot_broadcast_already_assigned_order' ? 409 : 500;

    return NextResponse.json(
      {
        ok: false,
        error: msg,
      },
      { status },
    );
  }
}