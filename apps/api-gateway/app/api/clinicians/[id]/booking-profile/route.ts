// apps/api-gateway/app/api/clinicians/[id]/booking-profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { computeClinicianOperationalState } from '@/src/lib/clinician-operational-state';
import { loadClinicianComplianceChecks } from '@/src/lib/credentialing/loadChecks';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_REFUND_POLICY = {
  within24hPercent: 50,
  noShowPercent: 0,
  clinicianMissPercent: 100,
  networkProrate: true,
};

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'cache-control': 'no-store, max-age=0',
      'access-control-allow-origin': '*',
    },
  });
}

function safeParseJson(value: unknown): any {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function cleanStr(value: unknown, max = 240): string | undefined {
  const s = String(value ?? '').trim();
  if (!s) return undefined;
  return s.length > max ? s.slice(0, max) : s;
}

function normalizeCurrency(value: unknown) {
  const c = String(value || 'ZAR').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(c) ? c : 'ZAR';
}

function num(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function amountCents(...values: unknown[]) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n) && n >= 0) return Math.round(n);
  }

  return 0;
}

function normalizeCountryCode(value: unknown) {
  const raw = String(value ?? '').trim().slice(0, 80);
  const s = raw.toLowerCase();

  if (!s) return 'ZA';

  if (
    s === 'za' ||
    s === 'zaf' ||
    s === 'south africa' ||
    s === 'south-africa' ||
    s === 'republic of south africa'
  ) {
    return 'ZA';
  }

  return raw.toUpperCase();
}

function cleanComment(value: unknown, max = 360): string | null {
  const s = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!s) return null;
  return s.length > max ? `${s.slice(0, max).trim()}...` : s;
}

function splitSchemes(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).map((s) => s.trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value.split(',').map((s) => s.trim()).filter(Boolean);
  }

  return [];
}

function readProfileJson(clinician: any) {
  const meta = safeParseJson(clinician?.meta);
  const rawProfileJson = safeParseJson(meta.rawProfileJson);
  const rawProfile = safeParseJson(meta.rawProfile);
  const submittedProfile = safeParseJson(meta.submittedProfile);

  return {
    meta,
    profile: {
      ...meta,
      ...submittedProfile,
      ...rawProfile,
      ...rawProfileJson,
    },
  };
}

function buildFeeProfile(clinician: any, profile: any) {
  const currency = normalizeCurrency(clinician?.currency || profile?.currency || 'ZAR');

  const standardCents = amountCents(
    clinician?.feeCents,
    profile?.feeCents,
    profile?.standardFeeCents,
    profile?.standardConsultFeeCents,
    profile?.consultationFeeCents,
  );

  const followUpCents = amountCents(
    profile?.followUpFeeCents,
    profile?.followupFeeCents,
    standardCents > 0 ? Math.round(standardCents * 0.75) : 0,
  );

  return {
    standard: {
      priceCents: standardCents,
      currency,
      durationMin: Math.max(
        1,
        Math.round(num(profile?.durationMin ?? profile?.standardDurationMin, 30)),
      ),
      bufferMin: Math.max(0, Math.round(num(profile?.bufferMin, 0))),
    },
    followUp: {
      priceCents: followUpCents,
      currency,
      durationMin: Math.max(
        1,
        Math.round(num(profile?.followUpDurationMin ?? profile?.followupDurationMin, 15)),
      ),
      bufferMin: Math.max(
        0,
        Math.round(num(profile?.followUpBufferMin ?? profile?.followupBufferMin, 0)),
      ),
    },
  };
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,OPTIONS',
      'access-control-allow-headers':
        'content-type,authorization,cookie,x-uid,x-role,x-org-id,x-ambulant-identity',
    },
  });
}

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const requestedId = decodeURIComponent(String(ctx.params.id || '')).trim();

    if (!requestedId) {
      return json({ ok: false, error: 'id_required' }, 400);
    }

    const clinician = await (prisma as any).clinicianProfile.findFirst({
      where: {
        OR: [{ id: requestedId }, { userId: requestedId }],
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!clinician) {
      return json({ ok: false, error: 'unknown_clinician' }, 404);
    }

    const onboarding = await (prisma as any).clinicianOnboarding.findFirst({
      where: { clinicianId: clinician.id },
      orderBy: { createdAt: 'desc' },
    });

    const trainingSlot = onboarding?.trainingSlotId
      ? await (prisma as any).clinicianTrainingSlot.findUnique({
          where: { id: onboarding.trainingSlotId },
        })
      : null;

    const dispatch = await (prisma as any).clinicianDispatch.findFirst({
      where: { clinicianId: clinician.id },
      orderBy: { createdAt: 'desc' },
    });

    const checks = await loadClinicianComplianceChecks({
      clinicianId: clinician.id,
      orgId: 'org-default',
    });

    const operational: any = computeClinicianOperationalState({
      clinician,
      onboarding,
      trainingSlot,
      dispatch,
      checks,
    });

    const testimonialRows = await (prisma as any).clinicianRating.findMany({
      where: {
        clinicianUserId: clinician.userId,
        stars: { gte: 4 },
        comment: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: {
        id: true,
        stars: true,
        comment: true,
        createdAt: true,
      },
    });

    const testimonials = testimonialRows
      .map((row: any) => {
        const comment = cleanComment(row.comment);
        if (!comment) return null;
        return {
          id: String(row.id),
          stars: typeof row.stars === 'number' ? row.stars : undefined,
          comment,
          createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
        };
      })
      .filter(Boolean)
      .slice(0, 3);

    const { meta, profile } = readProfileJson(clinician);
    const fees = buildFeeProfile(clinician, profile);

    const acceptedSchemes = [
      ...splitSchemes(clinician.acceptedSchemes),
      ...splitSchemes(profile.acceptedSchemes),
      ...splitSchemes(profile.schemes),
      ...splitSchemes(profile.insurers),
    ];

    const acceptsMedicalAid =
      clinician.acceptsMedicalAid === true ||
      profile.acceptsMedicalAid === true ||
      profile.hasInsurance === true ||
      acceptedSchemes.length > 0;

    const city = cleanStr(clinician.city) || cleanStr(profile.city);
    const province =
      cleanStr(profile.province) || cleanStr(profile.region) || cleanStr(profile.state);

    const location =
      cleanStr(clinician.location) ||
      [city, province].filter(Boolean).join(', ') ||
      city ||
      province ||
      '';

    const practiceName =
      cleanStr(clinician.practiceName) ||
      cleanStr(profile.practiceName) ||
      cleanStr(profile.practice);

    const clinicianOut = {
      id: String(clinician.id),
      userId: clinician.userId ?? null,
      name:
        clinician.displayName ||
        profile.displayName ||
        profile.name ||
        String(clinician.id),
      displayName:
        clinician.displayName ||
        profile.displayName ||
        profile.name ||
        String(clinician.id),
      specialty: clinician.specialty || profile.specialty || 'General Practice',
      location,
      city,
      province,
      country: normalizeCountryCode(clinician.country ?? profile.country),
      timezone: profile.timezone || 'Africa/Johannesburg',
      rating:
        typeof clinician.ratingAvg === 'number'
          ? clinician.ratingAvg
          : typeof clinician.rating === 'number'
            ? clinician.rating
            : 0,
      ratingAvg: typeof clinician.ratingAvg === 'number' ? clinician.ratingAvg : 0,
      ratingCount: typeof clinician.ratingCount === 'number' ? clinician.ratingCount : 0,
      bio: cleanStr(profile.bio || profile.publicBio || profile.about, 2000),
      status: clinician.status ?? null,
      photoUrl: clinician.photoUrl ?? profile.photoUrl ?? profile.avatarUrl ?? null,
      avatarUrl: clinician.avatarUrl ?? profile.avatarUrl ?? profile.photoUrl ?? null,
      acceptsMedicalAid,
      acceptedSchemes: Array.from(new Set(acceptedSchemes)),
      practiceName,
      practiceAddress1: cleanStr(
        profile.practiceAddress1 || profile.addressLine1 || profile.address1,
      ),
      practiceAddress2: cleanStr(
        profile.practiceAddress2 || profile.addressLine2 || profile.address2,
      ),
      practiceCity: city,
      practiceCountry: normalizeCountryCode(
        profile.practiceCountry || profile.country || clinician.country,
      ),
      practicePhone: cleanStr(profile.practicePhone || profile.phone || clinician.phone),
      practiceEmail: cleanStr(profile.practiceEmail || profile.email || clinician.userId),
      hpcsaRegNo: cleanStr(
        clinician.hpcsaRegNo || profile.hpcsaRegNo || profile.regulatorRegistration,
      ),
      regulatorBody: cleanStr(profile.regulatorBody || profile.board || 'HPCSA'),
      bhfNumberPresent: Boolean(profile.bhfNumber || profile.practiceNumber),
      qualifications: Array.isArray(profile.qualifications) ? profile.qualifications : [],
      verifiedQualifications: Array.isArray(profile.verifiedQualifications)
        ? profile.verifiedQualifications
        : [],
      additionalQualifications: Array.isArray(profile.additionalQualifications)
        ? profile.additionalQualifications
        : [],
      online: Boolean(clinician.online),
      operational: {
        canBeListed: operational.canBeListed,
        canBeBooked: operational.canBeBooked,
        canPrescribe: operational.canPrescribe,
        prescribingMode: operational.prescribingMode,
        allowedWorkspaces: operational.allowedWorkspaces,
        patientCategory: operational.patientCategory,
      },
    };

    return json({
      ok: true,
      clinician: clinicianOut,
      fees,
      refundPolicy: DEFAULT_REFUND_POLICY,
      rules: {
        followUpRequiresOpenCase: true,
        followUpFromCaseContextOnly: true,
      },
      testimonials,
      meta: {
        source: 'api_gateway_booking_profile',
        realPatientApprovedAt:
          meta.realPatientApprovedAt ?? meta.realPatientApproval?.approvedAt ?? null,
      },
    });
  } catch (e: any) {
    console.error('[api-gateway] clinician booking profile failed', e);
    return json(
      { ok: false, error: 'booking_profile_failed', detail: String(e?.message || e) },
      500,
    );
  }
}
