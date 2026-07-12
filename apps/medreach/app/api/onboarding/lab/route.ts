import { NextRequest, NextResponse } from 'next/server';
import { clean, postToGateway, readJson } from './_gateway';

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

function countryCode(value: unknown) {
  return (clean(value) || 'ZA').toUpperCase().slice(0, 2);
}

function currencyFor(country: string, value: unknown) {
  return (clean(value) || COUNTRY_CURRENCY[country] || 'ZAR').toUpperCase().slice(0, 3);
}

function normalizePayoutMask(value: unknown) {
  const raw = clean(value).replace(/\s+/g, '');

  if (!raw) return null;
  if (raw.length <= 4) return `****${raw}`;

  return `****${raw.slice(-4)}`;
}

function splitCsv(value: unknown) {
  return clean(value)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function fullName(firstName: string, middleName: string, lastName: string) {
  return [firstName, middleName, lastName].map((part) => part.trim()).filter(Boolean).join(' ');
}

export async function POST(req: NextRequest) {
  const body = await readJson(req);

  const displayName = clean(body.displayName || body.tradingName || body.name);
  const registeredName = clean(body.registeredName || body.legalName || displayName);
  const registrationNumber = clean(body.registrationNumber);
  const accreditationBody = clean(body.accreditationBody);

  const contactFirstName = clean(body.contactFirstName || body.firstName);
  const contactMiddleName = clean(body.contactMiddleName || body.middleName);
  const contactLastName = clean(body.contactLastName || body.lastName);
  const contactName = clean(body.contactName) || fullName(contactFirstName, contactMiddleName, contactLastName);

  const email = clean(body.email).toLowerCase();
  const phone = clean(body.phone);
  const country = countryCode(body.country);
  const currency = currencyFor(country, body.currency);

  const logoUrl = clean(body.logoDataUrl || body.logoUrl);
  const serviceAreas = splitCsv(body.serviceAreas);

  const bankName = clean(body.bankName);
  const accountName = clean(body.accountName);
  const accountNumber = clean(body.accountNumber);
  const branchCode = clean(body.branchCode);

  if (!displayName) {
    return NextResponse.json({ ok: false, error: 'missing_display_or_trading_name' }, { status: 400 });
  }

  if (!registeredName) {
    return NextResponse.json({ ok: false, error: 'missing_registered_name' }, { status: 400 });
  }

  if (!registrationNumber) {
    return NextResponse.json({ ok: false, error: 'missing_registration_number' }, { status: 400 });
  }

  if (!email && !phone) {
    return NextResponse.json({ ok: false, error: 'missing_lab_contact' }, { status: 400 });
  }

  const payload = {
    name: displayName,
    displayName,
    logoUrl: logoUrl || undefined,
    contact: contactName || email || phone,
    ownerUserId: clean(body.ownerUserId) || email || contactName || phone,
    country,
    currency,
    active: false,
    status: 'PENDING',
    onboardingStatus: 'SUBMITTED',
    canManageStaff: false,
    canPublishResults: false,
    payoutAccountMasked: normalizePayoutMask(accountNumber || body.payoutLast4),
    rejectionReason: null,
    meta: {
      source: 'medreach_enterprise_partner_onboarding',
      applicantType: 'lab',
      visualIdentity: {
        kind: 'LAB_LOGO',
        uploaded: Boolean(logoUrl),
        logoUrl: logoUrl || null,
      },
      organisationIdentity: {
        displayName,
        tradingName: displayName,
        registeredName,
        legalName: registeredName,
        registrationNumber,
        accreditationBody,
      },
      primaryContact: {
        firstName: contactFirstName,
        middleName: contactMiddleName,
        lastName: contactLastName,
        fullName: contactName,
        email,
        phone,
      },
      location: {
        address: clean(body.address),
        city: clean(body.city),
        province: clean(body.province),
        country,
        serviceAreas,
      },
      payout: {
        bankName,
        accountName,
        accountNumber,
        accountNumberLast4: accountNumber ? accountNumber.slice(-4) : '',
        branchCode,
        currency,
      },
      notes: clean(body.notes),
    },
  };

  return postToGateway(req, {
    path: '/api/medreach/labs',
    body: payload,
    actorRef: email || contactName || phone || displayName,
  });
}