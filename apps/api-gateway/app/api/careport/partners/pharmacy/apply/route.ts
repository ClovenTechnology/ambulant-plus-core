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


function hierarchyText(value: unknown, max = 512) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text.slice(0, max);
}

function hierarchyObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};
}

function partnerHierarchySnapshot(body: any, partnerType: string) {
  const raw = hierarchyObject(
    body?.carePortPharmacyHierarchy ||
      body?.pharmacyHierarchy ||
      body?.hierarchySnapshot ||
      body?.hierarchy ||
      body?.network ||
      body?.branch ||
      body?.franchise,
  );

  const networkName =
    hierarchyText(body?.networkName || body?.pharmacyNetworkName || body?.carePortNetworkName || raw.networkName || raw.name, 180) ||
    null;

  const branchType =
    hierarchyText(body?.branchType || body?.pharmacyBranchType || raw.branchType || raw.type, 80).toUpperCase() ||
    'INDEPENDENT_PHARMACY';

  const hqPharmacyId =
    hierarchyText(body?.hqPharmacyId || body?.headquarterPharmacyId || body?.parentPharmacyId || raw.hqPharmacyId || raw.headquarterPharmacyId || raw.parentPharmacyId, 160) ||
    null;

  const parentPharmacyId =
    hierarchyText(body?.parentPharmacyId || body?.parentId || hqPharmacyId || raw.parentId, 160) ||
    null;

  const franchiseGroupName =
    hierarchyText(body?.franchiseGroupName || body?.pharmacyFranchiseName || raw.franchiseGroupName || raw.franchiseName, 180) ||
    null;

  const branchCode =
    hierarchyText(body?.pharmacyBranchCode || body?.outletCode || body?.branchCode || raw.branchCode, 80) ||
    null;

  return {
    source: 'careport_pharmacy_hq_branch_franchise_network_onboarding',
    partnerType,
    carePortPharmacyNetwork: true,
    hierarchyModel: 'CarePortPharmacyHQBranchFranchiseMetadata',
    branchType,
    pharmacyBranchType: branchType,
    networkName,
    pharmacyNetworkName: networkName,
    franchiseGroupName,
    pharmacyFranchiseName: franchiseGroupName,
    hqPharmacyId,
    headquarterPharmacyId: hqPharmacyId,
    parentPharmacyId,
    branchCode,
    pharmacyBranchCode: branchCode,
    isHeadquarter: ['HQ', 'HEADQUARTER', 'HEAD_OFFICE'].includes(branchType),
    isBranch: /BRANCH/.test(branchType),
    isFranchise: /FRANCHISE/.test(branchType) || Boolean(franchiseGroupName),
    capturedAt: new Date().toISOString(),
  };
}

function attachPartnerHierarchySnapshot(target: any, hierarchySnapshot: Record<string, any>) {
  if (!target || typeof target !== 'object' || Array.isArray(target)) return target;

  target.hierarchySnapshot = hierarchySnapshot;
  target.carePortPharmacyHierarchy = hierarchySnapshot;
  target.pharmacyHierarchy = hierarchySnapshot;
  target.pharmacyNetworkName = hierarchySnapshot.pharmacyNetworkName;
  target.pharmacyBranchType = hierarchySnapshot.pharmacyBranchType;
  target.pharmacyFranchiseName = hierarchySnapshot.pharmacyFranchiseName;
  target.hqPharmacyId = hierarchySnapshot.hqPharmacyId;
  target.headquarterPharmacyId = hierarchySnapshot.headquarterPharmacyId;
  target.parentPharmacyId = hierarchySnapshot.parentPharmacyId;
  target.pharmacyBranchCode = hierarchySnapshot.pharmacyBranchCode;
  target.branchPharmacyHierarchy = hierarchySnapshot.isBranch;
  target.franchisePharmacyHierarchy = hierarchySnapshot.isFranchise;

  return target;
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
    const agreementSnapshot = partnerAgreementSnapshot(body, 'careport_pharmacy');
    const hierarchySnapshot = partnerHierarchySnapshot(body, 'careport_pharmacy');

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

    attachAgreementSnapshot(kycPayload, agreementSnapshot);
    attachPartnerHierarchySnapshot(kycPayload, hierarchySnapshot);

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
        meta: { orgId, pharmacyId: pharmacy.id, displayName, registeredName, email, phone, agreementSnapshot, hierarchySnapshot },
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