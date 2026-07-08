// apps/api-gateway/app/api/medreach/labs/[labId]/tests/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import { emitEvent } from '@/src/lib/events';
import { push, sseKeys } from '@/src/lib/sse';

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

function cleanNumber(value: unknown): number | null {
  if (value == null || value === '') return null;

  const n = Number(value);

  return Number.isFinite(n) ? n : null;
}

function cleanInt(value: unknown, fallback: number, min: number, max: number) {
  const n = Number(value);

  if (!Number.isFinite(n)) return fallback;

  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function cleanMoneyCents(value: unknown, fallback = 0) {
  if (value == null || value === '') return fallback;

  const n = Number(value);

  if (!Number.isFinite(n)) return fallback;

  return Math.max(0, Math.trunc(n));
}

function cleanPriceCents(body: Record<string, unknown>, fallback = 0) {
  if (body.priceCents != null) return cleanMoneyCents(body.priceCents, fallback);
  if (body.priceMinor != null) return cleanMoneyCents(body.priceMinor, fallback);

  const priceZAR = Number(body.priceZAR);

  if (Number.isFinite(priceZAR)) {
    return Math.max(0, Math.round(priceZAR * 100));
  }

  return fallback;
}

function safeJson(value: unknown) {
  if (value == null) return null;

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

function roleOf(who: any) {
  return String(who.role || '').toLowerCase();
}

function projectOfferedTest(row: any) {
  return {
    id: row.id,
    labId: row.labId,
    catalogTestId: row.catalogTestId ?? null,

    code: row.localCode || row.catalogTest?.code || row.id,
    localCode: row.localCode ?? null,

    name: row.localName,
    localName: row.localName,
    catalogName: row.catalogTest?.name ?? null,
    category: row.catalogTest?.category ?? null,
    loincCode: row.catalogTest?.loincCode ?? null,

    active: row.active,

    priceCents: row.priceCents,
    priceZAR: row.priceCents / 100,
    currency: row.currency,

    turnaroundHours: row.turnaroundHours,
    etaDays: Math.max(1, Math.ceil(row.turnaroundHours / 24)),

    specimenType: row.specimenType,
    sampleType: row.specimenType,
    containerType: row.containerType ?? null,

    requiresColdChain: row.requiresColdChain,
    requiredTempMinC: row.requiredTempMinC ?? null,
    requiredTempMaxC: row.requiredTempMaxC ?? null,
    maxTransitMins: row.maxTransitMins ?? null,

    prepNotes: row.prepNotes ?? null,
    instructions: row.prepNotes ?? '',

    availabilityMeta: row.availabilityMeta ?? null,

    createdAt: row.createdAt?.toISOString?.() ?? null,
    updatedAt: row.updatedAt?.toISOString?.() ?? null,
  };
}

async function assertLabReadAccess(req: NextRequest, labId: string, who: any) {
  const role = roleOf(who);

  if (['admin', 'clinician', 'patient', 'system'].includes(role)) return true;

  if (role === 'lab') {
    const headerLabId = cleanString(req.headers.get('x-lab-id'));

    if (!headerLabId || headerLabId !== labId) return false;

    const lab = await prisma.labPartner.findUnique({
      where: { id: labId },
      select: {
        id: true,
        active: true,
        status: true,
        ownerUserId: true,
      },
    });

    if (!lab || !lab.active) return false;
    if (lab.ownerUserId && who.uid && lab.ownerUserId !== who.uid) return false;

    return true;
  }

  if (role === 'lab_staff') {
    const headerLabId = cleanString(req.headers.get('x-staff-lab-id'));

    if (!headerLabId || headerLabId !== labId || !who.uid) return false;

    const staff = await prisma.medReachLabStaff.findFirst({
      where: {
        userId: who.uid,
        labId,
        active: true,
        status: 'ACTIVE',
        role: { in: ['OWNER', 'ADMIN', 'OPERATIONS'] as any },
      },
      select: { labId: true, role: true },
    });

    return staff?.labId === labId;
  }

  return false;
}

async function assertLabWriteAccess(req: NextRequest, labId: string, who: any) {
  const role = roleOf(who);

  if (role === 'admin') return true;

  if (role === 'lab') {
    const headerLabId = cleanString(req.headers.get('x-lab-id'));

    if (!headerLabId || headerLabId !== labId) return false;

    const lab = await prisma.labPartner.findUnique({
      where: { id: labId },
      select: {
        id: true,
        active: true,
        status: true,
        ownerUserId: true,
      },
    });

    if (!lab || !lab.active || lab.status !== 'ACTIVE') return false;
    if (lab.ownerUserId && who.uid && lab.ownerUserId !== who.uid) return false;

    return true;
  }

  if (role === 'lab_staff') {
    const headerLabId = cleanString(req.headers.get('x-staff-lab-id'));

    if (!headerLabId || headerLabId !== labId || !who.uid) return false;

    /**
     * Do not guess MedReachStaffRole enum values here.
     * For Batch 1, any ACTIVE staff member for the lab can maintain inventory.
     * We can later tighten this once admin/staff role UX is wired.
     */
    const staff = await prisma.medReachLabStaff.findFirst({
      where: {
        userId: who.uid,
        labId,
        active: true,
        status: 'ACTIVE',
      },
      select: { labId: true },
    });

    return staff?.labId === labId;
  }

  return false;
}

async function assertActiveLabExists(labId: string) {
  return prisma.labPartner.findUnique({
    where: { id: labId },
    select: {
      id: true,
      active: true,
      status: true,
      currency: true,
    },
  });
}

async function resolveCatalogTest(body: Record<string, unknown>) {
  const catalogTestId = cleanString(body.catalogTestId);
  const code = cleanString(body.code ?? body.localCode).toUpperCase();

  if (catalogTestId) {
    return prisma.medReachTestCatalog.findUnique({
      where: { id: catalogTestId },
    });
  }

  if (code) {
    return prisma.medReachTestCatalog.findUnique({
      where: { code },
    });
  }

  return null;
}

function requestedCatalogTestId(
  catalogTest: { id: string } | null,
  body: Record<string, unknown>,
) {
  return catalogTest?.id ?? (cleanString(body.catalogTestId) || null);
}

function availabilityMetaFromBody(body: Record<string, unknown>, existing?: any) {
  return safeJson({
    ...(body.availabilityMeta && typeof body.availabilityMeta === 'object'
      ? (body.availabilityMeta as Record<string, unknown>)
      : {}),
    homeDrawSupported:
      cleanBoolean(body.homeDrawSupported, undefined) ??
      existing?.availabilityMeta?.homeDrawSupported ??
      true,
    labWalkInSupported:
      cleanBoolean(body.labWalkInSupported, undefined) ??
      existing?.availabilityMeta?.labWalkInSupported ??
      true,
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { labId: string } },
) {
  const who = readIdentity(req.headers);
  const labId = cleanString(params.labId);

  if (!labId) {
    return NextResponse.json(
      { ok: false, error: 'missing_labId' },
      { status: 400 },
    );
  }

  const allowed = await assertLabReadAccess(req, labId, who);

  if (!allowed) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const q = cleanString(url.searchParams.get('q'));
  const active = cleanBoolean(
    url.searchParams.get('active'),
    roleOf(who) === 'admin' ? undefined : true,
  );
  const limit = cleanInt(url.searchParams.get('limit'), 200, 1, 500);

  const where: Record<string, any> = { labId };

  if (active !== undefined) where.active = active;

  if (q) {
    where.OR = [
      { localCode: { contains: q, mode: 'insensitive' } },
      { localName: { contains: q, mode: 'insensitive' } },
      {
        catalogTest: {
          is: {
            OR: [
              { code: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
              { category: { contains: q, mode: 'insensitive' } },
              { loincCode: { contains: q, mode: 'insensitive' } },
            ],
          },
        },
      },
    ];
  }

  const rows = await prisma.medReachLabOfferedTest.findMany({
    where,
    orderBy: [{ active: 'desc' }, { localName: 'asc' }],
    take: limit,
    include: {
      catalogTest: true,
    },
  });

  return NextResponse.json({
    ok: true,
    data: rows.map(projectOfferedTest),
    meta: {
      labId,
      count: rows.length,
    },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { labId: string } },
) {
  const who = readIdentity(req.headers);
  const labId = cleanString(params.labId);

  if (!labId) {
    return NextResponse.json(
      { ok: false, error: 'missing_labId' },
      { status: 400 },
    );
  }

  const allowed = await assertLabWriteAccess(req, labId, who);

  if (!allowed) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const lab = await assertActiveLabExists(labId);

  if (!lab || !lab.active || lab.status !== 'ACTIVE') {
    return NextResponse.json(
      { ok: false, error: 'lab_not_found_or_inactive' },
      { status: 404 },
    );
  }

  let body: Record<string, unknown>;

  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const catalogTest = await resolveCatalogTest(body);

  const localCode = cleanString(body.localCode ?? body.code).toUpperCase();
  const localName =
    cleanString(body.localName ?? body.name) ||
    catalogTest?.name ||
    localCode;

  const specimenType =
    cleanString(body.specimenType ?? body.sampleType) ||
    catalogTest?.specimenTypeDefault ||
    'Blood';

  const priceCents = cleanPriceCents(body, 0);
  const turnaroundHours = cleanInt(
    body.turnaroundHours ??
      (body.etaDays ? Number(body.etaDays) * 24 : undefined),
    24,
    1,
    24 * 60,
  );

  if (!localCode || !localName) {
    return NextResponse.json(
      { ok: false, error: 'missing_code_or_name' },
      { status: 400 },
    );
  }

  if (priceCents < 0) {
    return NextResponse.json({ ok: false, error: 'invalid_price' }, { status: 400 });
  }

  const catalogTestId = requestedCatalogTestId(catalogTest, body);
  const availabilityMeta = availabilityMetaFromBody(body);

  const maxTransitRaw = cleanNumber(body.maxTransitMins);
  const maxTransitMins = maxTransitRaw == null ? null : Math.trunc(maxTransitRaw);

  const row = await prisma.medReachLabOfferedTest.upsert({
    where: {
      labId_localCode: {
        labId,
        localCode,
      },
    },
    create: {
      labId,
      catalogTestId,
      localCode,
      localName,
      active: cleanBoolean(body.active, true) ?? true,
      priceCents,
      currency:
        cleanString(body.currency).toUpperCase().slice(0, 3) ||
        lab.currency ||
        'ZAR',
      turnaroundHours,
      specimenType,
      containerType:
        cleanString(body.containerType) ||
        catalogTest?.containerTypeDefault ||
        null,
      requiresColdChain:
        cleanBoolean(
          body.requiresColdChain,
          catalogTest?.requiresColdChainDefault ?? false,
        ) ?? false,
      requiredTempMinC:
        cleanNumber(body.requiredTempMinC) ??
        catalogTest?.requiredTempMinCDefault ??
        null,
      requiredTempMaxC:
        cleanNumber(body.requiredTempMaxC) ??
        catalogTest?.requiredTempMaxCDefault ??
        null,
      maxTransitMins,
      prepNotes:
        cleanString(body.prepNotes ?? body.instructions) ||
        catalogTest?.prepNotes ||
        null,
      availabilityMeta,
    },
    update: {
      catalogTestId,
      localName,
      active: cleanBoolean(body.active, true) ?? true,
      priceCents,
      currency:
        cleanString(body.currency).toUpperCase().slice(0, 3) ||
        lab.currency ||
        'ZAR',
      turnaroundHours,
      specimenType,
      containerType:
        cleanString(body.containerType) ||
        catalogTest?.containerTypeDefault ||
        null,
      requiresColdChain:
        cleanBoolean(
          body.requiresColdChain,
          catalogTest?.requiresColdChainDefault ?? false,
        ) ?? false,
      requiredTempMinC:
        cleanNumber(body.requiredTempMinC) ??
        catalogTest?.requiredTempMinCDefault ??
        null,
      requiredTempMaxC:
        cleanNumber(body.requiredTempMaxC) ??
        catalogTest?.requiredTempMaxCDefault ??
        null,
      maxTransitMins,
      prepNotes:
        cleanString(body.prepNotes ?? body.instructions) ||
        catalogTest?.prepNotes ||
        null,
      availabilityMeta,
    },
    include: {
      catalogTest: true,
    },
  });

  await prisma.auditEvent.create({
    data: {
      kind: 'medreach_lab_test_upserted',
      actorId: who.uid,
      actorRole: who.role,
      subjectId: row.id,
      meta: {
        labId,
        offeredTestId: row.id,
        localCode: row.localCode,
        localName: row.localName,
      },
    },
  });

  const evt = {
    kind: 'medreach_lab_test_upserted',
    labId,
    offeredTestId: row.id,
    localCode: row.localCode,
    at: new Date().toISOString(),
  };

  emitEvent({
    kind: 'medreach_lab_test_upserted',
    payload: evt,
    targets: { admin: true },
  });

  await push(sseKeys.lab(labId), evt);

  return NextResponse.json(
    {
      ok: true,
      data: projectOfferedTest(row),
    },
    { status: 201 },
  );
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { labId: string } },
) {
  const who = readIdentity(req.headers);
  const labId = cleanString(params.labId);

  if (!labId) {
    return NextResponse.json(
      { ok: false, error: 'missing_labId' },
      { status: 400 },
    );
  }

  const allowed = await assertLabWriteAccess(req, labId, who);

  if (!allowed) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown>;

  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const id = cleanString(body.id);
  const localCode = cleanString(body.localCode ?? body.code).toUpperCase();

  if (!id && !localCode) {
    return NextResponse.json(
      { ok: false, error: 'missing_id_or_code' },
      { status: 400 },
    );
  }

  const existing = id
    ? await prisma.medReachLabOfferedTest.findFirst({
        where: { id, labId },
      })
    : await prisma.medReachLabOfferedTest.findUnique({
        where: {
          labId_localCode: {
            labId,
            localCode,
          },
        },
      });

  if (!existing) {
    return NextResponse.json(
      { ok: false, error: 'offered_test_not_found' },
      { status: 404 },
    );
  }

  const catalogTest = await resolveCatalogTest(body);
  const data: Record<string, any> = {};

  if ('catalogTestId' in body || 'code' in body) {
    data.catalogTestId = requestedCatalogTestId(catalogTest, body);
  }

  if ('localCode' in body || 'code' in body) {
    data.localCode = localCode;
  }

  if ('localName' in body || 'name' in body) {
    data.localName = cleanString(body.localName ?? body.name);
  }

  if ('active' in body) {
    data.active = cleanBoolean(body.active, existing.active);
  }

  if ('priceCents' in body || 'priceMinor' in body || 'priceZAR' in body) {
    data.priceCents = cleanPriceCents(body, existing.priceCents);
  }

  if ('currency' in body) {
    data.currency =
      cleanString(body.currency).toUpperCase().slice(0, 3) || existing.currency;
  }

  if ('turnaroundHours' in body || 'etaDays' in body) {
    data.turnaroundHours = cleanInt(
      body.turnaroundHours ??
        (body.etaDays ? Number(body.etaDays) * 24 : undefined),
      existing.turnaroundHours,
      1,
      24 * 60,
    );
  }

  if ('specimenType' in body || 'sampleType' in body) {
    data.specimenType =
      cleanString(body.specimenType ?? body.sampleType) ||
      existing.specimenType;
  }

  if ('containerType' in body) {
    data.containerType = cleanString(body.containerType) || null;
  }

  if ('requiresColdChain' in body) {
    data.requiresColdChain = cleanBoolean(
      body.requiresColdChain,
      existing.requiresColdChain,
    );
  }

  if ('requiredTempMinC' in body) {
    data.requiredTempMinC = cleanNumber(body.requiredTempMinC);
  }

  if ('requiredTempMaxC' in body) {
    data.requiredTempMaxC = cleanNumber(body.requiredTempMaxC);
  }

  if ('maxTransitMins' in body) {
    const maxTransitMinsPatch = cleanNumber(body.maxTransitMins);
    data.maxTransitMins =
      maxTransitMinsPatch == null ? null : Math.trunc(maxTransitMinsPatch);
  }

  if ('prepNotes' in body || 'instructions' in body) {
    data.prepNotes = cleanString(body.prepNotes ?? body.instructions) || null;
  }

  if (
    'availabilityMeta' in body ||
    'homeDrawSupported' in body ||
    'labWalkInSupported' in body
  ) {
    data.availabilityMeta = availabilityMetaFromBody(body, existing);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: false, error: 'no_changes' }, { status: 400 });
  }

  if ('localCode' in data && !data.localCode) {
    return NextResponse.json({ ok: false, error: 'missing_code' }, { status: 400 });
  }

  if ('localName' in data && !data.localName) {
    return NextResponse.json({ ok: false, error: 'missing_name' }, { status: 400 });
  }

  const row = await prisma.medReachLabOfferedTest.update({
    where: { id: existing.id },
    data,
    include: {
      catalogTest: true,
    },
  });

  await prisma.auditEvent.create({
    data: {
      kind: 'medreach_lab_test_updated',
      actorId: who.uid,
      actorRole: who.role,
      subjectId: row.id,
      meta: {
        labId,
        offeredTestId: row.id,
        changedFields: Object.keys(data),
      },
    },
  });

  const evt = {
    kind: 'medreach_lab_test_updated',
    labId,
    offeredTestId: row.id,
    changedFields: Object.keys(data),
    at: new Date().toISOString(),
  };

  emitEvent({
    kind: 'medreach_lab_test_updated',
    payload: evt,
    targets: { admin: true },
  });

  await push(sseKeys.lab(labId), evt);

  return NextResponse.json({
    ok: true,
    data: projectOfferedTest(row),
  });
}