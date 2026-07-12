import { NextRequest, NextResponse } from 'next/server';
import { clean, postToGateway, readJson } from '../_gateway';

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

function splitArrayOrCsv(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((part) => clean(part)).filter(Boolean);
  }

  return splitCsv(value);
}

function fullName(firstName: string, middleName: string, lastName: string) {
  return [firstName, middleName, lastName].map((part) => part.trim()).filter(Boolean).join(' ');
}

function cleanBool(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value;
  const raw = clean(value).toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(raw)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(raw)) return false;
  return fallback;
}

export async function POST(req: NextRequest) {
  const body = await readJson(req);

  const firstName = clean(body.firstName);
  const middleName = clean(body.middleName);
  const lastName = clean(body.lastName);
  const full = clean(body.fullName) || fullName(firstName, middleName, lastName);

  const email = clean(body.email).toLowerCase();
  const phone = clean(body.phone);
  const country = countryCode(body.country);
  const currency = currencyFor(country, body.currency);

  const avatarUrl = clean(body.avatarDataUrl || body.avatarUrl);
  const serviceAreas = splitCsv(body.serviceAreas);
  const preferredLabIds = splitArrayOrCsv(body.preferredLabIds || body.preferredLabs);

  const bankName = clean(body.bankName);
  const accountName = clean(body.accountName);
  const accountNumber = clean(body.accountNumber);
  const branchCode = clean(body.branchCode);

  if (!firstName || !lastName) {
    return NextResponse.json({ ok: false, error: 'missing_first_or_last_name' }, { status: 400 });
  }

  if (!email && !phone) {
    return NextResponse.json({ ok: false, error: 'missing_phleb_contact' }, { status: 400 });
  }

  const actorRef = email || phone || full;

  const identityKind =
    country === 'ZA' && clean(body.saIdNumber || body.idNumber)
      ? 'SOUTH_AFRICAN_ID'
      : 'PASSPORT';

  const vehicle = {
    type: clean(body.vehicleType),
    make: clean(body.vehicleMake),
    model: clean(body.vehicleModel),
    year: clean(body.vehicleYear),
    registration: clean(body.vehicleRegistration),
    colour: clean(body.vehicleColour || body.vehicleColor),
    hasOwnTransport: cleanBool(body.hasOwnTransport, true),
    hasColdChainBag: cleanBool(body.hasColdChainBag || body.coldChainBag, false),
  };

  const payload = {
    userId: actorRef,
    fullName: full,
    displayName: full,
    avatarUrl: avatarUrl || undefined,
    email,
    contactPhone: phone,
    basePhone: phone,
    qualification: clean(body.qualification),
    country,
    currency,
    active: false,
    approvalStatus: 'PENDING',
    defaultLabId: null,
    payoutAccountMasked: normalizePayoutMask(accountNumber || body.payoutLast4),
    commissionKind: null,
    commissionValue: null,
    rejectionReason: null,
    preferences: {
      serviceAreas,
      preferredLabIds,
      vehicle,
    },
    profileMeta: {
      source: 'medreach_enterprise_partner_onboarding',
      applicantType: 'phleb',
      visualIdentity: {
        kind: 'PHLEB_PROFILE_PHOTO',
        uploaded: Boolean(avatarUrl),
        avatarUrl: avatarUrl || null,
      },
      personalIdentity: {
        firstName,
        middleName,
        lastName,
        fullName: full,
        email,
        phone,
        address: clean(body.address),
        city: clean(body.city),
        province: clean(body.province),
        country,
        identityKind,
        saIdNumber: clean(body.saIdNumber || body.idNumber),
        passportNumber: clean(body.passportNumber),
        passportCountry: clean(body.passportCountry),
        passportExpiry: clean(body.passportExpiry),
      },
      professionalIdentity: {
        qualification: clean(body.qualification),
        hpcsaNumber: clean(body.hpcsaNumber),
      },
      serviceAreas,
      preferredLabIds,
      vehicle,
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
    path: '/api/medreach/phlebs',
    body: payload,
    actorRef,
  });
}