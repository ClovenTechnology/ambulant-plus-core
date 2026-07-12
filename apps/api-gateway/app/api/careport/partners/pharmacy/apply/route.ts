import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clean(value: unknown, max = 500) {
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

function orgIdFromHeaders(req: NextRequest) {
  return clean(req.headers.get('x-org-id') || process.env.DEFAULT_ORG_ID || 'org-default', 160) || 'org-default';
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

    const pharmacyName = clean(body?.pharmacyName || body?.name || body?.businessName, 220);
    const contactName = clean(body?.contactName || body?.ownerName || body?.responsiblePerson, 180);
    const email = cleanEmail(body?.email || body?.contactEmail);
    const phone = cleanPhone(body?.phone || body?.contactPhone);
    const registrationNumber = clean(body?.registrationNumber || body?.companyRegistrationNumber, 160);
    const sapcNumber = clean(body?.sapcNumber || body?.licenseNumber || body?.pharmacyCouncilNumber, 160);
    const address = clean(body?.address || body?.physicalAddress, 500);
    const city = clean(body?.city, 120);
    const country = clean(body?.country || 'ZA', 2).toUpperCase() || 'ZA';
    const currency = clean(body?.currency || 'ZAR', 3).toUpperCase() || 'ZAR';
    const bankAccountMasked = clean(body?.bankAccountMasked || body?.payoutAccountMask || body?.accountMask, 160);
    const notes = clean(body?.notes || body?.message, 1200);

    if (!pharmacyName) return json({ ok: false, error: 'pharmacy_name_required' }, 400);
    if (!email) return json({ ok: false, error: 'email_required' }, 400);
    if (!phone) return json({ ok: false, error: 'phone_required' }, 400);

    const kycPayload = {
      source: 'careport_public_partner_application',
      applicantType: 'PHARMACY',
      pharmacyName,
      contactName,
      email,
      phone,
      registrationNumber,
      sapcNumber,
      address,
      city,
      country,
      currency,
      bankAccountMasked,
      supportsPickup: bool(body?.supportsPickup, true),
      supportsDelivery: bool(body?.supportsDelivery, true),
      acceptsCard: bool(body?.acceptsCard, true),
      acceptsMedicalAid: bool(body?.acceptsMedicalAid, false),
      notes,
      submittedAt: new Date().toISOString(),
    };

    const pharmacy = await (prisma as any).pharmacyPartner.create({
      data: {
        orgId,
        name: pharmacyName,
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
        bankAccountMasked: bankAccountMasked || null,
        commercialStatus: 'ONBOARDING_REVIEW',
        subscriptionStatus: 'PENDING_ONBOARDING',
        kycSchemaKey: 'ZA_SAPC_PHARMACY_PUBLIC_INTAKE_v1',
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
        meta: { orgId, pharmacyId: pharmacy.id, pharmacyName, email, phone },
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