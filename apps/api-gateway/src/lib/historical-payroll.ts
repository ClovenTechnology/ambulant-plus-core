import { prisma } from '@/lib/prisma';
import { ensureWorkforceMemberForPayrollProfile } from '@/src/lib/workforce';

const DAY_MS = 24 * 60 * 60 * 1000;
export const HISTORICAL_PAYROLL_CALCULATION_VERSION = 1;

type Db = any;

function utcDay(value: Date | string) {
  const d = value instanceof Date ? value : new Date(value);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addUtcDays(value: Date, days: number) {
  return new Date(value.getTime() + days * DAY_MS);
}

function monthStart(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

function monthEnd(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0));
}

function nextMonth(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 1));
}

function minDate(a: Date, b: Date) {
  return a.getTime() <= b.getTime() ? a : b;
}

function maxDate(a: Date, b: Date) {
  return a.getTime() >= b.getTime() ? a : b;
}

function dayCountInclusive(from: Date, to: Date) {
  if (to.getTime() < from.getTime()) return 0;
  return Math.floor((utcDay(to).getTime() - utcDay(from).getTime()) / DAY_MS) + 1;
}

function labelForMonth(value: Date) {
  return value.toLocaleString('en-ZA', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  });
}

function settlementState(gross: number, settled: number) {
  if (settled <= 0) return 'UNPAID';
  if (settled >= gross) return 'FULLY_SETTLED';
  return 'PARTIALLY_SETTLED';
}

function asJsonObject(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return JSON.parse(JSON.stringify(value)) as Record<string, any>;
}

async function payrollProfileOrThrow(db: Db, input: {
  payrollProfileId?: string | null;
  staffUserId?: string | null;
}) {
  const where = input.payrollProfileId
    ? { id: input.payrollProfileId }
    : { staffUserId: input.staffUserId || '__missing__' };

  const profile = await db.staffPayrollProfile.findFirst({ where });
  if (!profile) throw new Error('staff_payroll_profile_not_found');
  if (!profile.startDate) throw new Error('staff_employment_start_date_required');
  if (String(profile.payFrequency || 'monthly').toLowerCase() !== 'monthly') {
    throw new Error('historical_reconstruction_currently_requires_monthly_pay_frequency');
  }
  return profile;
}

async function staffProfileAndChanges(db: Db, profile: any) {
  const staffProfile = await db.adminUserProfile.findFirst({
    where: { userId: profile.staffUserId },
    select: { id: true, userId: true },
  });

  if (!staffProfile) {
    return { staffProfile: null, changes: [] as any[] };
  }

  const changes = await db.staffEmploymentChange.findMany({
    where: {
      staffProfileId: staffProfile.id,
      salaryAfterCents: { not: null },
    },
    orderBy: [{ effectiveAt: 'asc' }, { createdAt: 'asc' }],
  });

  return { staffProfile, changes };
}

async function upsertCompensationTimeline(db: Db, profile: any, actorUserId: string | null) {
  const { staffProfile, changes } = await staffProfileAndChanges(db, profile);
  const start = utcDay(profile.startDate);
  const end = profile.endDate ? utcDay(profile.endDate) : null;
  const warnings: Array<Record<string, any>> = [];

  const salaryChanges = changes
    .filter((change: any) => Number(change.salaryAfterCents ?? 0) >= 0)
    .map((change: any) => ({
      ...change,
      effectiveAt: utcDay(change.effectiveAt),
    }))
    .filter((change: any) => change.effectiveAt.getTime() >= start.getTime())
    .filter((change: any) => !end || change.effectiveAt.getTime() <= end.getTime());

  const firstChange = salaryChanges[0] || null;
  let initialSalary = Number(firstChange?.salaryBeforeCents ?? profile.baseSalaryCents ?? 0);
  if (initialSalary < 0) initialSalary = 0;

  const definitions: Array<{
    sourceFingerprint: string;
    sourceType: string;
    sourceId: string | null;
    changeType: string | null;
    effectiveFrom: Date;
    baseSalaryCents: number;
    notes: string | null;
    meta: Record<string, any>;
  }> = [
    {
      sourceFingerprint: `payroll-profile:${profile.id}:baseline`,
      sourceType: 'payroll_profile',
      sourceId: profile.id,
      changeType: 'EMPLOYMENT_BASELINE',
      effectiveFrom: start,
      baseSalaryCents: initialSalary,
      notes: 'Derived baseline for historical payroll reconstruction.',
      meta: {
        derivation: firstChange?.salaryBeforeCents != null
          ? 'earliest_employment_change.salaryBeforeCents'
          : 'staff_payroll_profile.baseSalaryCents',
      },
    },
  ];

  for (const change of salaryChanges) {
    definitions.push({
      sourceFingerprint: `employment-change:${change.id}`,
      sourceType: 'staff_employment_change',
      sourceId: change.id,
      changeType: String(change.changeType || 'SALARY_REVIEW'),
      effectiveFrom: change.effectiveAt,
      baseSalaryCents: Math.max(0, Number(change.salaryAfterCents || 0)),
      notes: change.notes || null,
      meta: {
        salaryBeforeCents: change.salaryBeforeCents ?? null,
        salaryAfterCents: change.salaryAfterCents ?? null,
      },
    });
  }

  definitions.sort((a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime());

  const latestDerivedSalary = definitions[definitions.length - 1]?.baseSalaryCents ?? initialSalary;
  const profileSalary = Math.max(0, Number(profile.baseSalaryCents || 0));

  if (salaryChanges.length && latestDerivedSalary !== profileSalary) {
    warnings.push({
      code: 'CURRENT_PROFILE_SALARY_MISMATCH',
      message:
        'The current payroll salary differs from the last effective-dated salary event. Add the missing promotion/salary-review event; the reconstruction will not invent its effective date.',
      profileBaseSalaryCents: profileSalary,
      latestEffectiveDatedSalaryCents: latestDerivedSalary,
    });
  }

  const output: any[] = [];
  for (let index = 0; index < definitions.length; index += 1) {
    const definition = definitions[index];
    const effectiveTo = definitions[index + 1]?.effectiveFrom || null;

    const existing = await db.staffCompensationHistory.findUnique({
      where: { sourceFingerprint: definition.sourceFingerprint },
    });

    const data = {
      staffUserId: profile.staffUserId,
      payrollProfileId: profile.id,
      staffProfileId: staffProfile?.id || null,
      sourceType: definition.sourceType,
      sourceId: definition.sourceId,
      changeType: definition.changeType,
      effectiveFrom: definition.effectiveFrom,
      effectiveTo,
      compensationType: 'salary',
      baseSalaryCents: definition.baseSalaryCents,
      hourlyRateCents: Math.max(0, Number(profile.hourlyRateCents || 0)),
      defaultHoursPerPeriod: profile.defaultHoursPerPeriod ?? null,
      payFrequency: String(profile.payFrequency || 'monthly'),
      currency: String(profile.currency || 'ZAR'),
      notes: definition.notes,
      meta: {
        ...definition.meta,
        effectiveToSemantics: 'exclusive',
      },
      createdByUserId: actorUserId,
    };

    let row;
    if (!existing) {
      row = await db.staffCompensationHistory.create({
        data: { sourceFingerprint: definition.sourceFingerprint, ...data },
      });
    } else if (!existing.lockedAt) {
      row = await db.staffCompensationHistory.update({
        where: { id: existing.id },
        data,
      });
    } else {
      row = existing;
      const changed =
        Number(existing.baseSalaryCents || 0) !== definition.baseSalaryCents ||
        utcDay(existing.effectiveFrom).getTime() !== definition.effectiveFrom.getTime();
      if (changed) {
        warnings.push({
          code: 'LOCKED_COMPENSATION_HISTORY_CONFLICT',
          historyId: existing.id,
          sourceFingerprint: existing.sourceFingerprint,
        });
      }
    }

    output.push(row);
  }

  return { timeline: output, warnings, staffProfileId: staffProfile?.id || null };
}

async function findOrCreatePeriod(db: Db, month: Date, profile: any, actorUserId: string | null) {
  const startsAt = monthStart(month);
  const endsDay = monthEnd(month);
  const endsAt = new Date(endsDay.getTime() + DAY_MS - 1);
  const existing = await db.payrollPeriod.findFirst({
    where: {
      periodType: 'monthly',
      startsAt,
      endsAt,
      country: profile.country || 'ZA',
      currency: profile.currency || 'ZAR',
    },
  });
  if (existing) return existing;

  return db.payrollPeriod.create({
    data: {
      label: labelForMonth(month),
      periodType: 'monthly',
      startsAt,
      endsAt,
      payDate: endsDay,
      country: profile.country || 'ZA',
      currency: profile.currency || 'ZAR',
      status: 'historical_reconstructed',
      meta: {
        generatedBy: 'historical_payroll_reconstruction_v1',
        generatedByUserId: actorUserId,
      },
    },
  });
}

function compensationForDate(timeline: any[], date: Date) {
  let active = timeline[0] || null;
  for (const item of timeline) {
    if (utcDay(item.effectiveFrom).getTime() <= date.getTime()) active = item;
    else break;
  }
  return active;
}

async function upsertAccrualAndArrears(db: Db, entitlement: any) {
  const sourceType = 'historical_payroll_entitlement';
  const sourceId = entitlement.id;
  const gross = Math.max(0, Number(entitlement.grossEntitlementCents || 0));
  const historicallySettled = Math.max(0, Number(entitlement.amountHistoricallySettledCents || 0));
  const postReconciliationPaid = Math.max(0, Number(entitlement.postReconciliationPaidCents || 0));
  const settled = Math.min(gross, historicallySettled + postReconciliationPaid);
  const remaining = Math.max(0, gross - settled);

  let accrual = await db.staffSalaryAccrual.findFirst({
    where: { sourceType, sourceId },
  });

  const accrualData = {
    staffUserId: entitlement.staffUserId,
    payrollProfileId: entitlement.payrollProfileId,
    payrollPeriodId: entitlement.payrollPeriodId,
    accrualType: 'salary',
    status: remaining > 0 ? 'accrued' : 'settled',
    earnedFrom: entitlement.periodStartsAt,
    earnedTo: entitlement.periodEndsAt,
    grossCents: gross,
    netExpectedCents: gross,
    paidCents: Math.min(gross, settled),
    unpaidCents: remaining,
    currency: entitlement.currency,
    sourceType,
    sourceId,
    meta: {
      entitlementId: entitlement.id,
      historicalReconciliation: true,
    },
  };

  if (accrual) {
    accrual = await db.staffSalaryAccrual.update({
      where: { id: accrual.id },
      data: accrualData,
    });
  } else {
    accrual = await db.staffSalaryAccrual.create({ data: accrualData });
  }

  let ledger = await db.staffArrearsLedger.findFirst({
    where: { sourceType, sourceId },
    orderBy: { createdAt: 'desc' },
  });

  const ledgerData = {
    staffUserId: entitlement.staffUserId,
    payrollProfileId: entitlement.payrollProfileId,
    payrollPeriodId: entitlement.payrollPeriodId,
    salaryAccrualId: accrual.id,
    entryType: 'historical_salary_entitlement',
    status: remaining <= 0 ? 'settled' : settled > 0 ? 'partial' : 'open',
    description: `Historical salary entitlement: ${labelForMonth(utcDay(entitlement.periodStartsAt))}`,
    debitCents: gross,
    creditCents: Math.min(gross, settled),
    balanceAfterCents: remaining,
    currency: entitlement.currency,
    dueDate: entitlement.periodEndsAt,
    effectiveAt: new Date(),
    sourceType,
    sourceId,
    meta: {
      entitlementId: entitlement.id,
      historicalReconciliation: true,
    },
  };

  if (ledger) {
    ledger = await db.staffArrearsLedger.update({
      where: { id: ledger.id },
      data: ledgerData,
    });
  } else {
    ledger = await db.staffArrearsLedger.create({ data: ledgerData });
  }

  return { accrual, ledger };
}

export async function rebuildHistoricalPayroll(input: {
  payrollProfileId?: string | null;
  staffUserId?: string | null;
  actorUserId?: string | null;
  throughDate?: Date | string | null;
}) {
  const db: any = prisma;
  const profile = await payrollProfileOrThrow(db, input);
  await ensureWorkforceMemberForPayrollProfile(profile, input.actorUserId || null);
  const employmentStart = utcDay(profile.startDate);
  const requestedThrough = input.throughDate ? utcDay(input.throughDate) : utcDay(new Date());
  const employmentEnd = profile.endDate ? utcDay(profile.endDate) : requestedThrough;
  const through = minDate(requestedThrough, employmentEnd);

  if (through.getTime() < employmentStart.getTime()) {
    throw new Error('historical_payroll_through_date_precedes_employment_start');
  }

  const compensation = await upsertCompensationTimeline(
    db,
    profile,
    input.actorUserId || null,
  );
  const timeline = await db.staffCompensationHistory.findMany({
    where: { payrollProfileId: profile.id },
    orderBy: [{ effectiveFrom: 'asc' }, { createdAt: 'asc' }],
  });

  if (!timeline.length) throw new Error('compensation_history_not_available');

  const entitlements: any[] = [];
  for (
    let cursor = monthStart(employmentStart);
    cursor.getTime() <= monthStart(through).getTime();
    cursor = nextMonth(cursor)
  ) {
    const period = await findOrCreatePeriod(db, cursor, profile, input.actorUserId || null);
    const periodStart = monthStart(cursor);
    const periodLastDay = monthEnd(cursor);
    const eligibleStart = maxDate(periodStart, employmentStart);
    const eligibleEnd = minDate(periodLastDay, through);
    const periodDays = dayCountInclusive(periodStart, periodLastDay);

    const segmentDefs: any[] = [];
    let segmentCursor = eligibleStart;

    while (segmentCursor.getTime() <= eligibleEnd.getTime()) {
      const active = compensationForDate(timeline, segmentCursor);
      if (!active) throw new Error('compensation_history_gap');

      const nextBoundary = active.effectiveTo
        ? utcDay(active.effectiveTo)
        : addUtcDays(eligibleEnd, 1);
      const segmentEndExclusive = minDate(nextBoundary, addUtcDays(eligibleEnd, 1));
      const segmentEnd = addUtcDays(segmentEndExclusive, -1);
      const days = dayCountInclusive(segmentCursor, segmentEnd);
      if (days <= 0) throw new Error('compensation_history_invalid_interval');

      const rate = Math.max(0, Number(active.baseSalaryCents || 0));
      const gross = Math.round((rate * days) / periodDays);

      segmentDefs.push({
        compensationHistoryId: active.id,
        effectiveFrom: segmentCursor,
        effectiveTo: segmentEnd,
        salaryRateCents: rate,
        grossEntitlementCents: gross,
        eligibleDayCount: days,
        periodDayCount: periodDays,
        prorationFactor: days / periodDays,
        meta: {
          calculationVersion: HISTORICAL_PAYROLL_CALCULATION_VERSION,
          basis: 'calendar_days',
        },
      });

      segmentCursor = segmentEndExclusive;
    }

    const gross = segmentDefs.reduce(
      (sum, segment) => sum + Number(segment.grossEntitlementCents || 0),
      0,
    );

    const existing = await db.staffPayrollEntitlement.findUnique({
      where: {
        staffUserId_payrollPeriodId: {
          staffUserId: profile.staffUserId,
          payrollPeriodId: period.id,
        },
      },
    });

    let entitlement = existing;
    if (!existing?.lockedAt) {
      const settled = Math.min(
        gross,
        Math.max(0, Number(existing?.amountHistoricallySettledCents || 0)),
      );
      const postReconciliationPaid = Math.min(
        Math.max(0, gross - settled),
        Math.max(0, Number(existing?.postReconciliationPaidCents || 0)),
      );
      const state = settlementState(gross, settled);
      const data = {
        staffUserId: profile.staffUserId,
        payrollProfileId: profile.id,
        payrollPeriodId: period.id,
        periodStartsAt: period.startsAt,
        periodEndsAt: period.endsAt,
        grossEntitlementCents: gross,
        amountHistoricallySettledCents: settled,
        postReconciliationPaidCents: postReconciliationPaid,
        remainingCents: Math.max(0, gross - settled - postReconciliationPaid),
        currency: profile.currency || 'ZAR',
        settlementState: state,
        calculationStatus: compensation.warnings.length ? 'CALCULATED_WITH_WARNING' : 'CALCULATED',
        calculationVersion: HISTORICAL_PAYROLL_CALCULATION_VERSION,
        prorationMeta: {
          periodDayCount: periodDays,
          employmentEligibleDayCount: dayCountInclusive(eligibleStart, eligibleEnd),
          basis: 'calendar_days',
        },
        warningMeta: compensation.warnings.length ? { warnings: compensation.warnings } : null,
        generatedByUserId: input.actorUserId || null,
        generatedAt: new Date(),
      };

      if (existing) {
        entitlement = await db.staffPayrollEntitlement.update({
          where: { id: existing.id },
          data,
        });
        await db.staffPayrollEntitlementSegment.deleteMany({
          where: { entitlementId: existing.id },
        });
      } else {
        entitlement = await db.staffPayrollEntitlement.create({ data });
      }

      if (segmentDefs.length) {
        await db.staffPayrollEntitlementSegment.createMany({
          data: segmentDefs.map((segment) => ({
            ...segment,
            entitlementId: entitlement.id,
          })),
        });
      }
    }

    await upsertAccrualAndArrears(db, entitlement);
    entitlements.push(entitlement);
  }

  await db.payrollAuditEvent.create({
    data: {
      eventType: 'historical_payroll_rebuilt',
      actorUserId: input.actorUserId || null,
      subjectType: 'StaffPayrollProfile',
      subjectId: profile.id,
      staffUserId: profile.staffUserId,
      afterMeta: {
        entitlementCount: entitlements.length,
        throughDate: through.toISOString(),
        warningCount: compensation.warnings.length,
      },
      meta: {
        calculationVersion: HISTORICAL_PAYROLL_CALCULATION_VERSION,
      },
    },
  });

  return {
    profile,
    compensationHistory: timeline,
    warnings: compensation.warnings,
    entitlements,
  };
}

export async function reconcileHistoricalPayroll(input: {
  payrollProfileId: string;
  actorUserId?: string | null;
  entitlementIds?: string[];
  from?: Date | string | null;
  to?: Date | string | null;
  settlementState: 'FULLY_SETTLED' | 'PARTIALLY_SETTLED' | 'UNPAID';
  amountHistoricallySettledCents?: number | null;
  settlements?: Array<{ entitlementId: string; amountHistoricallySettledCents: number }>;
  reference?: string | null;
  note?: string | null;
  effectiveAt?: Date | string | null;
  lock?: boolean;
}) {
  const db: any = prisma;
  const profile = await payrollProfileOrThrow(db, {
    payrollProfileId: input.payrollProfileId,
  });

  const where: any = { payrollProfileId: profile.id };
  if (input.entitlementIds?.length) {
    where.id = { in: input.entitlementIds };
  } else {
    const range: any = {};
    if (input.from) range.gte = utcDay(input.from);
    if (input.to) range.lte = new Date(monthEnd(utcDay(input.to)).getTime() + DAY_MS - 1);
    if (Object.keys(range).length) where.periodStartsAt = range;
  }

  const targets = await db.staffPayrollEntitlement.findMany({
    where,
    orderBy: { periodStartsAt: 'asc' },
  });
  if (!targets.length) throw new Error('historical_payroll_entitlements_not_found');

  const perEntitlement = new Map(
    (input.settlements || []).map((item) => [
      String(item.entitlementId),
      Math.max(0, Math.round(Number(item.amountHistoricallySettledCents || 0))),
    ]),
  );

  if (
    input.settlementState === 'PARTIALLY_SETTLED' &&
    targets.length > 1 &&
    !perEntitlement.size
  ) {
    throw new Error('partial_bulk_reconciliation_requires_per_period_settlements');
  }

  const updated: any[] = [];
  for (const entitlement of targets) {
    const existingReconciliation = await db.staffPayrollHistoricalReconciliation.findUnique({
      where: { entitlementId: entitlement.id },
    });

    if (entitlement.lockedAt || existingReconciliation?.lockedAt) {
      throw new Error(`historical_reconciliation_locked:${entitlement.id}`);
    }

    const gross = Math.max(0, Number(entitlement.grossEntitlementCents || 0));
    let settled = 0;

    if (input.settlementState === 'FULLY_SETTLED') {
      settled = gross;
    } else if (input.settlementState === 'UNPAID') {
      settled = 0;
    } else {
      const explicit = perEntitlement.has(entitlement.id)
        ? perEntitlement.get(entitlement.id)
        : input.amountHistoricallySettledCents;
      if (explicit === null || explicit === undefined) {
        throw new Error(`partial_settlement_amount_required:${entitlement.id}`);
      }
      settled = Math.max(0, Math.min(gross, Math.round(Number(explicit) || 0)));
      if (settled <= 0 || settled >= gross) {
        throw new Error(`partial_settlement_amount_must_be_between_zero_and_gross:${entitlement.id}`);
      }
    }

    const postReconciliationPaid = Math.max(0, Number(entitlement.postReconciliationPaidCents || 0));
    if (settled + postReconciliationPaid > gross) {
      throw new Error(`historical_reconciliation_conflicts_with_post_reconciliation_payments:${entitlement.id}`);
    }
    const state = settlementState(gross, settled);
    const remaining = Math.max(0, gross - settled - postReconciliationPaid);
    const lockAt = input.lock ? new Date() : null;

    const result = await db.$transaction(async (tx: Db) => {
      const before = await tx.staffPayrollEntitlement.findUnique({
        where: { id: entitlement.id },
      });

      const next = await tx.staffPayrollEntitlement.update({
        where: { id: entitlement.id },
        data: {
          amountHistoricallySettledCents: settled,
          remainingCents: remaining,
          settlementState: state,
          ...(input.lock
            ? { lockedAt: lockAt, lockedByUserId: input.actorUserId || null }
            : {}),
        },
      });

      const reconciliationData = {
        staffUserId: profile.staffUserId,
        payrollProfileId: profile.id,
        settlementState: state,
        amountHistoricallySettledCents: settled,
        reference: input.reference || null,
        note: input.note || null,
        sourceType: 'legacy_onboarding',
        effectiveAt: input.effectiveAt ? new Date(input.effectiveAt) : null,
        lockedAt: lockAt,
        lockedByUserId: input.lock ? input.actorUserId || null : null,
        recordedByUserId: input.actorUserId || null,
        meta: {
          grossEntitlementCents: gross,
          remainingCents: remaining,
        },
      };

      const reconciliation = existingReconciliation
        ? await tx.staffPayrollHistoricalReconciliation.update({
            where: { id: existingReconciliation.id },
            data: reconciliationData,
          })
        : await tx.staffPayrollHistoricalReconciliation.create({
            data: {
              entitlementId: entitlement.id,
              ...reconciliationData,
            },
          });

      await tx.payrollAuditEvent.create({
        data: {
          eventType: input.lock
            ? 'historical_payroll_reconciled_and_locked'
            : 'historical_payroll_reconciled',
          actorUserId: input.actorUserId || null,
          subjectType: 'StaffPayrollEntitlement',
          subjectId: entitlement.id,
          staffUserId: profile.staffUserId,
          beforeMeta: asJsonObject(before),
          afterMeta: {
            settlementState: state,
            amountHistoricallySettledCents: settled,
            remainingCents: remaining,
            lockedAt: lockAt?.toISOString() || null,
          },
          meta: {
            reference: input.reference || null,
            reconciliationId: reconciliation.id,
          },
        },
      });

      return next;
    });

    await upsertAccrualAndArrears(db, result);
    updated.push(result);
  }

  return { profile, items: updated };
}

export async function historicalPayrollSnapshot(input: {
  payrollProfileId?: string | null;
  staffUserId?: string | null;
}) {
  const db: any = prisma;
  const profile = await payrollProfileOrThrow(db, input);
  const [compensationHistory, entitlements, reconciliations] = await Promise.all([
    db.staffCompensationHistory.findMany({
      where: { payrollProfileId: profile.id },
      orderBy: { effectiveFrom: 'asc' },
    }),
    db.staffPayrollEntitlement.findMany({
      where: { payrollProfileId: profile.id },
      orderBy: { periodStartsAt: 'asc' },
    }),
    db.staffPayrollHistoricalReconciliation.findMany({
      where: { payrollProfileId: profile.id },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  const entitlementIds = entitlements.map((item: any) => item.id);
  const segments = entitlementIds.length
    ? await db.staffPayrollEntitlementSegment.findMany({
        where: { entitlementId: { in: entitlementIds } },
        orderBy: [{ effectiveFrom: 'asc' }, { createdAt: 'asc' }],
      })
    : [];

  const segmentsByEntitlement = new Map<string, any[]>();
  for (const segment of segments) {
    const list = segmentsByEntitlement.get(segment.entitlementId) || [];
    list.push(segment);
    segmentsByEntitlement.set(segment.entitlementId, list);
  }

  const reconciliationByEntitlement = new Map(
    reconciliations.map((item: any) => [item.entitlementId, item]),
  );

  return {
    profile,
    compensationHistory,
    entitlements: entitlements.map((item: any) => ({
      ...item,
      segments: segmentsByEntitlement.get(item.id) || [],
      reconciliation: reconciliationByEntitlement.get(item.id) || null,
    })),
  };
}
