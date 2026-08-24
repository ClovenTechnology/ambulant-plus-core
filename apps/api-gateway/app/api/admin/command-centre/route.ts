import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminRequest } from '@/src/lib/admin-auth';
import {
  json,
  requireEnterpriseFinanceAdmin,
  safeAggregateSum,
} from '@/src/enterprise-finance/access-envelope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LIVE_WINDOW_MS = 5 * 60 * 1000;

function upper(value: unknown) {
  return String(value || '').trim().toUpperCase();
}

async function safeSection<T>(name: string, work: () => Promise<T>) {
  try {
    return { available: true as const, data: await work() };
  } catch (error) {
    console.error(`[admin-command-centre] ${name} unavailable`, error);
    return { available: false as const, data: null, reason: 'data_unavailable' };
  }
}

export async function GET(req: NextRequest) {
  const isAdmin = await verifyAdminRequest(req);
  if (!isAdmin) return json({ ok: false, error: 'admin_required' }, 403);

  const db: any = prisma;
  const now = new Date();
  const liveSince = new Date(now.getTime() - LIVE_WINDOW_MS);

  const [patients, clinicians, consultations, network, staff, commerce] = await Promise.all([
    safeSection('patients', async () => {
      const [total, onlineNow, consultedRows, deviceRows] = await Promise.all([
        db.patientProfile.count(),
        db.presenceSession.count({
          where: {
            actorType: 'PATIENT',
            endedAt: null,
            lastSeenAt: { gte: liveSince },
          },
        }),
        db.appointment.findMany({
          where: { completedAt: { not: null } },
          select: { patientId: true },
          distinct: ['patientId'],
        }),
        db.device.findMany({
          where: { patientId: { not: null } },
          select: { patientId: true },
          distinct: ['patientId'],
        }),
      ]);

      return {
        total,
        onlineNow,
        consulted: consultedRows.length,
        ownDevices: deviceRows.filter((row: any) => Boolean(row.patientId)).length,
      };
    }),

    safeSection('clinicians', async () => {
      const [total, onlineNow, consultedRows, trainingScheduled, trainingCompleted, onboardingRows, statusRows] = await Promise.all([
        db.clinicianProfile.count(),
        db.clinicianProfile.count({
          where: {
            online: true,
            lastSeenAt: { gte: liveSince },
            disabled: false,
            archived: false,
          },
        }),
        db.appointment.findMany({
          where: { completedAt: { not: null } },
          select: { clinicianId: true },
          distinct: ['clinicianId'],
        }),
        db.clinicianProfile.count({
          where: {
            trainingScheduledAt: { not: null },
            trainingCompleted: false,
            archived: false,
          },
        }),
        db.clinicianProfile.count({ where: { trainingCompleted: true } }),
        db.clinicianOnboarding.findMany({ select: { paymentPlan: true } }),
        db.clinicianProfile.findMany({ select: { status: true, disabled: true, archived: true } }),
      ]);

      const paymentPath = { payLater: 0, deposit: 0, full: 0, other: 0 };
      for (const row of onboardingRows) {
        const plan = upper(row.paymentPlan);
        if (['START_NOW_PAY_LATER', 'WAIVER_TRAIN_NOW_PAY_LATER'].includes(plan)) paymentPath.payLater += 1;
        else if (plan === 'QUALIFYING_DEPOSIT') paymentPath.deposit += 1;
        else if (plan === 'FULL_PAYMENT') paymentPath.full += 1;
        else paymentPath.other += 1;
      }

      const account = { active: 0, pending: 0, suspended: 0, archived: 0, other: 0 };
      for (const row of statusRows) {
        const status = upper(row.status);
        if (row.archived) account.archived += 1;
        else if (row.disabled || ['SUSPENDED', 'DISABLED', 'BLOCKED'].includes(status)) account.suspended += 1;
        else if (['ACTIVE', 'APPROVED', 'VERIFIED', 'LIVE'].includes(status)) account.active += 1;
        else if (['PENDING', 'REVIEW', 'SUBMITTED', 'ONBOARDING'].includes(status)) account.pending += 1;
        else account.other += 1;
      }

      return {
        total,
        onlineNow,
        consulted: consultedRows.length,
        paymentPath,
        training: {
          scheduled: trainingScheduled,
          completed: trainingCompleted,
        },
        account,
      };
    }),

    safeSection('consultations', async () => {
      const [total, inSession, card, medicalAid, iomtRooms] = await Promise.all([
        db.appointment.count(),
        db.appointment.count({
          where: {
            startedAt: { not: null },
            completedAt: null,
            cancelledAt: null,
          },
        }),
        db.appointment.count({ where: { paymentMethod: 'CARD' } }),
        db.appointment.count({ where: { paymentMethod: 'MEDICAL_AID' } }),
        db.vitalSample.findMany({
          where: { roomId: { not: null } },
          select: { roomId: true },
          distinct: ['roomId'],
        }),
      ]);

      const roomIds = iomtRooms.map((row: any) => row.roomId).filter(Boolean);
      const withIoMTs = roomIds.length
        ? await db.appointment.count({ where: { roomId: { in: roomIds } } })
        : 0;

      return { total, inSession, withIoMTs, card, medicalAid };
    }),

    safeSection('network', async () => {
      const [labsTotal, labsActive, labsPending, phlebsTotal, phlebsActive, phlebAgg, pharmaciesTotal, pharmaciesActive, ridersTotal, ridersActive, ridersOnJob, ridersOnline] = await Promise.all([
        db.labPartner.count(),
        db.labPartner.count({ where: { active: true, status: 'ACTIVE' } }),
        db.labPartner.count({ where: { status: 'PENDING' } }),
        db.medReachPhlebProfile.count(),
        db.medReachPhlebProfile.count({ where: { active: true, approvalStatus: 'ACTIVE' } }),
        db.medReachPhlebProfile.aggregate({ _sum: { completedJobsCount: true } }),
        db.pharmacyPartner.count(),
        db.pharmacyPartner.count({ where: { active: true } }),
        db.carePortRiderProfile.count(),
        db.carePortRiderProfile.count({ where: { isActive: true } }),
        db.carePortRiderProfile.count({ where: { isActive: true, isOnJob: true } }),
        db.presenceSession.count({
          where: {
            actorType: 'RIDER',
            endedAt: null,
            lastSeenAt: { gte: liveSince },
          },
        }),
      ]);

      return {
        labs: { total: labsTotal, active: labsActive, pending: labsPending },
        phlebs: {
          total: phlebsTotal,
          active: phlebsActive,
          completedJobs: Number(phlebAgg?._sum?.completedJobsCount || 0),
        },
        pharmacies: { total: pharmaciesTotal, active: pharmaciesActive },
        riders: { total: ridersTotal, active: ridersActive, onJob: ridersOnJob, onlineNow: ridersOnline },
      };
    }),

    safeSection('staff', async () => {
      const [total, rows, onlineNow, workforcePayees] = await Promise.all([
        db.adminUserProfile.count(),
        db.adminUserProfile.findMany({ select: { lifecycleState: true } }),
        db.adminStaffPresence.count({
          where: {
            state: { not: 'OFFLINE' },
            expiresAt: { gt: now },
          },
        }),
        db.workforceMember.count(),
      ]);

      const lifecycle = { active: 0, leave: 0, suspended: 0, archived: 0 };
      for (const row of rows) {
        const state = upper(row.lifecycleState);
        if (state === 'ACTIVE') lifecycle.active += 1;
        else if (state === 'LEAVE') lifecycle.leave += 1;
        else if (state === 'SUSPENDED') lifecycle.suspended += 1;
        else if (state === 'ARCHIVED') lifecycle.archived += 1;
      }

      return { total, onlineNow, workforcePayees, lifecycle };
    }),

    safeSection('commerce', async () => {
      const [productsTotal, productsActive, productsPublished, ordersTotal, orderRows] = await Promise.all([
        db.shopProduct.count(),
        db.shopProduct.count({ where: { active: true } }),
        db.shopProduct.count({ where: { active: true, channels: { some: {} } } }),
        db.shopOrder.count(),
        db.shopOrder.groupBy({ by: ['status'], _count: { _all: true } }),
      ]);

      const orders: Record<string, number> = {};
      for (const row of orderRows) orders[upper(row.status)] = Number(row?._count?._all || 0);

      return {
        products: { total: productsTotal, active: productsActive, published: productsPublished },
        orders: {
          total: ordersTotal,
          pending: orders.PENDING || 0,
          paid: orders.PAID || orders.CAPTURED || 0,
          fulfilled: orders.FULFILLED || orders.COMPLETED || 0,
        },
      };
    }),
  ]);

  const financeAccess = await requireEnterpriseFinanceAdmin(req);
  const finance = financeAccess.ok
    ? await safeSection('finance', async () => {
        const operating = await safeAggregateSum(
          db.revenueLedgerEntry,
          ['grossAmountCents', 'netPlatformRevenueCents'],
          { inflowCategory: 'operating_revenue' },
        );
        const manual = await safeAggregateSum(
          db.revenueLedgerEntry,
          ['netSettlementCents', 'amountReceivedCents', 'grossAmountCents'],
          { manualEntry: true },
        );
        const payrollArrears = await safeAggregateSum(
          db.staffArrearsLedger,
          ['debitCents', 'creditCents'],
          { status: { in: ['open', 'partial', 'unpaid', 'overdue'] } },
        );
        const commissions = await db.commissionAward.findMany({
          where: { status: { in: ['APPROVED', 'SCHEDULED', 'approved', 'scheduled', 'partially_paid'] } },
          select: { approvedAmountCents: true, calculatedAmountCents: true, paidAmountCents: true },
        });
        const commissionPayableCents = commissions.reduce(
          (sum: number, row: any) =>
            sum + Math.max(0, Number(row.approvedAmountCents || row.calculatedAmountCents || 0) - Number(row.paidAmountCents || 0)),
          0,
        );

        return {
          grossRevenueCents: Number(operating.grossAmountCents || 0),
          netPlatformRevenueCents: Number(operating.netPlatformRevenueCents || 0),
          manualInflowsCents: Number(manual.netSettlementCents || manual.amountReceivedCents || manual.grossAmountCents || 0),
          payrollLiabilityCents: Math.max(0, Number(payrollArrears.debitCents || 0) - Number(payrollArrears.creditCents || 0)),
          commissionPayableCents,
        };
      })
    : { available: false as const, data: null, reason: 'finance_scope_required' };

  return json({
    ok: true,
    generatedAt: now.toISOString(),
    liveWindowSeconds: LIVE_WINDOW_MS / 1000,
    sections: { patients, clinicians, consultations, network, staff, commerce, finance },
  });
}
