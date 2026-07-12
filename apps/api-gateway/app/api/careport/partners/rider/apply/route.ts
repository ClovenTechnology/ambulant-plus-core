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

function countryCode(value: unknown) {
  return (clean(value, 4) || 'ZA').toUpperCase().slice(0, 2);
}

function currencyFor(country: string, value: unknown) {
  return (clean(value, 4) || COUNTRY_CURRENCY[country] || 'ZAR').toUpperCase().slice(0, 3);
}

function splitCsv(value: unknown) {
  return clean(value)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function orgIdFromHeaders(req: NextRequest) {
  return clean(req.headers.get('x-org-id') || process.env.DEFAULT_ORG_ID || 'org-default', 160) || 'org-default';
}

function stableUserId(email: string, phone: string) {
  const base = email || phone || `rider-${Date.now()}`;
  return `careport-rider-applicant:${base.toLowerCase().replace(/[^a-z0-9@.+_-]+/g, '-')}`.slice(0, 160);
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

    const firstName = clean(body?.firstName, 120);
    const middleName = clean(body?.middleName, 120);
    const lastName = clean(body?.lastName, 120);
    const fullNameValue = clean(body?.fullName || body?.name, 180) || fullName(firstName, middleName, lastName);

    const email = cleanEmail(body?.email || body?.contactEmail);
    const phone = cleanPhone(body?.phone || body?.contactPhone);

    const country = countryCode(body?.country);
    const currency = currencyFor(country, body?.currency);

    const address = clean(body?.address || body?.residentialAddress, 500);
    const city = clean(body?.city, 120);
    const province = clean(body?.province, 120);
    const serviceAreas = splitCsv(body?.serviceAreas || body?.areas);

    const avatarUrl = clean(body?.avatarDataUrl || body?.avatarUrl, 1_500_000);

    const saIdNumber = clean(body?.saIdNumber || body?.idNumber || body?.identityNumberMasked, 160);
    const passportNumber = clean(body?.passportNumber, 160);
    const passportCountry = clean(body?.passportCountry, 120);
    const passportExpiry = clean(body?.passportExpiry, 80);

    const vehicleType = clean(body?.vehicleType || body?.transportType, 80);
    const vehicleMake = clean(body?.vehicleMake, 120);
    const vehicleModel = clean(body?.vehicleModel, 120);
    const vehicleYear = clean(body?.vehicleYear, 20);
    const vehicleRegistration = clean(body?.vehicleRegistration || body?.registration, 80);
    const vehicleColour = clean(body?.vehicleColour || body?.vehicleColor, 80);

    const bankName = clean(body?.bankName, 160);
    const accountName = clean(body?.accountName, 180);
    const accountNumber = clean(body?.accountNumber, 120);
    const branchCode = clean(body?.branchCode, 80);

    const notes = clean(body?.notes || body?.message, 1200);

    if (!firstName || !lastName) return json({ ok: false, error: 'first_and_last_name_required' }, 400);
    if (!email) return json({ ok: false, error: 'email_required' }, 400);
    if (!phone) return json({ ok: false, error: 'phone_required' }, 400);

    const userId = stableUserId(email, phone);
    const identityKind = country === 'ZA' && saIdNumber ? 'SOUTH_AFRICAN_ID' : 'PASSPORT';

    const kyiPayload = {
      source: 'careport_enterprise_public_partner_application',
      applicantType: 'RIDER',
      visualIdentity: {
        kind: 'RIDER_PROFILE_PHOTO',
        uploaded: Boolean(avatarUrl),
        avatarUrl: avatarUrl || null,
      },
      personalIdentity: {
        firstName,
        middleName,
        lastName,
        fullName: fullNameValue,
        email,
        phone,
        address,
        city,
        province,
        country,
        identityKind,
        saIdNumber,
        passportNumber,
        passportCountry,
        passportExpiry,
      },
      serviceAreas,
      vehicle: {
        type: vehicleType,
        make: vehicleMake,
        model: vehicleModel,
        year: vehicleYear,
        registration: vehicleRegistration,
        colour: vehicleColour,
        hasOwnTransport: bool(body?.hasOwnTransport, true),
        medicineHandlingAcknowledged: bool(body?.medicineHandlingAcknowledged || body?.coldChainAware, false),
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

    const existingRider = await (prisma as any).carePortRiderProfile
      ?.findFirst?.({ where: { userId } })
      .catch(() => null);

    const rider = existingRider?.id
      ? await (prisma as any).carePortRiderProfile.update({
          where: { id: existingRider.id },
          data: {
            orgId,
            country,
            currency,
            isActive: false,
            isOnJob: false,
            kyiStatus: 'PENDING_REVIEW',
            kyiSchemaKey: 'ZA_RIDER_ENTERPRISE_PUBLIC_INTAKE_v1',
            kyiPayload,
            kyiSubmittedAt: new Date(),
            kyiVerifiedAt: null,
            kyiRejectedReason: null,
            bankAccountMasked: normalizePayoutMask(accountNumber || body?.bankAccountMasked || body?.payoutAccountMask || body?.accountMask),
            accountStatus: 'AWAITING_ACTIVATION',
          } as any,
        })
      : await (prisma as any).carePortRiderProfile.create({
          data: {
            orgId,
            userId,
            country,
            currency,
            isActive: false,
            isOnJob: false,
            kyiStatus: 'PENDING_REVIEW',
            kyiSchemaKey: 'ZA_RIDER_ENTERPRISE_PUBLIC_INTAKE_v1',
            kyiPayload,
            kyiSubmittedAt: new Date(),
            kyiVerifiedAt: null,
            kyiRejectedReason: null,
            bankAccountMasked: normalizePayoutMask(accountNumber || body?.bankAccountMasked || body?.payoutAccountMask || body?.accountMask),
            accountStatus: 'AWAITING_ACTIVATION',
            payoutCycle: 'WEEKLY',
          } as any,
        });

    await (prisma as any).auditEvent?.create?.({
      data: {
        kind: 'careport_rider_public_application_submitted',
        actorId: null,
        actorRole: 'public_applicant',
        subjectId: userId,
        meta: { orgId, riderProfileId: rider.id, userId, fullName: fullNameValue, email, phone },
      },
    }).catch(() => null);

    return json({
      ok: true,
      applicationType: 'rider',
      applicationId: rider.id,
      userId,
      status: 'PENDING_REVIEW',
      message: 'Rider application submitted for CarePort KYI review.',
      rider,
    }, 201);
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'careport_rider_application_failed' }, error?.status || 500);
  }
}