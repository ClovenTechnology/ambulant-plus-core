import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { asObject, json, routeError, text } from '@/src/enterprise-finance/access-envelope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// A5_M_G_A_PUBLIC_VENDOR_REGISTRATION_ROUTE

function cleanEmail(value: any) {
  return text(value, 320)?.toLowerCase() || null;
}

function bool(value: any) {
  return value === true || value === 'true';
}

function maskAccount(value: any) {
  const raw = text(value, 120);
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (!digits) return 'provided';
  return digits.length <= 4 ? `****${digits}` : `****${digits.slice(-4)}`;
}

export async function POST(req: NextRequest) {
  try {
    const db: any = prisma;
    const body = await req.json().catch(() => ({}));

    const legalName = text(body.legalName || body.registeredName || body.companyName, 240);
    const tradingNameSameAsRegistered = bool(body.tradingNameSameAsRegistered);
    const tradingName = tradingNameSameAsRegistered ? legalName : text(body.tradingName, 240);

    if (!legalName) {
      return json({ ok: false, error: 'registered_name_required' }, 400);
    }

    const email = cleanEmail(body.email || body.contactEmail || body.contactPerson1Email);
    const contactPhone = text(body.phone || body.contactPhone || body.contactPerson1Phone, 80);

    if (!email && !contactPhone) {
      return json({ ok: false, error: 'email_or_phone_required' }, 400);
    }

    const vendor = await db.opsVendor.create({
      data: {
        vendorType: text(body.vendorType || 'supplier', 100),
        status: 'pending',

        legalName,
        registeredName: text(body.registeredName || legalName, 240),
        tradingName,
        tradingNameSameAsRegistered,

        email,
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
        contactPhone,

        contactPerson1Name: text(body.contactPerson1Name || body.contactName, 240),
        contactPerson1Role: text(body.contactPerson1Role, 160),
        contactPerson1Email: cleanEmail(body.contactPerson1Email || body.contactEmail),
        contactPerson1Phone: text(body.contactPerson1Phone || body.contactPhone, 80),

        contactPerson2Name: text(body.contactPerson2Name, 240),
        contactPerson2Role: text(body.contactPerson2Role, 160),
        contactPerson2Email: cleanEmail(body.contactPerson2Email),
        contactPerson2Phone: text(body.contactPerson2Phone, 80),

        manufacturer: bool(body.manufacturer),
        supplier: body.supplier === undefined ? true : bool(body.supplier),
        payoutEligible: false,
        preferredPayoutMethod: text(body.preferredPayoutMethod, 80),

        bankName: text(body.bankName, 180),
        bankAccountName: text(body.bankAccountName, 240),
        bankAccountMasked: maskAccount(body.bankAccountNumber || body.bankAccountMasked),
        bankAccountNumberMasked: maskAccount(body.bankAccountNumber || body.bankAccountNumberMasked),
        bankBranchCode: text(body.bankBranchCode, 80),
        bankSwiftCode: text(body.bankSwiftCode, 80),
        paypalEmail: cleanEmail(body.paypalEmail),

        vatRegistered: bool(body.vatRegistered),
        vatNumber: text(body.vatNumber, 120),
        taxIdentifierMasked: text(body.taxIdentifierMasked, 120),

        registrationSource: 'public_vendor_registration',
        documents: asObject(body.documents || {}),
        vendorMeta: asObject({
          submittedAt: new Date().toISOString(),
          submittedFrom: 'public_vendor_registration',
          productSummary: body.productSummary || null,
          notes: body.notes || null,
        }),
      },
    });

    return json({
      ok: true,
      vendor: {
        id: vendor.id,
        status: vendor.status,
        legalName: vendor.legalName,
        tradingName: vendor.tradingName,
        email: vendor.email,
      },
    }, 201);
  } catch (error: any) {
    return routeError(error, 'public_vendor_registration_failed');
  }
}
