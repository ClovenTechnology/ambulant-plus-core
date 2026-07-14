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

// A5_M_G_A_ENTERPRISE_FINANCE_VENDOR_ADMIN_ROUTE

function boolOrUndefined(value: any) {
  if (value === undefined) return undefined;
  return value === true || value === 'true';
}

function cleanEmail(value: any) {
  return text(value, 320)?.toLowerCase() || null;
}

function defined(data: Record<string, any>) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}

function maskAccount(value: any) {
  const raw = text(value, 120);
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return 'provided';
  return digits.length <= 4 ? `****${digits}` : `****${digits.slice(-4)}`;
}

function idempotencyKey(req: NextRequest) {
  return text(req.headers.get('Idempotency-Key'), 180) || null;
}

async function auditVendor(action: string, req: NextRequest, vendorId: string, extra: Record<string, any> = {}) {
  await auditEnterpriseFinance(action, req, {
    model: 'OpsVendor',
    subjectId: vendorId,
    idempotencyKey: idempotencyKey(req),
    mutationSurface: 'enterprise_finance_vendor_admin',
    ...extra,
  });
}

export async function GET(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;

    const db: any = prisma;
    const { searchParams } = new URL(req.url);

    const status = text(searchParams.get('status'), 80);
    const vendorType = text(searchParams.get('vendorType'), 100);
    const q = text(searchParams.get('q'), 160);
    const payoutEligible = searchParams.get('payoutEligible');
    const limitRaw = Number(searchParams.get('limit') || 100);
    const limit = Math.max(1, Math.min(Number.isFinite(limitRaw) ? limitRaw : 100, 500));

    const where: any = {};

    if (status) where.status = status;
    if (vendorType) where.vendorType = vendorType;
    if (payoutEligible === 'true') where.payoutEligible = true;
    if (payoutEligible === 'false') where.payoutEligible = false;

    if (q) {
      where.OR = [
        { legalName: { contains: q, mode: 'insensitive' } },
        { registeredName: { contains: q, mode: 'insensitive' } },
        { tradingName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { vatNumber: { contains: q, mode: 'insensitive' } },
        { industry: { contains: q, mode: 'insensitive' } },
      ];
    }

    const vendors = await db.opsVendor.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
    });

    return json({
      ok: true,
      envelope: access.envelope,
      vendors,
      meta: {
        count: vendors.length,
        limit,
        status: status || 'all',
        payoutEligible: payoutEligible || 'all',
      },
    });
  } catch (error: any) {
    return routeError(error, 'enterprise_finance_vendor_list_failed');
  }
}

export async function POST(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;

    const db: any = prisma;
    const body = await req.json().catch(() => ({}));
    const action = text(body.action || 'create_vendor', 120);

    if (action !== 'create_vendor') {
      return json({ ok: false, envelope: access.envelope, error: 'unsupported_vendor_post_action', action }, 400);
    }

    const legalName = text(body.legalName || body.registeredName || body.companyName, 240);
    if (!legalName) {
      return json({ ok: false, envelope: access.envelope, error: 'registered_name_required' }, 400);
    }

    const tradingNameSameAsRegistered = body.tradingNameSameAsRegistered === undefined ? false : Boolean(body.tradingNameSameAsRegistered);

    const vendor = await db.opsVendor.create({
      data: {
        vendorType: text(body.vendorType || 'supplier', 100),
        status: text(body.status || 'active', 80),

        legalName,
        registeredName: text(body.registeredName || legalName, 240),
        tradingName: tradingNameSameAsRegistered ? legalName : text(body.tradingName, 240),
        tradingNameSameAsRegistered,

        email: cleanEmail(body.email || body.contactEmail),
        phone: text(body.phone || body.contactPhone, 80),
        website: text(body.website, 500),
        industry: text(body.industry, 160),
        products: asObject(body.products || body.productList || body.services || {}),

        addressLine1: text(body.addressLine1, 300),
        addressLine2: text(body.addressLine2, 300),
        city: text(body.city, 160),
        province: text(body.province || body.state, 160),
        postalCode: text(body.postalCode || body.zipCode, 40),
        country: text(body.country || 'ZA', 2),

        contactName: text(body.contactName || body.contactPerson1Name, 240),
        contactEmail: cleanEmail(body.contactEmail || body.contactPerson1Email),
        contactPhone: text(body.contactPhone || body.contactPerson1Phone, 80),

        contactPerson1Name: text(body.contactPerson1Name || body.contactName, 240),
        contactPerson1Role: text(body.contactPerson1Role, 160),
        contactPerson1Email: cleanEmail(body.contactPerson1Email || body.contactEmail),
        contactPerson1Phone: text(body.contactPerson1Phone || body.contactPhone, 80),

        contactPerson2Name: text(body.contactPerson2Name, 240),
        contactPerson2Role: text(body.contactPerson2Role, 160),
        contactPerson2Email: cleanEmail(body.contactPerson2Email),
        contactPerson2Phone: text(body.contactPerson2Phone, 80),

        manufacturer: Boolean(body.manufacturer),
        supplier: body.supplier === undefined ? true : Boolean(body.supplier),
        payoutEligible: Boolean(body.payoutEligible),
        preferredPayoutMethod: text(body.preferredPayoutMethod, 80),

        bankName: text(body.bankName, 180),
        bankAccountName: text(body.bankAccountName, 240),
        bankAccountMasked: maskAccount(body.bankAccountNumber || body.bankAccountMasked),
        bankAccountNumberMasked: maskAccount(body.bankAccountNumber || body.bankAccountNumberMasked),
        bankBranchCode: text(body.bankBranchCode, 80),
        bankSwiftCode: text(body.bankSwiftCode, 80),
        paypalEmail: cleanEmail(body.paypalEmail),

        vatRegistered: Boolean(body.vatRegistered),
        vatNumber: text(body.vatNumber, 120),
        taxIdentifierMasked: text(body.taxIdentifierMasked, 120),

        registrationSource: text(body.registrationSource || 'admin_vendor_create', 120),
        documents: asObject(body.documents || {}),
        vendorMeta: asObject(body.vendorMeta || body.meta || {}),
        createdByUserId: access.envelope.actor.userId,
        approvedByUserId: Boolean(body.approveNow) ? access.envelope.actor.userId : null,
        approvedAt: Boolean(body.approveNow) ? new Date() : null,
      },
    });

    await auditVendor('vendor_created', req, vendor.id, { status: vendor.status });
    return json({ ok: true, envelope: access.envelope, vendor }, 201);
  } catch (error: any) {
    return routeError(error, 'enterprise_finance_vendor_create_failed');
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;

    const db: any = prisma;
    const body = await req.json().catch(() => ({}));
    const action = text(body.action, 120);
    const id = text(body.id || body.vendorId, 180);

    if (!action) {
      return json({ ok: false, envelope: access.envelope, error: 'action_required' }, 400);
    }

    if (!id) {
      return json({ ok: false, envelope: access.envelope, error: 'vendor_id_required' }, 400);
    }

    const existing = await db.opsVendor.findUnique({ where: { id } });
    if (!existing) {
      return json({ ok: false, envelope: access.envelope, error: 'vendor_not_found' }, 404);
    }

    if (
      action === 'approve_vendor' ||
      action === 'reject_vendor' ||
      action === 'archive_vendor' ||
      action === 'suspend_vendor' ||
      action === 'enable_vendor_payout' ||
      action === 'disable_vendor_payout' ||
      action === 'update_vendor'
    ) {
      const forcedStatus =
        action === 'approve_vendor' ? 'active' :
        action === 'reject_vendor' ? 'rejected' :
        action === 'archive_vendor' ? 'archived' :
        action === 'suspend_vendor' ? 'suspended' :
        undefined;

      const tradingNameSameAsRegistered = boolOrUndefined(body.tradingNameSameAsRegistered);
      const legalName = body.legalName === undefined && body.registeredName === undefined
        ? undefined
        : text(body.legalName || body.registeredName, 240);

      const vendor = await db.opsVendor.update({
        where: { id },
        data: defined({
          vendorType: body.vendorType === undefined ? undefined : text(body.vendorType, 100),
          status: forcedStatus || (body.status === undefined ? undefined : text(body.status, 80)),

          legalName,
          registeredName: body.registeredName === undefined ? undefined : text(body.registeredName, 240),
          tradingName:
            tradingNameSameAsRegistered === true
              ? (legalName || existing.legalName)
              : body.tradingName === undefined
                ? undefined
                : text(body.tradingName, 240),
          tradingNameSameAsRegistered,

          email: body.email === undefined ? undefined : cleanEmail(body.email),
          phone: body.phone === undefined ? undefined : text(body.phone, 80),
          website: body.website === undefined ? undefined : text(body.website, 500),
          industry: body.industry === undefined ? undefined : text(body.industry, 160),
          products: body.products === undefined && body.productList === undefined && body.services === undefined ? undefined : asObject(body.products || body.productList || body.services || {}),

          addressLine1: body.addressLine1 === undefined ? undefined : text(body.addressLine1, 300),
          addressLine2: body.addressLine2 === undefined ? undefined : text(body.addressLine2, 300),
          city: body.city === undefined ? undefined : text(body.city, 160),
          province: body.province === undefined && body.state === undefined ? undefined : text(body.province || body.state, 160),
          postalCode: body.postalCode === undefined && body.zipCode === undefined ? undefined : text(body.postalCode || body.zipCode, 40),
          country: body.country === undefined ? undefined : text(body.country, 2),

          contactName: body.contactName === undefined ? undefined : text(body.contactName, 240),
          contactEmail: body.contactEmail === undefined ? undefined : cleanEmail(body.contactEmail),
          contactPhone: body.contactPhone === undefined ? undefined : text(body.contactPhone, 80),

          contactPerson1Name: body.contactPerson1Name === undefined ? undefined : text(body.contactPerson1Name, 240),
          contactPerson1Role: body.contactPerson1Role === undefined ? undefined : text(body.contactPerson1Role, 160),
          contactPerson1Email: body.contactPerson1Email === undefined ? undefined : cleanEmail(body.contactPerson1Email),
          contactPerson1Phone: body.contactPerson1Phone === undefined ? undefined : text(body.contactPerson1Phone, 80),

          contactPerson2Name: body.contactPerson2Name === undefined ? undefined : text(body.contactPerson2Name, 240),
          contactPerson2Role: body.contactPerson2Role === undefined ? undefined : text(body.contactPerson2Role, 160),
          contactPerson2Email: body.contactPerson2Email === undefined ? undefined : cleanEmail(body.contactPerson2Email),
          contactPerson2Phone: body.contactPerson2Phone === undefined ? undefined : text(body.contactPerson2Phone, 80),

          manufacturer: boolOrUndefined(body.manufacturer),
          supplier: boolOrUndefined(body.supplier),
          payoutEligible:
            action === 'enable_vendor_payout'
              ? true
              : action === 'disable_vendor_payout' || action === 'archive_vendor' || action === 'suspend_vendor'
                ? false
                : boolOrUndefined(body.payoutEligible),
          preferredPayoutMethod: body.preferredPayoutMethod === undefined ? undefined : text(body.preferredPayoutMethod, 80),

          bankName: body.bankName === undefined ? undefined : text(body.bankName, 180),
          bankAccountName: body.bankAccountName === undefined ? undefined : text(body.bankAccountName, 240),
          bankAccountMasked: body.bankAccountNumber === undefined && body.bankAccountMasked === undefined ? undefined : maskAccount(body.bankAccountNumber || body.bankAccountMasked),
          bankAccountNumberMasked: body.bankAccountNumber === undefined && body.bankAccountNumberMasked === undefined ? undefined : maskAccount(body.bankAccountNumber || body.bankAccountNumberMasked),
          bankBranchCode: body.bankBranchCode === undefined ? undefined : text(body.bankBranchCode, 80),
          bankSwiftCode: body.bankSwiftCode === undefined ? undefined : text(body.bankSwiftCode, 80),
          paypalEmail: body.paypalEmail === undefined ? undefined : cleanEmail(body.paypalEmail),

          vatRegistered: boolOrUndefined(body.vatRegistered),
          vatNumber: body.vatNumber === undefined ? undefined : text(body.vatNumber, 120),
          taxIdentifierMasked: body.taxIdentifierMasked === undefined ? undefined : text(body.taxIdentifierMasked, 120),

          documents: body.documents === undefined ? undefined : asObject(body.documents),
          vendorMeta: body.vendorMeta === undefined && body.meta === undefined ? undefined : asObject(body.vendorMeta || body.meta || {}),

          approvedByUserId: action === 'approve_vendor' ? access.envelope.actor.userId : undefined,
          approvedAt: action === 'approve_vendor' ? new Date() : undefined,
          archivedAt: action === 'archive_vendor' ? new Date() : undefined,
        }),
      });

      const auditAction =
        action === 'approve_vendor' ? 'vendor_approved' :
        action === 'reject_vendor' ? 'vendor_rejected' :
        action === 'archive_vendor' ? 'vendor_archived' :
        action === 'suspend_vendor' ? 'vendor_suspended' :
        action === 'enable_vendor_payout' ? 'vendor_payout_enabled' :
        action === 'disable_vendor_payout' ? 'vendor_payout_disabled' :
        'vendor_updated';

      await auditVendor(auditAction, req, vendor.id, {
        status: vendor.status,
        payoutEligible: vendor.payoutEligible,
      });

      return json({ ok: true, envelope: access.envelope, vendor });
    }

    return json({ ok: false, envelope: access.envelope, error: 'unsupported_vendor_patch_action', action }, 400);
  } catch (error: any) {
    return routeError(error, 'enterprise_finance_vendor_patch_failed');
  }
}
