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

function stableUserId(email: string, phone: string) {
  const base = email || phone || `rider-${Date.now()}`;
  return `careport-rider-applicant:${base.toLowerCase().replace(/[^a-z0-9@.+_-]+/g, '-')}`.slice(0, 160);
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

    const fullName = clean(body?.fullName || body?.name, 180);
    const email = cleanEmail(body?.email || body?.contactEmail);
    const phone = cleanPhone(body?.phone || body?.contactPhone);
    const idNumberMasked = clean(body?.idNumberMasked || body?.identityNumberMasked || body?.idNumber, 160);
    const vehicleType = clean(body?.vehicleType || body?.transportType, 80);
    const vehicleRegistration = clean(body?.vehicleRegistration || body?.registration, 80);
    const serviceAreas = clean(body?.serviceAreas || body?.areas, 500);
    const city = clean(body?.city, 120);
    const country = clean(body?.country || 'ZA', 2).toUpperCase() || 'ZA';
    const currency = clean(body?.currency || 'ZAR', 3).toUpperCase() || 'ZAR';
    const bankAccountMasked = clean(body?.bankAccountMasked || body?.payoutAccountMask || body?.accountMask, 160);
    const notes = clean(body?.notes || body?.message, 1200);

    if (!fullName) return json({ ok: false, error: 'full_name_required' }, 400);
    if (!email) return json({ ok: false, error: 'email_required' }, 400);
    if (!phone) return json({ ok: false, error: 'phone_required' }, 400);

    const userId = stableUserId(email, phone);

    const kyiPayload = {
      source: 'careport_public_partner_application',
      applicantType: 'RIDER',
      fullName,
      email,
      phone,
      idNumberMasked,
      vehicleType,
      vehicleRegistration,
      serviceAreas,
      city,
      country,
      currency,
      bankAccountMasked,
      hasOwnTransport: bool(body?.hasOwnTransport, true),
      coldChainAware: bool(body?.coldChainAware, false),
      notes,
      submittedAt: new Date().toISOString(),
    };

    const rider = await (prisma as any).carePortRiderProfile.upsert({
      where: { userId },
      create: {
        orgId,
        userId,
        country,
        currency,
        isActive: false,
        isOnJob: false,
        kyiStatus: 'PENDING_REVIEW',
        kyiSchemaKey: 'ZA_RIDER_PUBLIC_INTAKE_v1',
        kyiPayload,
        kyiSubmittedAt: new Date(),
        kyiVerifiedAt: null,
        kyiRejectedReason: null,
        bankAccountMasked: bankAccountMasked || null,
        accountStatus: 'AWAITING_ACTIVATION',
        payoutCycle: 'WEEKLY',
      } as any,
      update: {
        orgId,
        country,
        currency,
        isActive: false,
        isOnJob: false,
        kyiStatus: 'PENDING_REVIEW',
        kyiSchemaKey: 'ZA_RIDER_PUBLIC_INTAKE_v1',
        kyiPayload,
        kyiSubmittedAt: new Date(),
        kyiVerifiedAt: null,
        kyiRejectedReason: null,
        bankAccountMasked: bankAccountMasked || null,
        accountStatus: 'AWAITING_ACTIVATION',
      } as any,
    });

    await (prisma as any).auditEvent?.create?.({
      data: {
        kind: 'careport_rider_public_application_submitted',
        actorId: null,
        actorRole: 'public_applicant',
        subjectId: userId,
        meta: { orgId, riderProfileId: rider.id, userId, fullName, email, phone },
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