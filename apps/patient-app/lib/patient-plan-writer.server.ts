// apps/patient-app/lib/patient-plan-writer.server.ts
import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import {
  canAutoUpgrade,
  formatZar,
  hashCode,
  normalizeCode,
  planCostZar,
} from './wallet.server';
import { normalizePlan, type Plan } from './plans';

export type BillingCycle = 'monthly' | 'annual';

export class PatientPlanWriterError extends Error {
  code: string;
  status: number;

  constructor(code: string, status: number, message?: string) {
    super(message || code);
    this.name = 'PatientPlanWriterError';
    this.code = code;
    this.status = status;
  }
}

type Tx = Prisma.TransactionClient;

type SessionSubject = {
  userId: string;
  patientId: string;
};

type WalletResult = {
  availableZar: number;
  heldZar: number;
  balanceZar: number;
};

type PurchaseResult = {
  plan: Exclude<Plan, 'free'>;
  cycle: BillingCycle;
  paidZar: number;
  txRef: string;
  wallet: WalletResult;
};

type RedeemResult = {
  redeemed: {
    code: string;
    valueZar: number;
    plan?: Exclude<Plan, 'free'>;
  };
  effect: 'upgraded' | 'credit_saved';
  message: string;
  allowShopSpend: boolean;
};

function clean(value: unknown, max = 180) {
  return String(value ?? '').trim().slice(0, max);
}

function defaultOrgId() {
  return (
    clean(
      process.env.DEFAULT_ORG_ID ||
        process.env.NEXT_PUBLIC_DEFAULT_ORG_ID ||
        'org-default',
      120,
    ) || 'org-default'
  );
}

function normalizeCycle(value: unknown): BillingCycle {
  return clean(value, 32).toLowerCase() === 'annual'
    ? 'annual'
    : 'monthly';
}

function safeTxRef(value: unknown) {
  const supplied = clean(value, 180);

  if (supplied && /^[A-Za-z0-9._:-]{8,180}$/.test(supplied)) {
    return supplied;
  }

  return `planwallet:${crypto.randomUUID()}`;
}

function addBillingPeriod(from: Date, cycle: BillingCycle) {
  const d = new Date(from);

  if (cycle === 'annual') {
    d.setUTCFullYear(d.getUTCFullYear() + 1);
  } else {
    d.setUTCMonth(d.getUTCMonth() + 1);
  }

  return d;
}

function effectivePlanFromRow(
  row:
    | {
        plan: string;
        status: string;
        startsAt: Date | null;
        endsAt: Date | null;
      }
    | null
    | undefined,
  now: Date,
): Plan {
  if (!row) return 'free';

  const plan = normalizePlan(row.plan) || 'free';
  const status = clean(row.status, 80).toLowerCase();

  if (status !== 'active') return 'free';
  if (row.startsAt && row.startsAt.getTime() > now.getTime()) {
    return 'free';
  }
  if (row.endsAt && row.endsAt.getTime() <= now.getTime()) {
    return 'free';
  }

  return plan;
}

async function assertPatientSubject(
  tx: Tx,
  subject: SessionSubject,
) {
  const patientId = clean(subject.patientId, 180);
  const userId = clean(subject.userId, 180);

  if (!patientId || !userId) {
    throw new PatientPlanWriterError(
      'patient_authentication_required',
      401,
    );
  }

  const profile = await tx.patientProfile.findUnique({
    where: { id: patientId },
    select: { id: true, userId: true },
  });

  if (!profile) {
    throw new PatientPlanWriterError(
      'patient_profile_not_found',
      404,
    );
  }

  if (profile.userId !== userId) {
    throw new PatientPlanWriterError(
      'patient_subject_mismatch',
      403,
    );
  }

  return profile;
}

async function getOrCreateWalletTx(
  tx: Tx,
  userId: string,
  orgId = defaultOrgId(),
) {
  const existing = await tx.walletAccount.findUnique({
    where: { userId },
  });

  if (existing) return existing;

  return tx.walletAccount.create({
    data: {
      userId,
      orgId,
      currency: 'ZAR',
      balanceZar: 0,
      heldZar: 0,
    },
  });
}

async function walletResultTx(
  tx: Tx,
  accountId: string,
): Promise<WalletResult> {
  const wallet = await tx.walletAccount.findUnique({
    where: { id: accountId },
  });

  if (!wallet) {
    throw new PatientPlanWriterError(
      'wallet_not_found',
      500,
    );
  }

  return {
    balanceZar: wallet.balanceZar,
    heldZar: wallet.heldZar,
    availableZar: Math.max(
      0,
      wallet.balanceZar - wallet.heldZar,
    ),
  };
}

async function applyPlanEntitlementTx(args: {
  tx: Tx;
  patientId: string;
  plan: Exclude<Plan, 'free'>;
  cycle: BillingCycle;
  sourceType: string;
  sourceRef: string;
  idempotencyKey: string;
  orgId: string;
  metadata?: Prisma.InputJsonValue;
}) {
  const existingEvent =
    await args.tx.patientPlanEntitlementEvent.findUnique({
      where: {
        idempotencyKey: args.idempotencyKey,
      },
      select: { id: true },
    });

  if (existingEvent) {
    const existing =
      await args.tx.patientPlanEntitlement.findUnique({
        where: { patientId: args.patientId },
      });

    if (!existing) {
      throw new PatientPlanWriterError(
        'entitlement_idempotency_state_invalid',
        500,
      );
    }

    return existing;
  }

  const now = new Date();

  const previous =
    await args.tx.patientPlanEntitlement.findUnique({
      where: { patientId: args.patientId },
    });

  const previousEffective =
    effectivePlanFromRow(previous, now);

  const sameActivePlan =
    previousEffective === args.plan &&
    previous?.endsAt &&
    previous.endsAt.getTime() > now.getTime();

  const periodBase =
    sameActivePlan && previous?.endsAt
      ? previous.endsAt
      : now;

  const startsAt =
    sameActivePlan && previous?.startsAt
      ? previous.startsAt
      : now;

  const endsAt =
    addBillingPeriod(periodBase, args.cycle);

  const entitlement =
    await args.tx.patientPlanEntitlement.upsert({
      where: { patientId: args.patientId },
      create: {
        patientId: args.patientId,
        plan: args.plan,
        cycle: args.cycle,
        status: 'active',
        startsAt,
        endsAt,
        sourceType: args.sourceType,
        sourceRef: args.sourceRef,
        orgId: args.orgId,
        metadata: args.metadata,
      },
      update: {
        plan: args.plan,
        cycle: args.cycle,
        status: 'active',
        startsAt,
        endsAt,
        sourceType: args.sourceType,
        sourceRef: args.sourceRef,
        orgId: args.orgId,
        metadata: args.metadata,
      },
    });

  await args.tx.patientPlanEntitlementEvent.create({
    data: {
      entitlementId: entitlement.id,
      patientId: args.patientId,
      eventType: 'plan_activated',
      fromPlan: previousEffective,
      toPlan: args.plan,
      cycle: args.cycle,
      startsAt,
      endsAt,
      sourceType: args.sourceType,
      sourceRef: args.sourceRef,
      idempotencyKey: args.idempotencyKey,
      metadata: args.metadata,
    },
  });

  return entitlement;
}

async function runSerializable<T>(
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(fn, {
        isolationLevel:
          Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 15_000,
      });
    } catch (error) {
      lastError = error;

      if (
        error instanceof
          Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034' &&
        attempt < 2
      ) {
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}

export async function purchasePatientPlanWithWallet(args: {
  userId: string;
  patientId: string;
  plan: Exclude<Plan, 'free'>;
  cycle: BillingCycle;
  txRef?: unknown;
}): Promise<PurchaseResult> {
  const plan = normalizePlan(args.plan);

  if (!plan || plan === 'free') {
    throw new PatientPlanWriterError(
      'invalid_plan',
      400,
      'Invalid plan.',
    );
  }

  const cycle = normalizeCycle(args.cycle);
  const amountZar = planCostZar(plan, cycle);

  if (amountZar <= 0) {
    throw new PatientPlanWriterError(
      'plan_has_no_cost',
      400,
      'This plan has no configured wallet price.',
    );
  }

  const txRef = safeTxRef(args.txRef);

  return runSerializable(async (tx) => {
    await assertPatientSubject(tx, {
      userId: args.userId,
      patientId: args.patientId,
    });

    const wallet =
      await getOrCreateWalletTx(
        tx,
        args.userId,
      );

    const refId = `${plan}:${cycle}`;

    let hold =
      await tx.walletHold.findUnique({
        where: { txRef },
      });

    if (hold) {
      if (
        hold.accountId !== wallet.id ||
        hold.scope !== 'PLAN' ||
        hold.amountZar !== amountZar ||
        clean(hold.refType, 80) !== 'plan' ||
        clean(hold.refId, 180) !== refId
      ) {
        throw new PatientPlanWriterError(
          'wallet_transaction_conflict',
          409,
        );
      }

      if (
        hold.status !== 'HELD' &&
        hold.status !== 'CAPTURED'
      ) {
        throw new PatientPlanWriterError(
          'wallet_transaction_not_capturable',
          409,
        );
      }

      if (hold.status === 'HELD') {
        await tx.walletHold.update({
          where: { id: hold.id },
          data: { status: 'CAPTURED' },
        });

        await tx.walletAccount.update({
          where: { id: wallet.id },
          data: {
            heldZar: {
              decrement: hold.amountZar,
            },
            balanceZar: {
              decrement: hold.amountZar,
            },
          },
        });

        await tx.walletEntry.create({
          data: {
            accountId: wallet.id,
            kind: 'DEBIT',
            scope: 'PLAN',
            amountZar: -hold.amountZar,
            currency: 'ZAR',
            holdId: hold.id,
            txRef: hold.txRef,
            refType: hold.refType,
            refId: hold.refId,
            meta: {
              reason: 'plan_pay_wallet',
              plan,
              cycle,
            },
            orgId: wallet.orgId,
          },
        });

        hold = {
          ...hold,
          status: 'CAPTURED',
        };
      }
    } else {
      const availableZar =
        Math.max(
          0,
          wallet.balanceZar - wallet.heldZar,
        );

      if (amountZar > availableZar) {
        throw new PatientPlanWriterError(
          'insufficient_wallet_credit',
          400,
          `Insufficient wallet credit. Available ${availableZar}.`,
        );
      }

      hold =
        await tx.walletHold.create({
          data: {
            accountId: wallet.id,
            scope: 'PLAN',
            amountZar,
            currency: 'ZAR',
            status: 'CAPTURED',
            txRef,
            refType: 'plan',
            refId,
            orgId: wallet.orgId,
          },
        });

      await tx.walletAccount.update({
        where: { id: wallet.id },
        data: {
          balanceZar: {
            decrement: amountZar,
          },
        },
      });

      await tx.walletEntry.create({
        data: {
          accountId: wallet.id,
          kind: 'DEBIT',
          scope: 'PLAN',
          amountZar: -amountZar,
          currency: 'ZAR',
          holdId: hold.id,
          txRef,
          refType: 'plan',
          refId,
          meta: {
            reason: 'plan_pay_wallet',
            plan,
            cycle,
          },
          orgId: wallet.orgId,
        },
      });
    }

    await applyPlanEntitlementTx({
      tx,
      patientId: args.patientId,
      plan,
      cycle,
      sourceType: 'wallet_purchase',
      sourceRef: hold.id,
      idempotencyKey: `wallet-plan:${hold.id}`,
      orgId: wallet.orgId,
      metadata: {
        walletHoldId: hold.id,
        txRef,
        paidZar: amountZar,
      },
    });

    return {
      plan,
      cycle,
      paidZar: amountZar,
      txRef,
      wallet:
        await walletResultTx(
          tx,
          wallet.id,
        ),
    };
  });
}

export async function redeemPatientVoucher(args: {
  userId: string;
  patientId: string;
  code: unknown;
}): Promise<RedeemResult> {
  const raw = normalizeCode(String(args.code ?? ''));

  if (!raw || raw.length < 6) {
    throw new PatientPlanWriterError(
      'invalid_voucher_code',
      400,
      'Please enter a valid code.',
    );
  }

  const codeHash = hashCode(raw);

  return runSerializable(async (tx) => {
    await assertPatientSubject(tx, {
      userId: args.userId,
      patientId: args.patientId,
    });

    const voucher =
      await tx.voucherCode.findUnique({
        where: { codeHash },
      });

    if (!voucher || !voucher.active) {
      throw new PatientPlanWriterError(
        'invalid_voucher_code',
        404,
        'Invalid code.',
      );
    }

    const now = new Date();

    if (
      voucher.validFrom &&
      now.getTime() <
        voucher.validFrom.getTime()
    ) {
      throw new PatientPlanWriterError(
        'voucher_not_active',
        400,
        'This code is not active yet.',
      );
    }

    if (
      voucher.expiresAt &&
      now.getTime() >
        voucher.expiresAt.getTime()
    ) {
      throw new PatientPlanWriterError(
        'voucher_expired',
        400,
        'This code has expired.',
      );
    }

    if (voucher.kind === 'FREE_CONSULT') {
      throw new PatientPlanWriterError(
        'voucher_appointment_only',
        400,
        'This voucher is appointment-only. Apply it during appointment booking.',
      );
    }

    const priorRedemption =
      await tx.voucherRedemption.findFirst({
        where: {
          voucherId: voucher.id,
          userId: args.userId,
        },
        select: { id: true },
      });

    if (priorRedemption) {
      throw new PatientPlanWriterError(
        'voucher_already_redeemed',
        409,
        'This voucher has already been redeemed on this account.',
      );
    }

    const claimed =
      await tx.voucherCode.updateMany({
        where: {
          id: voucher.id,
          active: true,
          usedCount: {
            lt: voucher.maxUses,
          },
        },
        data: {
          usedCount: {
            increment: 1,
          },
        },
      });

    if (claimed.count !== 1) {
      throw new PatientPlanWriterError(
        'voucher_usage_exhausted',
        400,
        'This code has already been used.',
      );
    }

    const wallet =
      await getOrCreateWalletTx(
        tx,
        args.userId,
      );

    const credited =
      Math.max(
        0,
        Math.trunc(voucher.valueZar),
      );

    const creditEntry =
      await tx.walletEntry.create({
        data: {
          accountId: wallet.id,
          kind: 'CREDIT',
          scope: null,
          amountZar: credited,
          currency: 'ZAR',
          sponsorType: voucher.sponsorType,
          sponsorId: voucher.sponsorId,
          voucherId: voucher.id,
          txRef: null,
          meta: {
            kind: voucher.kind,
            codeLast4: voucher.codeLast4,
          },
          orgId: wallet.orgId,
        },
      });

    await tx.walletAccount.update({
      where: { id: wallet.id },
      data: {
        balanceZar: {
          increment: credited,
        },
      },
    });

    const redemption =
      await tx.voucherRedemption.create({
        data: {
          voucherId: voucher.id,
          userId: args.userId,
          creditedZar: credited,
          walletEntryId: creditEntry.id,
          meta: {
            codeLast4: voucher.codeLast4,
          },
          orgId: voucher.orgId,
        },
      });

    const constraints =
      (
        voucher.constraints &&
        typeof voucher.constraints === 'object' &&
        !Array.isArray(voucher.constraints)
      )
        ? (voucher.constraints as Record<string, unknown>)
        : {};

    const autoApply =
      Boolean(constraints.autoApply);

    const target =
      normalizePlan(
        constraints.planTarget,
      );

    const cycle =
      normalizeCycle(
        constraints.cycle,
      );

    const entitlement =
      await tx.patientPlanEntitlement.findUnique({
        where: {
          patientId: args.patientId,
        },
      });

    const currentPlan =
      effectivePlanFromRow(
        entitlement,
        now,
      );

    let effect: RedeemResult['effect'] =
      'credit_saved';

    let message =
      `Credit saved. ${formatZar(credited)} was added to your wallet.`;

    let upgradedPlan:
      | Exclude<Plan, 'free'>
      | undefined;

    if (
      voucher.kind === 'PLAN_INTENT' &&
      autoApply &&
      target &&
      target !== 'free' &&
      canAutoUpgrade(
        currentPlan,
        target,
      )
    ) {
      const cost =
        planCostZar(
          target,
          cycle,
        );

      const walletAfterCredit =
        await tx.walletAccount.findUnique({
          where: { id: wallet.id },
        });

      if (!walletAfterCredit) {
        throw new PatientPlanWriterError(
          'wallet_not_found',
          500,
        );
      }

      const availableZar =
        Math.max(
          0,
          walletAfterCredit.balanceZar -
            walletAfterCredit.heldZar,
        );

      if (
        cost > 0 &&
        availableZar >= cost
      ) {
        const txRef =
          `redeem:${voucher.id}:${redemption.id}`;

        const hold =
          await tx.walletHold.create({
            data: {
              accountId: wallet.id,
              scope: 'PLAN',
              amountZar: cost,
              currency: 'ZAR',
              status: 'CAPTURED',
              txRef,
              refType: 'plan',
              refId: `${target}:${cycle}`,
              orgId: wallet.orgId,
            },
          });

        await tx.walletAccount.update({
          where: { id: wallet.id },
          data: {
            balanceZar: {
              decrement: cost,
            },
          },
        });

        await tx.walletEntry.create({
          data: {
            accountId: wallet.id,
            kind: 'DEBIT',
            scope: 'PLAN',
            amountZar: -cost,
            currency: 'ZAR',
            holdId: hold.id,
            txRef,
            refType: 'plan',
            refId: `${target}:${cycle}`,
            meta: {
              reason: 'auto_apply_plan',
              voucherId: voucher.id,
              redemptionId: redemption.id,
            },
            orgId: wallet.orgId,
          },
        });

        await applyPlanEntitlementTx({
          tx,
          patientId: args.patientId,
          plan: target,
          cycle,
          sourceType: 'voucher_plan_intent',
          sourceRef: redemption.id,
          idempotencyKey:
            `voucher-plan:${redemption.id}`,
          orgId: wallet.orgId,
          metadata: {
            voucherId: voucher.id,
            redemptionId: redemption.id,
            walletHoldId: hold.id,
            paidZar: cost,
          },
        });

        effect = 'upgraded';
        upgradedPlan = target;

        const remaining =
          Math.max(
            0,
            availableZar - cost,
          );

        message =
          `Upgraded. ${target.toUpperCase()} is now active. ` +
          `Wallet remaining: ${formatZar(remaining)}.`;
      } else {
        message =
          `Credit saved. Wallet funded with ${formatZar(credited)} — ` +
          'you can use it to upgrade at any time.';
      }
    } else if (
      voucher.kind === 'PLAN_INTENT' &&
      autoApply &&
      target &&
      target !== 'free' &&
      !canAutoUpgrade(
        currentPlan,
        target,
      )
    ) {
      message =
        `Credit saved. You already have ${currentPlan.toUpperCase()} — ` +
        `your wallet was funded with ${formatZar(credited)} for future use.`;
    }

    return {
      redeemed: {
        code: `****${voucher.codeLast4}`,
        valueZar: credited,
        ...(upgradedPlan
          ? { plan: upgradedPlan }
          : {}),
      },
      effect,
      message,
      allowShopSpend: true,
    };
  });
}