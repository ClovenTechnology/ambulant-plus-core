import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import {
  readIdentity,
  requireTrustedIdentityInProduction,
} from '@/src/lib/identity';

function jsonError(error: string, status: number) {
  return NextResponse.json(
    { ok: false, error },
    {
      status,
      headers: {
        'cache-control': 'no-store',
      },
    },
  );
}

export async function resolveAuthenticatedClinician(
  request: NextRequest,
  requestedClinicianId?: string | null,
) {
  const who = readIdentity(request.headers);

  try {
    requireTrustedIdentityInProduction(request.headers, who);
  } catch {
    return {
      ok: false as const,
      response: jsonError('untrusted_clinician_identity', 401),
    };
  }

  if (!who.uid) {
    return {
      ok: false as const,
      response: jsonError('unauthorized', 401),
    };
  }

  if (who.role !== 'clinician') {
    return {
      ok: false as const,
      response: jsonError('clinician_identity_required', 403),
    };
  }

  const identityIds = Array.from(
    new Set(
      [who.uid, who.actorRefId]
        .map((value) => String(value || '').trim())
        .filter(Boolean),
    ),
  );

  const clinician = await prisma.clinicianProfile.findFirst({
    where: {
      OR: [
        { userId: { in: identityIds } },
        { id: { in: identityIds } },
      ],
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (!clinician) {
    return {
      ok: false as const,
      response: jsonError('clinician_not_found', 404),
    };
  }

  const requested = String(requestedClinicianId || '').trim();

  if (
    requested &&
    requested !== String(clinician.id) &&
    requested !== String(clinician.userId || '')
  ) {
    return {
      ok: false as const,
      response: jsonError('clinician_identity_mismatch', 403),
    };
  }

  return {
    ok: true as const,
    clinician,
    who,
  };
}
