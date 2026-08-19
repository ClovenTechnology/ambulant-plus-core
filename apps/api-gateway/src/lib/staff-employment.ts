import crypto, { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { AdminStaffActor } from '@/src/lib/admin-staff-auth';
import { hasStaffCapability } from '@/src/lib/admin-staff-policy';
import { createPaystackTransferRecipient } from '@/src/payments/paystack-transfers';
import { reconcileOverdueSalaryArrears } from '@/src/lib/staff-payroll-arrears';
import {
  ApplicationDocumentStorageError,
  deleteApplicationDocument,
  headApplicationDocument,
  presignApplicationDocumentDownload,
  presignApplicationDocumentUpload,
  safeApplicationDocumentFileName,
  verifyApplicationDocumentSignature,
} from '@/src/lib/application-documents-storage';
import {
  deleteEnterpriseMedia,
  enterpriseMediaErrorResponse,
  enterpriseMediaObjectBelongsTo,
  enterpriseMediaObjectKey,
  enterpriseMediaStorageStatus,
  getEnterpriseMediaObject,
  managedEnterpriseMediaRef,
  objectKeyFromManagedEnterpriseMediaRef,
  presignEnterpriseMediaUpload,
  validateEnterpriseMediaUploadInput,
  verifyEnterpriseMediaUpload,
} from '@/src/lib/enterprise-media-storage';

const MAX_EMPLOYMENT_DOCUMENT_BYTES = 15 * 1024 * 1024;
const EMPLOYMENT_DOCUMENT_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

export class StaffEmploymentError extends Error {
  status: number;
  detail?: unknown;
  constructor(message: string, status = 400, detail?: unknown) {
    super(message);
    this.name = 'StaffEmploymentError';
    this.status = status;
    this.detail = detail;
  }
}

function clean(value: unknown, max = 240) {
  const text = String(value ?? '').trim();
  return text ? text.slice(0, max) : null;
}

function cents(value: unknown) {
  const numeric = Math.round(Number(value) || 0);
  return Math.max(0, Math.min(numeric, 2_000_000_000));
}

function dateOrNull(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isFinite(date.getTime()) ? date : null;
}

function jsonObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function canManageEmployment(actor: AdminStaffActor) {
  return actor.isSuperAdmin || hasStaffCapability(actor, 'staff.manage');
}

function canReadCompensation(actor: AdminStaffActor, staffProfileId: string) {
  return (
    actor.profileId === staffProfileId ||
    canManageEmployment(actor) ||
    actor.scopes.includes('finance.read') ||
    actor.scopes.includes('finance.payouts.run') ||
    actor.scopes.includes('finance.payouts.approve')
  );
}

async function requireStaffTarget(actor: AdminStaffActor, staffProfileId: string) {
  const profile = await prisma.adminUserProfile.findUnique({
    where: { id: staffProfileId },
    select: {
      id: true,
      userId: true,
      name: true,
      email: true,
      phone: true,
      staffIdentifier: true,
      photoUrl: true,
      departmentId: true,
      designationId: true,
      managerId: true,
      createdAt: true,
      department: { select: { id: true, name: true } },
      designation: { select: { id: true, name: true } },
      manager: { select: { id: true, name: true, email: true } },
    },
  });
  if (!profile) throw new StaffEmploymentError('staff_not_found', 404);
  if (actor.profileId !== profile.id && !canManageEmployment(actor) && !actor.scopes.includes('finance.read')) {
    throw new StaffEmploymentError('staff_employment_access_denied', 403);
  }
  return profile;
}

function bankEncryptionSecret() {
  const secret = String(
    process.env.STAFF_BANK_ENCRYPTION_KEY ||
      process.env.PAYOUT_BANK_ENCRYPTION_KEY ||
      process.env.AUTH_SESSION_SECRET ||
      '',
  ).trim();
  if (!secret) throw new StaffEmploymentError('staff_bank_encryption_not_configured', 503);
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptStaffBankAccountNumber(accountNumber: string) {
  const key = bankEncryptionSecret();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(accountNumber, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`;
}

export function decryptStaffBankAccountNumber(value: string) {
  const [version, ivText, tagText, encryptedText] = String(value || '').split(':');
  if (version !== 'v1' || !ivText || !tagText || !encryptedText) {
    throw new StaffEmploymentError('staff_bank_encrypted_value_invalid', 500);
  }
  const key = bankEncryptionSecret();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

function maskAccountNumber(value: string) {
  const digits = value.replace(/\s+/g, '');
  return digits.length <= 4 ? `•••• ${digits}` : `•••• •••• ${digits.slice(-4)}`;
}

export async function readPrimaryStaffBankAccountNumber(staffUserId: string) {
  const account = await prisma.staffBankAccount.findFirst({
    where: { staffUserId, active: true, isPrimary: true },
    orderBy: { updatedAt: 'desc' },
  });
  if (!account?.accountNumberEncrypted) return null;
  return { account, accountNumber: decryptStaffBankAccountNumber(account.accountNumberEncrypted) };
}

function serializePayrollProfile(profile: any, includeCompensation: boolean) {
  if (!profile) return null;
  return {
    id: profile.id,
    staffUserId: profile.staffUserId,
    employmentType: profile.employmentType,
    payrollStatus: profile.payrollStatus,
    country: profile.country,
    currency: profile.currency,
    ...(includeCompensation
      ? {
          baseSalaryCents: profile.baseSalaryCents,
          hourlyRateCents: profile.hourlyRateCents,
          defaultHoursPerPeriod: profile.defaultHoursPerPeriod,
          payFrequency: profile.payFrequency,
          commissionEligible: profile.commissionEligible,
          commissionMode: profile.commissionMode,
          taxNumber: profile.taxNumber,
          payrollNumber: profile.payrollNumber,
          employerReference: profile.employerReference,
        }
      : {}),
    startDate: profile.startDate,
    endDate: profile.endDate,
    profileMeta: profile.profileMeta,
    payrollMeta: includeCompensation ? profile.payrollMeta : null,
    approvalStatus: profile.approvalStatus,
    approvedAt: profile.approvedAt,
    updatedAt: profile.updatedAt,
  };
}


type StaffWorkspaceWarning = {
  dataset: string;
  code:
    | 'schema_not_ready'
    | 'read_failed';
};

function staffWorkspaceWarningCode(
  error: unknown,
): StaffWorkspaceWarning['code'] {
  const code =
    String(
      (error as any)?.code ||
      '',
    ).trim();

  return (
    code === 'P2021' ||
    code === 'P2022'
  )
    ? 'schema_not_ready'
    : 'read_failed';
}

async function safeWorkspaceRead<T>(input: {
  dataset: string;
  read: () => Promise<T>;
  fallback: T;
  warnings: StaffWorkspaceWarning[];
  staffProfileId: string;
  staffUserId: string;
}) {
  try {
    return await input.read();
  } catch (error) {
    const warning = {
      dataset:
        input.dataset,
      code:
        staffWorkspaceWarningCode(
          error,
        ),
    } satisfies StaffWorkspaceWarning;

    input.warnings.push(
      warning,
    );

    console.error(
      '[staff employment] workspace dataset unavailable',
      {
        staffProfileId:
          input.staffProfileId,
        staffUserId:
          input.staffUserId,
        dataset:
          input.dataset,
        warningCode:
          warning.code,
        error,
      },
    );

    return input.fallback;
  }
}


export async function getStaffEmploymentWorkspace(input: {
  actor: AdminStaffActor;
  staffProfileId: string;
}) {
  const target = await requireStaffTarget(input.actor, input.staffProfileId);
  const self = input.actor.profileId === target.id;
  const canManage = canManageEmployment(input.actor);
  const canReadPay = canReadCompensation(input.actor, target.id);

  let arrearsReconciliation: any = null;
  let arrearsReconciliationWarning: string | null = null;

  if (canReadPay) {
    try {
      arrearsReconciliation = await reconcileOverdueSalaryArrears({
        staffUserId: target.userId,
      });
    } catch (error) {
      arrearsReconciliationWarning = 'salary_arrears_reconciliation_failed';
      console.error(
        '[staff employment] salary arrears reconciliation failed; loading persisted workspace',
        { staffProfileId: target.id, staffUserId: target.userId, error },
      );
    }
  }

  const workspaceWarnings: StaffWorkspaceWarning[] = [];

  const [payrollProfile, bankAccounts, documents, changes, leave, payslips, arrears, activeTemplate] = await Promise.all([
    safeWorkspaceRead({
      dataset: 'payroll_profile',
      read: () =>
        prisma.staffPayrollProfile.findFirst({
          where: { staffUserId: target.userId },
          orderBy: { updatedAt: 'desc' },
        }),
      fallback: null,
      warnings: workspaceWarnings,
      staffProfileId: target.id,
      staffUserId: target.userId,
    }),
    canReadPay
      ? safeWorkspaceRead({
          dataset: 'bank_accounts',
          read: () =>
            prisma.staffBankAccount.findMany({
              where: { staffUserId: target.userId, active: true },
              orderBy: [{ isPrimary: 'desc' }, { updatedAt: 'desc' }],
              select: {
                id: true,
                accountHolderName: true,
                bankName: true,
                bankCode: true,
                branchCode: true,
                accountNumberMasked: true,
                accountType: true,
                country: true,
                currency: true,
                paystackRecipientCode: true,
                verificationStatus: true,
                verificationProvider: true,
                verifiedAt: true,
                isPrimary: true,
                active: true,
                updatedAt: true,
              },
            }),
          fallback: [],
          warnings: workspaceWarnings,
          staffProfileId: target.id,
          staffUserId: target.userId,
        })
      : Promise.resolve([]),
    safeWorkspaceRead({
      dataset: 'employment_documents',
      read: () =>
        prisma.staffEmploymentDocument.findMany({
          where: { staffProfileId: target.id, state: 'active' },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            documentType: true,
            title: true,
            fileName: true,
            contentType: true,
            sizeBytes: true,
            effectiveAt: true,
            expiresAt: true,
            state: true,
            createdAt: true,
            uploadedByProfile: { select: { id: true, name: true, email: true } },
          },
        }),
      fallback: [],
      warnings: workspaceWarnings,
      staffProfileId: target.id,
      staffUserId: target.userId,
    }),
    safeWorkspaceRead({
      dataset: 'employment_changes',
      read: () =>
        prisma.staffEmploymentChange.findMany({
          where: { staffProfileId: target.id },
          orderBy: [{ effectiveAt: 'desc' }, { createdAt: 'desc' }],
          take: 100,
        }),
      fallback: [],
      warnings: workspaceWarnings,
      staffProfileId: target.id,
      staffUserId: target.userId,
    }),
    safeWorkspaceRead({
      dataset: 'leave_balances',
      read: () =>
        prisma.staffLeaveBalance.findMany({
          where: { staffProfileId: target.id },
          orderBy: [{ year: 'desc' }, { leaveType: 'asc' }],
        }),
      fallback: [],
      warnings: workspaceWarnings,
      staffProfileId: target.id,
      staffUserId: target.userId,
    }),
    canReadPay
      ? safeWorkspaceRead({
          dataset: 'payslips',
          read: () =>
            prisma.payslip.findMany({
              where: { staffUserId: target.userId },
              orderBy: { createdAt: 'desc' },
              take: 36,
            }),
          fallback: [],
          warnings: workspaceWarnings,
          staffProfileId: target.id,
          staffUserId: target.userId,
        })
      : Promise.resolve([]),
    canReadPay
      ? safeWorkspaceRead({
          dataset: 'salary_arrears',
          read: () =>
            prisma.staffArrearsLedger.findMany({
              where: { staffUserId: target.userId, status: { in: ['open', 'partial', 'overdue'] } },
              orderBy: [{ dueDate: 'asc' }, { effectiveAt: 'desc' }],
              take: 100,
            }),
          fallback: [],
          warnings: workspaceWarnings,
          staffProfileId: target.id,
          staffUserId: target.userId,
        })
      : Promise.resolve([]),
    safeWorkspaceRead({
      dataset: 'staff_id_template',
      read: () =>
        prisma.staffIdTemplate.findFirst({
          where: { active: true },
          orderBy: { updatedAt: 'desc' },
        }),
      fallback: null,
      warnings: workspaceWarnings,
      staffProfileId: target.id,
      staffUserId: target.userId,
    }),
  ]);

  return {
    ok: true,
    staff: target,
    payrollProfile: serializePayrollProfile(payrollProfile, canReadPay),
    bankAccounts,
    documents,
    employmentChanges: changes,
    leaveBalances: leave,
    payslips,
    arrears,
    arrearsReconciliation,
    arrearsReconciliationWarning,
    workspaceWarnings,
    staffId: {
      ready: Boolean(target.staffIdentifier),
      activeTemplate: activeTemplate ? { id: activeTemplate.id, name: activeTemplate.name, validityMonths: activeTemplate.validityMonths } : null,
      downloadUrl: target.staffIdentifier ? `/api/admin/staff/${encodeURIComponent(target.id)}/id-card` : null,
    },
    permissions: {
      self,
      canManageEmployment: canManage,
      canReadCompensation: canReadPay,
      canEditBank: self || canManage || input.actor.scopes.includes('finance.payouts.run'),
      canUploadDocuments: canManage,
      canDownloadDocuments: self || canManage,
      canManageLeave: canManage,
      canRecordEmploymentChange: canManage,
      canManageStaffIdTemplate: canManage,
    },
  };
}

export async function updateStaffEmployment(input: {
  request: NextRequest;
  actor: AdminStaffActor;
  staffProfileId: string;
  body: any;
}) {
  const target = await requireStaffTarget(input.actor, input.staffProfileId);
  if (!canManageEmployment(input.actor)) throw new StaffEmploymentError('staff_employment_manage_required', 403);

  const current = await prisma.staffPayrollProfile.findFirst({
    where: { staffUserId: target.userId },
    orderBy: { updatedAt: 'desc' },
  });
  const startDate = input.body?.startDate === undefined ? current?.startDate || null : dateOrNull(input.body.startDate);
  const endDate = input.body?.endDate === undefined ? current?.endDate || null : dateOrNull(input.body.endDate);
  const profileMeta = {
    ...jsonObject(current?.profileMeta),
    ...(input.body?.positionTitle !== undefined ? { positionTitle: clean(input.body.positionTitle, 240) } : {}),
    ...(input.body?.contractType !== undefined ? { contractType: clean(input.body.contractType, 120) } : {}),
    ...(input.body?.contractStatus !== undefined ? { contractStatus: clean(input.body.contractStatus, 120) } : {}),
    ...(input.body?.probationEndsAt !== undefined ? { probationEndsAt: clean(input.body.probationEndsAt, 80) } : {}),
    ...(input.body?.benefits !== undefined ? { benefits: input.body.benefits } : {}),
  };

  const data: any = {
    staffDisplayName: target.name || target.email,
    staffEmail: target.email,
    departmentId: target.departmentId,
    designationId: target.designationId,
    employmentType: clean(input.body?.employmentType ?? current?.employmentType ?? 'permanent', 80) || 'permanent',
    payrollStatus: clean(input.body?.payrollStatus ?? current?.payrollStatus ?? 'active', 80) || 'active',
    country: (clean(input.body?.country ?? current?.country ?? 'ZA', 2) || 'ZA').toUpperCase(),
    currency: (clean(input.body?.currency ?? current?.currency ?? 'ZAR', 3) || 'ZAR').toUpperCase(),
    baseSalaryCents: input.body?.baseSalaryCents === undefined ? current?.baseSalaryCents || 0 : cents(input.body.baseSalaryCents),
    hourlyRateCents: input.body?.hourlyRateCents === undefined ? current?.hourlyRateCents || 0 : cents(input.body.hourlyRateCents),
    payFrequency: clean(input.body?.payFrequency ?? current?.payFrequency ?? 'monthly', 80) || 'monthly',
    commissionEligible: input.body?.commissionEligible === undefined ? Boolean(current?.commissionEligible) : Boolean(input.body.commissionEligible),
    commissionMode: clean(input.body?.commissionMode ?? current?.commissionMode ?? 'none', 80) || 'none',
    taxNumber: input.body?.taxNumber === undefined ? current?.taxNumber || null : clean(input.body.taxNumber, 180),
    payrollNumber: input.body?.payrollNumber === undefined ? current?.payrollNumber || null : clean(input.body.payrollNumber, 180),
    employerReference: input.body?.employerReference === undefined ? current?.employerReference || null : clean(input.body.employerReference, 180),
    startDate,
    endDate,
    profileMeta,
    approvalStatus: clean(input.body?.approvalStatus ?? current?.approvalStatus ?? 'approved', 80) || 'approved',
    approvedByUserId: input.actor.userId,
    approvedAt: new Date(),
  };

  const item = current
    ? await prisma.staffPayrollProfile.update({ where: { id: current.id }, data })
    : await prisma.staffPayrollProfile.create({ data: { staffUserId: target.userId, ...data } });

  await prisma.auditLog.create({
    data: {
      actorUserId: input.actor.userId,
      actorType: 'ADMIN',
      actorRefId: input.actor.profileId,
      app: 'admin-dashboard',
      action: 'staff.employment.updated',
      entityType: 'StaffPayrollProfile',
      entityId: item.id,
      description: `Employment and compensation updated for ${target.email}`,
      meta: { staffProfileId: target.id, staffUserId: target.userId },
      ip: input.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      userAgent: input.request.headers.get('user-agent') || null,
    },
  }).catch(() => null);

  return { ok: true, item: serializePayrollProfile(item, true) };
}

export async function updateStaffBankAccount(input: {
  request: NextRequest;
  actor: AdminStaffActor;
  staffProfileId: string;
  body: any;
}) {
  const target = await requireStaffTarget(input.actor, input.staffProfileId);
  const self = input.actor.profileId === target.id;
  const canEdit = self || canManageEmployment(input.actor) || input.actor.scopes.includes('finance.payouts.run');
  if (!canEdit) throw new StaffEmploymentError('staff_bank_manage_required', 403);

  const accountHolderName = clean(input.body?.accountHolderName, 180);
  const accountNumber = String(input.body?.accountNumber || '').replace(/\s+/g, '').trim();
  const bankName = clean(input.body?.bankName, 180);
  const bankCode = clean(input.body?.bankCode, 80);
  const branchCode = clean(input.body?.branchCode, 80);
  const accountType = clean(input.body?.accountType, 80);
  const country = (clean(input.body?.country || 'ZA', 2) || 'ZA').toUpperCase();
  const currency = (clean(input.body?.currency || 'ZAR', 3) || 'ZAR').toUpperCase();

  if (!accountHolderName || !accountNumber || !bankCode) {
    throw new StaffEmploymentError('staff_bank_required_fields_missing', 400);
  }
  if (!/^[A-Za-z0-9-]{4,40}$/.test(accountNumber)) {
    throw new StaffEmploymentError('staff_bank_account_number_invalid', 400);
  }

  const encrypted = encryptStaffBankAccountNumber(accountNumber);
  const masked = maskAccountNumber(accountNumber);
  const now = new Date();

  let recipientCode: string | null = null;
  let verificationStatus = 'saved';
  let verificationProvider: string | null = null;
  let verifiedAt: Date | null = null;
  let providerError: string | null = null;

  try {
    const recipient = await createPaystackTransferRecipient({
      name: accountHolderName,
      accountNumber,
      bankCode,
      currency,
      country,
      metadata: {
        scope: 'staff_payroll',
        staffUserId: target.userId,
        staffProfileId: target.id,
      },
    });
    recipientCode = recipient.recipientCode;
    verificationStatus = 'recipient_ready';
    verificationProvider = 'paystack';
    verifiedAt = now;
  } catch (error: any) {
    providerError = clean(error?.message || 'paystack_recipient_unavailable', 240);
    verificationStatus = 'saved_unverified';
  }

  const item = await prisma.$transaction(async (tx) => {
    await tx.staffBankAccount.updateMany({
      where: { staffUserId: target.userId, active: true, isPrimary: true },
      data: { isPrimary: false },
    });

    return tx.staffBankAccount.create({
      data: {
        staffUserId: target.userId,
        payrollProfileId: (await tx.staffPayrollProfile.findFirst({
          where: { staffUserId: target.userId },
          orderBy: { updatedAt: 'desc' },
          select: { id: true },
        }))?.id || null,
        accountHolderName,
        bankName,
        bankCode,
        branchCode,
        accountNumberMasked: masked,
        accountNumberEncrypted: encrypted,
        accountType,
        country,
        currency,
        paystackRecipientCode: recipientCode,
        verificationStatus,
        verificationProvider,
        verifiedAt,
        isPrimary: true,
        active: true,
        meta: providerError ? { recipientSetup: { status: 'pending', errorCode: providerError } } : { recipientSetup: { status: 'ready' } },
        createdByUserId: input.actor.userId,
        updatedByUserId: input.actor.userId,
      },
    });
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: input.actor.userId,
      actorType: 'ADMIN',
      actorRefId: input.actor.profileId,
      app: 'admin-dashboard',
      action: 'staff.bank.updated',
      entityType: 'StaffBankAccount',
      entityId: item.id,
      description: `Primary payroll bank account updated for ${target.email}`,
      meta: { staffProfileId: target.id, masked, verificationStatus },
      ip: input.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      userAgent: input.request.headers.get('user-agent') || null,
    },
  }).catch(() => null);

  return {
    ok: true,
    item: {
      id: item.id,
      accountHolderName: item.accountHolderName,
      bankName: item.bankName,
      bankCode: item.bankCode,
      branchCode: item.branchCode,
      accountNumberMasked: item.accountNumberMasked,
      accountType: item.accountType,
      country: item.country,
      currency: item.currency,
      verificationStatus: item.verificationStatus,
      verificationProvider: item.verificationProvider,
      verifiedAt: item.verifiedAt,
      isPrimary: item.isPrimary,
    },
    providerPending: Boolean(providerError),
  };
}

function employmentDocumentObjectKey(staffProfileId: string) {
  const safe = String(staffProfileId || '').replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 160);
  return `staff-employment-documents/${safe}/${randomUUID()}`;
}

export async function presignStaffEmploymentDocument(input: {
  actor: AdminStaffActor;
  staffProfileId: string;
  body: any;
}) {
  await requireStaffTarget(input.actor, input.staffProfileId);
  if (!canManageEmployment(input.actor)) throw new StaffEmploymentError('staff_document_manage_required', 403);

  const contentType = String(input.body?.contentType || '').trim().toLowerCase();
  const sizeBytes = Math.floor(Number(input.body?.sizeBytes) || 0);
  const checksumSha256 = String(input.body?.checksumSha256 || '').trim().toLowerCase();
  if (!EMPLOYMENT_DOCUMENT_TYPES.has(contentType)) throw new StaffEmploymentError('staff_document_type_invalid', 400);
  if (sizeBytes <= 0 || sizeBytes > MAX_EMPLOYMENT_DOCUMENT_BYTES) throw new StaffEmploymentError('staff_document_size_invalid', 400);
  if (!/^[a-f0-9]{64}$/.test(checksumSha256)) throw new StaffEmploymentError('staff_document_checksum_invalid', 400);

  const objectKey = employmentDocumentObjectKey(input.staffProfileId);
  const presign = await presignApplicationDocumentUpload({ objectKey, contentType, checksumSha256Hex: checksumSha256 });
  return { ok: true, objectKey, ...presign };
}

export async function confirmStaffEmploymentDocument(input: {
  request: NextRequest;
  actor: AdminStaffActor;
  staffProfileId: string;
  body: any;
}) {
  const target = await requireStaffTarget(input.actor, input.staffProfileId);
  if (!canManageEmployment(input.actor)) throw new StaffEmploymentError('staff_document_manage_required', 403);

  const objectKey = String(input.body?.objectKey || '').trim();
  const contentType = String(input.body?.contentType || '').trim().toLowerCase();
  const sizeBytes = Math.floor(Number(input.body?.sizeBytes) || 0);
  const checksumSha256 = String(input.body?.checksumSha256 || '').trim().toLowerCase();
  const prefix = `staff-employment-documents/${String(target.id).replace(/[^A-Za-z0-9_-]+/g, '_').slice(0, 160)}/`;
  if (!objectKey.startsWith(prefix)) throw new StaffEmploymentError('staff_document_object_key_invalid', 400);
  if (!EMPLOYMENT_DOCUMENT_TYPES.has(contentType)) throw new StaffEmploymentError('staff_document_type_invalid', 400);
  if (sizeBytes <= 0 || sizeBytes > MAX_EMPLOYMENT_DOCUMENT_BYTES) throw new StaffEmploymentError('staff_document_size_invalid', 400);
  if (!/^[a-f0-9]{64}$/.test(checksumSha256)) throw new StaffEmploymentError('staff_document_checksum_invalid', 400);

  try {
    const head = await headApplicationDocument(objectKey);
    if (Number(head.ContentLength || 0) !== sizeBytes) throw new StaffEmploymentError('staff_document_size_mismatch', 409);
    if (String(head.ContentType || '').toLowerCase() !== contentType) throw new StaffEmploymentError('staff_document_type_mismatch', 409);
    const checksumBase64 = Buffer.from(checksumSha256, 'hex').toString('base64');
    if (head.ChecksumSHA256 && head.ChecksumSHA256 !== checksumBase64) throw new StaffEmploymentError('staff_document_checksum_mismatch', 409);
    const signatureOk = await verifyApplicationDocumentSignature(objectKey, contentType);
    if (!signatureOk) throw new StaffEmploymentError('staff_document_signature_invalid', 409);
  } catch (error) {
    if (error instanceof StaffEmploymentError || error instanceof ApplicationDocumentStorageError) throw error;
    throw new StaffEmploymentError('staff_document_verification_failed', 503);
  }

  const fileName = safeApplicationDocumentFileName(input.body?.fileName || 'employment-document');
  const documentType = clean(input.body?.documentType || 'OTHER', 80) || 'OTHER';
  const title = clean(input.body?.title || fileName, 240) || fileName;
  const item = await prisma.staffEmploymentDocument.create({
    data: {
      staffProfileId: target.id,
      documentType,
      title,
      fileName,
      contentType,
      sizeBytes,
      checksumSha256,
      objectKey,
      effectiveAt: dateOrNull(input.body?.effectiveAt),
      expiresAt: dateOrNull(input.body?.expiresAt),
      uploadedByProfileId: input.actor.profileId,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: input.actor.userId,
      actorType: 'ADMIN',
      actorRefId: input.actor.profileId,
      app: 'admin-dashboard',
      action: 'staff.document.issued',
      entityType: 'StaffEmploymentDocument',
      entityId: item.id,
      description: title,
      meta: { staffProfileId: target.id, documentType, contentType, sizeBytes },
      ip: input.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      userAgent: input.request.headers.get('user-agent') || null,
    },
  }).catch(() => null);

  return { ok: true, item: { ...item, objectKey: undefined, checksumSha256: undefined } };
}

export async function staffEmploymentDocumentDownload(input: {
  actor: AdminStaffActor;
  staffProfileId: string;
  documentId: string;
}) {
  const target = await requireStaffTarget(input.actor, input.staffProfileId);
  if (input.actor.profileId !== target.id && !canManageEmployment(input.actor)) {
    throw new StaffEmploymentError('staff_document_access_denied', 403);
  }
  const item = await prisma.staffEmploymentDocument.findFirst({
    where: { id: input.documentId, staffProfileId: target.id, state: 'active' },
  });
  if (!item) throw new StaffEmploymentError('staff_document_not_found', 404);
  return presignApplicationDocumentDownload(item.objectKey, item.fileName);
}

export async function archiveStaffEmploymentDocument(input: {
  request: NextRequest;
  actor: AdminStaffActor;
  staffProfileId: string;
  documentId: string;
}) {
  const target = await requireStaffTarget(input.actor, input.staffProfileId);
  if (!canManageEmployment(input.actor)) throw new StaffEmploymentError('staff_document_manage_required', 403);
  const item = await prisma.staffEmploymentDocument.findFirst({ where: { id: input.documentId, staffProfileId: target.id } });
  if (!item) throw new StaffEmploymentError('staff_document_not_found', 404);
  const updated = await prisma.staffEmploymentDocument.update({ where: { id: item.id }, data: { state: 'archived' } });
  await prisma.auditLog.create({
    data: {
      actorUserId: input.actor.userId,
      actorType: 'ADMIN',
      actorRefId: input.actor.profileId,
      app: 'admin-dashboard',
      action: 'staff.document.archived',
      entityType: 'StaffEmploymentDocument',
      entityId: item.id,
      description: item.title,
      meta: { staffProfileId: target.id },
      ip: input.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      userAgent: input.request.headers.get('user-agent') || null,
    },
  }).catch(() => null);
  return { ok: true, item: updated };
}

export async function recordStaffEmploymentChange(input: {
  request: NextRequest;
  actor: AdminStaffActor;
  staffProfileId: string;
  body: any;
}) {
  const target = await requireStaffTarget(input.actor, input.staffProfileId);
  if (!canManageEmployment(input.actor)) throw new StaffEmploymentError('staff_employment_manage_required', 403);
  const effectiveAt = dateOrNull(input.body?.effectiveAt) || new Date();
  const changeType = clean(input.body?.changeType || 'PROMOTION', 80) || 'PROMOTION';
  const salaryAfterCents = input.body?.salaryAfterCents === undefined ? null : cents(input.body.salaryAfterCents);

  const payroll = await prisma.staffPayrollProfile.findFirst({ where: { staffUserId: target.userId }, orderBy: { updatedAt: 'desc' } });
  const item = await prisma.$transaction(async (tx) => {
    const change = await tx.staffEmploymentChange.create({
      data: {
        staffProfileId: target.id,
        changeType,
        effectiveAt,
        fromDepartmentId: target.departmentId,
        toDepartmentId: clean(input.body?.toDepartmentId, 160) || target.departmentId,
        fromDesignationId: target.designationId,
        toDesignationId: clean(input.body?.toDesignationId, 160) || target.designationId,
        fromManagerId: target.managerId,
        toManagerId: clean(input.body?.toManagerId, 160) || target.managerId,
        salaryBeforeCents: payroll?.baseSalaryCents ?? null,
        salaryAfterCents,
        currency: (clean(input.body?.currency || payroll?.currency || 'ZAR', 3) || 'ZAR').toUpperCase(),
        benefits: input.body?.benefits ?? undefined,
        privileges: input.body?.privileges ?? undefined,
        notes: clean(input.body?.notes, 2000),
        supportingDocumentId: clean(input.body?.supportingDocumentId, 160),
        createdByProfileId: input.actor.profileId,
      },
    });

    const profileData: any = {};
    if (input.body?.toDepartmentId !== undefined) profileData.departmentId = clean(input.body.toDepartmentId, 160);
    if (input.body?.toDesignationId !== undefined) profileData.designationId = clean(input.body.toDesignationId, 160);
    if (input.body?.toManagerId !== undefined) profileData.managerId = clean(input.body.toManagerId, 160);
    if (Object.keys(profileData).length) await tx.adminUserProfile.update({ where: { id: target.id }, data: profileData });
    if (payroll && salaryAfterCents !== null) {
      await tx.staffPayrollProfile.update({ where: { id: payroll.id }, data: { baseSalaryCents: salaryAfterCents, approvedByUserId: input.actor.userId, approvedAt: new Date() } });
    }
    return change;
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: input.actor.userId,
      actorType: 'ADMIN',
      actorRefId: input.actor.profileId,
      app: 'admin-dashboard',
      action: 'staff.employment_change.recorded',
      entityType: 'StaffEmploymentChange',
      entityId: item.id,
      description: `${changeType} recorded for ${target.email}`,
      meta: { staffProfileId: target.id },
      ip: input.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      userAgent: input.request.headers.get('user-agent') || null,
    },
  }).catch(() => null);
  return { ok: true, item };
}

export async function updateStaffLeaveBalance(input: {
  actor: AdminStaffActor;
  staffProfileId: string;
  body: any;
}) {
  const target = await requireStaffTarget(input.actor, input.staffProfileId);
  if (!canManageEmployment(input.actor)) throw new StaffEmploymentError('staff_leave_manage_required', 403);
  const year = Math.floor(Number(input.body?.year) || new Date().getUTCFullYear());
  const leaveType = clean(input.body?.leaveType || 'ANNUAL', 80) || 'ANNUAL';
  if (year < 2000 || year > 2200) throw new StaffEmploymentError('staff_leave_year_invalid', 400);
  const item = await prisma.staffLeaveBalance.upsert({
    where: { staffProfileId_leaveType_year: { staffProfileId: target.id, leaveType, year } },
    update: {
      entitlementDays: Number(input.body?.entitlementDays || 0),
      usedDays: Number(input.body?.usedDays || 0),
      adjustmentDays: Number(input.body?.adjustmentDays || 0),
      notes: clean(input.body?.notes, 1000),
    },
    create: {
      staffProfileId: target.id,
      leaveType,
      year,
      entitlementDays: Number(input.body?.entitlementDays || 0),
      usedDays: Number(input.body?.usedDays || 0),
      adjustmentDays: Number(input.body?.adjustmentDays || 0),
      notes: clean(input.body?.notes, 1000),
    },
  });
  return { ok: true, item };
}

export async function getStaffIdTemplate(actor: AdminStaffActor) {
  if (!canManageEmployment(actor)) throw new StaffEmploymentError('staff_id_template_manage_required', 403);
  const item = await prisma.staffIdTemplate.findFirst({ orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }] });
  return { ok: true, item, media: enterpriseMediaStorageStatus() };
}

export async function updateStaffIdTemplate(input: { actor: AdminStaffActor; body: any }) {
  if (!canManageEmployment(input.actor)) throw new StaffEmploymentError('staff_id_template_manage_required', 403);
  const current = await prisma.staffIdTemplate.findFirst({ orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }] });
  const data = {
    name: clean(input.body?.name || current?.name || 'Default Staff ID', 160) || 'Default Staff ID',
    active: input.body?.active !== false,
    organisationName: clean(input.body?.organisationName || current?.organisationName || 'Ambulant+', 160) || 'Ambulant+',
    subtitle: clean(input.body?.subtitle ?? current?.subtitle, 240),
    accentHex: /^#[0-9A-Fa-f]{6}$/.test(String(input.body?.accentHex || current?.accentHex || '')) ? String(input.body?.accentHex || current?.accentHex) : '#0f172a',
    footerText: clean(input.body?.footerText ?? current?.footerText, 240),
    validityMonths: Math.min(120, Math.max(1, Math.floor(Number(input.body?.validityMonths || current?.validityMonths || 12)))),
    updatedByProfileId: input.actor.profileId,
  };
  if (data.active) await prisma.staffIdTemplate.updateMany({ where: { active: true }, data: { active: false } });
  const item = current
    ? await prisma.staffIdTemplate.update({ where: { id: current.id }, data })
    : await prisma.staffIdTemplate.create({ data: { ...data, createdByProfileId: input.actor.profileId } });
  return { ok: true, item };
}

export async function presignStaffIdTemplateImage(input: { actor: AdminStaffActor; body: any }) {
  if (!canManageEmployment(input.actor)) throw new StaffEmploymentError('staff_id_template_manage_required', 403);
  const template = await prisma.staffIdTemplate.findFirst({ orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }] });
  if (!template) throw new StaffEmploymentError('staff_id_template_required', 409);
  const validated = validateEnterpriseMediaUploadInput(input.body || {});
  const objectKey = enterpriseMediaObjectKey({ kind: 'staff-id-template', ownerId: template.id });
  return { ok: true, objectKey, ...(await presignEnterpriseMediaUpload({ objectKey, ...validated })) };
}

export async function confirmStaffIdTemplateImage(input: { actor: AdminStaffActor; body: any }) {
  if (!canManageEmployment(input.actor)) throw new StaffEmploymentError('staff_id_template_manage_required', 403);
  const template = await prisma.staffIdTemplate.findFirst({ orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }] });
  if (!template) throw new StaffEmploymentError('staff_id_template_required', 409);
  const objectKey = String(input.body?.objectKey || '').trim();
  if (!enterpriseMediaObjectBelongsTo({ objectKey, kind: 'staff-id-template', ownerId: template.id })) throw new StaffEmploymentError('staff_id_template_image_key_invalid', 400);
  const validated = validateEnterpriseMediaUploadInput(input.body || {});
  await verifyEnterpriseMediaUpload({ objectKey, ...validated });
  const previous = objectKeyFromManagedEnterpriseMediaRef(template.backgroundImageRef);
  const updated = await prisma.staffIdTemplate.update({ where: { id: template.id }, data: { backgroundImageRef: managedEnterpriseMediaRef(objectKey), updatedByProfileId: input.actor.profileId } });
  if (previous && previous !== objectKey) deleteEnterpriseMedia(previous).catch(() => null);
  return { ok: true, item: updated };
}

export async function staffIdTemplateImage(actor: AdminStaffActor) {
  if (!canManageEmployment(actor)) throw new StaffEmploymentError('staff_id_template_manage_required', 403);
  const template = await prisma.staffIdTemplate.findFirst({ where: { active: true }, orderBy: { updatedAt: 'desc' } });
  const objectKey = objectKeyFromManagedEnterpriseMediaRef(template?.backgroundImageRef);
  if (!template || !objectKey) throw new StaffEmploymentError('staff_id_template_image_not_found', 404);
  return getEnterpriseMediaObject(objectKey);
}

function escapeXml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function generateStaffIdSvg(input: { actor: AdminStaffActor; staffProfileId: string }) {
  const target = await requireStaffTarget(input.actor, input.staffProfileId);
  if (!target.staffIdentifier) throw new StaffEmploymentError('staff_identifier_required', 409);
  const template = await prisma.staffIdTemplate.findFirst({ where: { active: true }, orderBy: { updatedAt: 'desc' } });
  const accent = template?.accentHex || '#0f172a';
  const validFrom = new Date();
  const validUntil = new Date(validFrom);
  validUntil.setMonth(validUntil.getMonth() + (template?.validityMonths || 12));
  const initials = String(target.name || target.email).split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  let avatarData = '';
  const avatarKey = objectKeyFromManagedEnterpriseMediaRef(target.photoUrl);
  if (avatarKey) {
    try {
      const object = await getEnterpriseMediaObject(avatarKey);
      if (object.bytes?.length) avatarData = `data:${object.contentType || 'image/jpeg'};base64,${Buffer.from(object.bytes).toString('base64')}`;
    } catch {
      avatarData = '';
    }
  }
  let backgroundData = '';
  const backgroundKey = objectKeyFromManagedEnterpriseMediaRef(template?.backgroundImageRef);
  if (backgroundKey) {
    try {
      const object = await getEnterpriseMediaObject(backgroundKey);
      if (object.bytes?.length) backgroundData = `data:${object.contentType || 'image/png'};base64,${Buffer.from(object.bytes).toString('base64')}`;
    } catch {
      backgroundData = '';
    }
  }
  const svg = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="1012" height="638" viewBox="0 0 1012 638">\n<rect width="1012" height="638" rx="36" fill="#ffffff"/>\n${backgroundData ? `<image href="${backgroundData}" x="0" y="0" width="1012" height="638" preserveAspectRatio="xMidYMid slice" opacity="0.12"/>` : ''}\n<rect width="1012" height="118" rx="36" fill="${escapeXml(accent)}"/>\n<rect y="82" width="1012" height="36" fill="${escapeXml(accent)}"/>\n<text x="54" y="72" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="700" fill="#ffffff">${escapeXml(template?.organisationName || 'Ambulant+')}</text>\n<text x="54" y="155" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700" fill="${escapeXml(accent)}">STAFF IDENTIFICATION</text>\n<defs><clipPath id="staffPhoto"><circle cx="170" cy="310" r="105"/></clipPath></defs>\n<circle cx="170" cy="310" r="105" fill="#e2e8f0"/>\n${avatarData ? `<image href="${avatarData}" x="65" y="205" width="210" height="210" preserveAspectRatio="xMidYMid slice" clip-path="url(#staffPhoto)"/>` : `<text x="170" y="335" text-anchor="middle" font-family="Arial" font-size="76" font-weight="700" fill="#475569">${escapeXml(initials)}</text>`}\n<text x="330" y="255" font-family="Arial" font-size="42" font-weight="700" fill="#0f172a">${escapeXml(target.name || target.email)}</text>\n<text x="330" y="305" font-family="Arial" font-size="25" fill="#334155">${escapeXml(target.designation?.name || 'Staff')}</text>\n<text x="330" y="345" font-family="Arial" font-size="22" fill="#64748b">${escapeXml(target.department?.name || '')}</text>\n<text x="54" y="478" font-family="Arial" font-size="18" fill="#64748b">Staff ID</text>\n<text x="54" y="512" font-family="Arial" font-size="26" font-weight="700" fill="#0f172a">${escapeXml(target.staffIdentifier)}</text>\n<text x="330" y="478" font-family="Arial" font-size="18" fill="#64748b">Valid until</text>\n<text x="330" y="512" font-family="Arial" font-size="26" font-weight="700" fill="#0f172a">${escapeXml(validUntil.toISOString().slice(0, 10))}</text>\n<text x="54" y="590" font-family="Arial" font-size="16" fill="#64748b">${escapeXml(template?.footerText || template?.subtitle || 'Ambulant+ Contactless Medicine')}</text>\n</svg>`;
  return { svg, fileName: `Ambulant-Staff-ID-${target.staffIdentifier}.svg` };
}

export function staffEmploymentErrorResponse(error: unknown) {
  if (error instanceof StaffEmploymentError || error instanceof ApplicationDocumentStorageError) {
    const status = error instanceof StaffEmploymentError ? error.status : error.status;
    return { status, body: { ok: false, error: error.message, ...(error instanceof StaffEmploymentError && error.detail !== undefined ? { detail: error.detail } : {}) } };
  }
  const media = enterpriseMediaErrorResponse(error);
  if (media) return media;
  return null;
}
