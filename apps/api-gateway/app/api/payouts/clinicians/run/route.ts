import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { computeRefundCents } from '@/src/payments/refunds';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// A5_J_C_CLINICIAN_CONTRACTOR_PAYOUT_RUNNER_FOUNDATION
function json(payload: any, status = 200) {
  return NextResponse.json(payload, { status });
}

function asObject(value: any): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asCents(value: any, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : fallback;
}

function text(value: any, max = 240) {
  return String(value || '').trim().slice(0, max);
}

function monthKey(date: Date) {
  return date.toISOString().slice(0, 7);
}

function contractorTaxAdvisory(currency: string) {
  return {
    enabled: false,
    advisoryOnly: true,
    amountCents: 0,
    currency,
    label: 'Tax and statutory obligations advisory',
    message:
      'Tax, PAYE, UIF, pension, professional indemnity and other statutory or professional obligations may remain the contractor clinician\'s responsibility unless Ambulant+ explicitly enables and applies a deduction line.',
  };
}

function buildClinicianContractorSummary(input: {
  appointmentId: string;
  startsAt: Date;
  endsAt: Date;
  currency: string;
  originalPriceCents: number;
  refundCents: number;
  grossEligibleCents: number;
  platformFeeCents: number;
  clinicianTakeCents: number;
  paymentRef: string | null;
}) {
  const platformDeduction = {
    code: 'platform_commission',
    label: 'Ambulant+ platform commission',
    amountCents: input.platformFeeCents,
    currency: input.currency,
    applied: true,
    source: 'appointment.platformFeeCents',
  };

  const onboardingInstalment = {
    code: 'onboarding_instalment',
    label: 'Onboarding/training instalment',
    amountCents: 0,
    currency: input.currency,
    applied: false,
    source: 'not_applied_in_phase_1',
  };

  const planFee = {
    code: 'clinician_plan_fee',
    label: 'Clinician plan tier fee',
    amountCents: 0,
    currency: input.currency,
    applied: false,
    source: 'not_applied_in_phase_1',
    note: 'Solo plan is expected to remain free. Paid clinician plan deductions should be enabled by Admin policy before applying.',
  };

  const customDeductions: any[] = [];
  const taxAdvisory = contractorTaxAdvisory(input.currency);

  return {
    type: 'ambulant_contractor_payout_summary',
    scope: 'clinician_appointment_payout',
    appointmentId: input.appointmentId,
    periodMonth: monthKey(input.endsAt),
    periodStart: input.startsAt.toISOString(),
    periodEnd: input.endsAt.toISOString(),
    currency: input.currency,
    grossEarningsCents: input.grossEligibleCents,
    originalPriceCents: input.originalPriceCents,
    refundCents: input.refundCents,
    platformFeeCents: input.platformFeeCents,
    baseClinicianTakeCents: input.clinicianTakeCents,
    onboardingInstalmentCents: 0,
    planFeeCents: 0,
    customDeductionCents: 0,
    taxWithholdingCents: 0,
    taxEstimateCents: 0,
    totalChargedDeductionsCents: 0,
    netPayableCents: input.clinicianTakeCents,
    paymentRef: input.paymentRef,
    deductionLines: [platformDeduction, onboardingInstalment, planFee],
    customDeductions,
    taxAdvisory,
    contractorNotice:
      'This is a contractor payout summary, not an employment payslip. Tax, PAYE, UIF, pension, professional indemnity and other statutory or professional obligations may remain the clinician\'s responsibility unless Ambulant+ explicitly applies a deduction line.',
  };
}

async function existingPayoutForAppointment(appointmentId: string, clinicianId: string) {
  const rows = await (prisma as any).payout.findMany({
    where: {
      role: 'clinician',
      entityId: clinicianId,
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  return rows.find((row: any) => asObject(row?.meta).appointmentId === appointmentId) || null;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as any;
    const now = new Date();

    const fromRaw = text(body?.from || body?.periodStart, 40);
    const toRaw = text(body?.to || body?.periodEnd, 40);
    const from = fromRaw ? new Date(fromRaw) : null;
    const to = toRaw ? new Date(toRaw) : now;

    const where: any = {
      status: 'completed',
      endsAt: { lte: to },
    };

    if (from && !Number.isNaN(from.getTime())) {
      where.endsAt.gte = from;
    }

    const candidates = await prisma.appointment.findMany({
      where,
      select: {
        id: true,
        clinicianId: true,
        startsAt: true,
        endsAt: true,
        priceCents: true,
        currency: true,
        paymentRef: true,
        platformFeeCents: true,
        clinicianTakeCents: true,
        meta: true,
      },
      orderBy: { endsAt: 'asc' },
      take: asCents(body?.take, 1000) || 1000,
    });

    let created = 0;
    let skipped = 0;
    const createdPayouts: any[] = [];

    for (const appointment of candidates) {
      if (!appointment.clinicianId) {
        skipped += 1;
        continue;
      }

      const existing = await existingPayoutForAppointment(appointment.id, appointment.clinicianId);
      if (existing) {
        skipped += 1;
        continue;
      }

      const startsAt = new Date(appointment.startsAt);
      const endsAt = new Date(appointment.endsAt);
      const scheduledMs = Math.max(0, endsAt.getTime() - startsAt.getTime());

      const refundCents = computeRefundCents({
        priceCents: appointment.priceCents,
        startsAt,
        endsAt,
        cancelAt: null,
        cancelBy: null,
        joinedAtMs: 0,
        scheduledMs,
      });

      const grossEligibleCents = Math.max(0, appointment.priceCents - refundCents);
      const proportion = appointment.priceCents > 0 ? grossEligibleCents / appointment.priceCents : 0;

      const baseClinicianTakeCents = asCents(
        Math.round((appointment.clinicianTakeCents ?? Math.round(appointment.priceCents * 0.7)) * proportion),
      );

      const platformFeeCents = asCents(
        Math.round((appointment.platformFeeCents ?? Math.max(0, appointment.priceCents - baseClinicianTakeCents)) * proportion),
      );

      const currency = text(appointment.currency || 'ZAR', 3).toUpperCase() || 'ZAR';

      const contractorPayoutSummary = buildClinicianContractorSummary({
        appointmentId: appointment.id,
        startsAt,
        endsAt,
        currency,
        originalPriceCents: appointment.priceCents,
        refundCents,
        grossEligibleCents,
        platformFeeCents,
        clinicianTakeCents: baseClinicianTakeCents,
        paymentRef: appointment.paymentRef ?? null,
      });

      const payout = await prisma.payout.create({
        data: {
          role: 'clinician',
          entityId: appointment.clinicianId,
          periodStart: appointment.startsAt,
          periodEnd: appointment.endsAt,
          amountCents: baseClinicianTakeCents,
          currency,
          status: 'pending',
          meta: {
            appointmentId: appointment.id,
            paymentRef: appointment.paymentRef ?? null,
            platformFeeCents,
            refundCents,
            originalPriceCents: appointment.priceCents,
            grossEligibleCents,
            clinicianTakeCents: baseClinicianTakeCents,
            contractorPayoutSummary,
            payoutSummaryLabel: 'Ambulant+ Contractor Payout Summary',
            payoutSummaryEmptyState:
              'No payout summary yet. You haven\'t completed any eligible jobs yet.',
            source: 'clinician_completed_appointment',
            generatedBy: 'A5-J-C',
            generatedAt: new Date().toISOString(),
            appointmentMeta: asObject(appointment.meta),
          },
        },
      });

      created += 1;
      createdPayouts.push({
        id: payout.id,
        appointmentId: appointment.id,
        clinicianId: appointment.clinicianId,
        amountCents: payout.amountCents,
        currency: payout.currency,
        status: payout.status,
      });
    }

    return json({
      ok: true,
      processed: candidates.length,
      created,
      skipped,
      createdPayouts,
      emptyState:
        created === 0 && candidates.length === 0
          ? 'No payout summary yet. You haven\'t completed any eligible jobs yet.'
          : null,
    });
  } catch (err: any) {
    console.error('payouts/clinicians/run error', err);
    return json({ ok: false, error: err?.message || 'internal_error' }, 500);
  }
}
