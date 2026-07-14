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


function agreementText(value: unknown, max = 512) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text.slice(0, max);
}

function agreementBool(value: unknown) {
  if (value === true || value === 1) return true;
  const text = agreementText(value, 32).toLowerCase();

  return ['true', '1', 'yes', 'y', 'accepted', 'agree', 'agreed', 'signed'].includes(text);
}

function agreementObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function partnerAgreementSnapshot(body: any, partnerType: string) {
  const now = new Date().toISOString();
  const raw = agreementObject(
    body?.agreementSnapshot ||
      body?.agreement ||
      body?.agreementAcceptance ||
      body?.terms ||
      body?.termsAcceptance ||
      body?.contractAcceptance,
  );

  const accepted = agreementBool(
    body?.termsAccepted ??
      body?.acceptedTerms ??
      body?.agreementAccepted ??
      body?.contractAccepted ??
      body?.attestationAccepted ??
      raw.accepted ??
      raw.termsAccepted ??
      raw.agreementAccepted ??
      raw.contractAccepted,
  );

  const termsVersion =
    agreementText(body?.termsVersion || body?.agreementVersion || body?.contractVersion || raw.termsVersion || raw.agreementVersion || raw.contractVersion || raw.version, 80) ||
    'A5-PARTNER-TERMS-v1';

  const acceptedAt =
    agreementText(body?.termsAcceptedAt || body?.agreementAcceptedAt || body?.contractAcceptedAt || body?.acceptedAt || raw.acceptedAt, 80) ||
    (accepted ? now : null);

  const signedAt =
    agreementText(body?.signedAt || raw.signedAt, 80) ||
    (accepted ? now : null);

  return {
    source: 'partner_onboarding_application',
    partnerType,
    accepted,
    termsAccepted: accepted,
    agreementAccepted: accepted,
    contractAccepted: accepted,
    attestationAccepted: accepted,
    acceptedAt,
    termsAcceptedAt: acceptedAt,
    agreementAcceptedAt: acceptedAt,
    contractAcceptedAt: acceptedAt,
    termsVersion,
    agreementVersion: agreementText(body?.agreementVersion || raw.agreementVersion || termsVersion, 80) || termsVersion,
    contractVersion: agreementText(body?.contractVersion || raw.contractVersion || termsVersion, 80) || termsVersion,
    signedAt,
    signedBy:
      agreementText(body?.signedBy || body?.applicantName || body?.contactName || body?.ownerName || raw.signedBy || raw.name, 180) ||
      null,
    signature: agreementText(body?.signature || body?.signatureText || raw.signature, 240) || null,
    signatureHash: agreementText(body?.signatureHash || raw.signatureHash, 180) || null,
    consentIp: agreementText(body?.consentIp || raw.consentIp, 80) || null,
    userAgent: agreementText(body?.userAgent || raw.userAgent, 300) || null,
    capturedAt: now,
  };
}

function attachAgreementSnapshot(target: any, agreementSnapshot: Record<string, any>) {
  if (!target || typeof target !== 'object' || Array.isArray(target)) return target;

  target.agreementSnapshot = agreementSnapshot;
  target.termsAccepted = agreementSnapshot.accepted;
  target.termsAcceptedAt = agreementSnapshot.termsAcceptedAt;
  target.termsVersion = agreementSnapshot.termsVersion;
  target.agreementAccepted = agreementSnapshot.agreementAccepted;
  target.agreementAcceptedAt = agreementSnapshot.agreementAcceptedAt;
  target.agreementVersion = agreementSnapshot.agreementVersion;
  target.contractAccepted = agreementSnapshot.contractAccepted;
  target.contractAcceptedAt = agreementSnapshot.contractAcceptedAt;
  target.contractVersion = agreementSnapshot.contractVersion;

  return target;
}

function withAgreementSnapshot(value: unknown, agreementSnapshot: Record<string, any>) {
  const base = agreementObject(value);

  return attachAgreementSnapshot({ ...base }, agreementSnapshot);
}

export async function POST(req: NextRequest) {
  try {
    const orgId = orgIdFromHeaders(req);
    const body = await req.json().catch(() => ({}));
    const agreementSnapshot = partnerAgreementSnapshot(body, 'careport_rider');

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

    attachAgreementSnapshot(kyiPayload, agreementSnapshot);

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
        meta: { orgId, riderProfileId: rider.id, userId, fullName: fullNameValue, email, phone, agreementSnapshot },
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