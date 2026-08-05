// apps/api-gateway/app/api/clinicians/me/multi-care-policy/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import {
  readIdentity,
  requireTrustedIdentityInProduction,
} from '@/src/lib/identity';
import {
  isMultiCareFoundationUnavailable,
  loadClinicianMultiCarePolicies,
  MultiCarePolicyValidationError,
  saveClinicianMultiCarePolicies,
} from '@/src/clinicians/multi-care-policy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

function parseObject(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, any>;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed
        : {};
    } catch {
      return {};
    }
  }

  return {};
}

function currency(value: unknown) {
  const normalized = String(value || 'ZAR').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : 'ZAR';
}

async function resolveClinician(req: NextRequest) {
  const who = readIdentity(req.headers);

  try {
    requireTrustedIdentityInProduction(req.headers, who);
  } catch {
    return {
      error: json({ ok: false, error: 'unauthorized' }, 401),
      clinician: null,
    };
  }

  if (!who.uid) {
    return {
      error: json({ ok: false, error: 'unauthorized' }, 401),
      clinician: null,
    };
  }

  if (who.role !== 'clinician') {
    return {
      error: json(
        { ok: false, error: 'clinician_identity_required' },
        403,
      ),
      clinician: null,
    };
  }

  const identityRefs = Array.from(
    new Set(
      [who.uid, who.actorRefId]
        .map((value) => String(value || '').trim())
        .filter(Boolean),
    ),
  );

  const clinician = await (prisma as any).clinicianProfile.findFirst({
    where: {
      OR: identityRefs.flatMap((identityRef) => [
        { id: identityRef },
        { userId: identityRef },
      ]),
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!clinician) {
    return {
      error: json({ ok: false, error: 'clinician_not_found' }, 404),
      clinician: null,
    };
  }

  if (!clinician.userId) {
    return {
      error: json(
        { ok: false, error: 'clinician_user_id_required' },
        409,
      ),
      clinician: null,
    };
  }

  return { error: null, clinician };
}

function clinicianCurrency(clinician: any) {
  const meta = parseObject(clinician?.meta);
  const rawProfile = parseObject(meta.rawProfile);
  const rawProfileJson = parseObject(meta.rawProfileJson);
  const profile = {
    ...meta,
    ...rawProfile,
    ...rawProfileJson,
  };

  return currency(
    clinician?.currency ||
      profile.currency ||
      profile.billingCurrency ||
      profile.consultationCurrency,
  );
}

function orgIdFor(clinician: any) {
  return String(clinician?.orgId || 'org-default').trim() || 'org-default';
}

function errorResponse(error: any, operation: 'load' | 'save') {
  if (error instanceof MultiCarePolicyValidationError) {
    return json(
      {
        ok: false,
        error: 'invalid_multi_care_policy',
        detail: error.message,
      },
      400,
    );
  }

  if (isMultiCareFoundationUnavailable(error)) {
    return json(
      {
        ok: false,
        error: 'multi_care_foundation_unavailable',
        detail:
          'The multi-care database foundation has not been deployed to this environment.',
      },
      503,
    );
  }

  console.error(
    `[api-gateway] ${operation.toUpperCase()} /api/clinicians/me/multi-care-policy failed`,
    error,
  );

  return json(
    {
      ok: false,
      error:
        operation === 'load'
          ? 'multi_care_policy_load_failed'
          : 'multi_care_policy_save_failed',
    },
    500,
  );
}

export async function GET(req: NextRequest) {
  try {
    const { error, clinician } = await resolveClinician(req);
    if (error || !clinician) return error;

    const result = await loadClinicianMultiCarePolicies({
      clinicianUserId: clinician.userId,
      currency: clinicianCurrency(clinician),
    });

    return json({
      ok: true,
      clinicianId: clinician.id,
      clinicianUserId: clinician.userId,
      ...result,
    });
  } catch (error: any) {
    return errorResponse(error, 'load');
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { error, clinician } = await resolveClinician(req);
    if (error || !clinician) return error;

    const body = await req.json().catch(() => ({} as any));
    const result = await saveClinicianMultiCarePolicies({
      clinicianUserId: clinician.userId,
      currency: clinicianCurrency(clinician),
      orgId: orgIdFor(clinician),
      policies: body.policies,
    });

    return json({
      ok: true,
      clinicianId: clinician.id,
      clinicianUserId: clinician.userId,
      ...result,
    });
  } catch (error: any) {
    return errorResponse(error, 'save');
  }
}
