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
function maskAccount(value: string) { const raw = text(value, 80).replace(/\s+/g, ''); return raw ? `•••• ${raw.slice(-4)}` : null; }

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

function payoutState(clinician: any) {
  const meta = asObject(clinician?.meta);
  const state = asObject(meta.payoutAccount);
  return {
    status: text(state.status, 40) || 'not_configured',
    provider: text(state.provider, 40) || null,
    bankName: text(state.bankName, 180) || null,
    bankCode: text(state.bankCode, 80) || null,
    accountName: text(state.accountName, 180) || null,
    accountMasked: text(state.accountMasked, 80) || null,
    accountType: text(state.accountType, 40) || null,
    verifiedAt: text(state.verifiedAt, 80) || null,
    verificationMessage: text(state.verificationMessage, 500) || null,
    recipientConfigured: Boolean(text(state.recipientCode || clinician?.payoutAccountId, 180)),
  };
}

export async function GET(req: NextRequest) {
  try {
    const { error, clinician } = await requireClinician(req); if (error || !clinician) return error;
    const url = new URL(req.url);
    const includeBanks = ['1', 'true', 'yes'].includes(String(url.searchParams.get('banks') || '').toLowerCase());
    const banks = includeBanks ? await listPaystackZaVerificationBanks() : undefined;
    return json({ ok: true, payoutAccount: payoutState(clinician), ...(banks ? { banks } : {}) });
  } catch (err: any) {
    return json({ ok: false, error: err?.message || 'payout_account_load_failed' }, 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { error, clinician, who } = await requireClinician(req); if (error || !clinician || !who) return error;
    const body = await req.json().catch(() => ({}));
    const accountType = body?.accountType === 'business' ? 'business' : 'personal';
    const documentType = accountType === 'business'
      ? 'businessRegistrationNumber'
      : body?.documentType === 'passportNumber' ? 'passportNumber' : 'identityNumber';
    const bankCode = text(body?.bankCode, 80);
    const bankName = text(body?.bankName, 180);
    const accountNumber = text(body?.accountNumber, 80).replace(/\s+/g, '');
    const accountName = text(body?.accountName || clinician.displayName || clinician.email, 180);
    const documentNumber = text(body?.documentNumber, 120).replace(/\s+/g, '');
    if (!bankCode || !accountNumber || !accountName || !documentNumber) return json({ ok: false, error: 'bank_account_validation_fields_required' }, 400);

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
      accountType,
    });

    const validation = await validatePaystackZaAccount({ bankCode, accountNumber, accountName, accountType, documentType, documentNumber });
    const verificationPassed = validation.verified && validation.accountAcceptsCredits && validation.accountOpen && validation.accountHolderMatch;
    if (!verificationPassed) {
      await (prisma as any).auditEvent?.create?.({ data: { kind: 'clinician_payout_account_verification_failed', actorId: who.uid, actorRole: who.role, subjectId: clinician.id, meta: { bankCode, bankName, accountMasked: maskAccount(accountNumber), accountType, verified: validation.verified, accountAcceptsCredits: validation.accountAcceptsCredits, accountOpen: validation.accountOpen, accountHolderMatch: validation.accountHolderMatch } } }).catch(() => null);
      return json({ ok: false, error: 'bank_account_verification_failed', verificationMessage: validation.verificationMessage, checks: { verified: validation.verified, accountAcceptsCredits: validation.accountAcceptsCredits, accountOpen: validation.accountOpen, accountHolderMatch: validation.accountHolderMatch } }, 422);
    }

    const recipient = await createPaystackTransferRecipient({ type: 'basa', name: accountName, accountNumber, bankCode, currency: 'ZAR', country: 'ZA', description: 'Ambulant+ clinician payout destination', metadata: { scope: 'clinician_payout', clinicianId: clinician.id } });
    const payoutAccount = {
      status: 'verified', provider: 'paystack', bankName, bankCode, accountName, accountMasked: maskAccount(accountNumber), accountType,
      recipientCode: recipient.recipientCode, accountFingerprint: fingerprint, verifiedAt: new Date().toISOString(), verificationMessage: validation.verificationMessage || 'Verified', verificationVersion: 'paystack-za-account-validation-v1',
    };
    const updated = await (prisma as any).clinicianProfile.update({ where: { id: clinician.id }, data: { payoutAccountId: recipient.recipientCode, meta: { ...existingMeta, payoutAccount } } });
    await (prisma as any).auditEvent?.create?.({ data: { kind: 'clinician_payout_account_verified', actorId: who.uid, actorRole: who.role, subjectId: clinician.id, meta: { bankCode, bankName, accountMasked: payoutAccount.accountMasked, accountType, provider: 'paystack' } } }).catch(() => null);
    return json({ ok: true, payoutAccount: payoutState(updated) });
  } catch (err: any) {
    console.error('[api-gateway][clinicians/me/payout-account] failed', err);
    return json({ ok: false, error: err?.message || 'payout_account_save_failed' }, typeof err?.status === 'number' ? err.status : 500);
  }
}
