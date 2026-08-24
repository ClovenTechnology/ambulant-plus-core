import { NextRequest } from 'next/server';
import {
  auditEnterpriseFinance,
  json,
  requireEnterpriseFinanceAdmin,
  routeError,
  text,
} from '@/src/enterprise-finance/access-envelope';
import {
  historicalPayrollSnapshot,
  rebuildHistoricalPayroll,
  reconcileHistoricalPayroll,
} from '@/src/lib/historical-payroll';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATES = new Set(['FULLY_SETTLED', 'PARTIALLY_SETTLED', 'UNPAID']);

function asOptionalDate(value: unknown) {
  const raw = text(value, 80);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function cents(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : null;
}

export async function GET(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;

    const { searchParams } = new URL(req.url);
    const payrollProfileId = text(searchParams.get('payrollProfileId'), 180);
    const staffUserId = text(searchParams.get('staffUserId'), 180);
    if (!payrollProfileId && !staffUserId) {
      return json({ ok: false, error: 'payroll_profile_or_staff_required' }, 400);
    }

    const snapshot = await historicalPayrollSnapshot({
      payrollProfileId: payrollProfileId || null,
      staffUserId: staffUserId || null,
    });

    return json({ ok: true, envelope: access.envelope, ...snapshot });
  } catch (error: any) {
    if (error?.message === 'staff_payroll_profile_not_found') {
      return json({ ok: false, error: error.message }, 404);
    }
    return routeError(error, 'enterprise_finance_historical_payroll_get_failed');
  }
}

export async function POST(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;

    const body = await req.json().catch(() => ({}));
    const action = text(body.action || 'rebuild', 80).toLowerCase();
    const actorUserId = access.envelope.actor.userId;

    if (action === 'rebuild') {
      const payrollProfileId = text(body.payrollProfileId, 180);
      const staffUserId = text(body.staffUserId, 180);
      if (!payrollProfileId && !staffUserId) {
        return json({ ok: false, error: 'payroll_profile_or_staff_required' }, 400);
      }

      const result = await rebuildHistoricalPayroll({
        payrollProfileId: payrollProfileId || null,
        staffUserId: staffUserId || null,
        actorUserId,
        throughDate: asOptionalDate(body.throughDate),
      });

      await auditEnterpriseFinance('historical_payroll_reconstruction_requested', req, {
        model: 'StaffPayrollProfile',
        subjectId: result.profile.id,
        staffUserId: result.profile.staffUserId,
        entitlementCount: result.entitlements.length,
        warningCount: result.warnings.length,
      });

      const snapshot = await historicalPayrollSnapshot({
        payrollProfileId: result.profile.id,
      });
      return json({ ok: true, envelope: access.envelope, warnings: result.warnings, ...snapshot });
    }

    if (action === 'reconcile') {
      const payrollProfileId = text(body.payrollProfileId, 180);
      if (!payrollProfileId) {
        return json({ ok: false, error: 'payroll_profile_required' }, 400);
      }

      const state = text(body.settlementState, 80).toUpperCase();
      if (!STATES.has(state)) {
        return json({
          ok: false,
          error: 'invalid_historical_settlement_state',
          allowedStates: Array.from(STATES),
        }, 400);
      }

      const entitlementIds = Array.isArray(body.entitlementIds)
        ? body.entitlementIds.map((value: any) => text(value, 180)).filter(Boolean)
        : [];

      const settlements = Array.isArray(body.settlements)
        ? body.settlements
            .map((item: any) => ({
              entitlementId: text(item?.entitlementId, 180),
              amountHistoricallySettledCents: cents(item?.amountHistoricallySettledCents),
            }))
            .filter((item: any) => item.entitlementId && item.amountHistoricallySettledCents !== null)
        : [];

      const result = await reconcileHistoricalPayroll({
        payrollProfileId,
        actorUserId,
        entitlementIds,
        from: asOptionalDate(body.from),
        to: asOptionalDate(body.to),
        settlementState: state as 'FULLY_SETTLED' | 'PARTIALLY_SETTLED' | 'UNPAID',
        amountHistoricallySettledCents: cents(body.amountHistoricallySettledCents),
        settlements,
        reference: text(body.reference, 240) || null,
        note: text(body.note, 1000) || null,
        effectiveAt: asOptionalDate(body.effectiveAt),
        lock: Boolean(body.lock),
      });

      await auditEnterpriseFinance('historical_payroll_reconciliation_requested', req, {
        model: 'StaffPayrollProfile',
        subjectId: result.profile.id,
        staffUserId: result.profile.staffUserId,
        settlementState: state,
        entitlementCount: result.items.length,
        locked: Boolean(body.lock),
      });

      const snapshot = await historicalPayrollSnapshot({
        payrollProfileId: result.profile.id,
      });
      return json({ ok: true, envelope: access.envelope, ...snapshot });
    }

    return json({ ok: false, error: 'unsupported_historical_payroll_action' }, 400);
  } catch (error: any) {
    const message = String(error?.message || '');
    if (
      message.startsWith('historical_reconciliation_locked:') ||
      message.startsWith('partial_settlement_amount') ||
      message === 'partial_bulk_reconciliation_requires_per_period_settlements' ||
      message === 'staff_employment_start_date_required' ||
      message === 'historical_reconstruction_currently_requires_monthly_pay_frequency' ||
      message === 'compensation_history_gap' ||
      message === 'compensation_history_invalid_interval'
    ) {
      return json({ ok: false, error: message }, 409);
    }
    if (message === 'staff_payroll_profile_not_found') {
      return json({ ok: false, error: message }, 404);
    }
    return routeError(error, 'enterprise_finance_historical_payroll_action_failed');
  }
}
