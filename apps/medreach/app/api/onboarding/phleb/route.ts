// apps/medreach/app/api/onboarding/phleb/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { clean, postToGateway, readJson } from '../_gateway';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizePayoutMask(value: unknown) {
  const raw = clean(value);

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

export async function POST(req: NextRequest) {
  const body = await readJson(req);

  const fullName = clean(body.fullName);
  const email = clean(body.email);
  const phone = clean(body.phone);
  const country = clean(body.country) || 'ZA';
  const currency = clean(body.currency) || 'ZAR';

  if (!fullName) {
    return NextResponse.json({ ok: false, error: 'missing_full_name' }, { status: 400 });
  }

  if (!email && !phone) {
    return NextResponse.json(
      { ok: false, error: 'missing_phleb_contact' },
      { status: 400 },
    );
  }

  const actorRef = email || phone || fullName;

  const payload = {
    userId: actorRef,
    fullName,
    email,
    contactPhone: phone,
    basePhone: phone,
    qualification: clean(body.qualification),
    country,
    currency,
    active: false,
    approvalStatus: 'PENDING',
    defaultLabId: clean(body.defaultLabId) || null,
    payoutAccountMasked: normalizePayoutMask(body.payoutLast4),
    commissionKind: null,
    commissionValue: null,
    rejectionReason: null,
    preferences: {
      serviceAreas: splitCsv(body.serviceAreas),
      preferredLabIds: splitCsv(body.preferredLabIds),
      vehicle: {
        type: clean(body.vehicleType),
        make: clean(body.vehicleMake),
        model: clean(body.vehicleModel),
        registration: clean(body.vehicleRegistration),
        color: clean(body.vehicleColor),
      },
    },
    meta: {
      source: 'medreach_applicant_onboarding',
      applicantType: 'phleb',
      hasColdChainBag: Boolean(body.hasColdChainBag),
      hasOwnTransport: Boolean(body.hasOwnTransport),
      experienceYears: Number(body.experienceYears || 0),
      notes: clean(body.notes),
    },
  };

  return postToGateway(req, {
    path: '/api/medreach/phlebs',
    body: payload,
    actorRef,
  });
}