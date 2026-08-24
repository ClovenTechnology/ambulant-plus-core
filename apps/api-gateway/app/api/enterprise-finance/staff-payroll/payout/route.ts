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

const PAYMENT_METHODS = new Set([
  'bank_transfer',
  'eft',
  'paystack',
  'card',
  'cash',
  'internal_adjustment',
  'manual',
  'other',
]);

function int(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

function payslipNumber(period: any, staffUserId: string) {
  const key = String(staffUserId).replace(/[^A-Za-z0-9]/g, '').slice(-10) || 'STAFF';
  const month = new Date(period.startsAt).toISOString().slice(0, 7).replace('-', '');
  return `AMB-${month}-${key}-${Date.now().toString(36).toUpperCase()}`;
}

function paymentMethod(value: unknown) {
  const normalized = String(value || 'bank_transfer').trim().toLowerCase().replace(/\s+/g, '_');
  return PAYMENT_METHODS.has(normalized) ? normalized : null;
}

function settlementDate(value: unknown) {
  if (!value) return new Date();
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  if (d.getTime() > Date.now() + 5 * 60 * 1000) return null;
  return d;
}

function appendUnique(values: unknown, value: string) {
  const list = Array.isArray(values) ? values.map(String) : [];
  return Array.from(new Set([...list, value]));
}

export async function GET(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;

    const db: any = prisma;
    const { searchParams } = new URL(req.url);
    const payrollProfileId = text(searchParams.get('payrollProfileId'), 180);
    const staffUserId = text(searchParams.get('staffUserId'), 180);
    if (!payrollProfileId && !staffUserId) {
      return json({ ok: false, error: 'payroll_profile_or_staff_required' }, 400);
    }

    const profile = await db.staffPayrollProfile.findFirst({
      where: payrollProfileId ? { id: payrollProfileId } : { staffUserId },
    });
    if (!profile) return json({ ok: false, error: 'staff_payroll_profile_not_found' }, 404);

    const [payslips, commissions, arrears] = await Promise.all([
      db.payslip.findMany({
        where: { staffUserId: profile.staffUserId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      db.commissionAward.findMany({
        where: {
          staffUserId: profile.staffUserId,
          status: { in: ['APPROVED', 'SCHEDULED', 'PAID', 'approved', 'scheduled', 'partially_paid'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      db.staffPayrollEntitlement.findMany({
        where: { payrollProfileId: profile.id, remainingCents: { gt: 0 } },
        orderBy: { periodStartsAt: 'asc' },
        take: 240,
      }),
    ]);

    const payslipIds = payslips.map((row: any) => row.id);
    const [lineItems, allocations] = payslipIds.length
      ? await Promise.all([
          db.payslipLineItem.findMany({
            where: { payslipId: { in: payslipIds } },
            orderBy: { createdAt: 'asc' },
          }),
          db.payrollPaymentAllocation.findMany({
            where: { payslipId: { in: payslipIds } },
            orderBy: { createdAt: 'desc' },
            take: 500,
          }),
        ])
      : [[], []];

    const batchIds = Array.from(new Set(allocations.map((row: any) => row.paymentBatchId).filter(Boolean)));
    const paymentBatches = batchIds.length
      ? await db.payrollPaymentBatch.findMany({
          where: { id: { in: batchIds } },
          orderBy: { createdAt: 'desc' },
        })
      : [];

    const linesBySlip = new Map<string, any[]>();
    for (const row of lineItems) {
      const list = linesBySlip.get(row.payslipId) || [];
      list.push(row);
      linesBySlip.set(row.payslipId, list);
    }

    const allocationsBySlip = new Map<string, any[]>();
    for (const row of allocations) {
      const list = allocationsBySlip.get(row.payslipId) || [];
      list.push(row);
      allocationsBySlip.set(row.payslipId, list);
    }

    return json({
      ok: true,
      envelope: access.envelope,
      profile,
      payslips: payslips.map((slip: any) => ({
        ...slip,
        lineItems: linesBySlip.get(slip.id) || [],
        allocations: allocationsBySlip.get(slip.id) || [],
      })),
      paymentBatches,
      commissions,
      arrears,
    });
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
      if (!payrollProfileId || !payrollPeriodId) {
        return json({ ok: false, error: 'payroll_profile_and_period_required' }, 400);
      }

      const profile = await db.staffPayrollProfile.findUnique({ where: { id: payrollProfileId } });
      const period = await db.payrollPeriod.findUnique({ where: { id: payrollPeriodId } });
      if (!profile || !period) return json({ ok: false, error: 'payroll_profile_or_period_not_found' }, 404);

      const baseEntitlement = await db.staffPayrollEntitlement.findUnique({
        where: { staffUserId_payrollPeriodId: { staffUserId: profile.staffUserId, payrollPeriodId } },
      });
      if (!baseEntitlement) {
        return json({ ok: false, error: 'payroll_entitlement_required_before_payslip' }, 409);
      }

      const requestedArrearsIds = Array.isArray(body.arrearsEntitlementIds)
        ? body.arrearsEntitlementIds.map(String)
        : [];
      const arrears = requestedArrearsIds.length
        ? await db.staffPayrollEntitlement.findMany({
            where: {
              id: { in: requestedArrearsIds },
              payrollProfileId: profile.id,
              remainingCents: { gt: 0 },
            },
            orderBy: { periodStartsAt: 'asc' },
          })
        : [];
      if (arrears.length !== requestedArrearsIds.length) {
        return json({ ok: false, error: 'invalid_or_settled_arrears_selection' }, 409);
      }

      const requestedAwardIds = Array.isArray(body.commissionAwardIds)
        ? body.commissionAwardIds.map(String)
        : [];
      const awards = requestedAwardIds.length
        ? await db.commissionAward.findMany({
            where: {
              id: { in: requestedAwardIds },
              staffUserId: profile.staffUserId,
              status: { in: ['APPROVED', 'SCHEDULED', 'approved', 'scheduled'] },
            },
          })
        : [];
      if (awards.length !== requestedAwardIds.length) {
        return json({ ok: false, error: 'invalid_commission_selection' }, 409);
      }

      const baseSalaryCents = int(baseEntitlement.remainingCents || baseEntitlement.grossEntitlementCents);
      const arrearsPaidCents = arrears.reduce((sum: number, row: any) => sum + int(row.remainingCents), 0);
      const commissionCents = awards.reduce(
        (sum: number, row: any) => sum + Math.max(0, int(row.approvedAmountCents || row.calculatedAmountCents) - int(row.paidAmountCents)),
        0,
      );
      const bonusCents = int(body.bonusCents);
      const otherEarningsCents = int(body.otherEarningsCents);
      const deductionCents = int(body.deductionCents);
      const taxWithholdingCents = int(body.taxWithholdingCents);
      const uifCents = int(body.uifCents);
      const pensionCents = int(body.pensionCents);
      const allowanceCents = bonusCents + otherEarningsCents;
      const totalDeductions = deductionCents + taxWithholdingCents + uifCents + pensionCents;
      const netPayCents = Math.max(
        0,
        baseSalaryCents + arrearsPaidCents + commissionCents + allowanceCents - totalDeductions,
      );

      const result = await db.$transaction(async (tx: any) => {
        let run = await tx.payrollRun.findFirst({
          where: {
            payrollPeriodId,
            runType: 'staff_payout',
            status: { in: ['draft', 'approved'] },
          },
          orderBy: { createdAt: 'desc' },
        });
        if (!run) {
          run = await tx.payrollRun.create({
            data: {
              payrollPeriodId,
              runType: 'staff_payout',
              status: 'draft',
              currency: profile.currency || 'ZAR',
              generatedByUserId: access.envelope.actor.userId,
              generatedAt: new Date(),
            },
          });
        }

        let slip = await tx.payslip.findFirst({
          where: {
            payrollPeriodId,
            staffUserId: profile.staffUserId,
            status: { in: ['draft', 'approved', 'scheduled'] },
          },
          orderBy: { createdAt: 'desc' },
        });

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
          issuedAt: new Date(),
          meta: {
            generatedFromEntitlementId: baseEntitlement.id,
            arrears: arrears.map((row: any) => ({
              entitlementId: row.id,
              amountCents: int(row.remainingCents),
              payrollPeriodId: row.payrollPeriodId,
            })),
            commissionAwardIds: awards.map((row: any) => row.id),
            bonusCents,
            otherEarningsCents,
            generatedBySystem: true,
            generatedAt: new Date().toISOString(),
          },
        };

        if (slip) slip = await tx.payslip.update({ where: { id: slip.id }, data: slipData });
        else {
          slip = await tx.payslip.create({
            data: {
              ...slipData,
              payrollPeriodId,
              staffUserId: profile.staffUserId,
              payslipNumber: payslipNumber(period, profile.staffUserId),
            },
          });
        }

        await tx.payslipLineItem.deleteMany({ where: { payslipId: slip.id } });
        const lines: any[] = [
          {
            lineType: 'base_salary',
            label: 'Base salary',
            amountCents: baseSalaryCents,
            sourceType: 'staff_payroll_entitlement',
            sourceId: baseEntitlement.id,
          },
          ...arrears.map((row: any) => ({
            lineType: 'historical_arrears',
            label: `Historical arrears — ${new Date(row.periodStartsAt).toISOString().slice(0, 7)}`,
            amountCents: int(row.remainingCents),
            sourceType: 'staff_payroll_entitlement',
            sourceId: row.id,
          })),
          ...awards.map((row: any) => ({
            lineType: 'commission',
            label: 'Commission',
            amountCents: Math.max(0, int(row.approvedAmountCents || row.calculatedAmountCents) - int(row.paidAmountCents)),
            sourceType: 'commission_award',
            sourceId: row.id,
          })),
        ];

        if (bonusCents) lines.push({ lineType: 'bonus', label: 'Bonus / incentive', amountCents: bonusCents });
        if (otherEarningsCents) lines.push({ lineType: 'other_earnings', label: 'Other approved earnings', amountCents: otherEarningsCents });
        if (deductionCents) lines.push({ lineType: 'deduction', label: 'Deductions / recoveries', amountCents: -deductionCents });
        if (taxWithholdingCents) lines.push({ lineType: 'tax', label: 'Tax withholding', amountCents: -taxWithholdingCents });
        if (uifCents) lines.push({ lineType: 'uif', label: 'UIF', amountCents: -uifCents });
        if (pensionCents) lines.push({ lineType: 'pension', label: 'Pension', amountCents: -pensionCents });

        if (lines.length) {
          await tx.payslipLineItem.createMany({
            data: lines.map((line) => ({
              payslipId: slip.id,
              staffUserId: profile.staffUserId,
              currency: profile.currency || 'ZAR',
              affectsNetPay: true,
              ...line,
            })),
          });
        }

        if (awards.length) {
          await tx.commissionAward.updateMany({
            where: { id: { in: awards.map((row: any) => row.id) } },
            data: { status: 'SCHEDULED', payrollPeriodId, payslipId: slip.id },
          });
          await tx.commissionEvent.updateMany({
            where: { id: { in: awards.map((row: any) => row.commissionEventId).filter(Boolean) } },
            data: { eventStatus: 'SCHEDULED' },
          });
        }

        await tx.payrollRun.update({
          where: { id: run.id },
          data: {
            staffCount: 1,
            grossCents: baseSalaryCents,
            allowanceCents,
            commissionCents,
            deductionCents: totalDeductions,
            netPayCents,
            arrearsPaidCents,
          },
        });

        return { run, payslip: slip, lines };
      });

      await auditEnterpriseFinance('staff_payslip_prepared', req, {
        model: 'Payslip',
        subjectId: result.payslip.id,
        staffUserId: profile.staffUserId,
        netPayCents,
        generatedBySystem: true,
      });

      return json({ ok: true, envelope: access.envelope, ...result });
    }

    if (action === 'record_payslip_settlement' || action === 'mark_payslip_paid') {
      const payslipId = text(body.payslipId, 180);
      const paymentReference = text(body.paymentReference, 240);
      const proofOfPaymentObjectKey = text(body.proofOfPaymentObjectKey, 1200) || null;
      const note = text(body.note, 2000) || null;
      const method = paymentMethod(body.paymentMethod);
      const paidAt = settlementDate(body.settledAt);

      if (!payslipId) return json({ ok: false, error: 'payslip_required' }, 400);
      if (!paymentReference) return json({ ok: false, error: 'payment_reference_required' }, 400);
      if (!method) return json({ ok: false, error: 'valid_payment_method_required' }, 400);
      if (!paidAt) return json({ ok: false, error: 'valid_settlement_timestamp_required' }, 400);

      const slip = await db.payslip.findUnique({ where: { id: payslipId } });
      if (!slip) return json({ ok: false, error: 'payslip_not_found' }, 404);

      const requestedAmount = int(body.amountCents ?? slip.unpaidBalanceCents);
      const unpaidBefore = int(slip.unpaidBalanceCents);
      if (unpaidBefore <= 0 || slip.status === 'paid') {
        return json({ ok: true, envelope: access.envelope, payslip: slip, idempotent: true });
      }
      if (requestedAmount <= 0) {
        return json({ ok: false, error: 'settlement_amount_must_be_greater_than_zero' }, 400);
      }
      if (requestedAmount > unpaidBefore) {
        return json({
          ok: false,
          error: 'settlement_amount_exceeds_remaining_balance',
          remainingCents: unpaidBefore,
        }, 409);
      }

      const duplicate = await db.payrollPaymentAllocation.findFirst({
        where: {
          payslipId,
          paymentReference,
          status: 'paid',
        },
        orderBy: { createdAt: 'desc' },
      });
      if (duplicate) {
        const current = await db.payslip.findUnique({ where: { id: payslipId } });
        return json({ ok: true, envelope: access.envelope, payslip: current, idempotent: true });
      }

      const result = await db.$transaction(async (tx: any) => {
        const currentSlip = await tx.payslip.findUnique({ where: { id: payslipId } });
        if (!currentSlip) throw new Error('payslip_not_found');

        const currentOutstanding = int(currentSlip.unpaidBalanceCents);
        if (requestedAmount > currentOutstanding) throw new Error('settlement_amount_exceeds_remaining_balance');

        const meta = asObject(currentSlip.meta);
        const arrearsMeta = Array.isArray(meta.arrears) ? meta.arrears : [];
        const commissionAwardIds = Array.isArray(meta.commissionAwardIds)
          ? meta.commissionAwardIds.map(String)
          : [];
        const currentEntitlementId = text(meta.generatedFromEntitlementId, 180);

        const batch = await tx.payrollPaymentBatch.create({
          data: {
            label: `Payslip ${currentSlip.payslipNumber || currentSlip.id}`,
            batchType: 'payroll',
            status: 'paid',
            staffCount: 1,
            allocationCount: 0,
            totalAmountCents: requestedAmount,
            paidAmountCents: requestedAmount,
            currency: currentSlip.currency,
            paymentMethod: method,
            manualReference: paymentReference,
            createdByUserId: access.envelope.actor.userId,
            approvedByUserId: access.envelope.actor.userId,
            approvedAt: paidAt,
            submittedAt: paidAt,
            completedAt: paidAt,
            meta: {
              payslipId: currentSlip.id,
              proofOfPaymentObjectKey,
              note,
              settlementTimestamp: paidAt.toISOString(),
              source: 'admin_payroll_settlement',
            },
          },
        });

        let cashRemaining = requestedAmount;
        let allocationCount = 0;
        const createdAllocations: any[] = [];

        // Cash is applied to historical arrears first. This keeps partial-payment
        // semantics deterministic and directly reduces the oldest payroll debt.
        for (const item of arrearsMeta) {
          if (cashRemaining <= 0) break;
          const entitlementId = text(item?.entitlementId, 180);
          if (!entitlementId) continue;

          const entitlement = await tx.staffPayrollEntitlement.findUnique({ where: { id: entitlementId } });
          if (!entitlement || entitlement.staffUserId !== currentSlip.staffUserId) {
            throw new Error('payslip_arrears_entitlement_mismatch');
          }

          const payable = Math.min(int(item.amountCents), int(entitlement.remainingCents));
          const pay = Math.min(cashRemaining, payable);
          if (!pay) continue;

          const ledger = await tx.staffArrearsLedger.findFirst({
            where: { sourceType: 'historical_payroll_entitlement', sourceId: entitlement.id },
            orderBy: { createdAt: 'desc' },
          });
          const accrual = await tx.staffSalaryAccrual.findFirst({
            where: { sourceType: 'historical_payroll_entitlement', sourceId: entitlement.id },
            orderBy: { createdAt: 'desc' },
          });

          const allocation = await tx.payrollPaymentAllocation.create({
            data: {
              paymentBatchId: batch.id,
              staffUserId: currentSlip.staffUserId,
              payslipId: currentSlip.id,
              arrearsLedgerEntryId: ledger?.id || null,
              salaryAccrualId: accrual?.id || null,
              allocationType: 'arrears_payment',
              status: 'paid',
              amountCents: pay,
              currency: currentSlip.currency,
              paymentMethod: method,
              paymentReference,
              allocatedAt: paidAt,
              paidAt,
              reconciledByUserId: access.envelope.actor.userId,
              reconciledAt: paidAt,
              meta: {
                entitlementId: entitlement.id,
                entitlementSettlementCents: pay,
                proofOfPaymentObjectKey,
                note,
              },
            },
          });

          const nextPost = int(entitlement.postReconciliationPaidCents) + pay;
          const nextRemaining = Math.max(
            0,
            int(entitlement.grossEntitlementCents) - int(entitlement.amountHistoricallySettledCents) - nextPost,
          );
          await tx.staffPayrollEntitlement.update({
            where: { id: entitlement.id },
            data: {
              postReconciliationPaidCents: nextPost,
              remainingCents: nextRemaining,
              settlementState: nextRemaining ? 'PARTIALLY_SETTLED' : 'FULLY_SETTLED',
            },
          });
          if (accrual) {
            await tx.staffSalaryAccrual.update({
              where: { id: accrual.id },
              data: {
                paidCents: int(accrual.paidCents) + pay,
                unpaidCents: nextRemaining,
                status: nextRemaining ? 'partial' : 'settled',
                payslipId: currentSlip.id,
              },
            });
          }
          if (ledger) {
            await tx.staffArrearsLedger.update({
              where: { id: ledger.id },
              data: {
                creditCents: int(ledger.creditCents) + pay,
                balanceAfterCents: nextRemaining,
                status: nextRemaining ? 'partial' : 'settled',
                payslipId: currentSlip.id,
                batchId: batch.id,
                approvedByUserId: access.envelope.actor.userId,
                approvedAt: paidAt,
                meta: { ...asObject(ledger.meta), lastPaymentAllocationId: allocation.id },
              },
            });
          }

          createdAllocations.push(allocation);
          allocationCount += 1;
          cashRemaining -= pay;
        }

        // Approved commissions are next. Partial commission cash remains scheduled;
        // only a fully settled award/event advances to PAID.
        if (cashRemaining > 0 && commissionAwardIds.length) {
          const awards = await tx.commissionAward.findMany({
            where: { id: { in: commissionAwardIds }, payslipId: currentSlip.id },
            orderBy: { createdAt: 'asc' },
          });

          for (const award of awards) {
            if (cashRemaining <= 0) break;
            const approved = int(award.approvedAmountCents || award.calculatedAmountCents);
            const previouslyPaid = int(award.paidAmountCents);
            const awardOutstanding = Math.max(0, approved - previouslyPaid);
            const pay = Math.min(cashRemaining, awardOutstanding);
            if (!pay) continue;

            const allocation = await tx.payrollPaymentAllocation.create({
              data: {
                paymentBatchId: batch.id,
                staffUserId: currentSlip.staffUserId,
                payslipId: currentSlip.id,
                allocationType: 'commission_payment',
                status: 'paid',
                amountCents: pay,
                currency: currentSlip.currency,
                paymentMethod: method,
                paymentReference,
                allocatedAt: paidAt,
                paidAt,
                reconciledByUserId: access.envelope.actor.userId,
                reconciledAt: paidAt,
                meta: {
                  commissionAwardId: award.id,
                  proofOfPaymentObjectKey,
                  note,
                },
              },
            });

            const nextPaid = Math.min(approved, previouslyPaid + pay);
            const fullyPaid = nextPaid >= approved;
            await tx.commissionAward.update({
              where: { id: award.id },
              data: {
                status: fullyPaid ? 'PAID' : 'SCHEDULED',
                paidAmountCents: nextPaid,
                paymentAllocationId: allocation.id,
              },
            });
            if (award.commissionEventId) {
              await tx.commissionEvent.update({
                where: { id: award.commissionEventId },
                data: { eventStatus: fullyPaid ? 'PAID' : 'SCHEDULED' },
              });
            }

            createdAllocations.push(allocation);
            allocationCount += 1;
            cashRemaining -= pay;
          }
        }

        // Remaining cash is the current salary/allowance component.
        if (cashRemaining > 0) {
          let entitlementSettlementCents = 0;
          const currentEntitlement = currentEntitlementId
            ? await tx.staffPayrollEntitlement.findUnique({ where: { id: currentEntitlementId } })
            : null;

          if (currentEntitlement && currentEntitlement.staffUserId === currentSlip.staffUserId) {
            entitlementSettlementCents = Math.min(cashRemaining, int(currentEntitlement.remainingCents));
          }

          const allocation = await tx.payrollPaymentAllocation.create({
            data: {
              paymentBatchId: batch.id,
              staffUserId: currentSlip.staffUserId,
              payslipId: currentSlip.id,
              allocationType: 'salary_and_adjustments',
              status: 'paid',
              amountCents: cashRemaining,
              currency: currentSlip.currency,
              paymentMethod: method,
              paymentReference,
              allocatedAt: paidAt,
              paidAt,
              reconciledByUserId: access.envelope.actor.userId,
              reconciledAt: paidAt,
              meta: {
                entitlementId: currentEntitlement?.id || null,
                entitlementSettlementCents,
                proofOfPaymentObjectKey,
                note,
              },
            },
          });

          if (currentEntitlement && entitlementSettlementCents > 0) {
            const nextPost = int(currentEntitlement.postReconciliationPaidCents) + entitlementSettlementCents;
            const nextRemaining = Math.max(
              0,
              int(currentEntitlement.grossEntitlementCents) - int(currentEntitlement.amountHistoricallySettledCents) - nextPost,
            );
            await tx.staffPayrollEntitlement.update({
              where: { id: currentEntitlement.id },
              data: {
                postReconciliationPaidCents: nextPost,
                remainingCents: nextRemaining,
                settlementState: nextRemaining ? 'PARTIALLY_SETTLED' : 'FULLY_SETTLED',
              },
            });
          }

          createdAllocations.push(allocation);
          allocationCount += 1;
          cashRemaining = 0;
        }

        const allocatedCash = createdAllocations.reduce(
          (sum: number, allocation: any) => sum + int(allocation.amountCents),
          0,
        );
        if (allocatedCash !== requestedAmount) {
          throw new Error(`payroll_cash_allocation_invariant_failed:${allocatedCash}:${requestedAmount}`);
        }

        const newUnpaid = Math.max(0, currentOutstanding - requestedAmount);
        const fullySettled = newUnpaid === 0;
        const nonCashSettlementAdjustments: any[] = [];

        // When the net payslip is fully settled, any gross source balance left
        // behind is the non-cash portion discharged through payroll deductions /
        // withholding. Close those source balances explicitly and retain the
        // exact adjustment in batch metadata so a reversal can restore them.
        if (fullySettled) {
          const entitlementIds = Array.from(new Set([
            currentEntitlementId,
            ...arrearsMeta.map((item: any) => text(item?.entitlementId, 180)),
          ].filter(Boolean))) as string[];

          for (const entitlementId of entitlementIds) {
            const entitlement = await tx.staffPayrollEntitlement.findUnique({ where: { id: entitlementId } });
            if (!entitlement || entitlement.staffUserId !== currentSlip.staffUserId) continue;
            const residual = int(entitlement.remainingCents);
            if (!residual) continue;

            const nextPost = int(entitlement.postReconciliationPaidCents) + residual;
            await tx.staffPayrollEntitlement.update({
              where: { id: entitlement.id },
              data: {
                postReconciliationPaidCents: nextPost,
                remainingCents: 0,
                settlementState: 'FULLY_SETTLED',
              },
            });

            const accrual = await tx.staffSalaryAccrual.findFirst({
              where: { sourceType: 'historical_payroll_entitlement', sourceId: entitlement.id },
              orderBy: { createdAt: 'desc' },
            });
            if (accrual) {
              await tx.staffSalaryAccrual.update({
                where: { id: accrual.id },
                data: {
                  paidCents: int(accrual.paidCents) + residual,
                  unpaidCents: 0,
                  status: 'settled',
                  payslipId: currentSlip.id,
                },
              });
            }

            const ledger = await tx.staffArrearsLedger.findFirst({
              where: { sourceType: 'historical_payroll_entitlement', sourceId: entitlement.id },
              orderBy: { createdAt: 'desc' },
            });
            if (ledger) {
              await tx.staffArrearsLedger.update({
                where: { id: ledger.id },
                data: {
                  creditCents: int(ledger.creditCents) + residual,
                  balanceAfterCents: 0,
                  status: 'settled',
                  payslipId: currentSlip.id,
                  batchId: batch.id,
                  approvedByUserId: access.envelope.actor.userId,
                  approvedAt: paidAt,
                  meta: {
                    ...asObject(ledger.meta),
                    lastNonCashSettlementBatchId: batch.id,
                  },
                },
              });
            }

            nonCashSettlementAdjustments.push({
              kind: 'entitlement',
              entitlementId: entitlement.id,
              amountCents: residual,
              salaryAccrualId: accrual?.id || null,
              arrearsLedgerEntryId: ledger?.id || null,
            });
          }

          if (commissionAwardIds.length) {
            const residualAwards = await tx.commissionAward.findMany({
              where: { id: { in: commissionAwardIds }, payslipId: currentSlip.id },
            });
            for (const award of residualAwards) {
              const approved = int(award.approvedAmountCents || award.calculatedAmountCents);
              const residual = Math.max(0, approved - int(award.paidAmountCents));
              if (!residual) continue;
              await tx.commissionAward.update({
                where: { id: award.id },
                data: { status: 'PAID', paidAmountCents: approved },
              });
              if (award.commissionEventId) {
                await tx.commissionEvent.update({
                  where: { id: award.commissionEventId },
                  data: { eventStatus: 'PAID' },
                });
              }
              nonCashSettlementAdjustments.push({
                kind: 'commission',
                commissionAwardId: award.id,
                commissionEventId: award.commissionEventId || null,
                amountCents: residual,
              });
            }
          }
        }

        const nonCashTotal = nonCashSettlementAdjustments.reduce(
          (sum: number, adjustment: any) => sum + int(adjustment.amountCents),
          0,
        );
        const totalWithheldCents =
          int(currentSlip.deductionCents) +
          int(currentSlip.taxWithholdingCents) +
          int(currentSlip.uifCents) +
          int(currentSlip.pensionCents);
        if (nonCashTotal > totalWithheldCents) {
          throw new Error(`payroll_non_cash_settlement_invariant_failed:${nonCashTotal}:${totalWithheldCents}`);
        }

        const originalBatchMeta = asObject(batch.meta);
        const finalBatch = await tx.payrollPaymentBatch.update({
          where: { id: batch.id },
          data: {
            allocationCount,
            meta: {
              ...originalBatchMeta,
              nonCashSettlementAdjustments,
            },
          },
        });

        const payslip = await tx.payslip.update({
          where: { id: currentSlip.id },
          data: {
            status: fullySettled ? 'paid' : 'partial',
            unpaidBalanceCents: newUnpaid,
            paidAt: fullySettled ? paidAt : null,
            issuedAt: currentSlip.issuedAt || new Date(),
            approvedAt: currentSlip.approvedAt || paidAt,
            approvedByUserId: currentSlip.approvedByUserId || access.envelope.actor.userId,
            meta: {
              ...meta,
              settlementBatchIds: appendUnique(meta.settlementBatchIds, batch.id),
              lastSettlementReference: paymentReference,
              lastSettlementAt: paidAt.toISOString(),
              lastProofOfPaymentObjectKey: proofOfPaymentObjectKey,
            },
          },
        });

        if (currentSlip.payrollRunId) {
          await tx.payrollRun.update({
            where: { id: currentSlip.payrollRunId },
            data: {
              status: fullySettled ? 'paid' : 'partial',
              paidAt: fullySettled ? paidAt : null,
              approvedAt: paidAt,
              approvedByUserId: access.envelope.actor.userId,
            },
          });
        }

        return { batch: finalBatch, payslip, allocations: createdAllocations };
      });

      await auditEnterpriseFinance('staff_payslip_settlement_recorded', req, {
        model: 'Payslip',
        subjectId: result.payslip.id,
        staffUserId: result.payslip.staffUserId,
        paymentBatchId: result.batch.id,
        amountCents: requestedAmount,
        remainingCents: result.payslip.unpaidBalanceCents,
        paymentMethod: method,
        paymentReference,
        settledAt: paidAt.toISOString(),
        proofOfPaymentObjectKey,
      });

      return json({ ok: true, envelope: access.envelope, ...result });
    }

    if (action === 'reverse_payslip_settlement') {
      const paymentBatchId = text(body.paymentBatchId, 180);
      const reason = text(body.reason, 2000);
      if (!paymentBatchId || !reason) {
        return json({ ok: false, error: 'payment_batch_and_reversal_reason_required' }, 400);
      }

      const batch = await db.payrollPaymentBatch.findUnique({ where: { id: paymentBatchId } });
      if (!batch) return json({ ok: false, error: 'payroll_payment_batch_not_found' }, 404);
      if (String(batch.status).toLowerCase() === 'reversed') {
        return json({ ok: true, envelope: access.envelope, batch, idempotent: true });
      }

      const result = await db.$transaction(async (tx: any) => {
        const allocations = await tx.payrollPaymentAllocation.findMany({
          where: { paymentBatchId, status: 'paid' },
          orderBy: { createdAt: 'asc' },
        });
        if (!allocations.length) throw new Error('payment_batch_has_no_reversible_allocations');

        const payslipId = allocations.map((row: any) => row.payslipId).find(Boolean);
        if (!payslipId) throw new Error('payment_batch_payslip_missing');
        const slip = await tx.payslip.findUnique({ where: { id: payslipId } });
        if (!slip) throw new Error('payslip_not_found');

        for (const allocation of allocations) {
          const allocationMeta = asObject(allocation.meta);
          const entitlementId = text(allocationMeta.entitlementId, 180);
          const entitlementSettlementCents = int(
            allocationMeta.entitlementSettlementCents || allocation.amountCents,
          );

          if (entitlementId && entitlementSettlementCents > 0) {
            const entitlement = await tx.staffPayrollEntitlement.findUnique({ where: { id: entitlementId } });
            if (entitlement) {
              const nextPost = Math.max(0, int(entitlement.postReconciliationPaidCents) - entitlementSettlementCents);
              const nextRemaining = Math.max(
                0,
                int(entitlement.grossEntitlementCents) - int(entitlement.amountHistoricallySettledCents) - nextPost,
              );
              await tx.staffPayrollEntitlement.update({
                where: { id: entitlement.id },
                data: {
                  postReconciliationPaidCents: nextPost,
                  remainingCents: nextRemaining,
                  settlementState: nextRemaining > 0 ? (nextPost > 0 ? 'PARTIALLY_SETTLED' : 'UNPAID') : 'FULLY_SETTLED',
                },
              });

              if (allocation.salaryAccrualId) {
                const accrual = await tx.staffSalaryAccrual.findUnique({ where: { id: allocation.salaryAccrualId } });
                if (accrual) {
                  const nextPaid = Math.max(0, int(accrual.paidCents) - int(allocation.amountCents));
                  await tx.staffSalaryAccrual.update({
                    where: { id: accrual.id },
                    data: {
                      paidCents: nextPaid,
                      unpaidCents: nextRemaining,
                      status: nextRemaining > 0 ? (nextPaid > 0 ? 'partial' : 'accrued') : 'settled',
                    },
                  });
                }
              }

              if (allocation.arrearsLedgerEntryId) {
                const ledger = await tx.staffArrearsLedger.findUnique({ where: { id: allocation.arrearsLedgerEntryId } });
                if (ledger) {
                  const nextCredit = Math.max(0, int(ledger.creditCents) - int(allocation.amountCents));
                  await tx.staffArrearsLedger.update({
                    where: { id: ledger.id },
                    data: {
                      creditCents: nextCredit,
                      balanceAfterCents: nextRemaining,
                      status: nextRemaining > 0 ? (nextCredit > 0 ? 'partial' : 'open') : 'settled',
                      meta: {
                        ...asObject(ledger.meta),
                        lastReversalPaymentAllocationId: allocation.id,
                        lastReversalReason: reason,
                      },
                    },
                  });
                }
              }
            }
          }

          const commissionAwardId = text(allocationMeta.commissionAwardId, 180);
          if (commissionAwardId) {
            const award = await tx.commissionAward.findUnique({ where: { id: commissionAwardId } });
            if (award) {
              const nextPaid = Math.max(0, int(award.paidAmountCents) - int(allocation.amountCents));
              const approved = int(award.approvedAmountCents || award.calculatedAmountCents);
              const nextStatus = nextPaid >= approved && approved > 0 ? 'PAID' : 'SCHEDULED';
              await tx.commissionAward.update({
                where: { id: award.id },
                data: {
                  paidAmountCents: nextPaid,
                  status: nextStatus,
                  paymentAllocationId: award.paymentAllocationId === allocation.id ? null : award.paymentAllocationId,
                },
              });
              if (award.commissionEventId) {
                await tx.commissionEvent.update({
                  where: { id: award.commissionEventId },
                  data: { eventStatus: nextStatus },
                });
              }
            }
          }

          await tx.payrollPaymentAllocation.update({
            where: { id: allocation.id },
            data: {
              status: 'reversed',
              meta: {
                ...allocationMeta,
                reversedAt: new Date().toISOString(),
                reversedByUserId: access.envelope.actor.userId,
                reversalReason: reason,
              },
            },
          });
        }

        const batchMeta = asObject(batch.meta);
        const nonCashAdjustments = Array.isArray(batchMeta.nonCashSettlementAdjustments)
          ? batchMeta.nonCashSettlementAdjustments
          : [];

        for (const adjustment of nonCashAdjustments) {
          const amount = int(adjustment?.amountCents);
          if (!amount) continue;

          if (adjustment?.kind === 'entitlement') {
            const entitlementId = text(adjustment?.entitlementId, 180);
            if (!entitlementId) continue;
            const entitlement = await tx.staffPayrollEntitlement.findUnique({ where: { id: entitlementId } });
            if (!entitlement) continue;

            const nextPost = Math.max(0, int(entitlement.postReconciliationPaidCents) - amount);
            const nextRemaining = Math.max(
              0,
              int(entitlement.grossEntitlementCents) - int(entitlement.amountHistoricallySettledCents) - nextPost,
            );
            await tx.staffPayrollEntitlement.update({
              where: { id: entitlement.id },
              data: {
                postReconciliationPaidCents: nextPost,
                remainingCents: nextRemaining,
                settlementState: nextRemaining > 0 ? (nextPost > 0 ? 'PARTIALLY_SETTLED' : 'UNPAID') : 'FULLY_SETTLED',
              },
            });

            const salaryAccrualId = text(adjustment?.salaryAccrualId, 180);
            if (salaryAccrualId) {
              const accrual = await tx.staffSalaryAccrual.findUnique({ where: { id: salaryAccrualId } });
              if (accrual) {
                const nextPaid = Math.max(0, int(accrual.paidCents) - amount);
                await tx.staffSalaryAccrual.update({
                  where: { id: accrual.id },
                  data: {
                    paidCents: nextPaid,
                    unpaidCents: nextRemaining,
                    status: nextRemaining > 0 ? (nextPaid > 0 ? 'partial' : 'accrued') : 'settled',
                  },
                });
              }
            }

            const arrearsLedgerEntryId = text(adjustment?.arrearsLedgerEntryId, 180);
            if (arrearsLedgerEntryId) {
              const ledger = await tx.staffArrearsLedger.findUnique({ where: { id: arrearsLedgerEntryId } });
              if (ledger) {
                const nextCredit = Math.max(0, int(ledger.creditCents) - amount);
                await tx.staffArrearsLedger.update({
                  where: { id: ledger.id },
                  data: {
                    creditCents: nextCredit,
                    balanceAfterCents: nextRemaining,
                    status: nextRemaining > 0 ? (nextCredit > 0 ? 'partial' : 'open') : 'settled',
                  },
                });
              }
            }
          }

          if (adjustment?.kind === 'commission') {
            const commissionAwardId = text(adjustment?.commissionAwardId, 180);
            if (!commissionAwardId) continue;
            const award = await tx.commissionAward.findUnique({ where: { id: commissionAwardId } });
            if (!award) continue;
            const nextPaid = Math.max(0, int(award.paidAmountCents) - amount);
            const approved = int(award.approvedAmountCents || award.calculatedAmountCents);
            const nextStatus = nextPaid >= approved && approved > 0 ? 'PAID' : 'SCHEDULED';
            await tx.commissionAward.update({
              where: { id: award.id },
              data: { paidAmountCents: nextPaid, status: nextStatus },
            });
            if (award.commissionEventId) {
              await tx.commissionEvent.update({
                where: { id: award.commissionEventId },
                data: { eventStatus: nextStatus },
              });
            }
          }
        }

        const batchCash = int(batch.paidAmountCents || batch.totalAmountCents);
        const newUnpaid = Math.min(int(slip.netPayCents), int(slip.unpaidBalanceCents) + batchCash);
        const otherPaid = await tx.payrollPaymentAllocation.count({
          where: {
            payslipId: slip.id,
            status: 'paid',
            paymentBatchId: { not: paymentBatchId },
          },
        });

        const payslip = await tx.payslip.update({
          where: { id: slip.id },
          data: {
            status: otherPaid > 0 ? 'partial' : 'draft',
            unpaidBalanceCents: newUnpaid,
            paidAt: null,
            meta: {
              ...asObject(slip.meta),
              lastReversalBatchId: paymentBatchId,
              lastReversalReason: reason,
              lastReversalAt: new Date().toISOString(),
            },
          },
        });

        const reversedBatch = await tx.payrollPaymentBatch.update({
          where: { id: paymentBatchId },
          data: {
            status: 'reversed',
            resultMeta: {
              ...asObject(batch.resultMeta),
              reversedAt: new Date().toISOString(),
              reversedByUserId: access.envelope.actor.userId,
              reversalReason: reason,
            },
          },
        });

        if (slip.payrollRunId) {
          await tx.payrollRun.update({
            where: { id: slip.payrollRunId },
            data: { status: otherPaid > 0 ? 'partial' : 'draft', paidAt: null },
          });
        }

        return { batch: reversedBatch, payslip };
      });

      await auditEnterpriseFinance('staff_payslip_settlement_reversed', req, {
        model: 'PayrollPaymentBatch',
        subjectId: paymentBatchId,
        payslipId: result.payslip.id,
        staffUserId: result.payslip.staffUserId,
        reason,
      });

      return json({ ok: true, envelope: access.envelope, ...result });
    }

    return json({ ok: false, error: 'unsupported_staff_payout_action' }, 400);
  } catch (error) {
    return routeError(error, 'enterprise_finance_staff_payout_write_failed');
  }
}
