import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  asObject,
  auditEnterpriseFinance,
  json,
  requireEnterpriseFinanceAdmin,
  routeError,
  text,
} from '@/src/enterprise-finance/access-envelope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cents(value: any) {
  if (value === undefined || value === null || value === '') return 0;
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function intValue(value: any) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n);
}

function dateOrNull(value: any) {
  const raw = text(value, 80);
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function defined(data: Record<string, any>) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}

function idempotencyKey(req: NextRequest) {
  return text(req.headers.get('Idempotency-Key'), 180) || null;
}

function hasInvoiceAttachment(input: any) {
  return Boolean(text(input.invoiceUrl, 1200) || text(input.invoiceObjectKey, 1200));
}

function hasProofOfPayment(input: any) {
  return Boolean(text(input.proofOfPaymentUrl, 1200) || text(input.proofOfPaymentObjectKey, 1200));
}

function isPaidStatus(value: any) {
  const status = text(value, 80)?.toLowerCase();
  return status === 'paid' || status === 'captured' || status === 'bank_paid' || status === 'already_paid';
}
// A5_M_G_C_ENTERPRISE_FINANCE_VENDOR_PAYOUT_ROUTE

async function auditPayout(action: string, req: NextRequest, subjectId: string, extra: Record<string, any> = {}) {
  await auditEnterpriseFinance(action, req, {
    model: 'OpsVendorPayout',
    subjectId,
    idempotencyKey: idempotencyKey(req),
    mutationSurface: 'enterprise_finance_vendor_payout',
    ...extra,
  });
}

async function requirePayableVendor(db: any, vendorId: string | null) {
  if (!vendorId) return { error: 'registered_vendor_required', status: 400 };

  const vendor = await db.opsVendor.findUnique({ where: { id: vendorId } });
  if (!vendor) return { error: 'registered_vendor_required', status: 400 };
  if (vendor.status !== 'active') return { error: 'active_vendor_required', status: 400, vendor };
  if (vendor.payoutEligible !== true) return { error: 'payout_eligible_vendor_required', status: 400, vendor };

  return { vendor };
}

async function requirePayableInvoice(db: any, vendorInvoiceId: string | null, vendorId: string | null) {
  if (!vendorInvoiceId) return { error: 'uploaded_invoice_required_before_payment_initiation', status: 400 };

  const invoice = await db.opsVendorInvoice.findUnique({ where: { id: vendorInvoiceId } });
  if (!invoice) return { error: 'vendor_invoice_not_found', status: 404 };
  if (vendorId && invoice.vendorId && invoice.vendorId !== vendorId) return { error: 'vendor_invoice_mismatch', status: 400 };
  if (!invoice.invoiceUrl && !invoice.invoiceObjectKey) return { error: 'uploaded_invoice_required_before_payment_initiation', status: 400 };

  return { invoice };
}

export async function GET(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;

    const db: any = prisma;
    const { searchParams } = new URL(req.url);

    const vendorId = text(searchParams.get('vendorId'), 180);
    const status = text(searchParams.get('status'), 80);
    const payoutMethod = text(searchParams.get('payoutMethod'), 80);
    const q = text(searchParams.get('q'), 160);
    const limitRaw = Number(searchParams.get('limit') || 100);
    const limit = Math.max(1, Math.min(Number.isFinite(limitRaw) ? limitRaw : 100, 500));

    const where: any = {};
    if (vendorId) where.vendorId = vendorId;
    if (status) where.status = status;
    if (payoutMethod) where.payoutMethod = payoutMethod;

    if (q) {
      where.OR = [
        { vendorName: { contains: q, mode: 'insensitive' } },
        { paymentReference: { contains: q, mode: 'insensitive' } },
        { paystackRecipientCode: { contains: q, mode: 'insensitive' } },
        { paystackTransferCode: { contains: q, mode: 'insensitive' } },
      ];
    }

    const payouts = await db.opsVendorPayout.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
    });

    return json({ ok: true, envelope: access.envelope, payouts, meta: { count: payouts.length, limit } });
  } catch (error: any) {
    return routeError(error, 'enterprise_finance_vendor_payout_list_failed');
  }
}

export async function POST(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;

    const db: any = prisma;
    const body = await req.json().catch(() => ({}));
    const action = text(body.action || 'initiate_vendor_payout', 120);

    if (
      action !== 'initiate_vendor_payout' &&
      action !== 'record_vendor_payment_made' &&
      action !== 'schedule_vendor_payout'
    ) {
      return json({ ok: false, envelope: access.envelope, error: 'unsupported_vendor_payout_post_action', action }, 400);
    }

    const vendorId = text(body.vendorId, 180);
    const vendorInvoiceId = text(body.vendorInvoiceId || body.invoiceId, 180);
    const payoutMethod = text(body.payoutMethod || body.paymentMethod || (action === 'initiate_vendor_payout' ? 'paystack' : 'eft'), 80) || 'eft';
    const initiatedViaPaystack = payoutMethod === 'paystack' || action === 'initiate_vendor_payout';
    const alreadyPaid = action === 'record_vendor_payment_made' || isPaidStatus(body.status || body.paymentStatus);

    const vendorCheck = await requirePayableVendor(db, vendorId);
    if (!vendorCheck.vendor) {
      return json({ ok: false, envelope: access.envelope, error: vendorCheck.error }, vendorCheck.status);
    }

    const invoiceCheck = await requirePayableInvoice(db, vendorInvoiceId, vendorId);
    if (!invoiceCheck.invoice) {
      return json({ ok: false, envelope: access.envelope, error: invoiceCheck.error }, invoiceCheck.status);
    }

    if (alreadyPaid && !hasProofOfPayment(body)) {
      return json({ ok: false, envelope: access.envelope, error: 'proof_of_payment_required_for_paid_vendor_payout' }, 400);
    }

    if (alreadyPaid && !text(body.paymentReference, 240)) {
      return json({ ok: false, envelope: access.envelope, error: 'payment_reference_required_for_paid_vendor_payout' }, 400);
    }

    const amountCents = cents(body.amount || body.amountZar || body.amountCents / 100 || (invoiceCheck.invoice.balanceCents || invoiceCheck.invoice.totalCents) / 100);

    const payout = await db.opsVendorPayout.create({
      data: {
        vendorId,
        vendorName: vendorCheck.vendor.legalName || vendorCheck.vendor.tradingName,
        vendorInvoiceId,
        status: alreadyPaid ? 'paid' : initiatedViaPaystack ? 'pending_paystack_release' : text(body.status || 'scheduled', 80),
        payoutMethod,
        currency: text(body.currency || invoiceCheck.invoice.currency || 'ZAR', 3),
        amountCents,

        paymentReference: text(body.paymentReference, 240),
        paymentProvider: initiatedViaPaystack ? 'paystack' : text(body.paymentProvider, 80),
        paystackRecipientCode: text(body.paystackRecipientCode || vendorCheck.vendor.vendorMeta?.paystackRecipientCode, 240),
        paystackTransferCode: text(body.paystackTransferCode, 240),

        proofOfPaymentUrl: text(body.proofOfPaymentUrl, 1200),
        proofOfPaymentObjectKey: text(body.proofOfPaymentObjectKey, 1200),

        invoiceRequired: true,
        registeredVendorRequired: true,
        initiatedViaPaystack,

        scheduledAt: alreadyPaid ? null : (dateOrNull(body.scheduledAt) || new Date()),
        paidAt: alreadyPaid ? (dateOrNull(body.paidAt || body.paymentDate) || new Date()) : null,
        approvedByUserId: Boolean(body.approveNow) || alreadyPaid ? access.envelope.actor.userId : null,
        approvedAt: Boolean(body.approveNow) || alreadyPaid ? new Date() : null,
        createdByUserId: access.envelope.actor.userId,

        meta: asObject({
          ...(body.meta || {}),
          action,
          invoiceId: vendorInvoiceId,
          registeredVendorRequired: true,
          invoiceRequired: true,
          proofOfPaymentRequired: alreadyPaid,
        }),
      },
    });

    const ledgerStatus = alreadyPaid ? 'paid' : 'pending';
    const expenditure = await db.opsExpenditureLedgerEntry.create({
      data: {
        expenditureType: 'vendor_payment',
        category: text(body.category || 'vendor_payout', 120),
        subcategory: text(body.subcategory, 120),
        status: alreadyPaid ? 'approved' : 'pending',
        module: 'enterprise_finance',
        sourceType: 'ops_vendor_payout',
        sourceId: payout.id,
        externalReference: text(body.externalReference || body.paymentReference, 240),

        vendorId,
        vendorName: payout.vendorName,
        vendorInvoiceId,
        vendorPayoutId: payout.id,

        narration: text(body.narration || `Vendor payout for ${payout.vendorName || vendorId}`, 2000),
        description: text(body.description, 4000),

        amountCents,
        currency: payout.currency,
        zarEquivalentCents: payout.currency === 'ZAR' ? amountCents : cents(body.zarEquivalent || body.zarEquivalentCents / 100),
        amountUsdCents: payout.currency === 'USD' ? amountCents : cents(body.amountUsd || body.amountUsdCents / 100),
        fxRate: body.fxRate === undefined ? null : Number(body.fxRate),

        paymentMethod: payoutMethod,
        paymentProvider: payout.paymentProvider,
        paymentReference: payout.paymentReference,
        companyBankAccountReference: text(body.companyBankAccountReference, 240),
        paymentStatus: ledgerStatus,
        paidAt: alreadyPaid ? payout.paidAt : null,

        invoiceUrl: invoiceCheck.invoice.invoiceUrl,
        invoiceObjectKey: invoiceCheck.invoice.invoiceObjectKey,
        proofOfPaymentUrl: payout.proofOfPaymentUrl,
        proofOfPaymentObjectKey: payout.proofOfPaymentObjectKey,

        manualEntry: true,
        createdByUserId: access.envelope.actor.userId,
        approvedByUserId: alreadyPaid ? access.envelope.actor.userId : null,
        approvedAt: alreadyPaid ? new Date() : null,

        meta: asObject({
          action,
          vendorPayoutId: payout.id,
          vendorInvoiceId,
          initiatedViaPaystack,
          registeredVendorRequired: true,
          invoiceRequired: true,
          proofOfPaymentRequired: alreadyPaid,
        }),
      },
    });

    const updatedPayout = await db.opsVendorPayout.update({
      where: { id: payout.id },
      data: {
        expenditureLedgerEntryId: expenditure.id,
      },
    });

    await auditPayout(
      alreadyPaid ? 'vendor_payment_made_recorded' : initiatedViaPaystack ? 'vendor_payout_paystack_initiated' : 'vendor_payout_scheduled',
      req,
      updatedPayout.id,
      {
        vendorId,
        vendorInvoiceId,
        expenditureLedgerEntryId: expenditure.id,
        registeredVendorRequired: true,
        invoiceRequired: true,
        proofOfPaymentRequired: alreadyPaid,
        initiatedViaPaystack,
      }
    );

    return json({ ok: true, envelope: access.envelope, payout: updatedPayout, expenditure }, 201);
  } catch (error: any) {
    return routeError(error, 'enterprise_finance_vendor_payout_create_failed');
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;

    const db: any = prisma;
    const body = await req.json().catch(() => ({}));
    const action = text(body.action, 120);
    const id = text(body.id || body.payoutId || body.vendorPayoutId, 180);

    if (!action) return json({ ok: false, envelope: access.envelope, error: 'action_required' }, 400);
    if (!id) return json({ ok: false, envelope: access.envelope, error: 'vendor_payout_id_required' }, 400);

    const existing = await db.opsVendorPayout.findUnique({ where: { id } });
    if (!existing) return json({ ok: false, envelope: access.envelope, error: 'vendor_payout_not_found' }, 404);

    if (
      action === 'update_vendor_payout' ||
      action === 'approve_vendor_payout' ||
      action === 'mark_vendor_payout_paid' ||
      action === 'cancel_vendor_payout' ||
      action === 'void_vendor_payout'
    ) {
      const markingPaid = action === 'mark_vendor_payout_paid' || isPaidStatus(body.status);
      if (markingPaid && !hasProofOfPayment({ ...existing, ...body })) {
        return json({ ok: false, envelope: access.envelope, error: 'proof_of_payment_required_for_paid_vendor_payout' }, 400);
      }

      const payout = await db.opsVendorPayout.update({
        where: { id },
        data: defined({
          status:
            action === 'approve_vendor_payout' ? 'approved' :
            action === 'mark_vendor_payout_paid' ? 'paid' :
            action === 'cancel_vendor_payout' ? 'cancelled' :
            action === 'void_vendor_payout' ? 'voided' :
            body.status === undefined ? undefined : text(body.status, 80),

          payoutMethod: body.payoutMethod === undefined ? undefined : text(body.payoutMethod, 80),
          amountCents: body.amount === undefined && body.amountZar === undefined && body.amountCents === undefined ? undefined : cents(body.amount || body.amountZar || body.amountCents / 100),
          paymentReference: body.paymentReference === undefined ? undefined : text(body.paymentReference, 240),
          paymentProvider: body.paymentProvider === undefined ? undefined : text(body.paymentProvider, 80),
          paystackRecipientCode: body.paystackRecipientCode === undefined ? undefined : text(body.paystackRecipientCode, 240),
          paystackTransferCode: body.paystackTransferCode === undefined ? undefined : text(body.paystackTransferCode, 240),
          proofOfPaymentUrl: body.proofOfPaymentUrl === undefined ? undefined : text(body.proofOfPaymentUrl, 1200),
          proofOfPaymentObjectKey: body.proofOfPaymentObjectKey === undefined ? undefined : text(body.proofOfPaymentObjectKey, 1200),
          scheduledAt: body.scheduledAt === undefined ? undefined : dateOrNull(body.scheduledAt),
          paidAt: markingPaid ? (dateOrNull(body.paidAt || body.paymentDate) || new Date()) : body.paidAt === undefined ? undefined : dateOrNull(body.paidAt),
          approvedByUserId: action === 'approve_vendor_payout' || markingPaid ? access.envelope.actor.userId : undefined,
          approvedAt: action === 'approve_vendor_payout' || markingPaid ? new Date() : undefined,
          meta: body.meta === undefined ? undefined : asObject(body.meta),
        }),
      });

      const auditAction =
        action === 'approve_vendor_payout' ? 'vendor_payout_approved' :
        action === 'mark_vendor_payout_paid' ? 'vendor_payout_marked_paid' :
        action === 'cancel_vendor_payout' ? 'vendor_payout_cancelled' :
        action === 'void_vendor_payout' ? 'vendor_payout_voided' :
        'vendor_payout_updated';

      await auditPayout(auditAction, req, payout.id, {
        vendorId: payout.vendorId,
        vendorInvoiceId: payout.vendorInvoiceId,
        status: payout.status,
      });

      return json({ ok: true, envelope: access.envelope, payout });
    }

    return json({ ok: false, envelope: access.envelope, error: 'unsupported_vendor_payout_patch_action', action }, 400);
  } catch (error: any) {
    return routeError(error, 'enterprise_finance_vendor_payout_patch_failed');
  }
}
