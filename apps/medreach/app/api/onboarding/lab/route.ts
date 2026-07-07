// apps/medreach/app/api/onboarding/lab/route.ts
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

export async function POST(req: NextRequest) {
  const body = await readJson(req);

  const name = clean(body.name);
  const contact = clean(body.contact);
  const email = clean(body.email);
  const phone = clean(body.phone);
  const country = clean(body.country) || 'ZA';
  const currency = clean(body.currency) || 'ZAR';

  if (!name) {
    return NextResponse.json({ ok: false, error: 'missing_lab_name' }, { status: 400 });
  }

  if (!email && !phone && !contact) {
    return NextResponse.json(
      { ok: false, error: 'missing_lab_contact' },
      { status: 400 },
    );
  }

  const payload = {
    name,
    contact: contact || email || phone,
    ownerUserId: clean(body.ownerUserId) || email || contact || phone,
    country,
    currency,
    active: false,
    status: 'PENDING',
    onboardingStatus: 'SUBMITTED',
    canManageStaff: false,
    canPublishResults: false,
    payoutAccountMasked: normalizePayoutMask(body.payoutLast4),
    rejectionReason: null,
    meta: {
      source: 'medreach_applicant_onboarding',
      applicantType: 'lab',
      email,
      phone,
      registrationNumber: clean(body.registrationNumber),
      accreditationBody: clean(body.accreditationBody),
      address: clean(body.address),
      city: clean(body.city),
      province: clean(body.province),
      serviceAreas: clean(body.serviceAreas)
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean),
      notes: clean(body.notes),
    },
  };

  return postToGateway(req, {
    path: '/api/medreach/labs',
    body: payload,
    actorRef: email || contact || phone || name,
  });
}