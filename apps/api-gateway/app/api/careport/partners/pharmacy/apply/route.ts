import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COUNTRY_CURRENCY: Record<string, string> = {
  ZA: 'ZAR',
  NG: 'NGN',
  GB: 'GBP',
  UK: 'GBP',
  US: 'USD',
  CA: 'CAD',
  AU: 'AUD',
};

function clean(value: unknown, max = 2000) {
  return String(value ?? '').trim().slice(0, max);
}

function cleanEmail(value: unknown) {
  return clean(value, 254).toLowerCase();
}

function cleanPhone(value: unknown) {
  return clean(value, 80);
}

function bool(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value;
  const raw = String(value ?? '').trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(raw)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(raw)) return false;
  return fallback;
}

function splitCsv(value: unknown) {
  return clean(value)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function countryCode(value: unknown) {
  return (clean(value, 4) || 'ZA').toUpperCase().slice(0, 2);
}

function currencyFor(country: string, value: unknown) {
  return (clean(value, 4) || COUNTRY_CURRENCY[country] || 'ZAR').toUpperCase().slice(0, 3);
}

function orgIdFromHeaders(req: NextRequest) {
  return clean(req.headers.get('x-org-id') || process.env.DEFAULT_ORG_ID || 'org-default', 160) || 'org-default';
}

function normalizePayoutMask(value: unknown) {
  const raw = clean(value, 80).replace(/\s+/g, '');

  if (!raw) return null;
  if (raw.length <= 4) return `****${raw}`;

  return `****${raw.slice(-4)}`;
}

function fullName(firstName: string, middleName: string, lastName: string) {
  return [firstName, middleName, lastName].map((part) => part.trim()).filter(Boolean).join(' ');
}

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const orgId = orgIdFromHeaders(req);
    const body = await req.json().catch(() => ({}));

    const displayName = clean(body?.displayName || body?.tradingName || body?.pharmacyName || body?.name || body?.businessName, 220);
    const registeredName = clean(body?.registeredName || body?.legalName || displayName, 220);
    const registrationNumber = clean(body?.registrationNumber || body?.companyRegistrationNumber, 160);
    const sapcNumber = clean(body?.sapcNumber || body?.licenseNumber || body?.pharmacyCouncilNumber, 160);

    const contactFirstName = clean(body?.contactFirstName || body?.firstName, 120);
    const contactMiddleName = clean(body?.contactMiddleName || body?.middleName, 120);
    const contactLastName = clean(body?.contactLastName || body?.lastName, 120);
    const contactName =
      clean(body?.contactName || body?.ownerName || body?.responsiblePerson, 180) ||
      fullName(contactFirstName, contactMiddleName, contactLastName);

    const email = cleanEmail(body?.email || body?.contactEmail);
    const phone = cleanPhone(body?.phone || body?.contactPhone);
    const address = clean(body?.address || body?.physicalAddress, 500);
    const city = clean(body?.city, 120);
    const province = clean(body?.province, 120);
    const serviceAreas = splitCsv(body?.serviceAreas || body?.areas);
    const country = countryCode(body?.country);
    const currency = currencyFor(country, body?.currency);

    const logoUrl = clean(body?.logoDataUrl || body?.logoUrl, 1_500_000);

    const bankName = clean(body?.bankName, 160);
    const accountName = clean(body?.accountName, 180);
    const accountNumber = clean(body?.accountNumber, 120);
    const branchCode = clean(body?.branchCode, 80);

    const notes = clean(body?.notes || body?.message, 1200);

    if (!displayName) return json({ ok: false, error: 'pharmacy_display_or_trading_name_required' }, 400);
    if (!registeredName) return json({ ok: false, error: 'pharmacy_registered_name_required' }, 400);
    if (!registrationNumber && !sapcNumber) return json({ ok: false, error: 'pharmacy_registration_or_sapc_required' }, 400);
    if (!email) return json({ ok: false, error: 'email_required' }, 400);
    if (!phone) return json({ ok: false, error: 'phone_required' }, 400);

    const kycPayload = {
      source: 'careport_enterprise_public_partner_application',
      applicantType: 'PHARMACY',
      visualIdentity: {
        kind: 'PHARMACY_LOGO',
        uploaded: Boolean(logoUrl),
        logoUrl: logoUrl || null,
      },
      organisationIdentity: {
        displayName,
        tradingName: displayName,
        registeredName,
        legalName: registeredName,
        registrationNumber,
        sapcNumber,
      },
      responsibleContact: {
        firstName: contactFirstName,
        middleName: contactMiddleName,
        lastName: contactLastName,
        fullName: contactName,
        email,
        phone,
      },
      location: {
        address,
        city,
        province,
        country,
        serviceAreas,
      },
      operatingModel: {
        supportsPickup: bool(body?.supportsPickup, true),
        supportsDelivery: bool(body?.supportsDelivery, true),
        acceptsCard: bool(body?.acceptsCard, true),
        acceptsMedicalAid: bool(body?.acceptsMedicalAid, false),
      },
      payout: {
        bankName,
        accountName,
        accountNumber,
        accountNumberLast4: accountNumber ? accountNumber.slice(-4) : '',
        branchCode,
        currency,
      },
      notes,
      submittedAt: new Date().toISOString(),
    };

    const pharmacy = await (prisma as any).pharmacyPartner.create({
      data: {
        orgId,
        name: displayName,
        contact: contactName || email || phone,
        address: address || null,
        city: city || null,
        country,
        currency,
        active: false,
        supportsPickup: bool(body?.supportsPickup, true),
        supportsDelivery: bool(body?.supportsDelivery, true),
        acceptsCard: bool(body?.acceptsCard, true),
        acceptsMedicalAid: bool(body?.acceptsMedicalAid, false),
        bankAccountMasked: normalizePayoutMask(accountNumber || body?.bankAccountMasked || body?.payoutAccountMask || body?.accountMask),
        commercialStatus: 'ONBOARDING_REVIEW',
        subscriptionStatus: 'PENDING_ONBOARDING',
        kycSchemaKey: 'ZA_SAPC_PHARMACY_ENTERPRISE_PUBLIC_INTAKE_v1',
        kycPayload,
        kycSubmittedAt: new Date(),
        kycVerifiedAt: null,
        kycRejectedReason: null,
        kycStatus: 'PENDING_REVIEW',
      } as any,
    });

    await (prisma as any).auditEvent?.create?.({
      data: {
        kind: 'careport_pharmacy_public_application_submitted',
        actorId: null,
        actorRole: 'public_applicant',
        subjectId: pharmacy.id,
        meta: { orgId, pharmacyId: pharmacy.id, displayName, registeredName, email, phone },
      },
    }).catch(() => null);

    return json({
      ok: true,
      applicationType: 'pharmacy',
      applicationId: pharmacy.id,
      status: 'PENDING_REVIEW',
      message: 'Pharmacy application submitted for CarePort KYC review.',
      pharmacy,
    }, 201);
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'careport_pharmacy_application_failed' }, error?.status || 500);
  }
}