// apps/api-gateway/app/api/medreach/labs/[labId]/panels/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import { emitEvent } from '@/src/lib/events';
import { push, sseKeys } from '@/src/lib/sse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TestRef = {
  offeredTestId?: string | null;
  id?: string | null;
  localCode?: string | null;
  code?: string | null;
};

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanBoolean(value: unknown, fallback: boolean | undefined = undefined) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return fallback;
}

function cleanInt(value: unknown, fallback: number, min: number, max: number) {
  const n = Number(value);

  if (!Number.isFinite(n)) return fallback;

  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function cleanMoneyCents(value: unknown): number | null {
  if (value == null || value === '') return null;

  const n = Number(value);

  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : null;
}

function cleanPriceCents(body: Record<string, unknown>): number | null {
  if (body.priceCents != null) return cleanMoneyCents(body.priceCents);
  if (body.priceMinor != null) return cleanMoneyCents(body.priceMinor);

  const priceZAR = Number(body.priceZAR);

  if (Number.isFinite(priceZAR)) {
    return Math.max(0, Math.round(priceZAR * 100));
  }

  return null;
}

function roleOf(who: any) {
  return String(who.role || '').toLowerCase();
}

function uniq(values: string[]) {
  return Array.from(new Set(values.map((v) => cleanString(v)).filter(Boolean)));
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

function projectPanel(row: any) {
  const items = Array.isArray(row.items) ? row.items : [];
  const offeredTests = items.map((item: any) => projectOfferedTest(item.offeredTest));

  const derivedPriceCents = offeredTests.reduce(
    (sum: number, test: any) => sum + Number(test.priceCents || 0),
    0,
  );

  const derivedTurnaroundHours = offeredTests.reduce(
    (max: number, test: any) => Math.max(max, Number(test.turnaroundHours || 0)),
    0,
  );

  const effectivePriceCents = row.priceCents ?? derivedPriceCents;
  const effectiveTurnaroundHours = (row.turnaroundHours ?? derivedTurnaroundHours) || 24;

  return {
    id: row.id,
    labId: row.labId,
    code: row.code,
    name: row.name,
    description: row.description ?? null,
    active: row.active,

    priceCents: effectivePriceCents,
    panelPriceCents: row.priceCents ?? null,
    derivedPriceCents,
    priceZAR: effectivePriceCents / 100,

    currency: row.currency ?? offeredTests[0]?.currency ?? 'ZAR',

    turnaroundHours: effectiveTurnaroundHours,
    panelTurnaroundHours: row.turnaroundHours ?? null,
    derivedTurnaroundHours,
    etaDays: Math.max(1, Math.ceil(effectiveTurnaroundHours / 24)),

    tests: offeredTests,
    itemCount: offeredTests.length,

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

function extractTestRefs(body: Record<string, unknown>): TestRef[] {
  const refs: TestRef[] = [];

  if (Array.isArray(body.items)) {
    for (const item of body.items) {
      if (typeof item === 'string') {
        refs.push({ offeredTestId: item, localCode: item, code: item });
      } else if (item && typeof item === 'object') {
        const raw = item as Record<string, unknown>;
        refs.push({
          offeredTestId: cleanString(raw.offeredTestId),
          id: cleanString(raw.id),
          localCode: cleanString(raw.localCode),
          code: cleanString(raw.code),
        });
      }
    }
  }

  if (Array.isArray(body.tests)) {
    for (const item of body.tests) {
      if (typeof item === 'string') {
        refs.push({ offeredTestId: item, localCode: item, code: item });
      } else if (item && typeof item === 'object') {
        const raw = item as Record<string, unknown>;
        refs.push({
          offeredTestId: cleanString(raw.offeredTestId),
          id: cleanString(raw.id),
          localCode: cleanString(raw.localCode),
          code: cleanString(raw.code),
        });
      }
    }
  }

  if (Array.isArray(body.offeredTestIds)) {
    for (const id of body.offeredTestIds) {
      refs.push({ offeredTestId: cleanString(id), id: cleanString(id) });
    }
  }

  if (Array.isArray(body.localCodes)) {
    for (const code of body.localCodes) {
      refs.push({ localCode: cleanString(code), code: cleanString(code) });
    }
  }

  if (Array.isArray(body.codes)) {
    for (const code of body.codes) {
      refs.push({ localCode: cleanString(code), code: cleanString(code) });
    }
  }

  return refs.filter((ref) =>
    Boolean(ref.offeredTestId || ref.id || ref.localCode || ref.code),
  );
}

async function resolveOfferedTests(labId: string, refs: TestRef[]) {
  const ids = uniq(
    refs
      .flatMap((ref) => [ref.offeredTestId, ref.id])
      .filter((value): value is string => Boolean(value)),
  );

  const codes = uniq(
    refs
      .flatMap((ref) => [ref.localCode, ref.code])
      .filter((value): value is string => Boolean(value))
      .map((value) => value.toUpperCase()),
  );

  if (!ids.length && !codes.length) return [];

  const rows = await prisma.medReachLabOfferedTest.findMany({
    where: {
      labId,
      OR: [
        ...(ids.length ? [{ id: { in: ids } }] : []),
        ...(codes.length ? [{ localCode: { in: codes } }] : []),
        ...(codes.length
          ? [
              {
                catalogTest: {
                  is: {
                    code: { in: codes },
                  },
                },
              },
            ]
          : []),
      ],
    },
    include: {
      catalogTest: true,
    },
  });

  const byId = new Map(rows.map((row) => [row.id, row]));
  const byLocalCode = new Map(
    rows
      .filter((row) => row.localCode)
      .map((row) => [String(row.localCode).toUpperCase(), row]),
  );
  const byCatalogCode = new Map(
    rows
      .filter((row) => row.catalogTest?.code)
      .map((row) => [String(row.catalogTest?.code).toUpperCase(), row]),
  );

  const ordered: any[] = [];

  for (const ref of refs) {
    const id = cleanString(ref.offeredTestId || ref.id);
    const code = cleanString(ref.localCode || ref.code).toUpperCase();

    const row =
      (id && byId.get(id)) ||
      (code && byLocalCode.get(code)) ||
      (code && byCatalogCode.get(code)) ||
      null;

    if (row && !ordered.some((existing) => existing.id === row.id)) {
      ordered.push(row);
    }
  }

  return ordered;
}

async function loadPanel(panelId: string) {
  return prisma.medReachLabPanel.findUnique({
    where: { id: panelId },
    include: {
      items: {
        orderBy: { sortOrder: 'asc' },
        include: {
          offeredTest: {
            include: {
              catalogTest: true,
            },
          },
        },
      },
    },
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
  const limit = cleanInt(url.searchParams.get('limit'), 100, 1, 300);

  const where: Record<string, any> = { labId };

  if (active !== undefined) where.active = active;

  if (q) {
    where.OR = [
      { code: { contains: q, mode: 'insensitive' } },
      { name: { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
    ];
  }

  const rows = await prisma.medReachLabPanel.findMany({
    where,
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
    take: limit,
    include: {
      items: {
        orderBy: { sortOrder: 'asc' },
        include: {
          offeredTest: {
            include: {
              catalogTest: true,
            },
          },
        },
      },
    },
  });

  return NextResponse.json({
    ok: true,
    data: rows.map(projectPanel),
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

  const lab = await prisma.labPartner.findUnique({
    where: { id: labId },
    select: {
      id: true,
      active: true,
      status: true,
      currency: true,
    },
  });

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

  const code = cleanString(body.code).toUpperCase();
  const name = cleanString(body.name);
  const description = cleanString(body.description) || null;
  const priceCents = cleanPriceCents(body);
  const currency = cleanString(body.currency).toUpperCase().slice(0, 3) || lab.currency || 'ZAR';
  const turnaroundHours =
    body.turnaroundHours == null
      ? null
      : cleanInt(body.turnaroundHours, 24, 1, 24 * 60);

  if (!code || !name) {
    return NextResponse.json(
      { ok: false, error: 'missing_code_or_name' },
      { status: 400 },
    );
  }

  const refs = extractTestRefs(body);

  if (!refs.length) {
    return NextResponse.json(
      { ok: false, error: 'panel_requires_at_least_one_test' },
      { status: 400 },
    );
  }

  const offeredTests = await resolveOfferedTests(labId, refs);

  if (!offeredTests.length) {
    return NextResponse.json(
      { ok: false, error: 'no_matching_lab_tests' },
      { status: 400 },
    );
  }

  const panel = await prisma.$transaction(async (tx) => {
    const row = await tx.medReachLabPanel.upsert({
      where: {
        labId_code: {
          labId,
          code,
        },
      },
      create: {
        labId,
        code,
        name,
        description,
        active: cleanBoolean(body.active, true) ?? true,
        priceCents,
        currency,
        turnaroundHours,
      },
      update: {
        name,
        description,
        active: cleanBoolean(body.active, true) ?? true,
        priceCents,
        currency,
        turnaroundHours,
      },
    });

    await tx.medReachLabPanelItem.deleteMany({
      where: { panelId: row.id },
    });

    await tx.medReachLabPanelItem.createMany({
      data: offeredTests.map((test, index) => ({
        panelId: row.id,
        offeredTestId: test.id,
        sortOrder: index,
      })),
    });

    return row;
  });

  const projected = await loadPanel(panel.id);

  await prisma.auditEvent.create({
    data: {
      kind: 'medreach_lab_panel_upserted',
      actorId: who.uid,
      actorRole: who.role,
      subjectId: panel.id,
      meta: {
        labId,
        panelId: panel.id,
        code: panel.code,
        name: panel.name,
        offeredTestIds: offeredTests.map((test) => test.id),
      },
    },
  });

  const evt = {
    kind: 'medreach_lab_panel_upserted',
    labId,
    panelId: panel.id,
    code: panel.code,
    at: new Date().toISOString(),
  };

  emitEvent({
    kind: 'medreach_lab_panel_upserted',
    payload: evt,
    targets: { admin: true },
  });

  await push(sseKeys.lab(labId), evt);

  return NextResponse.json(
    {
      ok: true,
      data: projected ? projectPanel(projected) : null,
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
  const code = cleanString(body.code).toUpperCase();

  if (!id && !code) {
    return NextResponse.json(
      { ok: false, error: 'missing_id_or_code' },
      { status: 400 },
    );
  }

  const existing = id
    ? await prisma.medReachLabPanel.findFirst({ where: { id, labId } })
    : await prisma.medReachLabPanel.findUnique({
        where: {
          labId_code: {
            labId,
            code,
          },
        },
      });

  if (!existing) {
    return NextResponse.json(
      { ok: false, error: 'panel_not_found' },
      { status: 404 },
    );
  }

  const data: Record<string, any> = {};

  if ('code' in body) data.code = code;
  if ('name' in body) data.name = cleanString(body.name);
  if ('description' in body) data.description = cleanString(body.description) || null;
  if ('active' in body) data.active = cleanBoolean(body.active, existing.active);

  if ('priceCents' in body || 'priceMinor' in body || 'priceZAR' in body) {
    data.priceCents = cleanPriceCents(body);
  }

  if ('currency' in body) {
    data.currency = cleanString(body.currency).toUpperCase().slice(0, 3) || null;
  }

  if ('turnaroundHours' in body) {
    data.turnaroundHours =
      body.turnaroundHours == null
        ? null
        : cleanInt(body.turnaroundHours, existing.turnaroundHours ?? 24, 1, 24 * 60);
  }

  if ('code' in data && !data.code) {
    return NextResponse.json({ ok: false, error: 'missing_code' }, { status: 400 });
  }

  if ('name' in data && !data.name) {
    return NextResponse.json({ ok: false, error: 'missing_name' }, { status: 400 });
  }

  const refsProvided =
    'items' in body ||
    'tests' in body ||
    'offeredTestIds' in body ||
    'localCodes' in body ||
    'codes' in body;

  const refs = refsProvided ? extractTestRefs(body) : [];
  const offeredTests = refsProvided ? await resolveOfferedTests(labId, refs) : [];

  if (refsProvided && refs.length > 0 && offeredTests.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'no_matching_lab_tests' },
      { status: 400 },
    );
  }

  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.medReachLabPanel.update({
      where: { id: existing.id },
      data,
    });

    if (refsProvided) {
      await tx.medReachLabPanelItem.deleteMany({
        where: { panelId: updated.id },
      });

      if (offeredTests.length > 0) {
        await tx.medReachLabPanelItem.createMany({
          data: offeredTests.map((test, index) => ({
            panelId: updated.id,
            offeredTestId: test.id,
            sortOrder: index,
          })),
        });
      }
    }

    return updated;
  });

  const projected = await loadPanel(row.id);

  await prisma.auditEvent.create({
    data: {
      kind: 'medreach_lab_panel_updated',
      actorId: who.uid,
      actorRole: who.role,
      subjectId: row.id,
      meta: {
        labId,
        panelId: row.id,
        changedFields: Object.keys(data),
        replacedItems: refsProvided,
        offeredTestIds: offeredTests.map((test) => test.id),
      },
    },
  });

  const evt = {
    kind: 'medreach_lab_panel_updated',
    labId,
    panelId: row.id,
    changedFields: Object.keys(data),
    replacedItems: refsProvided,
    at: new Date().toISOString(),
  };

  emitEvent({
    kind: 'medreach_lab_panel_updated',
    payload: evt,
    targets: { admin: true },
  });

  await push(sseKeys.lab(labId), evt);

  return NextResponse.json({
    ok: true,
    data: projected ? projectPanel(projected) : null,
  });
}