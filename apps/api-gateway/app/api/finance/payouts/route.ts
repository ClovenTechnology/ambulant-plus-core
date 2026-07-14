import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  buildPaystackTransferReference,
  checkPaystackTransferBalance,
  createPaystackTransferRecipient,
  extractPartnerBankDetails,
  initiatePaystackTransfer,
  paystackBankDetailsReady,
} from '@/src/payments/paystack-transfers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// A5_J_C_CLINICIAN_FINANCE_PAYOUT_ACTIONS
function json(payload: any, status = 200) {
  return NextResponse.json(payload, { status });
}

function text(value: any, max = 240) {
  return String(value || '').trim().slice(0, max);
}

function asObject(value: any): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function asCents(value: any, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : fallback;
}

function idsFrom(value: any): string[] {
  if (Array.isArray(value)) return value.map((v) => text(v, 180)).filter(Boolean);
  const single = text(value, 180);
  return single ? [single] : [];
}

function payoutEmptyState(role: string) {
  if (role === 'clinician') {
    return {
      title: 'No payout summary yet.',
      message:
        "You haven't completed any eligible jobs yet. Once eligible consultations are completed and processed, your monthly Contractor Payout Summary will appear here.",
    };
  }

  return {
    title: 'No payout records yet.',
    message: 'Once eligible work is completed and processed, payout records will appear here.',
  };
}

function groupSummary(items: any[]) {
  const summary: Record<string, any> = {};

  for (const item of items) {
    const key = [item.role, item.status, item.currency || 'ZAR'].join(':');
    const meta = asObject(item.meta);
    const cps = asObject(meta.contractorPayoutSummary);

    if (!summary[key]) {
      summary[key] = {
        role: item.role,
        status: item.status,
        currency: item.currency || 'ZAR',
        count: 0,
        amountCents: 0,
        grossEarningsCents: 0,
        platformFeeCents: 0,
        refundCents: 0,
        onboardingInstalmentCents: 0,
        planFeeCents: 0,
        customDeductionCents: 0,
        taxWithholdingCents: 0,
      };
    }

    summary[key].count += 1;
    summary[key].amountCents += asCents(item.amountCents);
    summary[key].grossEarningsCents += asCents(cps.grossEarningsCents);
    summary[key].platformFeeCents += asCents(cps.platformFeeCents ?? meta.platformFeeCents);
    summary[key].refundCents += asCents(cps.refundCents ?? meta.refundCents);
    summary[key].onboardingInstalmentCents += asCents(cps.onboardingInstalmentCents);
    summary[key].planFeeCents += asCents(cps.planFeeCents);
    summary[key].customDeductionCents += asCents(cps.customDeductionCents);
    summary[key].taxWithholdingCents += asCents(cps.taxWithholdingCents);
  }

  return Object.values(summary);
}

async function loadClinicianProfile(clinicianId: string) {
  const db: any = prisma;
  const delegate = db.clinicianProfile;

  if (!delegate?.findFirst) return null;

  return delegate.findFirst({
    where: {
      OR: [
        { id: clinicianId },
        { userId: clinicianId },
      ],
    },
  }).catch(() => null);
}

function profileBankSource(profile: any, payout: any) {
  const profileMeta = asObject(profile?.meta);
  const payoutMeta = asObject(payout?.meta);

  return {
    ...asObject(profile),
    ...profileMeta,
    ...asObject(profileMeta.payout),
    ...asObject(profileMeta.payoutSettings),
    ...asObject(profileMeta.bank),
    ...asObject(profileMeta.bankAccount),
    ...asObject(profileMeta.bankDetails),
    ...asObject((profile as any)?.payoutSettings),
    ...payoutMeta,
    ...asObject(payoutMeta.payout),
    ...asObject(payoutMeta.bank),
    ...asObject(payoutMeta.bankAccount),
    ...asObject(payoutMeta.bankDetails),
    payoutAccountId: profile?.payoutAccountId || profileMeta.payoutAccountId || payoutMeta.payoutAccountId || null,
  };
}

function clinicianTransferStatus(transfer: any) {
  const status = text(transfer?.status || transfer?.paystackStatus, 80).toLowerCase();

  if (transfer?.paid || status === 'success') return 'paid';

  if (
    transfer?.failed ||
    status === 'failed' ||
    status === 'abandoned' ||
    status === 'reversed'
  ) {
    return 'failed';
  }

  return 'pending';
}

function failureReasonFromTransfer(transfer: any) {
  return (
    text(transfer?.message, 1000) ||
    text(transfer?.raw?.message, 1000) ||
    text(transfer?.raw?.data?.reason, 1000) ||
    text(transfer?.raw?.data?.failure_reason, 1000) ||
    null
  );
}

async function audit(kind: string, subjectId: string | null, meta: any) {
  const db: any = prisma;
  const promise = db.auditEvent?.create?.({
    data: {
      kind,
      actorId: null,
      actorRole: 'admin',
      subjectId,
      meta,
      at: new Date(),
    },
  });

  if (promise?.catch) await promise.catch(() => null);
}

async function sendClinicianPaystackTransferForPayout(payout: any, actorRole: string) {
  if (String(payout.role || '').toLowerCase() !== 'clinician') {
    return { ok: false, payoutId: payout.id, error: 'unsupported_payout_role', role: payout.role };
  }

  if (String(payout.status || '').toLowerCase() === 'paid') {
    return { ok: false, payoutId: payout.id, skipped: true, reason: 'already_paid' };
  }

  if (asCents(payout.amountCents) <= 0) {
    return { ok: false, payoutId: payout.id, skipped: true, reason: 'net_amount_not_positive' };
  }

  const profile = await loadClinicianProfile(String(payout.entityId || ''));
  const bankDetails = extractPartnerBankDetails(profileBankSource(profile, payout));

  if (!paystackBankDetailsReady(bankDetails)) {
    return {
      ok: false,
      payoutId: payout.id,
      clinicianId: payout.entityId,
      error: 'clinician_bank_details_missing_or_incomplete',
    };
  }

  const currentMeta = asObject(payout.meta);
  const currentTransfer = asObject(currentMeta.paystackTransfer);
  const existingRecipientCode = text(currentTransfer.recipientCode || (bankDetails as any)?.paystackRecipientCode, 180) || null;

  const recipient = existingRecipientCode
    ? { recipientCode: existingRecipientCode, raw: { reused: true } }
    : await createPaystackTransferRecipient({
        name:
          text(profile?.displayName, 120) ||
          text(profile?.email, 120) ||
          `Clinician ${String(payout.entityId || '').slice(0, 8)}`,
        accountNumber: bankDetails!.accountNumber!,
        bankCode: bankDetails!.bankCode!,
        currency: payout.currency || bankDetails!.currency || 'ZAR',
        country: bankDetails!.country || 'ZA',
        metadata: {
          scope: 'clinician_payout',
          payoutId: payout.id,
          clinicianId: payout.entityId,
        },
      });

  const reference =
    text(currentTransfer.reference || currentMeta.payoutRef, 180) ||
    buildPaystackTransferReference(['ambulant', 'clinician', 'payout', payout.id]);

  const transfer = await initiatePaystackTransfer({
    amountCents: asCents(payout.amountCents),
    recipientCode: recipient.recipientCode,
    reference,
    reason: `Ambulant+ clinician contractor payout ${payout.id}`,
    currency: payout.currency || bankDetails!.currency || 'ZAR',
    metadata: {
      scope: 'clinician_payout',
      payoutId: payout.id,
      clinicianId: payout.entityId,
      actorRole,
    },
  });

  const nextStatus = clinicianTransferStatus(transfer);
  const nowIso = new Date().toISOString();
  const failureReason = nextStatus === 'failed' ? failureReasonFromTransfer(transfer) || 'paystack_transfer_failed' : null;

  const nextMeta: any = {
    ...currentMeta,
    payoutRef: transfer.reference || reference,
    contractorPayoutSummary: {
      ...asObject(currentMeta.contractorPayoutSummary),
      payoutId: payout.id,
      clinicianId: payout.entityId,
      netPayableCents: asCents(payout.amountCents),
      currency: payout.currency || 'ZAR',
      payoutReference: transfer.reference || reference,
      transferStatus: transfer.status,
      lastTransferSubmittedAt: nowIso,
    },
    paystackTransfer: {
      ...currentTransfer,
      provider: 'paystack',
      reference: transfer.reference || reference,
      transferCode: transfer.transferCode || currentTransfer.transferCode || null,
      recipientCode: transfer.recipientCode || recipient.recipientCode,
      status: transfer.status || null,
      amountCents: asCents(payout.amountCents),
      currency: payout.currency || 'ZAR',
      submittedAt: nowIso,
      submittedByRole: actorRole,
      recipientSource: existingRecipientCode ? 'existing' : 'created',
      raw: transfer.raw || null,
    },
  };

  if (failureReason) {
    nextMeta.paystackTransfer.failureReason = failureReason;
    nextMeta.failureReason = failureReason;
  }

  const updated = await (prisma as any).payout.update({
    where: { id: payout.id },
    data: {
      status: nextStatus,
      updatedAt: new Date(),
      meta: nextMeta,
    },
  });

  await audit('clinician_paystack_transfer_submitted', payout.id, {
    payoutId: payout.id,
    clinicianId: payout.entityId,
    amountCents: payout.amountCents,
    currency: payout.currency,
    reference: transfer.reference || reference,
    transferCode: transfer.transferCode || null,
    recipientCode: transfer.recipientCode || recipient.recipientCode,
    status: transfer.status,
    payoutStatus: nextStatus,
  });

  return {
    ok: nextStatus !== 'failed',
    payoutId: payout.id,
    clinicianId: payout.entityId,
    amountCents: payout.amountCents,
    currency: payout.currency,
    reference: transfer.reference || reference,
    transferCode: transfer.transferCode || null,
    recipientCode: transfer.recipientCode || recipient.recipientCode,
    paystackStatus: transfer.status,
    payoutStatus: updated.status,
    paid: nextStatus === 'paid',
    failed: nextStatus === 'failed',
    error: failureReason || undefined,
  };
}

async function listPayouts(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const role = text(searchParams.get('role'), 80).toLowerCase();
  const statusRaw = text(searchParams.get('status'), 80).toLowerCase();
  const entityId = text(searchParams.get('entityId') || searchParams.get('clinicianId'), 180);
  const fromRaw = text(searchParams.get('from') || searchParams.get('periodStart'), 40);
  const toRaw = text(searchParams.get('to') || searchParams.get('periodEnd'), 40);
  const limit = Math.min(500, asCents(searchParams.get('limit'), 100));

  const allowedStatuses = new Set(['pending', 'paid', 'cancelled', 'failed', 'refunded']);

  const where: any = {};
  if (role) where.role = role;
  if (allowedStatuses.has(statusRaw)) where.status = statusRaw;
  if (entityId) where.entityId = entityId;

  if (fromRaw || toRaw) {
    where.periodStart = {};
    if (fromRaw) {
      const from = new Date(fromRaw);
      if (!Number.isNaN(from.getTime())) where.periodStart.gte = from;
    }

    if (toRaw) {
      const to = new Date(toRaw);
      if (!Number.isNaN(to.getTime())) where.periodStart.lte = to;
    }
  }

  const items = await (prisma as any).payout.findMany({
    where,
    orderBy: [{ periodStart: 'desc' }, { createdAt: 'desc' }],
    take: limit,
  });

  return json({
    ok: true,
    items,
    summary: groupSummary(items),
    emptyState: items.length ? null : payoutEmptyState(role || 'payout'),
  });
}

export async function GET(req: NextRequest) {
  try {
    return await listPayouts(req);
  } catch (err: any) {
    console.error('GET /api/finance/payouts error', err);
    return json({ ok: false, error: err?.message || 'internal_error' }, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as any;
    const action = text(body?.action || '', 120).toLowerCase();
    const actorRole = text(req.headers.get('x-user-role') || body?.actorRole || 'admin', 80) || 'admin';

    if (action === 'check_paystack_balance' || action === 'paystack_balance') {
      const currency = text(body?.currency || 'ZAR', 3).toUpperCase() || 'ZAR';
      const balance = await checkPaystackTransferBalance(currency);
      return json({ ok: true, action, balance });
    }

    if (action === 'add_deduction') {
      const payoutId = text(body?.payoutId || body?.id, 180);
      if (!payoutId) return json({ ok: false, error: 'payoutId_required' }, 400);

      const payout = await (prisma as any).payout.findUnique({ where: { id: payoutId } });
      if (!payout) return json({ ok: false, error: 'payout_not_found' }, 404);

      const amountCents = asCents(body?.amountCents ?? body?.amountMinor ?? body?.amount);
      const advisoryOnly = Boolean(body?.advisoryOnly || body?.estimateOnly);
      const deduction = {
        code: text(body?.code || 'custom_deduction', 80) || 'custom_deduction',
        label: text(body?.label || body?.reason || 'Custom deduction', 180) || 'Custom deduction',
        amountCents,
        currency: payout.currency || 'ZAR',
        advisoryOnly,
        createdAt: new Date().toISOString(),
        createdByRole: actorRole,
      };

      const meta = asObject(payout.meta);
      const currentSummary = asObject(meta.contractorPayoutSummary);
      const customDeductions = Array.isArray(currentSummary.customDeductions) ? currentSummary.customDeductions : [];
      const nextCustomDeductions = [...customDeductions, deduction];

      const chargedCustomDeductionCents = nextCustomDeductions
        .filter((row: any) => !row.advisoryOnly)
        .reduce((sum: number, row: any) => sum + asCents(row.amountCents), 0);

      const nextAmountCents = advisoryOnly
        ? asCents(payout.amountCents)
        : Math.max(0, asCents(payout.amountCents) - amountCents);

      const updated = await (prisma as any).payout.update({
        where: { id: payoutId },
        data: {
          amountCents: nextAmountCents,
          updatedAt: new Date(),
          meta: {
            ...meta,
            contractorPayoutSummary: {
              ...currentSummary,
              customDeductions: nextCustomDeductions,
              customDeductionCents: chargedCustomDeductionCents,
              netPayableCents: nextAmountCents,
              updatedAt: new Date().toISOString(),
            },
          },
        },
      });

      await audit('clinician_payout_deduction_added', payoutId, {
        payoutId,
        deduction,
        previousAmountCents: payout.amountCents,
        nextAmountCents,
      });

      return json({ ok: true, action, payout: updated, deduction });
    }

    if (action === 'mark_paid' || action === 'mark_failed') {
      const payoutIds = [
        ...idsFrom(body?.payoutIds),
        ...idsFrom(body?.payoutId),
        ...idsFrom(body?.ids),
        ...idsFrom(body?.id),
      ];

      if (!payoutIds.length) return json({ ok: false, error: 'payoutIds_required' }, 400);

      const status = action === 'mark_paid' ? 'paid' : 'failed';
      const rows = await (prisma as any).payout.findMany({ where: { id: { in: payoutIds } } });
      const results: any[] = [];

      for (const payout of rows) {
        const meta = asObject(payout.meta);
        const nowIso = new Date().toISOString();

        const nextMeta: any = {
          ...meta,
          manualReconciliation: {
            action,
            status,
            remittanceRef: text(body?.remittanceRef || body?.payoutRef || body?.reference, 180) || null,
            failureReason: status === 'failed' ? text(body?.failureReason || body?.reason, 1000) || null : null,
            reconciledAt: nowIso,
            reconciledByRole: actorRole,
          },
        };

        if (status === 'paid') {
          nextMeta.payoutRef = nextMeta.manualReconciliation.remittanceRef || meta.payoutRef || null;
        }

        const updated = await (prisma as any).payout.update({
          where: { id: payout.id },
          data: { status, updatedAt: new Date(), meta: nextMeta },
        });

        results.push(updated);
      }

      await audit('clinician_payout_manual_reconciled', payoutIds.join(','), {
        action,
        status,
        payoutIds,
        count: results.length,
      });

      return json({ ok: true, action, status, updatedCount: results.length, items: results });
    }

    if (
      action === 'send_paystack_transfer' ||
      action === 'send_paystack_transfers' ||
      action === 'paystack_transfer'
    ) {
      const payoutIds = [
        ...idsFrom(body?.payoutIds),
        ...idsFrom(body?.payoutId),
        ...idsFrom(body?.ids),
        ...idsFrom(body?.id),
      ];

      if (!payoutIds.length) return json({ ok: false, error: 'payoutIds_required' }, 400);

      const rows = await (prisma as any).payout.findMany({
        where: { id: { in: payoutIds } },
        orderBy: { createdAt: 'asc' },
      });

      const transferResults: any[] = [];
      const skippedPayouts: any[] = [];

      for (const payout of rows) {
        if (String(payout.role || '').toLowerCase() !== 'clinician') {
          skippedPayouts.push({ payoutId: payout.id, reason: 'unsupported_payout_role', role: payout.role });
          continue;
        }

        try {
          const result = await sendClinicianPaystackTransferForPayout(payout, actorRole);
          if (result?.skipped) skippedPayouts.push(result);
          else transferResults.push(result);
        } catch (err: any) {
          transferResults.push({
            ok: false,
            payoutId: payout.id,
            clinicianId: payout.entityId,
            error: err?.message || 'clinician_paystack_transfer_failed',
          });
        }
      }

      return json({
        ok: true,
        action,
        requestedCount: payoutIds.length,
        transferredCount: transferResults.filter((row) => row?.ok).length,
        failedCount: transferResults.filter((row) => row?.ok === false).length,
        skippedCount: skippedPayouts.length,
        transferResults,
        skippedPayouts,
      });
    }

    return json({
      ok: false,
      error: 'unsupported_action',
      supportedActions: [
        'check_paystack_balance',
        'send_paystack_transfer',
        'send_paystack_transfers',
        'paystack_transfer',
        'mark_paid',
        'mark_failed',
        'add_deduction',
      ],
    }, 400);
  } catch (err: any) {
    console.error('POST /api/finance/payouts error', err);
    return json({ ok: false, error: err?.message || 'internal_error' }, 500);
  }
}
