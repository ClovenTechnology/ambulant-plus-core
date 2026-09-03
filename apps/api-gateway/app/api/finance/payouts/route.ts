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
// A5_J_G_E_B_FINANCE_PAYOUT_ROLE_WIDENING

function json(payload: any, status = 200) {
  return NextResponse.json(payload, { status });
}

function text(value: any, max = 240) {
  if (value === null || value === undefined) return '';
  return String(value).trim().slice(0, max);
}

function asObject(value: any): Record<string, any> {
  if (!value) return {};

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, any>;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed
        : {};
    } catch {
      return {};
    }
  }

  return {};
}

function asCents(value: any, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : fallback;
}

function idsFrom(value: any): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => text(item, 180)).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => text(item, 180))
      .filter(Boolean);
  }

  const single = text(value, 180);
  return single ? [single] : [];
}

function normalizeRole(role: any) {
  const value = text(role, 80).toLowerCase();

  if (value === 'phlebotomist' || value === 'phlebotomists' || value === 'phlebs') {
    return 'phleb';
  }

  return value;
}

function roleDisplayName(role: any) {
  const value = normalizeRole(role);

  if (value === 'clinician') return 'Clinician';
  if (value === 'rider') return 'Rider';
  if (value === 'phleb') return 'Phlebotomist';
  if (value === 'pharmacy') return 'Pharmacy';
  if (value === 'lab') return 'Lab';

  return text(role, 80) || 'Partner';
}

function supportedTransferRole(role: any) {
  const value = normalizeRole(role);
  return value === 'clinician' || value === 'rider' || value === 'phleb';
}

function payoutEmptyState(role: string) {
  const value = normalizeRole(role);

  if (value === 'clinician') {
    return {
      title: 'No payout summary yet.',
      message: "You haven't completed any eligible consultations yet.",
    };
  }

  if (value === 'rider') {
    return {
      title: 'No rider payout summary yet.',
      message: "No eligible rider delivery jobs have been completed yet.",
    };
  }

  if (value === 'phleb') {
    return {
      title: 'No phlebotomist payout summary yet.',
      message: "No eligible phlebotomy jobs have been completed yet.",
    };
  }

  return {
    title: 'No payout summary yet.',
    message: 'No eligible payout records were found.',
  };
}

function groupSummary(items: any[]) {
  const summary: Record<string, any> = {};

  for (const item of items) {
    const meta = asObject(item.meta);
    const cps = asObject(meta.contractorPayoutSummary);
    const key = [item.role, item.status, item.currency || 'ZAR'].join(':');

    if (!summary[key]) {
      summary[key] = {
        key,
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

async function safeFindFirst(delegate: any, attempts: any[]) {
  if (!delegate?.findFirst) return null;

  for (const where of attempts) {
    try {
      const found = await delegate.findFirst({ where });
      if (found) return found;
    } catch {
      // Try the next possible shape. Some optional delegate fields do not exist.
    }
  }

  return null;
}

async function safeFindUnique(delegate: any, attempts: any[]) {
  if (!delegate?.findUnique) return null;

  for (const where of attempts) {
    try {
      const found = await delegate.findUnique({ where });
      if (found) return found;
    } catch {
      // Try the next possible shape.
    }
  }

  return null;
}

async function loadClinicianProfile(clinicianId: string) {
  const db: any = prisma;
  const delegate = db.clinicianProfile;

  if (!delegate) return null;

  return (
    (await safeFindFirst(delegate, [
      { id: clinicianId },
      { userId: clinicianId },
      { email: clinicianId },
    ])) || null
  );
}

async function loadPhlebProfile(phlebId: string) {
  const db: any = prisma;
  const delegate = db.medReachPhlebProfile;

  if (!delegate) return null;

  return (
    (await safeFindUnique(delegate, [
      { id: phlebId },
      { userId: phlebId },
    ])) ||
    (await safeFindFirst(delegate, [
      { id: phlebId },
      { userId: phlebId },
      { displayName: phlebId },
      { phone: phlebId },
    ])) ||
    null
  );
}

async function loadRiderProfile(riderId: string) {
  const db: any = prisma;

  const delegateNames = [
    'carePortRider',
    'carePortRiderProfile',
    'rider',
    'deliveryRider',
    'carePortKyiProfile',
    'carePortKycProfile',
    'carePortPartnerApplication',
    'carePortPartnerKyc',
    'partnerApplication',
    'partnerKycProfile',
  ];

  for (const name of delegateNames) {
    const delegate = db[name];
    if (!delegate) continue;

    const found =
      (await safeFindUnique(delegate, [
        { id: riderId },
        { userId: riderId },
      ])) ||
      (await safeFindFirst(delegate, [
        { id: riderId },
        { userId: riderId },
        { riderId },
        { payeeEntityId: riderId },
        { ownerUserId: riderId },
        { applicantUserId: riderId },
      ]));

    if (found) return found;
  }

  return null;
}

async function loadPartnerProfile(role: string, entityId: string) {
  const normalized = normalizeRole(role);

  if (normalized === 'clinician') return loadClinicianProfile(entityId);
  if (normalized === 'phleb') return loadPhlebProfile(entityId);
  if (normalized === 'rider') return loadRiderProfile(entityId);

  return null;
}

function profileBankSource(profile: any, payout: any, role: string) {
  const profileMeta = {
    ...asObject(profile?.meta),
    ...asObject(profile?.profileMeta),
  };

  const verifiedIdentityMeta = {
    ...asObject(profile?.verifiedIdentityMeta),
    ...asObject(profileMeta.verifiedIdentityMeta),
  };

  const payoutMeta = asObject(payout?.meta);
  const contractorPayoutSummary = asObject(payoutMeta.contractorPayoutSummary);
  const source = asObject(payoutMeta.source);

  return {
    role: normalizeRole(role),
    displayRole: roleDisplayName(role),

    ...asObject(profile),
    ...profileMeta,
    ...verifiedIdentityMeta,

    ...asObject(profileMeta.payout),
    ...asObject(profileMeta.payoutSettings),
    ...asObject(profileMeta.bank),
    ...asObject(profileMeta.bankAccount),
    ...asObject(profileMeta.bankDetails),
    ...asObject(profileMeta.settlement),
    ...asObject(profileMeta.settlementDetails),
    ...asObject(profileMeta.kycPayload),
    ...asObject(profileMeta.kyiPayload),

    ...asObject(verifiedIdentityMeta.payout),
    ...asObject(verifiedIdentityMeta.bank),
    ...asObject(verifiedIdentityMeta.bankAccount),
    ...asObject(verifiedIdentityMeta.bankDetails),
    ...asObject(verifiedIdentityMeta.settlement),
    ...asObject(verifiedIdentityMeta.settlementDetails),
    ...asObject(verifiedIdentityMeta.kycPayload),
    ...asObject(verifiedIdentityMeta.kyiPayload),

    ...payoutMeta,
    ...contractorPayoutSummary,
    ...source,

    ...asObject(payoutMeta.payout),
    ...asObject(payoutMeta.bank),
    ...asObject(payoutMeta.bankAccount),
    ...asObject(payoutMeta.bankDetails),
    ...asObject(payoutMeta.settlement),
    ...asObject(payoutMeta.settlementDetails),
    ...asObject(contractorPayoutSummary.bank),
    ...asObject(contractorPayoutSummary.bankAccount),
    ...asObject(contractorPayoutSummary.bankDetails),

    accountName:
      text(profile?.displayName, 180) ||
      text(profile?.name, 180) ||
      text(profile?.email, 180) ||
      text(profileMeta.accountName, 180) ||
      text(profileMeta.beneficiaryName, 180) ||
      text(payoutMeta.accountName, 180) ||
      text(payoutMeta.beneficiaryName, 180) ||
      roleDisplayName(role) + ' ' + String(payout?.entityId || '').slice(0, 8),

    payoutAccountId:
      profile?.payoutAccountId ||
      profile?.payoutAccountMasked ||
      profileMeta.payoutAccountId ||
      profileMeta.payoutAccountMasked ||
      verifiedIdentityMeta.payoutAccountId ||
      verifiedIdentityMeta.payoutAccountMasked ||
      payoutMeta.payoutAccountId ||
      payoutMeta.payoutAccountMasked ||
      null,

    profileMeta,
    verifiedIdentityMeta,
    metadata: {
      role: normalizeRole(role),
      entityId: payout?.entityId || null,
      payoutId: payout?.id || null,
      source,
    },
  };
}

function verifiedClinicianPayoutAccount(profile: any) {
  const state = asObject(asObject(profile?.meta).payoutAccount);
  const status = text(state.status, 40).toLowerCase();
  const recipientCode = text(state.recipientCode || profile?.payoutAccountId, 180);
  if (status !== 'verified' || !recipientCode) return null;
  return {
    recipientCode,
    bankName: text(state.bankName, 180) || null,
    accountMasked: text(state.accountMasked, 80) || null,
    accountName: text(state.accountName, 180) || null,
    currency: 'ZAR',
    country: 'ZA',
  };
}

function partnerTransferStatus(transfer: any) {
  const status = text(transfer?.status || transfer?.paystackStatus, 80).toLowerCase();

  if (transfer?.paid || status === 'success') return 'paid';
  if (transfer?.failed || status === 'failed' || status === 'reversed') return 'failed';

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

async function sendPartnerPaystackTransferForPayout(payout: any, actorRole: string) {
  const role = normalizeRole(payout.role);

  if (!supportedTransferRole(role)) {
    return {
      ok: false,
      payoutId: payout.id,
      skipped: true,
      reason: 'unsupported_payout_role',
      role: payout.role,
    };
  }

  if (String(payout.status || '').toLowerCase() === 'paid') {
    return {
      ok: false,
      payoutId: payout.id,
      role,
      entityId: payout.entityId,
      skipped: true,
      reason: 'already_paid',
    };
  }

  if (asCents(payout.amountCents) <= 0) {
    return {
      ok: false,
      payoutId: payout.id,
      role,
      entityId: payout.entityId,
      skipped: true,
      reason: 'net_amount_not_positive',
    };
  }

  const profile = await loadPartnerProfile(role, String(payout.entityId || ''));
  const verifiedClinicianAccount = role === 'clinician' ? verifiedClinicianPayoutAccount(profile) : null;
  const bankDetails = role === 'clinician' ? null : extractPartnerBankDetails(profileBankSource(profile, payout, role));

  if (role === 'clinician' && !verifiedClinicianAccount) {
    return {
      ok: false,
      payoutId: payout.id,
      role,
      entityId: payout.entityId,
      error: 'clinician_verified_payout_destination_required',
    };
  }

  if (role !== 'clinician' && !paystackBankDetailsReady(bankDetails)) {
    return {
      ok: false,
      payoutId: payout.id,
      role,
      entityId: payout.entityId,
      error: role + '_bank_details_missing_or_incomplete',
    };
  }

  const currentMeta = asObject(payout.meta);
  const currentTransfer = asObject(currentMeta.paystackTransfer);
  const currentSummary = asObject(currentMeta.contractorPayoutSummary);

  const existingRecipientCode =
    text(currentTransfer.recipientCode || verifiedClinicianAccount?.recipientCode || (bankDetails as any)?.paystackRecipientCode, 180) || null;

  const displayRole = roleDisplayName(role);
  const recipientName =
    text(profile?.displayName, 120) ||
    text(profile?.name, 120) ||
    text(profile?.email, 120) ||
    text(verifiedClinicianAccount?.accountName || (bankDetails as any)?.accountName, 120) ||
    displayRole + ' ' + String(payout.entityId || '').slice(0, 8);

  const recipient = existingRecipientCode
    ? { recipientCode: existingRecipientCode, raw: { reused: true } }
    : role === 'clinician'
      ? (() => { throw new Error('clinician_verified_payout_destination_required'); })()
      : await createPaystackTransferRecipient({
        name: recipientName,
        accountNumber: bankDetails!.accountNumber!,
        bankCode: bankDetails!.bankCode!,
        currency: payout.currency || verifiedClinicianAccount?.currency || bankDetails?.currency || 'ZAR',
        country: bankDetails!.country || 'ZA',
        metadata: {
          scope: role + '_payout',
          payoutRole: role,
          entityId: payout.entityId,
          payoutId: payout.id,
          actorRole,
        },
      });

  const reference =
    text(currentTransfer.reference || currentMeta.payoutRef || currentSummary.payoutReference, 180) ||
    buildPaystackTransferReference(['ambulant', role, 'payout', payout.id]);

  const transfer = await initiatePaystackTransfer({
    amountCents: asCents(payout.amountCents),
    recipientCode: recipient.recipientCode,
    reference,
    reason: 'Ambulant+ ' + displayRole.toLowerCase() + ' contractor payout ' + payout.id,
    currency: payout.currency || verifiedClinicianAccount?.currency || bankDetails?.currency || 'ZAR',
    metadata: {
      scope: role + '_payout',
      payoutRole: role,
      entityId: payout.entityId,
      payoutId: payout.id,
      actorRole,
    },
  });

  const nextStatus = partnerTransferStatus(transfer);
  const failureReason = failureReasonFromTransfer(transfer);

  const nextSummary = {
    ...currentSummary,
    transferStatus: transfer.status || nextStatus,
    payoutReference: transfer.reference || reference,
    paystackTransferCode: transfer.transferCode || null,
    submittedAt: new Date().toISOString(),
    submittedByRole: actorRole,
  };

  const nextMeta: any = {
    ...currentMeta,
    payoutRef: transfer.reference || reference,
    contractorPayoutSummary: nextSummary,
    paystackTransfer: {
      ...currentTransfer,
      ok: transfer.ok,
      status: transfer.status || nextStatus,
      reference: transfer.reference || reference,
      transferCode: transfer.transferCode || null,
      recipientCode: transfer.recipientCode || recipient.recipientCode,
      amountCents: asCents(payout.amountCents),
      currency: payout.currency || verifiedClinicianAccount?.currency || bankDetails?.currency || 'ZAR',
      message: transfer.message || null,
      raw: transfer.raw || null,
      submittedAt: new Date().toISOString(),
      submittedByRole: actorRole,
      recipientSource: existingRecipientCode ? 'existing' : 'created',
      payoutRole: role,
      entityId: payout.entityId,
    },
  };

  if (failureReason) {
    nextMeta.paystackTransfer.failureReason = failureReason;
  }

  const updated = await (prisma as any).payout.update({
    where: { id: payout.id },
    data: {
      status: nextStatus,
      updatedAt: new Date(),
      meta: nextMeta,
    },
  });

  await audit('finance_payout_paystack_transfer_submitted', payout.id, {
    payoutId: payout.id,
    payoutRole: role,
    entityId: payout.entityId,
    amountCents: asCents(payout.amountCents),
    reference: transfer.reference || reference,
    transferStatus: transfer.status || nextStatus,
    actorRole,
  });

  return {
    ok: transfer.ok,
    payoutId: payout.id,
    role,
    entityId: payout.entityId,
    status: nextStatus,
    reference: transfer.reference || reference,
    transferCode: transfer.transferCode || null,
    recipientCode: transfer.recipientCode || recipient.recipientCode,
    updated,
  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const role = normalizeRole(searchParams.get('role'));
    const status = text(searchParams.get('status'), 80).toLowerCase();
    const entityId = text(
      searchParams.get('entityId') ||
        searchParams.get('clinicianId') ||
        searchParams.get('riderId') ||
        searchParams.get('phlebId'),
      180,
    );

    const limit = Math.min(
      Math.max(parseInt(searchParams.get('limit') || '100', 10) || 100, 1),
      500,
    );

    const where: any = {};

    if (role) where.role = role;
    if (status) where.status = status;
    if (entityId) where.entityId = entityId;

    const items = await (prisma as any).payout.findMany({
      where,
      orderBy: [{ periodEnd: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });

    return json({
      ok: true,
      items,
      summary: groupSummary(items),
      emptyState: items.length ? null : payoutEmptyState(role || 'payout'),
    });
  } catch (err: any) {
    console.error('GET /api/finance/payouts error', err);
    return json({ ok: false, error: err?.message || 'internal_error' }, 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = text(body?.action, 120).toLowerCase();
    const actorRole = text(req.headers.get('x-user-role') || body?.actorRole || 'admin', 80) || 'admin';

    if (action === 'check_paystack_balance' || action === 'paystack_balance') {
      const currency = text(body?.currency || 'ZAR', 8).toUpperCase() || 'ZAR';
      const balance = await checkPaystackTransferBalance(currency);

      return json({
        ok: true,
        action,
        currency,
        balance,
      });
    }

    if (action === 'add_deduction') {
      const payoutIds = [
        ...idsFrom(body?.payoutIds),
        ...idsFrom(body?.payoutId),
        ...idsFrom(body?.ids),
        ...idsFrom(body?.id),
      ];

      if (!payoutIds.length) return json({ ok: false, error: 'payoutIds_required' }, 400);

      const amountCents = asCents(body?.amountCents ?? body?.amountMinor ?? body?.amount);
      const reason = text(body?.reason || body?.description || 'Admin deduction', 500);
      const deductionType = text(body?.deductionType || body?.type || 'admin_adjustment', 120);

      if (amountCents <= 0) return json({ ok: false, error: 'positive_amountCents_required' }, 400);

      const rows = await (prisma as any).payout.findMany({
        where: { id: { in: payoutIds } },
        orderBy: { createdAt: 'asc' },
      });

      const results: any[] = [];

      for (const payout of rows) {
        const meta = asObject(payout.meta);
        const cps = asObject(meta.contractorPayoutSummary);
        const currentDeductions = Array.isArray(cps.customDeductions) ? cps.customDeductions : [];

        const nextCustomDeductions = [
          ...currentDeductions,
          {
            type: deductionType,
            reason,
            amountCents,
            createdAt: new Date().toISOString(),
            createdByRole: actorRole,
            advisoryOnly: false,
          },
        ];

        const customDeductionCents = asCents(cps.customDeductionCents) + amountCents;
        const totalChargedDeductionsCents =
          asCents(cps.onboardingInstalmentCents) +
          asCents(cps.planFeeCents) +
          customDeductionCents +
          asCents(cps.taxWithholdingCents);

        const base =
          asCents(cps.baseClinicianTakeCents) ||
          asCents(cps.baseContractorTakeCents) ||
          asCents(cps.netPayableCents) ||
          asCents(payout.amountCents);

        const nextNetPayableCents = Math.max(0, base - totalChargedDeductionsCents);

        const nextMeta = {
          ...meta,
          contractorPayoutSummary: {
            ...cps,
            customDeductions: nextCustomDeductions,
            customDeductionCents,
            totalChargedDeductionsCents,
            netPayableCents: nextNetPayableCents,
            lastDeductionAt: new Date().toISOString(),
          },
        };

        const updated = await (prisma as any).payout.update({
          where: { id: payout.id },
          data: {
            amountCents: nextNetPayableCents,
            updatedAt: new Date(),
            meta: nextMeta,
          },
        });

        results.push(updated);
      }

      await audit('finance_payout_deduction_added', payoutIds.join(','), {
        action,
        payoutIds,
        amountCents,
        reason,
        deductionType,
        count: results.length,
      });

      return json({
        ok: true,
        action,
        updatedCount: results.length,
        items: results,
      });
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
      const remittanceRef = text(body?.remittanceRef || body?.payoutRef || body?.reference, 180) || null;
      const note = text(body?.note || body?.reason || body?.failureReason, 1000) || null;

      const rows = await (prisma as any).payout.findMany({
        where: { id: { in: payoutIds } },
        orderBy: { createdAt: 'asc' },
      });

      const results: any[] = [];

      for (const payout of rows) {
        const meta = asObject(payout.meta);

        const nextMeta: any = {
          ...meta,
          manualReconciliation: {
            status,
            remittanceRef,
            note,
            reconciledAt: new Date().toISOString(),
            reconciledByRole: actorRole,
          },
        };

        if (status === 'paid') {
          nextMeta.payoutRef = remittanceRef || meta.payoutRef || null;
        }

        const updated = await (prisma as any).payout.update({
          where: { id: payout.id },
          data: {
            status,
            updatedAt: new Date(),
            meta: nextMeta,
          },
        });

        results.push(updated);
      }

      await audit('finance_payout_manual_reconciled', payoutIds.join(','), {
        action,
        status,
        payoutIds,
        count: results.length,
      });

      return json({
        ok: true,
        action,
        status,
        updatedCount: results.length,
        items: results,
      });
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
        try {
          const result = await sendPartnerPaystackTransferForPayout(payout, actorRole);

          if (result?.skipped) skippedPayouts.push(result);
          else transferResults.push(result);
        } catch (err: any) {
          transferResults.push({
            ok: false,
            payoutId: payout.id,
            role: normalizeRole(payout.role),
            entityId: payout.entityId,
            error: err?.message || 'partner_paystack_transfer_failed',
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
