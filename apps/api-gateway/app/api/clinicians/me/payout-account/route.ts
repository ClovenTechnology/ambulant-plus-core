import { createHmac } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { readIdentity, requireTrustedIdentityInProduction } from '@/src/lib/identity';
import { createPaystackTransferRecipient, listPaystackZaVerificationBanks, validatePaystackZaAccount } from '@/src/payments/paystack-transfers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: any, status = 200) { return NextResponse.json(data, { status, headers: { 'cache-control': 'no-store' } }); }
function text(value: unknown, max = 240) { return String(value ?? '').trim().slice(0, max); }
function asObject(value: unknown): Record<string, any> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}; }
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
function maskAccount(value: string) { const raw = text(value, 80).replace(/\s+/g, ''); return raw ? `•••• ${raw.slice(-4)}` : null; }
function maskIdentity(value: string) {
  const raw = text(value, 120).replace(/\s+/g, '');
  if (!raw) return null;
  const visible = raw.slice(-4);
  return `${'•'.repeat(Math.max(4, Math.min(9, raw.length - visible.length)))}${visible}`;
}

function internalIdentitySecret() {
  const secret = text(process.env.AMBULANT_INTERNAL_IDENTITY_SECRET || process.env.INTERNAL_IDENTITY_SECRET, 512);
  if (!secret) {
    const error = new Error('internal_identity_secret_missing') as Error & { status?: number };
    error.status = 503;
    throw error;
  }
  return secret;
}

function accountFingerprint(bankCode: string, accountNumber: string) {
  return createHmac('sha256', internalIdentitySecret())
    .update(`ambulant-payout-account:v1:${bankCode}:${accountNumber}`)
    .digest('hex');
}

async function reserveVerificationAttempt(clinicianId: string, who: any, meta: Record<string, any>) {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const auditEvent = (prisma as any).auditEvent;
  if (!auditEvent?.count || !auditEvent?.create) {
    const error = new Error('payout_account_verification_audit_unavailable') as Error & { status?: number };
    error.status = 503;
    throw error;
  }

  let count: number;
  try {
    count = Number(await auditEvent.count({
      where: {
        kind: 'clinician_payout_account_verification_attempted',
        subjectId: clinicianId,
        at: { gte: since },
      },
    }) || 0);
  } catch {
    const error = new Error('payout_account_verification_audit_unavailable') as Error & { status?: number };
    error.status = 503;
    throw error;
  }

  if (count >= 5) {
    const error = new Error('payout_account_verification_rate_limited') as Error & { status?: number };
    error.status = 429;
    throw error;
  }

  try {
    await auditEvent.create({
      data: {
        kind: 'clinician_payout_account_verification_attempted',
        actorId: who.uid,
        actorRole: who.role,
        subjectId: clinicianId,
        meta,
      },
    });
  } catch {
    const error = new Error('payout_account_verification_audit_unavailable') as Error & { status?: number };
    error.status = 503;
    throw error;
  }
}

async function requireClinician(req: NextRequest) {
  const who = readIdentity(req.headers);
  try { requireTrustedIdentityInProduction(req.headers, who); } catch { return { error: json({ ok: false, error: 'unauthorized' }, 401), who: null, clinician: null }; }
  if (!who?.uid || String(who.role || '').toLowerCase() !== 'clinician') return { error: json({ ok: false, error: 'forbidden' }, 403), who: null, clinician: null };
  const refs = [text((who as any).actorRefId, 180), text(who.uid, 180), text((who as any).email, 240)].filter(Boolean);
  const clinician = await (prisma as any).clinicianProfile.findFirst({
    where: { OR: refs.flatMap((ref) => [{ id: ref }, { userId: ref }, { email: ref }]) },
    orderBy: { createdAt: 'desc' },
  });
  if (!clinician) return { error: json({ ok: false, error: 'clinician_profile_not_found' }, 404), who, clinician: null };
  return { error: null, who, clinician };
}

function profileAuthority(clinician: any) {
  const meta = asObject(clinician?.meta);
  const profile = Object.keys(asObject(meta.rawProfile)).length
    ? asObject(meta.rawProfile)
    : typeof meta.rawProfileJson === 'string'
      ? parseObject(meta.rawProfileJson)
      : Object.keys(asObject(meta.profile)).length
        ? asObject(meta.profile)
        : meta;
  return { meta, profile };
}

function identityOnFile(clinician: any) {
  const { profile } = profileAuthority(clinician);
  const saId = text(profile.idNumber || profile.saIdNumber, 120).replace(/\D/g, '');
  const passport = text(profile.passportNumber, 120).replace(/\s+/g, '').toUpperCase();
  const legalName = text(profile.fullName || profile.displayName || clinician?.displayName || clinician?.email, 180) || null;

  if (saId) {
    return {
      available: true,
      documentType: 'identityNumber' as const,
      documentLabel: 'South African ID',
      masked: maskIdentity(saId),
      accountHolderName: legalName,
      source: 'clinician_profile',
      raw: saId,
    };
  }

  if (passport) {
    return {
      available: true,
      documentType: 'passportNumber' as const,
      documentLabel: 'Passport',
      masked: maskIdentity(passport),
      accountHolderName: legalName,
      source: 'clinician_profile',
      raw: passport,
    };
  }

  return {
    available: false,
    documentType: null,
    documentLabel: null,
    masked: null,
    accountHolderName: legalName,
    source: null,
    raw: '',
  };
}

function publicIdentityOnFile(clinician: any) {
  const identity = identityOnFile(clinician);
  return {
    available: identity.available,
    documentType: identity.documentType,
    documentLabel: identity.documentLabel,
    masked: identity.masked,
    accountHolderName: identity.accountHolderName,
    source: identity.source,
  };
}

function payoutState(clinician: any) {
  const meta = asObject(clinician?.meta);
  const state = asObject(meta.payoutAccount);
  const tax = asObject(meta.payoutTaxProfile);
  return {
    status: text(state.status, 40) || 'not_configured',
    provider: text(state.provider, 40) || null,
    bankName: text(state.bankName, 180) || null,
    bankCode: text(state.bankCode, 80) || null,
    accountName: text(state.accountName, 180) || null,
    accountMasked: text(state.accountMasked, 80) || null,
    accountType: text(state.accountType || state.accountHolderType, 40) || null,
    accountHolderType: text(state.accountHolderType || state.accountType, 40) || null,
    businessRegistrationMasked: text(state.businessRegistrationMasked, 80) || null,
    vatRegistered: tax.accountHolderType === 'business' ? tax.vatRegistered === true : null,
    vatNumberMasked: text(tax.vatNumberMasked, 80) || null,
    verifiedAt: text(state.verifiedAt, 80) || null,
    verificationMessage: text(state.verificationMessage, 500) || null,
    recipientConfigured: Boolean(text(state.recipientCode || clinician?.payoutAccountId, 180)),
  };
}

function providerFailure(err: any) {
  const providerMessage = text(err?.payload?.message || err?.message, 500);
  const normalized = providerMessage.toLowerCase();

  if (normalized.includes('insufficient balance')) {
    return {
      status: 503,
      error: 'payout_account_verification_temporarily_unavailable',
      verificationMessage: 'Bank verification is temporarily unavailable while the Ambulant+ verification balance is replenished. Your payout account was not activated. Please try again later.',
    };
  }

  return null;
}

export async function GET(req: NextRequest) {
  try {
    const { error, clinician } = await requireClinician(req); if (error || !clinician) return error;
    const url = new URL(req.url);
    const includeBanks = ['1', 'true', 'yes'].includes(String(url.searchParams.get('banks') || '').toLowerCase());
    const banks = includeBanks ? await listPaystackZaVerificationBanks() : undefined;
    return json({ ok: true, payoutAccount: payoutState(clinician), identityOnFile: publicIdentityOnFile(clinician), ...(banks ? { banks } : {}) });
  } catch (err: any) {
    return json({ ok: false, error: err?.message || 'payout_account_load_failed' }, 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { error, clinician, who } = await requireClinician(req); if (error || !clinician || !who) return error;
    const body = await req.json().catch(() => ({}));
    const accountType = body?.accountType === 'business' ? 'business' : 'personal';
    const bankCode = text(body?.bankCode, 80);
    const bankName = text(body?.bankName, 180);
    const accountNumber = text(body?.accountNumber, 80).replace(/\s+/g, '');
    const accountName = text(body?.accountName || clinician.displayName || clinician.email, 180);
    const identity = identityOnFile(clinician);

    let documentType: 'identityNumber' | 'passportNumber' | 'businessRegistrationNumber';
    let documentNumber: string;
    let identitySource: 'clinician_profile' | 'operator_input';
    let businessRegistrationNumber = '';
    const vatNumber = accountType === 'business' ? text(body?.vatNumber, 80).replace(/\s+/g, '').toUpperCase() : '';

    if (accountType === 'business') {
      documentType = 'businessRegistrationNumber';
      businessRegistrationNumber = text(body?.businessRegistrationNumber || body?.documentNumber, 120).replace(/\s+/g, '').toUpperCase();
      documentNumber = businessRegistrationNumber;
      identitySource = 'operator_input';
    } else if (identity.available && identity.documentType && identity.raw) {
      documentType = identity.documentType;
      documentNumber = identity.raw;
      identitySource = 'clinician_profile';
    } else {
      documentType = body?.documentType === 'passportNumber' ? 'passportNumber' : 'identityNumber';
      documentNumber = text(body?.documentNumber, 120).replace(/\s+/g, '').toUpperCase();
      identitySource = 'operator_input';
    }

    if (!bankCode || !accountNumber || !accountName || !documentNumber) {
      const errorCode = accountType === 'personal' && !identity.available && !documentNumber
        ? 'clinician_identity_required_for_payout_validation'
        : accountType === 'business' && !businessRegistrationNumber
          ? 'business_registration_number_required'
          : 'bank_account_validation_fields_required';
      return json({ ok: false, error: errorCode }, 400);
    }

    const fingerprint = accountFingerprint(bankCode, accountNumber);
    const existingMeta = asObject(clinician.meta);
    const existingAccount = asObject(existingMeta.payoutAccount);
    if (
      text(existingAccount.status, 40).toLowerCase() === 'verified' &&
      text(existingAccount.bankCode, 80) === bankCode &&
      text(existingAccount.accountFingerprint, 128) === fingerprint &&
      text(existingAccount.recipientCode || clinician.payoutAccountId, 180)
    ) {
      return json({ ok: true, payoutAccount: payoutState(clinician), reused: true });
    }

    await reserveVerificationAttempt(clinician.id, who, {
      bankCode,
      bankName,
      accountMasked: maskAccount(accountNumber),
      accountHolderType: accountType,
      identitySource,
      documentType,
      ...(businessRegistrationNumber ? { businessRegistrationMasked: maskIdentity(businessRegistrationNumber) } : {}),
      ...(accountType === 'business' ? { vatProvided: Boolean(vatNumber) } : {}),
    });

    let validation;
    try {
      validation = await validatePaystackZaAccount({ bankCode, accountNumber, accountName, accountType, documentType, documentNumber });
    } catch (err: any) {
      const friendly = providerFailure(err);
      if (friendly) {
        await (prisma as any).auditEvent?.create?.({
          data: {
            kind: 'clinician_payout_account_verification_provider_unavailable',
            actorId: who.uid,
            actorRole: who.role,
            subjectId: clinician.id,
            meta: { bankCode, bankName, accountMasked: maskAccount(accountNumber), accountHolderType: accountType, reason: 'provider_balance_unavailable' },
          },
        }).catch(() => null);
        return json({ ok: false, error: friendly.error, verificationMessage: friendly.verificationMessage }, friendly.status);
      }
      throw err;
    }

    const verificationPassed = validation.verified && validation.accountAcceptsCredits && validation.accountOpen && validation.accountHolderMatch;
    if (!verificationPassed) {
      await (prisma as any).auditEvent?.create?.({ data: { kind: 'clinician_payout_account_verification_failed', actorId: who.uid, actorRole: who.role, subjectId: clinician.id, meta: { bankCode, bankName, accountMasked: maskAccount(accountNumber), accountHolderType: accountType, identitySource, verified: validation.verified, accountAcceptsCredits: validation.accountAcceptsCredits, accountOpen: validation.accountOpen, accountHolderMatch: validation.accountHolderMatch } } }).catch(() => null);
      return json({ ok: false, error: 'bank_account_verification_failed', verificationMessage: validation.verificationMessage, checks: { verified: validation.verified, accountAcceptsCredits: validation.accountAcceptsCredits, accountOpen: validation.accountOpen, accountHolderMatch: validation.accountHolderMatch } }, 422);
    }

    const recipient = await createPaystackTransferRecipient({ type: 'basa', name: accountName, accountNumber, bankCode, currency: 'ZAR', country: 'ZA', description: 'Ambulant+ clinician payout destination', metadata: { scope: 'clinician_payout', clinicianId: clinician.id } });
    const payoutAccount = {
      status: 'verified', provider: 'paystack', bankName, bankCode, accountName, accountMasked: maskAccount(accountNumber), accountType, accountHolderType: accountType,
      ...(businessRegistrationNumber ? { businessRegistrationMasked: maskIdentity(businessRegistrationNumber) } : {}),
      recipientCode: recipient.recipientCode, accountFingerprint: fingerprint, verifiedAt: new Date().toISOString(), verificationMessage: validation.verificationMessage || 'Verified', verificationVersion: 'paystack-za-account-validation-v1',
    };
    const payoutTaxProfile = accountType === 'business'
      ? {
          accountHolderType: 'business',
          vatRegistered: Boolean(vatNumber),
          vatNumber: vatNumber || null,
          vatNumberMasked: vatNumber ? maskIdentity(vatNumber) : null,
          updatedAt: new Date().toISOString(),
        }
      : {
          accountHolderType: 'personal',
          vatRegistered: false,
          vatNumber: null,
          vatNumberMasked: null,
          updatedAt: new Date().toISOString(),
        };
    const updated = await (prisma as any).clinicianProfile.update({ where: { id: clinician.id }, data: { payoutAccountId: recipient.recipientCode, meta: { ...existingMeta, payoutAccount, payoutTaxProfile } } });
    await (prisma as any).auditEvent?.create?.({ data: { kind: 'clinician_payout_account_verified', actorId: who.uid, actorRole: who.role, subjectId: clinician.id, meta: { bankCode, bankName, accountMasked: payoutAccount.accountMasked, accountHolderType: accountType, identitySource, provider: 'paystack', vatProvided: Boolean(vatNumber) } } }).catch(() => null);
    return json({ ok: true, payoutAccount: payoutState(updated) });
  } catch (err: any) {
    console.error('[api-gateway][clinicians/me/payout-account] failed', err);
    return json({ ok: false, error: err?.message || 'payout_account_save_failed' }, typeof err?.status === 'number' ? err.status : 500);
  }
}
