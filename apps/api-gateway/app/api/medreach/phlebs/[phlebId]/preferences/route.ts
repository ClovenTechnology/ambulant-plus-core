// apps/api-gateway/app/api/medreach/phlebs/[phlebId]/preferences/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanBoolean(value: unknown, fallback: boolean | undefined = undefined) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return fallback;
}

function roleOf(who: any) {
  return String(who.role || '').toLowerCase();
}

async function findPhleb(phlebId: string) {
  return prisma.medReachPhlebProfile.findFirst({
    where: {
      OR: [{ id: phlebId }, { userId: phlebId }],
    },
    include: {
      defaultLab: true,
    },
  });
}

function canAccessPreferences(phleb: any, who: any) {
  const role = roleOf(who);

  if (['admin', 'system'].includes(role)) return true;

  if (role === 'phleb') {
    return Boolean(who.uid && phleb.userId === who.uid);
  }

  return false;
}

function projectPreferences(row: any, labs: any[]) {
  return {
    phlebProfileId: row.id,
    phlebId: row.userId,
    userId: row.userId,

    active: row.active,
    approvalStatus: row.approvalStatus,

    country: row.country,
    currency: row.currency,

    defaultLabId: row.defaultLabId ?? null,
    defaultLab: row.defaultLab
      ? {
          id: row.defaultLab.id,
          name: row.defaultLab.name,
          active: row.defaultLab.active,
          status: row.defaultLab.status,
          country: row.defaultLab.country,
          currency: row.defaultLab.currency,
        }
      : null,

    availableDefaultLabs: labs.map((lab) => ({
      id: lab.id,
      name: lab.name,
      active: lab.active,
      status: lab.status,
      country: lab.country,
      currency: lab.currency,
    })),

    /**
     * Future schema-safe expansion:
     * preferredRadiusKm, workingHours, sampleTypesAccepted, coldChainCapable,
     * vehicleMode and homeDrawZones should get a real Json/preferences table
     * before we persist them.
     */
    schemaBackedPreferences: {
      country: row.country,
      currency: row.currency,
      defaultLabId: row.defaultLabId ?? null,
      active: row.active,
    },

    createdAt: row.createdAt?.toISOString?.() ?? null,
    updatedAt: row.updatedAt?.toISOString?.() ?? null,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { phlebId: string } },
) {
  const who = readIdentity(req.headers);
  const phlebId = cleanString(params.phlebId);

  if (!phlebId) {
    return NextResponse.json({ ok: false, error: 'missing_phlebId' }, { status: 400 });
  }

  const phleb = await findPhleb(phlebId);

  if (!phleb) {
    return NextResponse.json({ ok: false, error: 'phleb_not_found' }, { status: 404 });
  }

  if (!canAccessPreferences(phleb, who)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const labs = await prisma.labPartner.findMany({
    where: {
      active: true,
      status: 'ACTIVE',
      country: phleb.country,
    },
    orderBy: { name: 'asc' },
    take: 200,
  });

  return NextResponse.json({
    ok: true,
    data: projectPreferences(phleb, labs),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { phlebId: string } },
) {
  const who = readIdentity(req.headers);
  const role = roleOf(who);
  const phlebId = cleanString(params.phlebId);

  if (!phlebId) {
    return NextResponse.json({ ok: false, error: 'missing_phlebId' }, { status: 400 });
  }

  const existing = await findPhleb(phlebId);

  if (!existing) {
    return NextResponse.json({ ok: false, error: 'phleb_not_found' }, { status: 404 });
  }

  if (!canAccessPreferences(existing, who)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown>;

  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const data: Record<string, any> = {};

  if ('country' in body) {
    data.country = cleanString(body.country).toUpperCase().slice(0, 2) || existing.country;
  }

  if ('currency' in body) {
    data.currency = cleanString(body.currency).toUpperCase().slice(0, 3) || existing.currency;
  }

  if ('defaultLabId' in body) {
    const defaultLabId = cleanString(body.defaultLabId) || null;

    if (defaultLabId) {
      const lab = await prisma.labPartner.findUnique({
        where: { id: defaultLabId },
        select: { id: true, active: true, status: true },
      });

      if (!lab || !lab.active || lab.status !== 'ACTIVE') {
        return NextResponse.json(
          { ok: false, error: 'default_lab_not_found_or_inactive' },
          { status: 400 },
        );
      }
    }

    data.defaultLabId = defaultLabId;
  }

  if (['admin', 'system'].includes(role) && 'active' in body) {
    data.active = cleanBoolean(body.active, existing.active);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: false, error: 'no_changes' }, { status: 400 });
  }

  const row = await prisma.medReachPhlebProfile.update({
    where: { id: existing.id },
    data,
    include: {
      defaultLab: true,
    },
  });

  await prisma.auditEvent.create({
    data: {
      kind: 'medreach_phleb_preferences_updated',
      actorId: who.uid,
      actorRole: who.role,
      subjectId: row.id,
      meta: {
        phlebProfileId: row.id,
        userId: row.userId,
        changedFields: Object.keys(data),
      },
    },
  });

  const labs = await prisma.labPartner.findMany({
    where: {
      active: true,
      status: 'ACTIVE',
      country: row.country,
    },
    orderBy: { name: 'asc' },
    take: 200,
  });

  return NextResponse.json({
    ok: true,
    data: projectPreferences(row, labs),
  });
}