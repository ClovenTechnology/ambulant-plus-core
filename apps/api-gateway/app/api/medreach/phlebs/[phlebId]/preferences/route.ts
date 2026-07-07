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

function asObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? { ...(value as Record<string, any>) }
    : {};
}

function cleanStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => cleanString(item))
    .filter(Boolean);
}

function cleanVehicle(value: unknown): Record<string, any> {
  const raw = asObject(value);

  return {
    make: cleanString(raw.make),
    model: cleanString(raw.model),
    registration: cleanString(raw.registration),
    color: cleanString(raw.color),
    type: cleanString(raw.type),
    changePending: Boolean(raw.changePending),
  };
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

async function canAccessPreferences(req: NextRequest, phleb: any, who: any) {
  const role = roleOf(who);

  if (['admin', 'system'].includes(role)) return true;

  if (role === 'phleb') {
    return Boolean(who.uid && phleb.userId === who.uid);
  }

  if (role === 'lab') {
    const labId = cleanString(req.headers.get('x-lab-id'));
    if (!labId || phleb.defaultLabId !== labId) return false;

    const lab = await prisma.labPartner.findUnique({
      where: { id: labId },
      select: { active: true, status: true, ownerUserId: true },
    });

    return Boolean(
      lab?.active &&
        lab.status === 'ACTIVE' &&
        (!lab.ownerUserId || !who.uid || lab.ownerUserId === who.uid),
    );
  }

  if (role === 'lab_staff') {
    const labId = cleanString(req.headers.get('x-staff-lab-id'));
    if (!labId || !who.uid || phleb.defaultLabId !== labId) return false;

    const staff = await prisma.medReachLabStaff.findFirst({
      where: {
        userId: who.uid,
        labId,
        active: true,
        status: 'ACTIVE',
      },
      select: { labId: true },
    });

    return Boolean(staff?.labId);
  }

  return false;
}

function projectPreferences(row: any, labs: any[] = []) {
  const profileMeta = asObject(row.profileMeta);
  const serviceAreaMeta = asObject(row.serviceAreaMeta);
  const vehicle = asObject(profileMeta.vehicle);

  return {
    phlebId: row.id,
    userId: row.userId,
    avatarUrl: row.avatarUrl ?? '',
    contactPhone: row.phone ?? '',
    serviceAreas: Array.isArray(serviceAreaMeta.serviceAreas)
      ? serviceAreaMeta.serviceAreas
      : [],
    preferredLabIds: Array.isArray(profileMeta.preferredLabIds)
      ? profileMeta.preferredLabIds
      : row.defaultLabId
        ? [row.defaultLabId]
        : [],
    vehicle: {
      make: cleanString(vehicle.make),
      model: cleanString(vehicle.model),
      registration: cleanString(vehicle.registration),
      color: cleanString(vehicle.color),
      type: cleanString(vehicle.type || row.vehicleType),
      changePending: Boolean(vehicle.changePending),
    },
    availableLabs: labs.map((lab) => ({
      id: lab.id,
      name: lab.displayName || lab.name,
      logoUrl: lab.logoUrl ?? null,
      active: lab.active,
      status: lab.status,
      country: lab.country,
      currency: lab.currency,
    })),
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

  const existing = await findPhleb(phlebId);

  if (!existing) {
    return NextResponse.json({ ok: false, error: 'phleb_not_found' }, { status: 404 });
  }

  const allowed = await canAccessPreferences(req, existing, who);

  if (!allowed) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const labs = await prisma.labPartner.findMany({
    where: {
      active: true,
      status: 'ACTIVE',
      country: existing.country,
    },
    orderBy: { name: 'asc' },
    take: 200,
  });

  return NextResponse.json({
    ok: true,
    data: projectPreferences(existing, labs),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { phlebId: string } },
) {
  const who = readIdentity(req.headers);
  const phlebId = cleanString(params.phlebId);

  if (!phlebId) {
    return NextResponse.json({ ok: false, error: 'missing_phlebId' }, { status: 400 });
  }

  let body: Record<string, unknown>;

  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const existing = await findPhleb(phlebId);

  if (!existing) {
    return NextResponse.json({ ok: false, error: 'phleb_not_found' }, { status: 404 });
  }

  const allowed = await canAccessPreferences(req, existing, who);

  if (!allowed) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const data: Record<string, any> = {};
  const existingProfileMeta = asObject(existing.profileMeta);
  const existingServiceAreaMeta = asObject(existing.serviceAreaMeta);

  if ('avatarUrl' in body) {
    data.avatarUrl = cleanString(body.avatarUrl) || null;
  }

  if ('contactPhone' in body || 'phone' in body) {
    data.phone = cleanString(body.contactPhone || body.phone) || null;
  }

  if ('serviceAreas' in body) {
    data.serviceAreaMeta = {
      ...existingServiceAreaMeta,
      serviceAreas: cleanStringArray(body.serviceAreas),
    };
  }

  if ('preferredLabIds' in body) {
    data.profileMeta = {
      ...existingProfileMeta,
      preferredLabIds: cleanStringArray(body.preferredLabIds),
    };
  }

  if ('vehicle' in body) {
    const vehicle = cleanVehicle(body.vehicle);
    data.vehicleType = vehicle.type || null;
    data.profileMeta = {
      ...existingProfileMeta,
      ...(data.profileMeta || {}),
      vehicle,
    };
  }

  if (['admin', 'system'].includes(roleOf(who)) && 'defaultLabId' in body) {
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

  if (['admin', 'system'].includes(roleOf(who)) && 'active' in body) {
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