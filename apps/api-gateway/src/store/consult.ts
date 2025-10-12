import { prisma } from '@/src/lib/db';

export type AdminPolicy = {
  minStandardMinutes: number;
  minFollowupMinutes: number;
  bufferAfterMinutes: number;
  joinGracePatientMin: number;
  joinGraceClinicianMin: number;

  // NEW: Refund minima
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

const DEFAULT_CLIN: ClinicianConsult = {
  defaultStandardMin: 45,
  defaultFollowupMin: 20,
  minAdvanceMinutes: 30,
  maxAdvanceDays: 30,
};

const DEFAULT_REFUNDS: ClinicianRefunds = {
  within24hPercent: 50,
  noShowPercent: 0,
  clinicianMissPercent: 100,
  networkProrate: true,
};

export async function getAdminPolicy(): Promise<AdminPolicy> {
  const row = await prisma.adminConsultPolicy.findUnique({ where: { id: 'singleton' } });
  if (!row) return DEFAULT_ADMIN;
  return {
    minStandardMinutes: row.minStandardMinutes,
    minFollowupMinutes: row.minFollowupMinutes,
    bufferAfterMinutes: row.bufferAfterMinutes,
    joinGracePatientMin: row.joinGracePatientMin,
    joinGraceClinicianMin: row.joinGraceClinicianMin,
    minCancel24hRefund: row.minCancel24hRefund,
    minNoShowRefund: row.minNoShowRefund,
    minClinicianMissRefund: row.minClinicianMissRefund,
  };
}

export async function setAdminPolicy(p: AdminPolicy) {
  await prisma.adminConsultPolicy.upsert({
    where: { id: 'singleton' },
    update: { ...p },
    create: { id: 'singleton', ...p },
  });
}

export async function getClinicianConsult(userId: string): Promise<ClinicianConsult> {
  const row = await prisma.clinicianConsultSettings.findUnique({ where: { userId } });
  if (!row) return DEFAULT_CLIN;
  return {
    defaultStandardMin: row.defaultStandardMin,
    defaultFollowupMin: row.defaultFollowupMin,
    minAdvanceMinutes: row.minAdvanceMinutes,
    maxAdvanceDays: row.maxAdvanceDays,
  };
}

export async function setClinicianConsult(userId: string, c: ClinicianConsult, admin: AdminPolicy) {
  // enforce admin minima
  const safeStandard = Math.max(c.defaultStandardMin, admin.minStandardMinutes);
  const safeFollowup = Math.max(c.defaultFollowupMin, admin.minFollowupMinutes);

  await prisma.clinicianConsultSettings.upsert({
    where: { userId },
    update: {
      defaultStandardMin: safeStandard,
      defaultFollowupMin: safeFollowup,
      minAdvanceMinutes: c.minAdvanceMinutes,
      maxAdvanceDays: c.maxAdvanceDays,
    },
    create: {
      userId,
      defaultStandardMin: safeStandard,
      defaultFollowupMin: safeFollowup,
      minAdvanceMinutes: c.minAdvanceMinutes,
      maxAdvanceDays: c.maxAdvanceDays,
    },
  });
}

export async function getClinicianRefunds(userId: string): Promise<ClinicianRefunds> {
  const row = await prisma.clinicianRefundPolicy.findUnique({ where: { userId } });
  if (!row) return DEFAULT_REFUNDS;
  return {
    within24hPercent: row.within24hPercent,
    noShowPercent: row.noShowPercent,
    clinicianMissPercent: row.clinicianMissPercent,
    networkProrate: row.networkProrate,
  };
}

export async function setClinicianRefunds(userId: string, r: ClinicianRefunds, admin: AdminPolicy) {
  const clamp = (n: number, min: number) => Math.max(min, Math.min(100, Math.round(n)));

  const safe = {
    within24hPercent: clamp(r.within24hPercent, admin.minCancel24hRefund),
    noShowPercent: clamp(r.noShowPercent, admin.minNoShowRefund),
    clinicianMissPercent: clamp(r.clinicianMissPercent, admin.minClinicianMissRefund),
    networkProrate: !!r.networkProrate,
  };

  await prisma.clinicianRefundPolicy.upsert({
    where: { userId },
    update: safe,
    create: { userId, ...safe },
  });
}
