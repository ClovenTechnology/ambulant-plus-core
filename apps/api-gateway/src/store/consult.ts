// apps/api-gateway/src/store/consult.ts
import { prisma } from '@/src/lib/db';

export type AdminPolicy = {
  minStandardMinutes: number;
  minFollowupMinutes: number;
  bufferAfterMinutes: number;
  joinGracePatientMin: number;
  joinGraceClinicianMin: number;

  minCancel24hRefund: number;
  minNoShowRefund: number;
  minClinicianMissRefund: number;
};

export type ClinicianConsult = {
  defaultStandardMin: number;
  defaultFollowupMin: number;
  minAdvanceMinutes: number;
  maxAdvanceDays: number;
};

export type ClinicianRefunds = {
  within24hPercent: number;
  noShowPercent: number;
  clinicianMissPercent: number;
  networkProrate: boolean;
};

const DEFAULT_ADMIN: AdminPolicy = {
  minStandardMinutes: 30,
  minFollowupMinutes: 15,
  bufferAfterMinutes: 5,
  joinGracePatientMin: 5,
  joinGraceClinicianMin: 5,
  minCancel24hRefund: 50,
  minNoShowRefund: 0,
  minClinicianMissRefund: 100,
};

const DEFAULT_CLINICIAN_CONSULT: ClinicianConsult = {
  defaultStandardMin: 45,
  defaultFollowupMin: 20,
  minAdvanceMinutes: 30,
  maxAdvanceDays: 30,
};

const DEFAULT_CLINICIAN_REFUNDS: ClinicianRefunds = {
  within24hPercent: 50,
  noShowPercent: 0,
  clinicianMissPercent: 100,
  networkProrate: true,
};

function num(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clampPercent(value: unknown, fallback: number, min = 0): number {
  const n = num(value, fallback);
  return Math.max(min, Math.min(100, Math.round(n)));
}

function parseObject(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

function adminPolicyDelegate() {
  return (prisma as any).adminConsultPolicy;
}

function clinicianConsultSettingsDelegate() {
  return (prisma as any).clinicianConsultSettings;
}

function clinicianRefundPolicyDelegate() {
  return (prisma as any).clinicianRefundPolicy;
}

async function clinicianProfileByUserId(userId: string) {
  return (prisma as any).clinicianProfile?.findFirst?.({
    where: {
      OR: [
        { userId },
        { id: userId },
        { email: userId },
      ],
    },
    orderBy: { createdAt: 'desc' },
  });
}

function profileJson(clinician: any): { meta: Record<string, any>; profile: Record<string, any> } {
  const meta = parseObject(clinician?.meta);
  const profile =
    meta.rawProfile && typeof meta.rawProfile === 'object'
      ? meta.rawProfile
      : typeof meta.rawProfileJson === 'string'
        ? parseObject(meta.rawProfileJson)
        : meta;

  return { meta, profile };
}

async function updateClinicianProfileMeta(userId: string, patch: Record<string, any>) {
  const clinician = await clinicianProfileByUserId(userId);
  if (!clinician?.id) return false;

  const { meta, profile } = profileJson(clinician);
  const nextProfile = {
    ...profile,
    ...patch,
  };

  const nextMeta = {
    ...meta,
    rawProfile: nextProfile,
    rawProfileJson: JSON.stringify(nextProfile),
  };

  await (prisma as any).clinicianProfile.update({
    where: { id: clinician.id },
    data: { meta: nextMeta as any },
  });

  return true;
}

function safeAdmin(input: Partial<AdminPolicy> = {}): AdminPolicy {
  return {
    minStandardMinutes: num(input.minStandardMinutes, DEFAULT_ADMIN.minStandardMinutes),
    minFollowupMinutes: num(input.minFollowupMinutes, DEFAULT_ADMIN.minFollowupMinutes),
    bufferAfterMinutes: num(input.bufferAfterMinutes, DEFAULT_ADMIN.bufferAfterMinutes),
    joinGracePatientMin: num(input.joinGracePatientMin, DEFAULT_ADMIN.joinGracePatientMin),
    joinGraceClinicianMin: num(input.joinGraceClinicianMin, DEFAULT_ADMIN.joinGraceClinicianMin),
    minCancel24hRefund: clampPercent(input.minCancel24hRefund, DEFAULT_ADMIN.minCancel24hRefund),
    minNoShowRefund: clampPercent(input.minNoShowRefund, DEFAULT_ADMIN.minNoShowRefund),
    minClinicianMissRefund: clampPercent(
      input.minClinicianMissRefund,
      DEFAULT_ADMIN.minClinicianMissRefund,
    ),
  };
}

function safeConsult(input: Partial<ClinicianConsult>, admin: AdminPolicy): ClinicianConsult {
  return {
    defaultStandardMin: Math.max(
      num(input.defaultStandardMin, DEFAULT_CLINICIAN_CONSULT.defaultStandardMin),
      admin.minStandardMinutes,
    ),
    defaultFollowupMin: Math.max(
      num(input.defaultFollowupMin, DEFAULT_CLINICIAN_CONSULT.defaultFollowupMin),
      admin.minFollowupMinutes,
    ),
    minAdvanceMinutes: num(input.minAdvanceMinutes, DEFAULT_CLINICIAN_CONSULT.minAdvanceMinutes),
    maxAdvanceDays: num(input.maxAdvanceDays, DEFAULT_CLINICIAN_CONSULT.maxAdvanceDays),
  };
}

function safeRefunds(input: Partial<ClinicianRefunds>, admin: AdminPolicy): ClinicianRefunds {
  return {
    within24hPercent: clampPercent(
      input.within24hPercent,
      DEFAULT_CLINICIAN_REFUNDS.within24hPercent,
      admin.minCancel24hRefund,
    ),
    noShowPercent: clampPercent(
      input.noShowPercent,
      DEFAULT_CLINICIAN_REFUNDS.noShowPercent,
      admin.minNoShowRefund,
    ),
    clinicianMissPercent: clampPercent(
      input.clinicianMissPercent,
      DEFAULT_CLINICIAN_REFUNDS.clinicianMissPercent,
      admin.minClinicianMissRefund,
    ),
    networkProrate:
      typeof input.networkProrate === 'boolean'
        ? input.networkProrate
        : DEFAULT_CLINICIAN_REFUNDS.networkProrate,
  };
}

export async function getAdminPolicy(): Promise<AdminPolicy> {
  const delegate = adminPolicyDelegate();

  if (!delegate?.findUnique) {
    return DEFAULT_ADMIN;
  }

  try {
    const row = await delegate.findUnique({
      where: { id: 'singleton' },
    });

    if (!row) return DEFAULT_ADMIN;
    return safeAdmin(row);
  } catch (err: any) {
    console.error('[consult-store] getAdminPolicy failed; using defaults', err);
    return DEFAULT_ADMIN;
  }
}

export async function setAdminPolicy(policy: AdminPolicy): Promise<AdminPolicy> {
  const safe = safeAdmin(policy);
  const delegate = adminPolicyDelegate();

  if (!delegate?.upsert) {
    throw new Error('adminConsultPolicy_delegate_missing');
  }

  try {
    await delegate.upsert({
      where: { id: 'singleton' },
      update: safe,
      create: {
        id: 'singleton',
        ...safe,
      },
    });

    return safe;
  } catch (err: any) {
    console.error('[consult-store] setAdminPolicy failed', err);
    throw new Error(err?.message || 'admin_consult_policy_persist_failed');
  }
}

export async function saveAdminConsultSettings(
  input: Partial<AdminPolicy> & Record<string, any>,
): Promise<AdminPolicy> {
  const current = await getAdminPolicy();

  const next = safeAdmin({
    minStandardMinutes: input.minStandardMinutes ?? current.minStandardMinutes,
    minFollowupMinutes: input.minFollowupMinutes ?? current.minFollowupMinutes,
    bufferAfterMinutes: input.bufferAfterMinutes ?? current.bufferAfterMinutes,
    joinGracePatientMin: input.joinGracePatientMin ?? current.joinGracePatientMin,
    joinGraceClinicianMin: input.joinGraceClinicianMin ?? current.joinGraceClinicianMin,
    minCancel24hRefund: input.minCancel24hRefund ?? current.minCancel24hRefund,
    minNoShowRefund: input.minNoShowRefund ?? current.minNoShowRefund,
    minClinicianMissRefund: input.minClinicianMissRefund ?? current.minClinicianMissRefund,
  });

  return setAdminPolicy(next);
}

export async function getClinicianConsult(userId: string): Promise<ClinicianConsult> {
  const admin = await getAdminPolicy();
  const delegate = clinicianConsultSettingsDelegate();

  if (delegate?.findUnique) {
    try {
      const row = await delegate.findUnique({
        where: { userId },
      });

      if (row) {
        return safeConsult(row, admin);
      }
    } catch (err: any) {
      console.error('[consult-store] getClinicianConsult dedicated table failed; falling back to meta', err);
    }
  }

  try {
    const clinician = await clinicianProfileByUserId(userId);
    const { profile } = profileJson(clinician);
    const stored = parseObject(profile.consultSettings);

    return safeConsult(
      {
        defaultStandardMin:
          stored.defaultStandardMin ??
          stored.defaultMinutes ??
          profile.defaultStandardMin ??
          profile.defaultMinutes,
        defaultFollowupMin:
          stored.defaultFollowupMin ??
          stored.followupMinutes ??
          profile.defaultFollowupMin ??
          profile.followupMinutes,
        minAdvanceMinutes:
          stored.minAdvanceMinutes ??
          profile.minAdvanceMinutes,
        maxAdvanceDays:
          stored.maxAdvanceDays ??
          profile.maxAdvanceDays,
      },
      admin,
    );
  } catch (err: any) {
    console.error('[consult-store] getClinicianConsult meta fallback failed; using defaults', err);
    return safeConsult(DEFAULT_CLINICIAN_CONSULT, admin);
  }
}

export async function setClinicianConsult(
  userId: string,
  consult: ClinicianConsult,
  adminPolicy?: AdminPolicy,
): Promise<ClinicianConsult> {
  const admin = adminPolicy ?? (await getAdminPolicy());
  const safe = safeConsult(consult, admin);
  const delegate = clinicianConsultSettingsDelegate();

  let dedicatedSaved = false;

  if (delegate?.upsert) {
    try {
      await delegate.upsert({
        where: { userId },
        update: safe,
        create: {
          userId,
          ...safe,
        },
      });
      dedicatedSaved = true;
    } catch (err: any) {
      console.error('[consult-store] setClinicianConsult dedicated table failed; falling back to meta', err);
    }
  }

  await updateClinicianProfileMeta(userId, {
    consultSettings: {
      defaultMinutes: safe.defaultStandardMin,
      defaultStandardMin: safe.defaultStandardMin,
      followupMinutes: safe.defaultFollowupMin,
      defaultFollowupMin: safe.defaultFollowupMin,
      minAdvanceMinutes: safe.minAdvanceMinutes,
      maxAdvanceDays: safe.maxAdvanceDays,
    },
  });

  if (!dedicatedSaved) {
    console.warn('[consult-store] clinician consult settings saved to profile meta fallback only');
  }

  return safe;
}

export async function getClinicianRefunds(userId: string): Promise<ClinicianRefunds> {
  const admin = await getAdminPolicy();
  const delegate = clinicianRefundPolicyDelegate();

  if (delegate?.findUnique) {
    try {
      const row = await delegate.findUnique({
        where: { userId },
      });

      if (row) return safeRefunds(row, admin);
    } catch (err: any) {
      console.error('[consult-store] getClinicianRefunds dedicated table failed; falling back to meta', err);
    }
  }

  try {
    const clinician = await clinicianProfileByUserId(userId);
    const { profile } = profileJson(clinician);
    const stored = parseObject(profile.refundSettings || profile.refunds || profile.refundPolicy);

    return safeRefunds(stored, admin);
  } catch (err: any) {
    console.error('[consult-store] getClinicianRefunds meta fallback failed; using defaults', err);
    return safeRefunds(DEFAULT_CLINICIAN_REFUNDS, admin);
  }
}

export async function setClinicianRefunds(
  userId: string,
  refunds: ClinicianRefunds,
  adminPolicy?: AdminPolicy,
): Promise<ClinicianRefunds> {
  const admin = adminPolicy ?? (await getAdminPolicy());
  const safe = safeRefunds(refunds, admin);
  const delegate = clinicianRefundPolicyDelegate();

  let dedicatedSaved = false;

  if (delegate?.upsert) {
    try {
      await delegate.upsert({
        where: { userId },
        update: safe,
        create: {
          userId,
          ...safe,
        },
      });
      dedicatedSaved = true;
    } catch (err: any) {
      console.error('[consult-store] setClinicianRefunds dedicated table failed; falling back to meta', err);
    }
  }

  await updateClinicianProfileMeta(userId, {
    refundSettings: safe,
  });

  if (!dedicatedSaved) {
    console.warn('[consult-store] clinician refund policy saved to profile meta fallback only');
  }

  return safe;
}
