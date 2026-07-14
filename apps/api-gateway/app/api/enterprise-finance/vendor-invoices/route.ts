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
// A5_M_G_C_ENTERPRISE_FINANCE_VENDOR_INVOICE_ROUTE

async function auditInvoice(action: string, req: NextRequest, subjectId: string, extra: Record<string, any> = {}) {
  await auditEnterpriseFinance(action, req, {
    model: 'OpsVendorInvoice',
    subjectId,
    idempotencyKey: idempotencyKey(req),
    mutationSurface: 'enterprise_finance_vendor_invoice',
    ...extra,
  });
}

async function requireActiveVendor(db: any, vendorId: string | null) {
  if (!vendorId) return { error: 'registered_vendor_required', status: 400 };

  const vendor = await db.opsVendor.findUnique({ where: { id: vendorId } });
  if (!vendor) return { error: 'registered_vendor_required', status: 400 };
  if (vendor.status !== 'active') return { error: 'active_vendor_required', status: 400, vendor };

  return { vendor };
}

export async function GET(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;

    const db: any = prisma;
    const { searchParams } = new URL(req.url);

    const vendorId = text(searchParams.get('vendorId'), 180);
    const invoiceStatus = text(searchParams.get('invoiceStatus') || searchParams.get('status'), 80);
    const q = text(searchParams.get('q'), 160);
    const limitRaw = Number(searchParams.get('limit') || 100);
    const limit = Math.max(1, Math.min(Number.isFinite(limitRaw) ? limitRaw : 100, 500));

    const where: any = {};
    if (vendorId) where.vendorId = vendorId;
    if (invoiceStatus) where.invoiceStatus = invoiceStatus;

    if (q) {
      where.OR = [
        { vendorName: { contains: q, mode: 'insensitive' } },
        { invoiceNumber: { contains: q, mode: 'insensitive' } },
        { paymentReference: { contains: q, mode: 'insensitive' } },
      ];
    }

    const invoices = await db.opsVendorInvoice.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
    });

    return json({ ok: true, envelope: access.envelope, invoices, meta: { count: invoices.length, limit } });
  } catch (error: any) {
    return routeError(error, 'enterprise_finance_vendor_invoice_list_failed');
  }
}

export async function POST(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;

    const db: any = prisma;
    const body = await req.json().catch(() => ({}));
    const action = text(body.action || 'create_vendor_invoice', 120);

    if (action !== 'create_vendor_invoice') {
      return json({ ok: false, envelope: access.envelope, error: 'unsupported_vendor_invoice_post_action', action }, 400);
    }

    const vendorId = text(body.vendorId, 180);
    const vendorCheck = await requireActiveVendor(db, vendorId);
    if (!vendorCheck.vendor) {
      return json({ ok: false, envelope: access.envelope, error: vendorCheck.error }, vendorCheck.status);
    }

    if (!hasInvoiceAttachment(body)) {
      return json({ ok: false, envelope: access.envelope, error: 'uploaded_invoice_required' }, 400);
    }

    const totalCents = cents(body.total || body.totalZar || body.totalCents / 100);
    const amountPaidCents = cents(body.amountPaid || body.amountPaidZar || body.amountPaidCents / 100);
    const balanceCents = Math.max(totalCents - amountPaidCents, 0);
    const paidAlready = amountPaidCents > 0 || isPaidStatus(body.paymentStatus || body.invoiceStatus);

    if (paidAlready && !hasProofOfPayment(body)) {
      return json({ ok: false, envelope: access.envelope, error: 'proof_of_payment_required_for_paid_invoice' }, 400);
    }

    const invoice = await db.opsVendorInvoice.create({
      data: {
        vendorId,
        vendorName: vendorCheck.vendor.legalName || vendorCheck.vendor.tradingName,

        invoiceNumber: text(body.invoiceNumber, 240),
        invoiceStatus: text(body.invoiceStatus || (balanceCents === 0 && totalCents > 0 ? 'paid' : 'draft'), 80),
        invoiceDate: dateOrNull(body.invoiceDate),
        dueDate: dateOrNull(body.dueDate),

        currency: text(body.currency || 'ZAR', 3),
        subtotalCents: cents(body.subtotal || body.subtotalZar || body.subtotalCents / 100),
        taxCents: cents(body.tax || body.taxZar || body.taxCents / 100),
        totalCents,
        amountPaidCents,
        balanceCents,

        invoiceUrl: text(body.invoiceUrl, 1200),
        invoiceObjectKey: text(body.invoiceObjectKey, 1200),
        invoiceUploadedAt: new Date(),
        invoiceVerifiedAt: Boolean(body.verifyNow) ? new Date() : null,
        invoiceVerifiedByUserId: Boolean(body.verifyNow) ? access.envelope.actor.userId : null,

        proofOfPaymentUrl: text(body.proofOfPaymentUrl, 1200),
        proofOfPaymentObjectKey: text(body.proofOfPaymentObjectKey, 1200),
        proofOfPaymentUploadedAt: hasProofOfPayment(body) ? new Date() : null,

        paymentMethod: text(body.paymentMethod, 80),
        paymentReference: text(body.paymentReference, 240),
        paymentDate: dateOrNull(body.paymentDate),

        registeredVendorRequired: true,
        invoiceRequired: true,
        proofOfPaymentRequired: paidAlready,
        paymentInitiationMode: text(body.paymentInitiationMode, 80),

        importOrderId: text(body.importOrderId, 180),
        invoiceMeta: asObject(body.invoiceMeta || body.meta || {}),
        createdByUserId: access.envelope.actor.userId,
        approvedByUserId: Boolean(body.approveNow) ? access.envelope.actor.userId : null,
        approvedAt: Boolean(body.approveNow) ? new Date() : null,
      },
    });

    await auditInvoice('vendor_invoice_created', req, invoice.id, {
      vendorId: invoice.vendorId,
      invoiceStatus: invoice.invoiceStatus,
      invoiceRequired: true,
      registeredVendorRequired: true,
    });

    return json({ ok: true, envelope: access.envelope, invoice }, 201);
  } catch (error: any) {
    return routeError(error, 'enterprise_finance_vendor_invoice_create_failed');
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;

    const db: any = prisma;
    const body = await req.json().catch(() => ({}));
    const action = text(body.action, 120);
    const id = text(body.id || body.invoiceId || body.vendorInvoiceId, 180);

    if (!action) return json({ ok: false, envelope: access.envelope, error: 'action_required' }, 400);
    if (!id) return json({ ok: false, envelope: access.envelope, error: 'vendor_invoice_id_required' }, 400);

    const existing = await db.opsVendorInvoice.findUnique({ where: { id } });
    if (!existing) return json({ ok: false, envelope: access.envelope, error: 'vendor_invoice_not_found' }, 404);

    if (
      action === 'update_vendor_invoice' ||
      action === 'verify_vendor_invoice' ||
      action === 'mark_vendor_invoice_paid' ||
      action === 'void_vendor_invoice'
    ) {
      const markingPaid = action === 'mark_vendor_invoice_paid' || isPaidStatus(body.invoiceStatus);
      if (markingPaid && !hasProofOfPayment({ ...existing, ...body })) {
        return json({ ok: false, envelope: access.envelope, error: 'proof_of_payment_required_for_paid_invoice' }, 400);
      }

      const totalCents = body.total === undefined && body.totalZar === undefined && body.totalCents === undefined
        ? undefined
        : cents(body.total || body.totalZar || body.totalCents / 100);

      const amountPaidCents = action === 'mark_vendor_invoice_paid'
        ? (totalCents === undefined ? existing.totalCents : totalCents)
        : body.amountPaid === undefined && body.amountPaidZar === undefined && body.amountPaidCents === undefined
          ? undefined
          : cents(body.amountPaid || body.amountPaidZar || body.amountPaidCents / 100);

      const invoice = await db.opsVendorInvoice.update({
        where: { id },
        data: defined({
          invoiceNumber: body.invoiceNumber === undefined ? undefined : text(body.invoiceNumber, 240),
          invoiceStatus:
            action === 'verify_vendor_invoice' ? 'verified' :
            action === 'mark_vendor_invoice_paid' ? 'paid' :
            action === 'void_vendor_invoice' ? 'void' :
            body.invoiceStatus === undefined ? undefined : text(body.invoiceStatus, 80),

          invoiceDate: body.invoiceDate === undefined ? undefined : dateOrNull(body.invoiceDate),
          dueDate: body.dueDate === undefined ? undefined : dateOrNull(body.dueDate),

          totalCents,
          amountPaidCents,
          balanceCents: amountPaidCents === undefined && totalCents === undefined
            ? undefined
            : Math.max((totalCents === undefined ? existing.totalCents : totalCents) - (amountPaidCents === undefined ? existing.amountPaidCents : amountPaidCents), 0),

          invoiceUrl: body.invoiceUrl === undefined ? undefined : text(body.invoiceUrl, 1200),
          invoiceObjectKey: body.invoiceObjectKey === undefined ? undefined : text(body.invoiceObjectKey, 1200),
          invoiceUploadedAt: body.invoiceUrl !== undefined || body.invoiceObjectKey !== undefined ? new Date() : undefined,
          invoiceVerifiedAt: action === 'verify_vendor_invoice' ? new Date() : undefined,
          invoiceVerifiedByUserId: action === 'verify_vendor_invoice' ? access.envelope.actor.userId : undefined,

          proofOfPaymentUrl: body.proofOfPaymentUrl === undefined ? undefined : text(body.proofOfPaymentUrl, 1200),
          proofOfPaymentObjectKey: body.proofOfPaymentObjectKey === undefined ? undefined : text(body.proofOfPaymentObjectKey, 1200),
          proofOfPaymentUploadedAt: hasProofOfPayment(body) ? new Date() : undefined,

          paymentMethod: body.paymentMethod === undefined ? undefined : text(body.paymentMethod, 80),
          paymentReference: body.paymentReference === undefined ? undefined : text(body.paymentReference, 240),
          paymentDate: action === 'mark_vendor_invoice_paid' ? (dateOrNull(body.paymentDate) || new Date()) : body.paymentDate === undefined ? undefined : dateOrNull(body.paymentDate),

          proofOfPaymentRequired: markingPaid ? true : undefined,
          invoiceMeta: body.invoiceMeta === undefined && body.meta === undefined ? undefined : asObject(body.invoiceMeta || body.meta || {}),
        }),
      });

      const auditAction =
        action === 'verify_vendor_invoice' ? 'vendor_invoice_verified' :
        action === 'mark_vendor_invoice_paid' ? 'vendor_invoice_marked_paid' :
        action === 'void_vendor_invoice' ? 'vendor_invoice_voided' :
        'vendor_invoice_updated';

      await auditInvoice(auditAction, req, invoice.id, {
        vendorId: invoice.vendorId,
        invoiceStatus: invoice.invoiceStatus,
      });

      return json({ ok: true, envelope: access.envelope, invoice });
    }

    return json({ ok: false, envelope: access.envelope, error: 'unsupported_vendor_invoice_patch_action', action }, 400);
  } catch (error: any) {
    return routeError(error, 'enterprise_finance_vendor_invoice_patch_failed');
  }
}
