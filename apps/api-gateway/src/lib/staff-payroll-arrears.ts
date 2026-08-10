import { prisma } from '@/lib/prisma';

const AUTO_SOURCE_TYPE = 'payslip_unpaid_balance';
const AUTO_ID_PREFIX = 'salary-arrear:payslip:';

export function payablePayslip(row: {
  status: string;
  approvedAt: Date | null;
  issuedAt: Date | null;
}) {
  const status = String(row.status || '').trim().toLowerCase();
  if (['draft', 'cancelled', 'canceled', 'void'].includes(status)) return false;
  return Boolean(
    row.approvedAt ||
      row.issuedAt ||
      ['approved', 'issued', 'payable', 'unpaid', 'overdue', 'partially_paid'].includes(status),
  );
}

export function automaticSalaryArrearsId(payslipId: string) {
  return `${AUTO_ID_PREFIX}${payslipId}`;
}

export async function reconcileOverdueSalaryArrears(input: {
  now?: Date;
  staffUserId?: string | null;
} = {}) {
  const now = input.now ?? new Date();
  const duePeriods = await prisma.payrollPeriod.findMany({
    where: {
      payDate: { not: null, lte: now },
      status: { notIn: ['draft', 'cancelled', 'canceled', 'void'] },
    },
    select: { id: true, payDate: true, currency: true },
  });

  if (!duePeriods.length) {
    return { scanned: 0, opened: 0, updated: 0, closed: 0 };
  }

  const periodById = new Map(duePeriods.map((period) => [period.id, period]));
  const periodIds = duePeriods.map((period) => period.id);

  const payslips = await prisma.payslip.findMany({
    where: {
      payrollPeriodId: { in: periodIds },
      ...(input.staffUserId ? { staffUserId: input.staffUserId } : {}),
      unpaidBalanceCents: { gt: 0 },
    },
    select: {
      id: true,
      staffUserId: true,
      payrollProfileId: true,
      payrollPeriodId: true,
      status: true,
      approvedAt: true,
      issuedAt: true,
      netPayCents: true,
      unpaidBalanceCents: true,
      currency: true,
    },
  });

  // Only payslips that have crossed a real approval/issue boundary are salary liabilities.
  const eligible = payslips.filter(payablePayslip);
  let opened = 0;
  let updated = 0;
  let closed = 0;

  for (const payslip of eligible) {
    const period = periodById.get(payslip.payrollPeriodId);
    if (!period?.payDate) continue;

    const outstanding = Math.max(0, payslip.unpaidBalanceCents || 0);
    const id = automaticSalaryArrearsId(payslip.id);
    const existing = await prisma.staffArrearsLedger.findUnique({ where: { id } });

    if (outstanding <= 0) {
      if (existing && !['closed', 'paid', 'settled', 'reconciled'].includes(String(existing.status).toLowerCase())) {
        await prisma.staffArrearsLedger.update({
          where: { id },
          data: {
            status: 'closed',
            creditCents: Math.max(existing.creditCents || 0, existing.debitCents || 0),
            balanceAfterCents: 0,
            effectiveAt: now,
            meta: {
              ...((existing.meta && typeof existing.meta === 'object' && !Array.isArray(existing.meta)) ? existing.meta as Record<string, unknown> : {}),
              reconciledAutomaticallyAt: now.toISOString(),
            },
          },
        });
        closed += 1;
      }
      continue;
    }

    const data = {
      staffUserId: payslip.staffUserId,
      payrollProfileId: payslip.payrollProfileId,
      payrollPeriodId: payslip.payrollPeriodId,
      payslipId: payslip.id,
      entryType: 'salary_arrear',
      status: 'overdue',
      description: 'Salary balance remains unpaid after the scheduled pay date',
      debitCents: Math.max(existing?.debitCents || 0, payslip.netPayCents || 0, outstanding),
      creditCents: Math.max(0, Math.max(existing?.debitCents || 0, payslip.netPayCents || 0, outstanding) - outstanding),
      balanceAfterCents: outstanding,
      currency: payslip.currency || period.currency || 'ZAR',
      dueDate: period.payDate,
      effectiveAt: now,
      sourceType: AUTO_SOURCE_TYPE,
      sourceId: payslip.id,
      meta: {
        automatic: true,
        reconciledFrom: 'payslip.unpaidBalanceCents',
        lastReconciledAt: now.toISOString(),
      },
    };

    if (existing) {
      await prisma.staffArrearsLedger.update({ where: { id }, data });
      updated += 1;
    } else {
      await prisma.staffArrearsLedger.create({ data: { id, ...data } });
      opened += 1;
    }
  }

  // Close automatic rows whose payslip has since become fully paid. This second pass
  // keeps the derived arrears view correct even when there is no longer an unpaid row
  // in the main query.
  const autoRows = await prisma.staffArrearsLedger.findMany({
    where: {
      sourceType: AUTO_SOURCE_TYPE,
      ...(input.staffUserId ? { staffUserId: input.staffUserId } : {}),
      status: { in: ['open', 'partial', 'overdue'] },
    },
    select: { id: true, payslipId: true, debitCents: true, creditCents: true, meta: true },
  });

  const autoPayslipIds = autoRows.map((row) => row.payslipId).filter((value): value is string => Boolean(value));
  if (autoPayslipIds.length) {
    const currentPayslips = await prisma.payslip.findMany({
      where: { id: { in: autoPayslipIds } },
      select: { id: true, unpaidBalanceCents: true },
    });
    const balanceById = new Map(currentPayslips.map((row) => [row.id, row.unpaidBalanceCents]));

    for (const row of autoRows) {
      if (!row.payslipId || !balanceById.has(row.payslipId)) continue;
      const outstanding = Math.max(0, balanceById.get(row.payslipId) || 0);
      if (outstanding > 0) continue;
      await prisma.staffArrearsLedger.update({
        where: { id: row.id },
        data: {
          status: 'closed',
          creditCents: Math.max(row.creditCents || 0, row.debitCents || 0),
          balanceAfterCents: 0,
          effectiveAt: now,
          meta: {
            ...((row.meta && typeof row.meta === 'object' && !Array.isArray(row.meta)) ? row.meta as Record<string, unknown> : {}),
            reconciledAutomaticallyAt: now.toISOString(),
          },
        },
      });
      closed += 1;
    }
  }

  return { scanned: eligible.length, opened, updated, closed };
}
