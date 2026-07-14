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
// A5_M_G_C_ENTERPRISE_FINANCE_EXPENDITURE_ROUTE

async function auditExpenditure(action: string, req: NextRequest, subjectId: string, extra: Record<string, any> = {}) {
  await auditEnterpriseFinance(action, req, {
    model: 'OpsExpenditureLedgerEntry',
    subjectId,
    idempotencyKey: idempotencyKey(req),
    mutationSurface: 'enterprise_finance_expenditure',
    ...extra,
  });
}

async function requireVendorForPayment(db: any, vendorId: string | null) {
  if (!vendorId) return null;

  const vendor = await db.opsVendor.findUnique({ where: { id: vendorId } });
  if (!vendor) {
    return { error: 'registered_vendor_required', status: 400 };
  }

  if (vendor.status !== 'active') {
    return { error: 'active_vendor_required', status: 400, vendor };
  }

  return { vendor };
}

export async function GET(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;

    const db: any = prisma;
    const { searchParams } = new URL(req.url);

    const status = text(searchParams.get('status'), 80);
    const category = text(searchParams.get('category'), 120);
    const vendorId = text(searchParams.get('vendorId'), 180);
    const paymentStatus = text(searchParams.get('paymentStatus'), 80);
    const q = text(searchParams.get('q'), 160);
    const limitRaw = Number(searchParams.get('limit') || 100);
    const limit = Math.max(1, Math.min(Number.isFinite(limitRaw) ? limitRaw : 100, 500));

    const where: any = {};
    if (status) where.status = status;
    if (category) where.category = category;
    if (vendorId) where.vendorId = vendorId;
    if (paymentStatus) where.paymentStatus = paymentStatus;

    if (q) {
      where.OR = [
        { narration: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { vendorName: { contains: q, mode: 'insensitive' } },
        { externalReference: { contains: q, mode: 'insensitive' } },
        { paymentReference: { contains: q, mode: 'insensitive' } },
        { companyBankAccountReference: { contains: q, mode: 'insensitive' } },
      ];
    }

    const entries = await db.opsExpenditureLedgerEntry.findMany({
      where,
      orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });

    return json({
      ok: true,
      envelope: access.envelope,
      entries,
      meta: { count: entries.length, limit },
    });
  } catch (error: any) {
    return routeError(error, 'enterprise_finance_expenditure_list_failed');
  }
}

export async function POST(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;

    const db: any = prisma;
    const body = await req.json().catch(() => ({}));
    const action = text(body.action || 'create_expenditure', 120);

    if (action !== 'create_expenditure' && action !== 'record_paid_expenditure') {
      return json({ ok: false, envelope: access.envelope, error: 'unsupported_expenditure_post_action', action }, 400);
    }

    const vendorId = text(body.vendorId, 180);
    const vendorInvoiceId = text(body.vendorInvoiceId, 180);
    const vendorPayoutId = text(body.vendorPayoutId, 180);
    const paymentInitiationMode = text(body.paymentInitiationMode, 80);
    const paymentStatus = text(body.paymentStatus || (action === 'record_paid_expenditure' ? 'paid' : 'unpaid'), 80) || 'unpaid';

    const paymentIsVendorBound =
      Boolean(vendorId || vendorInvoiceId || vendorPayoutId) ||
      paymentInitiationMode === 'paystack' ||
      Boolean(body.initiatePayment);

    const paidAlready = action === 'record_paid_expenditure' || isPaidStatus(paymentStatus);

    if (paymentIsVendorBound) {
      const vendorCheck = await requireVendorForPayment(db, vendorId);
      if (!vendorCheck?.vendor) {
        return json({ ok: false, envelope: access.envelope, error: vendorCheck?.error || 'registered_vendor_required' }, vendorCheck?.status || 400);
      }
    }

    let invoice: any = null;
    if (vendorInvoiceId) {
      invoice = await db.opsVendorInvoice.findUnique({ where: { id: vendorInvoiceId } });
      if (!invoice) {
        return json({ ok: false, envelope: access.envelope, error: 'vendor_invoice_not_found' }, 404);
      }

      if (vendorId && invoice.vendorId && invoice.vendorId !== vendorId) {
        return json({ ok: false, envelope: access.envelope, error: 'vendor_invoice_mismatch' }, 400);
      }

      if (!invoice.invoiceUrl && !invoice.invoiceObjectKey) {
        return json({ ok: false, envelope: access.envelope, error: 'uploaded_invoice_required' }, 400);
      }
    }

    if (paymentInitiationMode === 'paystack' || Boolean(body.initiatePayment)) {
      if (!vendorId) {
        return json({ ok: false, envelope: access.envelope, error: 'registered_vendor_required_for_payment_initiation' }, 400);
      }

      if (!vendorInvoiceId && !hasInvoiceAttachment(body)) {
        return json({ ok: false, envelope: access.envelope, error: 'uploaded_invoice_required_before_payment_initiation' }, 400);
      }
    }

    if (paidAlready) {
      if (!hasProofOfPayment(body)) {
        return json({ ok: false, envelope: access.envelope, error: 'proof_of_payment_required_for_paid_entry' }, 400);
      }

      if (!text(body.paymentReference, 240) && !text(body.companyBankAccountReference, 240)) {
        return json({ ok: false, envelope: access.envelope, error: 'payment_reference_or_company_bank_reference_required' }, 400);
      }
    }

    const amountCents = cents(body.amount || body.amountZar || body.amountCents / 100);
    const amountUsdCents = cents(body.amountUsd || body.amountUsdCents / 100);
    const zarEquivalentCents = cents(body.zarEquivalent || body.zarEquivalentCents / 100 || body.amountZar || body.amount);

    const entry = await db.opsExpenditureLedgerEntry.create({
      data: {
        expenditureType: text(body.expenditureType || 'operating_expense', 120),
        category: text(body.category || 'general', 120),
        subcategory: text(body.subcategory, 120),
        status: text(body.status || 'pending', 80),
        module: text(body.module, 80),

        sourceType: text(body.sourceType, 120),
        sourceId: text(body.sourceId, 180),
        externalReference: text(body.externalReference, 240),

        vendorId,
        vendorName: text(body.vendorName || invoice?.vendorName, 240),
        vendorInvoiceId,
        importOrderId: text(body.importOrderId, 180),
        inventoryItemId: text(body.inventoryItemId, 180),
        vendorPayoutId,

        narration: text(body.narration, 2000),
        description: text(body.description, 4000),

        amountCents,
        currency: text(body.currency || 'ZAR', 3),
        amountUsdCents,
        zarEquivalentCents,
        fxRate: body.fxRate === undefined ? null : Number(body.fxRate),

        paymentMethod: text(body.paymentMethod, 80),
        paymentProvider: text(body.paymentProvider || (paymentInitiationMode === 'paystack' ? 'paystack' : null), 80),
        paymentReference: text(body.paymentReference, 240),
        companyBankAccountReference: text(body.companyBankAccountReference, 240),
        paymentStatus,
        paidAt: paidAlready ? (dateOrNull(body.paidAt || body.paymentDate) || new Date()) : dateOrNull(body.paidAt),

        occurredAt: dateOrNull(body.occurredAt) || new Date(),

        invoiceUrl: text(body.invoiceUrl || invoice?.invoiceUrl, 1200),
        invoiceObjectKey: text(body.invoiceObjectKey || invoice?.invoiceObjectKey, 1200),
        proofOfPaymentUrl: text(body.proofOfPaymentUrl, 1200),
        proofOfPaymentObjectKey: text(body.proofOfPaymentObjectKey, 1200),

        manualEntry: true,
        createdByUserId: access.envelope.actor.userId,
        approvedByUserId: Boolean(body.approveNow) ? access.envelope.actor.userId : null,
        approvedAt: Boolean(body.approveNow) ? new Date() : null,

        meta: asObject({
          ...(body.meta || {}),
          action,
          paymentInitiationMode: paymentInitiationMode || null,
          registeredVendorRequired: paymentIsVendorBound,
          invoiceRequired: paymentIsVendorBound,
          proofOfPaymentRequired: paidAlready,
        }),
      },
    });

    await auditExpenditure(
      paidAlready ? 'expenditure_paid_recorded' : 'expenditure_created',
      req,
      entry.id,
      {
        vendorId: entry.vendorId,
        vendorInvoiceId: entry.vendorInvoiceId,
        paymentStatus: entry.paymentStatus,
        paymentInitiationMode,
      }
    );

    return json({ ok: true, envelope: access.envelope, entry }, 201);
  } catch (error: any) {
    return routeError(error, 'enterprise_finance_expenditure_create_failed');
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;

    const db: any = prisma;
    const body = await req.json().catch(() => ({}));
    const action = text(body.action, 120);
    const id = text(body.id || body.expenditureId, 180);

    if (!action) return json({ ok: false, envelope: access.envelope, error: 'action_required' }, 400);
    if (!id) return json({ ok: false, envelope: access.envelope, error: 'expenditure_id_required' }, 400);

    const existing = await db.opsExpenditureLedgerEntry.findUnique({ where: { id } });
    if (!existing) return json({ ok: false, envelope: access.envelope, error: 'expenditure_not_found' }, 404);

    if (
      action === 'update_expenditure' ||
      action === 'approve_expenditure' ||
      action === 'mark_expenditure_paid' ||
      action === 'void_expenditure'
    ) {
      const markingPaid = action === 'mark_expenditure_paid' || isPaidStatus(body.paymentStatus);

      if (markingPaid && !hasProofOfPayment({ ...existing, ...body })) {
        return json({ ok: false, envelope: access.envelope, error: 'proof_of_payment_required_for_paid_entry' }, 400);
      }

      const entry = await db.opsExpenditureLedgerEntry.update({
        where: { id },
        data: defined({
          expenditureType: body.expenditureType === undefined ? undefined : text(body.expenditureType, 120),
          category: body.category === undefined ? undefined : text(body.category, 120),
          subcategory: body.subcategory === undefined ? undefined : text(body.subcategory, 120),
          status:
            action === 'approve_expenditure' ? 'approved' :
            action === 'void_expenditure' ? 'voided' :
            body.status === undefined ? undefined : text(body.status, 80),

          narration: body.narration === undefined ? undefined : text(body.narration, 2000),
          description: body.description === undefined ? undefined : text(body.description, 4000),

          paymentMethod: body.paymentMethod === undefined ? undefined : text(body.paymentMethod, 80),
          paymentProvider: body.paymentProvider === undefined ? undefined : text(body.paymentProvider, 80),
          paymentReference: body.paymentReference === undefined ? undefined : text(body.paymentReference, 240),
          companyBankAccountReference: body.companyBankAccountReference === undefined ? undefined : text(body.companyBankAccountReference, 240),
          paymentStatus: action === 'mark_expenditure_paid' ? 'paid' : body.paymentStatus === undefined ? undefined : text(body.paymentStatus, 80),
          paidAt: markingPaid ? (dateOrNull(body.paidAt || body.paymentDate) || new Date()) : body.paidAt === undefined ? undefined : dateOrNull(body.paidAt),

          invoiceUrl: body.invoiceUrl === undefined ? undefined : text(body.invoiceUrl, 1200),
          invoiceObjectKey: body.invoiceObjectKey === undefined ? undefined : text(body.invoiceObjectKey, 1200),
          proofOfPaymentUrl: body.proofOfPaymentUrl === undefined ? undefined : text(body.proofOfPaymentUrl, 1200),
          proofOfPaymentObjectKey: body.proofOfPaymentObjectKey === undefined ? undefined : text(body.proofOfPaymentObjectKey, 1200),

          approvedByUserId: action === 'approve_expenditure' ? access.envelope.actor.userId : undefined,
          approvedAt: action === 'approve_expenditure' ? new Date() : undefined,
          voidedByUserId: action === 'void_expenditure' ? access.envelope.actor.userId : undefined,
          voidedAt: action === 'void_expenditure' ? new Date() : undefined,
          meta: body.meta === undefined ? undefined : asObject(body.meta),
        }),
      });

      const auditAction =
        action === 'approve_expenditure' ? 'expenditure_approved' :
        action === 'mark_expenditure_paid' ? 'expenditure_marked_paid' :
        action === 'void_expenditure' ? 'expenditure_voided' :
        'expenditure_updated';

      await auditExpenditure(auditAction, req, entry.id, {
        paymentStatus: entry.paymentStatus,
        status: entry.status,
      });

      return json({ ok: true, envelope: access.envelope, entry });
    }

    return json({ ok: false, envelope: access.envelope, error: 'unsupported_expenditure_patch_action', action }, 400);
  } catch (error: any) {
    return routeError(error, 'enterprise_finance_expenditure_patch_failed');
  }
}
