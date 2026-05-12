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

function adminPolicyDelegate() {
  return (prisma as any).adminConsultPolicy;
}

function clinicianConsultSettingsDelegate() {
  return (prisma as any).clinicianConsultSettings;
}

function clinicianRefundPolicyDelegate() {
  return (prisma as any).clinicianRefundPolicy;
}

export async function getAdminPolicy(): Promise<AdminPolicy> {
  const delegate = adminPolicyDelegate();

  if (!delegate?.findUnique) {
    return DEFAULT_ADMIN;
  }

  const row = await delegate.findUnique({
    where: { id: 'singleton' },
  });

  if (!row) return DEFAULT_ADMIN;

  return {
    minStandardMinutes: num(row.minStandardMinutes, DEFAULT_ADMIN.minStandardMinutes),
    minFollowupMinutes: num(row.minFollowupMinutes, DEFAULT_ADMIN.minFollowupMinutes),
    bufferAfterMinutes: num(row.bufferAfterMinutes, DEFAULT_ADMIN.bufferAfterMinutes),
    joinGracePatientMin: num(row.joinGracePatientMin, DEFAULT_ADMIN.joinGracePatientMin),
    joinGraceClinicianMin: num(row.joinGraceClinicianMin, DEFAULT_ADMIN.joinGraceClinicianMin),
    minCancel24hRefund: num(row.minCancel24hRefund, DEFAULT_ADMIN.minCancel24hRefund),
    minNoShowRefund: num(row.minNoShowRefund, DEFAULT_ADMIN.minNoShowRefund),
    minClinicianMissRefund: num(row.minClinicianMissRefund, DEFAULT_ADMIN.minClinicianMissRefund),
  };
}

export async function setAdminPolicy(policy: AdminPolicy): Promise<AdminPolicy> {
  const safe: AdminPolicy = {
    minStandardMinutes: num(policy.minStandardMinutes, DEFAULT_ADMIN.minStandardMinutes),
    minFollowupMinutes: num(policy.minFollowupMinutes, DEFAULT_ADMIN.minFollowupMinutes),
    bufferAfterMinutes: num(policy.bufferAfterMinutes, DEFAULT_ADMIN.bufferAfterMinutes),
    joinGracePatientMin: num(policy.joinGracePatientMin, DEFAULT_ADMIN.joinGracePatientMin),
    joinGraceClinicianMin: num(policy.joinGraceClinicianMin, DEFAULT_ADMIN.joinGraceClinicianMin),
    minCancel24hRefund: clampPercent(policy.minCancel24hRefund, DEFAULT_ADMIN.minCancel24hRefund),
    minNoShowRefund: clampPercent(policy.minNoShowRefund, DEFAULT_ADMIN.minNoShowRefund),
    minClinicianMissRefund: clampPercent(
      policy.minClinicianMissRefund,
      DEFAULT_ADMIN.minClinicianMissRefund,
    ),
  };

  const delegate = adminPolicyDelegate();

  if (!delegate?.upsert) {
    return safe;
  }

  await delegate.upsert({
    where: { id: 'singleton' },
    update: safe,
    create: {
      id: 'singleton',
      ...safe,
    },
  });

  return safe;
}

export async function saveAdminConsultSettings(
  input: Partial<AdminPolicy> & Record<string, any>,
): Promise<AdminPolicy> {
  const current = await getAdminPolicy();

  const next: AdminPolicy = {
    minStandardMinutes: num(input.minStandardMinutes, current.minStandardMinutes),
    minFollowupMinutes: num(input.minFollowupMinutes, current.minFollowupMinutes),
    bufferAfterMinutes: num(input.bufferAfterMinutes, current.bufferAfterMinutes),
    joinGracePatientMin: num(input.joinGracePatientMin, current.joinGracePatientMin),
    joinGraceClinicianMin: num(input.joinGraceClinicianMin, current.joinGraceClinicianMin),
    minCancel24hRefund: clampPercent(
      input.minCancel24hRefund,
      current.minCancel24hRefund,
    ),
    minNoShowRefund: clampPercent(
      input.minNoShowRefund,
      current.minNoShowRefund,
    ),
    minClinicianMissRefund: clampPercent(
      input.minClinicianMissRefund,
      current.minClinicianMissRefund,
    ),
  };

  return setAdminPolicy(next);
}

export async function getClinicianConsult(userId: string): Promise<ClinicianConsult> {
  const delegate = clinicianConsultSettingsDelegate();

  if (!delegate?.findUnique) {
    return DEFAULT_CLINICIAN_CONSULT;
  }

  const row = await delegate.findUnique({
    where: { userId },
  });

  if (!row) return DEFAULT_CLINICIAN_CONSULT;

  return {
    defaultStandardMin: num(
      row.defaultStandardMin,
      DEFAULT_CLINICIAN_CONSULT.defaultStandardMin,
    ),
    defaultFollowupMin: num(
      row.defaultFollowupMin,
      DEFAULT_CLINICIAN_CONSULT.defaultFollowupMin,
    ),
    minAdvanceMinutes: num(
      row.minAdvanceMinutes,
      DEFAULT_CLINICIAN_CONSULT.minAdvanceMinutes,
    ),
    maxAdvanceDays: num(
      row.maxAdvanceDays,
      DEFAULT_CLINICIAN_CONSULT.maxAdvanceDays,
    ),
  };
}

export async function setClinicianConsult(
  userId: string,
  consult: ClinicianConsult,
  adminPolicy?: AdminPolicy,
): Promise<ClinicianConsult> {
  const admin = adminPolicy ?? (await getAdminPolicy());

  const safe: ClinicianConsult = {
    defaultStandardMin: Math.max(
      num(consult.defaultStandardMin, DEFAULT_CLINICIAN_CONSULT.defaultStandardMin),
      admin.minStandardMinutes,
    ),
    defaultFollowupMin: Math.max(
      num(consult.defaultFollowupMin, DEFAULT_CLINICIAN_CONSULT.defaultFollowupMin),
      admin.minFollowupMinutes,
    ),
    minAdvanceMinutes: num(
      consult.minAdvanceMinutes,
      DEFAULT_CLINICIAN_CONSULT.minAdvanceMinutes,
    ),
    maxAdvanceDays: num(
      consult.maxAdvanceDays,
      DEFAULT_CLINICIAN_CONSULT.maxAdvanceDays,
    ),
  };

  const delegate = clinicianConsultSettingsDelegate();

  if (!delegate?.upsert) {
    return safe;
  }

  await delegate.upsert({
    where: { userId },
    update: safe,
    create: {
      userId,
      ...safe,
    },
  });

  return safe;
}

export async function getClinicianRefunds(userId: string): Promise<ClinicianRefunds> {
  const delegate = clinicianRefundPolicyDelegate();

  if (!delegate?.findUnique) {
    return DEFAULT_CLINICIAN_REFUNDS;
  }

  const row = await delegate.findUnique({
    where: { userId },
  });

  if (!row) return DEFAULT_CLINICIAN_REFUNDS;

  return {
    within24hPercent: clampPercent(
      row.within24hPercent,
      DEFAULT_CLINICIAN_REFUNDS.within24hPercent,
    ),
    noShowPercent: clampPercent(
      row.noShowPercent,
      DEFAULT_CLINICIAN_REFUNDS.noShowPercent,
    ),
    clinicianMissPercent: clampPercent(
      row.clinicianMissPercent,
      DEFAULT_CLINICIAN_REFUNDS.clinicianMissPercent,
    ),
    networkProrate:
      typeof row.networkProrate === 'boolean'
        ? row.networkProrate
        : DEFAULT_CLINICIAN_REFUNDS.networkProrate,
  };
}

export async function setClinicianRefunds(
  userId: string,
  refunds: ClinicianRefunds,
  adminPolicy?: AdminPolicy,
): Promise<ClinicianRefunds> {
  const admin = adminPolicy ?? (await getAdminPolicy());

  const safe: ClinicianRefunds = {
    within24hPercent: clampPercent(
      refunds.within24hPercent,
      DEFAULT_CLINICIAN_REFUNDS.within24hPercent,
      admin.minCancel24hRefund,
    ),
    noShowPercent: clampPercent(
      refunds.noShowPercent,
      DEFAULT_CLINICIAN_REFUNDS.noShowPercent,
      admin.minNoShowRefund,
    ),
    clinicianMissPercent: clampPercent(
      refunds.clinicianMissPercent,
      DEFAULT_CLINICIAN_REFUNDS.clinicianMissPercent,
      admin.minClinicianMissRefund,
    ),
    networkProrate: Boolean(refunds.networkProrate),
  };

  const delegate = clinicianRefundPolicyDelegate();

  if (!delegate?.upsert) {
    return safe;
  }

  await delegate.upsert({
    where: { userId },
    update: safe,
    create: {
      userId,
      ...safe,
    },
  });

  return safe;
}