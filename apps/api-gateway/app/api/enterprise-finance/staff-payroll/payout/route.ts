import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  asObject,
  auditEnterpriseFinance,
  json,
  requireEnterpriseFinanceAdmin,
  routeError,
  text,
} from '@/src/enterprise-finance/access-envelope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function int(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

function payslipNumber(period: any, staffUserId: string) {
  const key = String(staffUserId).replace(/[^A-Za-z0-9]/g, '').slice(-10) || 'STAFF';
  const month = new Date(period.startsAt).toISOString().slice(0, 7).replace('-', '');
  return `AMB-${month}-${key}-${Date.now().toString(36).toUpperCase()}`;
}

export async function GET(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;
    const db: any = prisma;
    const { searchParams } = new URL(req.url);
    const payrollProfileId = text(searchParams.get('payrollProfileId'), 180);
    const staffUserId = text(searchParams.get('staffUserId'), 180);
    if (!payrollProfileId && !staffUserId) return json({ ok: false, error: 'payroll_profile_or_staff_required' }, 400);
    const profile = await db.staffPayrollProfile.findFirst({ where: payrollProfileId ? { id: payrollProfileId } : { staffUserId } });
    if (!profile) return json({ ok: false, error: 'staff_payroll_profile_not_found' }, 404);
    const [payslips, commissions, arrears] = await Promise.all([
      db.payslip.findMany({ where: { staffUserId: profile.staffUserId }, orderBy: { createdAt: 'desc' }, take: 50 }),
      db.commissionAward.findMany({ where: { staffUserId: profile.staffUserId, status: { in: ['APPROVED', 'SCHEDULED', 'PAID'] } }, orderBy: { createdAt: 'desc' }, take: 100 }),
      db.staffPayrollEntitlement.findMany({ where: { payrollProfileId: profile.id, remainingCents: { gt: 0 } }, orderBy: { periodStartsAt: 'asc' }, take: 240 }),
    ]);
    return json({ ok: true, envelope: access.envelope, profile, payslips, commissions, arrears });
  } catch (error) {
    return routeError(error, 'enterprise_finance_staff_payout_read_failed');
  }
}

export async function POST(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;
    const db: any = prisma;
    const body = await req.json().catch(() => ({}));
    const action = text(body.action, 80);

    if (action === 'prepare_payslip') {
      const payrollProfileId = text(body.payrollProfileId, 180);
      const payrollPeriodId = text(body.payrollPeriodId, 180);
      if (!payrollProfileId || !payrollPeriodId) return json({ ok: false, error: 'payroll_profile_and_period_required' }, 400);
      const profile = await db.staffPayrollProfile.findUnique({ where: { id: payrollProfileId } });
      const period = await db.payrollPeriod.findUnique({ where: { id: payrollPeriodId } });
      if (!profile || !period) return json({ ok: false, error: 'payroll_profile_or_period_not_found' }, 404);
      const baseEntitlement = await db.staffPayrollEntitlement.findUnique({
        where: { staffUserId_payrollPeriodId: { staffUserId: profile.staffUserId, payrollPeriodId } },
      });
      if (!baseEntitlement) return json({ ok: false, error: 'payroll_entitlement_required_before_payslip' }, 409);

      const requestedArrearsIds = Array.isArray(body.arrearsEntitlementIds) ? body.arrearsEntitlementIds.map(String) : [];
      const arrears = requestedArrearsIds.length ? await db.staffPayrollEntitlement.findMany({
        where: { id: { in: requestedArrearsIds }, payrollProfileId: profile.id, remainingCents: { gt: 0 } },
        orderBy: { periodStartsAt: 'asc' },
      }) : [];
      if (arrears.length !== requestedArrearsIds.length) return json({ ok: false, error: 'invalid_or_settled_arrears_selection' }, 409);

      const requestedAwardIds = Array.isArray(body.commissionAwardIds) ? body.commissionAwardIds.map(String) : [];
      const awards = requestedAwardIds.length ? await db.commissionAward.findMany({
        where: { id: { in: requestedAwardIds }, staffUserId: profile.staffUserId, status: { in: ['APPROVED', 'SCHEDULED'] } },
      }) : [];
      if (awards.length !== requestedAwardIds.length) return json({ ok: false, error: 'invalid_commission_selection' }, 409);

      const baseSalaryCents = int(baseEntitlement.remainingCents || baseEntitlement.grossEntitlementCents);
      const arrearsPaidCents = arrears.reduce((s: number, x: any) => s + int(x.remainingCents), 0);
      const commissionCents = awards.reduce((s: number, x: any) => s + int(x.approvedAmountCents || x.calculatedAmountCents), 0);
      const bonusCents = int(body.bonusCents);
      const otherEarningsCents = int(body.otherEarningsCents);
      const deductionCents = int(body.deductionCents);
      const taxWithholdingCents = int(body.taxWithholdingCents);
      const uifCents = int(body.uifCents);
      const pensionCents = int(body.pensionCents);
      const allowanceCents = bonusCents + otherEarningsCents;
      const totalDeductions = deductionCents + taxWithholdingCents + uifCents + pensionCents;
      const netPayCents = Math.max(0, baseSalaryCents + arrearsPaidCents + commissionCents + allowanceCents - totalDeductions);

      const result = await db.$transaction(async (tx: any) => {
        let run = await tx.payrollRun.findFirst({ where: { payrollPeriodId, runType: 'staff_payout', status: { in: ['draft', 'approved'] } }, orderBy: { createdAt: 'desc' } });
        if (!run) run = await tx.payrollRun.create({ data: { payrollPeriodId, runType: 'staff_payout', status: 'draft', currency: profile.currency || 'ZAR', generatedByUserId: access.envelope.actor.userId, generatedAt: new Date() } });

        let slip = await tx.payslip.findFirst({ where: { payrollPeriodId, staffUserId: profile.staffUserId, status: { in: ['draft', 'approved', 'scheduled'] } }, orderBy: { createdAt: 'desc' } });
        const slipData = {
          payrollRunId: run.id,
          payrollProfileId: profile.id,
          status: 'draft',
          grossSalaryCents: baseSalaryCents,
          allowanceCents,
          commissionCents,
          arrearsPaidCents,
          deductionCents,
          taxWithholdingCents,
          uifCents,
          pensionCents,
          netPayCents,
          unpaidBalanceCents: netPayCents,
          currency: profile.currency || 'ZAR',
          employerNote: text(body.employerNote, 2000),
          meta: {
            generatedFromEntitlementId: baseEntitlement.id,
            arrears: arrears.map((x: any) => ({ entitlementId: x.id, amountCents: int(x.remainingCents), payrollPeriodId: x.payrollPeriodId })),
            commissionAwardIds: awards.map((x: any) => x.id),
            bonusCents,
            otherEarningsCents,
          },
        };
        if (slip) slip = await tx.payslip.update({ where: { id: slip.id }, data: slipData });
        else slip = await tx.payslip.create({ data: { ...slipData, payrollPeriodId, staffUserId: profile.staffUserId, payslipNumber: payslipNumber(period, profile.staffUserId) } });

        await tx.payslipLineItem.deleteMany({ where: { payslipId: slip.id } });
        const lines: any[] = [
          { lineType: 'base_salary', label: 'Base salary', amountCents: baseSalaryCents, sourceType: 'staff_payroll_entitlement', sourceId: baseEntitlement.id },
          ...arrears.map((x: any) => ({ lineType: 'historical_arrears', label: `Historical arrears — ${new Date(x.periodStartsAt).toISOString().slice(0, 7)}`, amountCents: int(x.remainingCents), sourceType: 'staff_payroll_entitlement', sourceId: x.id })),
          ...awards.map((x: any) => ({ lineType: 'commission', label: 'Commission', amountCents: int(x.approvedAmountCents || x.calculatedAmountCents), sourceType: 'commission_award', sourceId: x.id })),
        ];
        if (bonusCents) lines.push({ lineType: 'bonus', label: 'Bonus / incentive', amountCents: bonusCents });
        if (otherEarningsCents) lines.push({ lineType: 'other_earnings', label: 'Other approved earnings', amountCents: otherEarningsCents });
        if (deductionCents) lines.push({ lineType: 'deduction', label: 'Deductions / recoveries', amountCents: -deductionCents });
        if (taxWithholdingCents) lines.push({ lineType: 'tax', label: 'Tax withholding', amountCents: -taxWithholdingCents });
        if (uifCents) lines.push({ lineType: 'uif', label: 'UIF', amountCents: -uifCents });
        if (pensionCents) lines.push({ lineType: 'pension', label: 'Pension', amountCents: -pensionCents });
        if (lines.length) await tx.payslipLineItem.createMany({ data: lines.map((line) => ({ payslipId: slip.id, staffUserId: profile.staffUserId, currency: profile.currency || 'ZAR', affectsNetPay: true, ...line })) });
        if (awards.length) await tx.commissionAward.updateMany({ where: { id: { in: awards.map((x: any) => x.id) } }, data: { status: 'SCHEDULED', payrollPeriodId, payslipId: slip.id } });
        await tx.payrollRun.update({ where: { id: run.id }, data: { staffCount: 1, grossCents: baseSalaryCents, allowanceCents, commissionCents, deductionCents: totalDeductions, netPayCents, arrearsPaidCents } });
        return { run, payslip: slip, lines };
      });

      await auditEnterpriseFinance('staff_payslip_prepared', req, { model: 'Payslip', subjectId: result.payslip.id, staffUserId: profile.staffUserId, netPayCents });
      return json({ ok: true, envelope: access.envelope, ...result });
    }

    if (action === 'mark_payslip_paid') {
      const payslipId = text(body.payslipId, 180);
      const paymentReference = text(body.paymentReference, 240);
      const proofOfPaymentObjectKey = text(body.proofOfPaymentObjectKey, 1200);
      if (!payslipId || !paymentReference || !proofOfPaymentObjectKey) return json({ ok: false, error: 'payslip_payment_reference_and_proof_required' }, 400);
      const slip = await db.payslip.findUnique({ where: { id: payslipId } });
      if (!slip) return json({ ok: false, error: 'payslip_not_found' }, 404);
      if (slip.status === 'paid') return json({ ok: true, envelope: access.envelope, payslip: slip, idempotent: true });
      const amountCents = int(body.amountCents || slip.unpaidBalanceCents);
      if (amountCents !== int(slip.unpaidBalanceCents) || amountCents <= 0) return json({ ok: false, error: 'payslip_closeout_requires_exact_unpaid_balance' }, 409);
      const meta = asObject(slip.meta);
      const arrearsMeta = Array.isArray(meta.arrears) ? meta.arrears : [];
      const commissionAwardIds = Array.isArray(meta.commissionAwardIds) ? meta.commissionAwardIds.map(String) : [];

      const result = await db.$transaction(async (tx: any) => {
        const batch = await tx.payrollPaymentBatch.create({ data: {
          label: `Payslip ${slip.payslipNumber || slip.id}`,
          batchType: 'payroll', status: 'paid', staffCount: 1,
          allocationCount: 1 + arrearsMeta.length + commissionAwardIds.length,
          totalAmountCents: amountCents, paidAmountCents: amountCents,
          currency: slip.currency, paymentMethod: text(body.paymentMethod || 'manual', 80), manualReference: paymentReference,
          createdByUserId: access.envelope.actor.userId, approvedByUserId: access.envelope.actor.userId,
          approvedAt: new Date(), submittedAt: new Date(), completedAt: new Date(),
          meta: { proofOfPaymentObjectKey },
        }});

        const arrearsTotal = arrearsMeta.reduce((s: number, x: any) => s + int(x.amountCents), 0);
        const commissionAwards = commissionAwardIds.length ? await tx.commissionAward.findMany({ where: { id: { in: commissionAwardIds }, payslipId: slip.id } }) : [];
        const commissionTotal = commissionAwards.reduce((s: number, x: any) => s + int(x.approvedAmountCents || x.calculatedAmountCents), 0);
        const primaryAmount = Math.max(0, amountCents - arrearsTotal - commissionTotal);
        if (primaryAmount) await tx.payrollPaymentAllocation.create({ data: { paymentBatchId: batch.id, staffUserId: slip.staffUserId, payslipId: slip.id, allocationType: 'salary_and_adjustments', status: 'paid', amountCents: primaryAmount, currency: slip.currency, paymentMethod: text(body.paymentMethod || 'manual', 80), paymentReference, allocatedAt: new Date(), paidAt: new Date(), reconciledByUserId: access.envelope.actor.userId, reconciledAt: new Date(), meta: { proofOfPaymentObjectKey } } });

        for (const item of arrearsMeta) {
          const entitlement = await tx.staffPayrollEntitlement.findUnique({ where: { id: String(item.entitlementId) } });
          if (!entitlement || entitlement.staffUserId !== slip.staffUserId) throw new Error('payslip_arrears_entitlement_mismatch');
          const pay = Math.min(int(item.amountCents), int(entitlement.remainingCents));
          if (!pay) continue;
          const ledger = await tx.staffArrearsLedger.findFirst({ where: { sourceType: 'historical_payroll_entitlement', sourceId: entitlement.id }, orderBy: { createdAt: 'desc' } });
          const accrual = await tx.staffSalaryAccrual.findFirst({ where: { sourceType: 'historical_payroll_entitlement', sourceId: entitlement.id }, orderBy: { createdAt: 'desc' } });
          const allocation = await tx.payrollPaymentAllocation.create({ data: { paymentBatchId: batch.id, staffUserId: slip.staffUserId, payslipId: slip.id, arrearsLedgerEntryId: ledger?.id || null, salaryAccrualId: accrual?.id || null, allocationType: 'arrears_payment', status: 'paid', amountCents: pay, currency: slip.currency, paymentMethod: text(body.paymentMethod || 'manual', 80), paymentReference, allocatedAt: new Date(), paidAt: new Date(), reconciledByUserId: access.envelope.actor.userId, reconciledAt: new Date(), meta: { entitlementId: entitlement.id, proofOfPaymentObjectKey } } });
          const nextPost = int(entitlement.postReconciliationPaidCents) + pay;
          const nextRemaining = Math.max(0, int(entitlement.grossEntitlementCents) - int(entitlement.amountHistoricallySettledCents) - nextPost);
          await tx.staffPayrollEntitlement.update({ where: { id: entitlement.id }, data: { postReconciliationPaidCents: nextPost, remainingCents: nextRemaining } });
          if (accrual) await tx.staffSalaryAccrual.update({ where: { id: accrual.id }, data: { paidCents: int(accrual.paidCents) + pay, unpaidCents: nextRemaining, status: nextRemaining ? 'partial' : 'settled', payslipId: slip.id } });
          if (ledger) await tx.staffArrearsLedger.update({ where: { id: ledger.id }, data: { creditCents: int(ledger.creditCents) + pay, balanceAfterCents: nextRemaining, status: nextRemaining ? 'partial' : 'settled', payslipId: slip.id, batchId: batch.id, approvedByUserId: access.envelope.actor.userId, approvedAt: new Date(), meta: { ...(asObject(ledger.meta)), lastPaymentAllocationId: allocation.id } } });
        }

        for (const award of commissionAwards) {
          const amount = int(award.approvedAmountCents || award.calculatedAmountCents);
          const allocation = await tx.payrollPaymentAllocation.create({ data: { paymentBatchId: batch.id, staffUserId: slip.staffUserId, payslipId: slip.id, allocationType: 'commission_payment', status: 'paid', amountCents: amount, currency: slip.currency, paymentMethod: text(body.paymentMethod || 'manual', 80), paymentReference, allocatedAt: new Date(), paidAt: new Date(), reconciledByUserId: access.envelope.actor.userId, reconciledAt: new Date(), meta: { commissionAwardId: award.id, proofOfPaymentObjectKey } } });
          await tx.commissionAward.update({ where: { id: award.id }, data: { status: 'PAID', paidAmountCents: amount, paymentAllocationId: allocation.id } });
          if (award.commissionEventId) await tx.commissionEvent.update({ where: { id: award.commissionEventId }, data: { eventStatus: 'PAID' } });
        }

        const payslip = await tx.payslip.update({ where: { id: slip.id }, data: { status: 'paid', unpaidBalanceCents: 0, paidAt: new Date(), issuedAt: slip.issuedAt || new Date(), approvedAt: slip.approvedAt || new Date(), approvedByUserId: slip.approvedByUserId || access.envelope.actor.userId, meta: { ...meta, paymentReference, proofOfPaymentObjectKey, paymentBatchId: batch.id } } });
        if (slip.payrollRunId) await tx.payrollRun.update({ where: { id: slip.payrollRunId }, data: { status: 'paid', paidAt: new Date(), approvedAt: new Date(), approvedByUserId: access.envelope.actor.userId } });
        return { batch, payslip };
      });

      await auditEnterpriseFinance('staff_payslip_paid', req, { model: 'Payslip', subjectId: result.payslip.id, staffUserId: result.payslip.staffUserId, amountCents, paymentReference, proofOfPaymentObjectKey });
      return json({ ok: true, envelope: access.envelope, ...result });
    }

    return json({ ok: false, error: 'unsupported_staff_payout_action' }, 400);
  } catch (error) {
    return routeError(error, 'enterprise_finance_staff_payout_write_failed');
  }
}
