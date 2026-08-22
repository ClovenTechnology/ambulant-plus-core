import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { automaticSalaryArrearsId, reconcileOverdueSalaryArrears } from '@/src/lib/staff-payroll-arrears';
import {
  asCents,
  asObject,
  auditEnterpriseFinance,
  dateRangeWhere,
  json,
  requireEnterpriseFinanceAdmin,
  routeError,
  text,
} from '@/src/enterprise-finance/access-envelope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// A5_K_D_C_ENTERPRISE_FINANCE_STAFF_ARREARS_ROUTE

export async function GET(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;

    const reconciliation = await reconcileOverdueSalaryArrears();
    const db: any = prisma;
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100', 10) || 100, 1), 500);

    const where: any = {
      ...dateRangeWhere(searchParams, 'effectiveAt'),
    };

    const staffUserId = text(searchParams.get('staffUserId'), 180);
    const status = text(searchParams.get('status'), 80);
    const entryType = text(searchParams.get('entryType'), 80);
    const q = text(searchParams.get('q'), 180)?.toLowerCase() || '';

    if (staffUserId) where.staffUserId = staffUserId;
    if (status) where.status = status;
    if (entryType) where.entryType = entryType;

    // Identity, payroll-period and payment-reference enrichment happens after the
    // ledger read because these finance models intentionally do not create a
    // parallel Staff identity relation.
    const baseItems = await db.staffArrearsLedger.findMany({
      where,
      orderBy: [{ effectiveAt: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    });

    const staffUserIds = Array.from(
      new Set(
        baseItems
          .map((item: any) => String(item.staffUserId || '').trim())
          .filter(Boolean),
      ),
    );
    const payrollPeriodIds = Array.from(
      new Set(
        baseItems
          .map((item: any) => String(item.payrollPeriodId || '').trim())
          .filter(Boolean),
      ),
    );
    const payrollProfileIds = Array.from(
      new Set(
        baseItems
          .map((item: any) => String(item.payrollProfileId || '').trim())
          .filter(Boolean),
      ),
    );
    const paymentAllocationIds = Array.from(
      new Set(
        baseItems
          .filter((item: any) => item.sourceType === 'payroll_payment_allocation')
          .map((item: any) => String(item.sourceId || '').trim())
          .filter(Boolean),
      ),
    );
    const arrearsIds = baseItems.map((item: any) => String(item.id));

    const [
      staffRows,
      periodRows,
      payrollRows,
      allocationRows,
      disputeRows,
    ] = await Promise.all([
      staffUserIds.length
        ? db.adminUserProfile.findMany({
            where: { userId: { in: staffUserIds } },
            select: {
              id: true,
              userId: true,
              name: true,
              email: true,
              staffIdentifier: true,
              department: { select: { id: true, name: true } },
              designation: { select: { id: true, name: true } },
            },
          })
        : [],
      payrollPeriodIds.length
        ? db.payrollPeriod.findMany({
            where: { id: { in: payrollPeriodIds } },
            select: {
              id: true,
              label: true,
              startsAt: true,
              endsAt: true,
              payDate: true,
              status: true,
              currency: true,
            },
          })
        : [],
      payrollProfileIds.length || staffUserIds.length
        ? db.staffPayrollProfile.findMany({
            where: {
              OR: [
                ...(payrollProfileIds.length ? [{ id: { in: payrollProfileIds } }] : []),
                ...(staffUserIds.length ? [{ staffUserId: { in: staffUserIds } }] : []),
              ],
            },
            orderBy: { updatedAt: 'desc' },
            select: {
              id: true,
              staffUserId: true,
              payrollNumber: true,
              employerReference: true,
              payFrequency: true,
            },
          })
        : [],
      paymentAllocationIds.length
        ? db.payrollPaymentAllocation.findMany({
            where: { id: { in: paymentAllocationIds } },
            select: {
              id: true,
              amountCents: true,
              paymentMethod: true,
              paymentReference: true,
              paidAt: true,
              status: true,
              paymentBatchId: true,
            },
          })
        : [],
      arrearsIds.length
        ? db.staffPayrollDispute.findMany({
            where: { arrearsLedgerEntryId: { in: arrearsIds } },
            orderBy: { raisedAt: 'desc' },
            select: {
              id: true,
              arrearsLedgerEntryId: true,
              disputeType: true,
              status: true,
              subject: true,
              raisedAt: true,
              resolvedAt: true,
            },
          })
        : [],
    ]);

    const staffByUserId = new Map<string, any>(
      staffRows.map((row: any) => [String(row.userId), row] as [string, any]),
    );
    const periodById = new Map<string, any>(
      periodRows.map((row: any) => [String(row.id), row] as [string, any]),
    );
    const payrollById = new Map<string, any>(
      payrollRows.map((row: any) => [String(row.id), row] as [string, any]),
    );
    const payrollByStaff = new Map<string, any>();
    for (const row of payrollRows) {
      const key = String(row.staffUserId || '');
      if (!payrollByStaff.has(key)) payrollByStaff.set(key, row);
    }
    const allocationById = new Map<string, any>(
      allocationRows.map((row: any) => [String(row.id), row] as [string, any]),
    );
    const disputeByArrearsId = new Map<string, any>();
    for (const row of disputeRows) {
      const key = String(row.arrearsLedgerEntryId || '');
      if (!disputeByArrearsId.has(key)) disputeByArrearsId.set(key, row);
    }

    const enriched = baseItems.map((item: any) => {
      const staff = staffByUserId.get(String(item.staffUserId || ''));
      const period = periodById.get(String(item.payrollPeriodId || ''));
      const payroll =
        payrollById.get(String(item.payrollProfileId || '')) ||
        payrollByStaff.get(String(item.staffUserId || ''));
      const allocation =
        item.sourceType === 'payroll_payment_allocation'
          ? allocationById.get(String(item.sourceId || ''))
          : null;
      const dispute = disputeByArrearsId.get(String(item.id));
      const outstandingAmountCents =
        item.entryType === 'payment'
          ? 0
          : Math.max(
              0,
              Number.isFinite(Number(item.balanceAfterCents))
                ? Number(item.balanceAfterCents)
                : Number(item.debitCents || 0) - Number(item.creditCents || 0),
            );

      return {
        ...item,
        staffProfileId: staff?.id || null,
        staffIdentifier: staff?.staffIdentifier || null,
        staffName: staff?.name || staff?.email || item.staffUserId,
        staffEmail: staff?.email || null,
        departmentName: staff?.department?.name || null,
        designationName: staff?.designation?.name || null,
        payrollNumber: payroll?.payrollNumber || null,
        employerReference: payroll?.employerReference || null,
        payFrequency: payroll?.payFrequency || null,
        period: period?.label || null,
        periodStartsAt: period?.startsAt || null,
        periodEndsAt: period?.endsAt || null,
        scheduledPaymentDate: period?.payDate || item.dueDate || null,
        outstandingAmountCents,
        paidAmountCents:
          item.entryType === 'payment'
            ? Number(item.creditCents || allocation?.amountCents || 0)
            : Math.max(0, Number(item.creditCents || 0)),
        paymentReference: allocation?.paymentReference || null,
        paymentMethod: allocation?.paymentMethod || null,
        paidAt: allocation?.paidAt || null,
        paymentBatchId: allocation?.paymentBatchId || item.batchId || null,
        disputeStatus: dispute?.status || 'none',
        disputeType: dispute?.disputeType || null,
        disputeSubject: dispute?.subject || null,
        disputeRaisedAt: dispute?.raisedAt || null,
      };
    });

    const filtered = q
      ? enriched.filter((item: any) =>
          [
            item.staffName,
            item.staffEmail,
            item.staffIdentifier,
            item.staffProfileId,
            item.staffUserId,
            item.payrollNumber,
            item.employerReference,
            item.period,
            item.reference,
            item.id,
            item.sourceId,
            item.description,
            item.status,
            item.entryType,
            item.disputeStatus,
            item.paymentReference,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(q),
        )
      : enriched;

    return json({
      ok: true,
      envelope: access.envelope,
      items: filtered.slice(0, limit),
      reconciliation,
      meta: {
        count: Math.min(filtered.length, limit),
        matched: filtered.length,
        scanned: baseItems.length,
        limit,
        canonicalStaffEnrichment: true,
      },
    });
  } catch (error: any) {
    return routeError(error, 'enterprise_finance_arrears_list_failed');
  }
}

export async function POST(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;

    const db: any = prisma;
    const body = await req.json().catch(() => ({}));
    const action = text(body.action || 'create_arrear', 80);
    const staffUserId = text(body.staffUserId, 180);

    if (action === 'reconcile_overdue') {
      const reconciliation = await reconcileOverdueSalaryArrears({
        staffUserId: staffUserId || null,
      });
      await auditEnterpriseFinance('staff_arrears_overdue_reconciled', req, {
        model: 'StaffArrearsLedger',
        staffUserId: staffUserId || null,
        ...reconciliation,
      });
      return json({ ok: true, envelope: access.envelope, reconciliation });
    }

    if (!staffUserId) return json({ ok: false, error: 'staffUserId_required' }, 400);

    if (action === 'record_payment') {
      const amountCents = asCents(body.amountCents ?? body.creditCents);
      if (amountCents <= 0) return json({ ok: false, error: 'positive_amount_required' }, 400);

      const linkedPayslipId = text(body.payslipId, 180) || null;
      const linkedPayslip = linkedPayslipId
        ? await db.payslip.findUnique({ where: { id: linkedPayslipId } })
        : null;
      if (linkedPayslipId && !linkedPayslip) {
        return json({ ok: false, error: 'payslip_not_found' }, 404);
      }
      if (linkedPayslip && linkedPayslip.staffUserId !== staffUserId) {
        return json({ ok: false, error: 'payslip_staff_mismatch' }, 409);
      }
      if (linkedPayslip && amountCents > Math.max(0, linkedPayslip.unpaidBalanceCents || 0)) {
        return json({ ok: false, error: 'payment_exceeds_unpaid_salary_balance' }, 409);
      }

      const batch = await db.payrollPaymentBatch.create({
        data: {
          label: text(body.label || 'Manual arrears payment', 240),
          batchType: 'arrears_payment',
          status: text(body.status || 'paid', 80),
          staffCount: 1,
          allocationCount: 1,
          totalAmountCents: amountCents,
          paidAmountCents: amountCents,
          currency: text(body.currency || 'ZAR', 3).toUpperCase(),
          paymentMethod: text(body.paymentMethod || 'manual', 80),
          manualReference: text(body.paymentReference || body.manualReference, 180) || null,
          createdByUserId: access.envelope.actor.userId,
          approvedByUserId: text(body.approvedByUserId || access.envelope.actor.userId, 180) || null,
          approvedAt: new Date(),
          completedAt: new Date(),
          filtersMeta: asObject(body.filtersMeta),
          resultMeta: asObject(body.resultMeta),
          meta: asObject(body.meta),
        },
      });

      const allocation = await db.payrollPaymentAllocation.create({
        data: {
          paymentBatchId: batch.id,
          staffUserId,
          payslipId: linkedPayslipId,
          arrearsLedgerEntryId: text(body.arrearsLedgerEntryId, 180) || null,
          salaryAccrualId: text(body.salaryAccrualId, 180) || null,
          allocationType: 'arrears_payment',
          status: 'paid',
          amountCents,
          currency: text(body.currency || 'ZAR', 3).toUpperCase(),
          paymentMethod: text(body.paymentMethod || 'manual', 80),
          paymentReference: text(body.paymentReference || body.manualReference, 180) || null,
          allocatedAt: new Date(),
          paidAt: new Date(),
          reconciledByUserId: access.envelope.actor.userId,
          reconciledAt: new Date(),
          meta: asObject(body.meta),
        },
      });

      const ledger = await db.staffArrearsLedger.create({
        data: {
          staffUserId,
          payrollProfileId: text(body.payrollProfileId, 180) || null,
          payrollPeriodId: text(body.payrollPeriodId, 180) || null,
          payslipId: linkedPayslipId,
          salaryAccrualId: text(body.salaryAccrualId, 180) || null,
          entryType: 'payment',
          status: 'closed',
          description: text(body.description || 'Arrears payment recorded', 1000),
          debitCents: 0,
          creditCents: amountCents,
          balanceAfterCents: asCents(body.balanceAfterCents),
          currency: text(body.currency || 'ZAR', 3).toUpperCase(),
          effectiveAt: body.effectiveAt ? new Date(body.effectiveAt) : new Date(),
          sourceType: 'payroll_payment_allocation',
          sourceId: allocation.id,
          batchId: batch.id,
          approvedByUserId: access.envelope.actor.userId,
          approvedAt: new Date(),
          meta: asObject(body.meta),
        },
      });

      if (linkedPayslip) {
        const nextUnpaid = Math.max(0, (linkedPayslip.unpaidBalanceCents || 0) - amountCents);
        await db.payslip.update({
          where: { id: linkedPayslip.id },
          data: {
            unpaidBalanceCents: nextUnpaid,
            status: nextUnpaid === 0 ? 'paid' : 'partially_paid',
            ...(nextUnpaid === 0 ? { paidAt: new Date() } : {}),
          },
        });

        const automaticId = automaticSalaryArrearsId(linkedPayslip.id);
        const automatic = await db.staffArrearsLedger.findUnique({ where: { id: automaticId } });
        if (automatic) {
          await db.staffArrearsLedger.update({
            where: { id: automaticId },
            data: {
              status: nextUnpaid === 0 ? 'closed' : 'partial',
              creditCents: Math.max(0, (automatic.debitCents || 0) - nextUnpaid),
              balanceAfterCents: nextUnpaid,
              effectiveAt: new Date(),
            },
          });
        }
      }

      await auditEnterpriseFinance('staff_arrears_payment_recorded', req, {
        model: 'StaffArrearsLedger',
        subjectId: ledger.id,
        staffUserId,
        amountCents,
        paymentBatchId: batch.id,
        allocationId: allocation.id,
      });

      return json({ ok: true, envelope: access.envelope, batch, allocation, item: ledger });
    }

    const debitCents = asCents(body.debitCents ?? body.amountCents);
    if (debitCents <= 0) return json({ ok: false, error: 'positive_debit_required' }, 400);

    const item = await db.staffArrearsLedger.create({
      data: {
        staffUserId,
        payrollProfileId: text(body.payrollProfileId, 180) || null,
        payrollPeriodId: text(body.payrollPeriodId, 180) || null,
        payslipId: text(body.payslipId, 180) || null,
        salaryAccrualId: text(body.salaryAccrualId, 180) || null,
        entryType: text(body.entryType || 'salary_arrear', 80),
        status: text(body.status || 'open', 80),
        description: text(body.description || 'Salary arrears entry', 1000),
        debitCents,
        creditCents: asCents(body.creditCents),
        balanceAfterCents: asCents(body.balanceAfterCents ?? debitCents),
        currency: text(body.currency || 'ZAR', 3).toUpperCase(),
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        effectiveAt: body.effectiveAt ? new Date(body.effectiveAt) : new Date(),
        sourceType: text(body.sourceType || 'manual_arrears_entry', 120),
        sourceId: text(body.sourceId, 180) || null,
        approvedByUserId: text(body.approvedByUserId || access.envelope.actor.userId, 180) || null,
        approvedAt: body.approvedAt ? new Date(body.approvedAt) : new Date(),
        meta: asObject(body.meta),
      },
    });

    await auditEnterpriseFinance('staff_arrears_entry_created', req, {
      model: 'StaffArrearsLedger',
      subjectId: item.id,
      staffUserId,
      debitCents,
    });

    return json({ ok: true, envelope: access.envelope, item });
  } catch (error: any) {
    return routeError(error, 'enterprise_finance_arrears_write_failed');
  }
}