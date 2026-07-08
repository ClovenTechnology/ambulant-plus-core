// apps/api-gateway/app/api/medreach/labs/[labId]/offers/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RequestedItem = {
  code?: string | null;
  name?: string | null;
};

type OfferDemand = {
  orderId?: string | null;
  tests: RequestedItem[];
  panels: RequestedItem[];
  fulfillmentMode?: string | null;
};

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanInt(value: unknown, fallback: number, min: number, max: number) {
  const n = Number(value);

  if (!Number.isFinite(n)) return fallback;

  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function safeJson<T = any>(value: unknown): T | null {
  if (value == null) return null;

  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return null;
  }
}

function roleOf(who: any) {
  return String(who.role || '').toLowerCase();
}

function normalizeKey(value: unknown) {
  return cleanString(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeRequestedItem(value: unknown): RequestedItem | null {
  if (typeof value === 'string') {
    const text = cleanString(value);
    return text ? { code: text, name: text } : null;
  }

  if (!value || typeof value !== 'object') return null;

  const raw = value as Record<string, unknown>;
  const code = cleanString(raw.code ?? raw.localCode ?? raw.loincCode ?? raw.id);
  const name = cleanString(raw.name ?? raw.localName ?? raw.label ?? raw.title);

  if (!code && !name) return null;

  return {
    code: code || name,
    name: name || code,
  };
}

function normalizeRequestedArray(value: unknown): RequestedItem[] {
  if (!Array.isArray(value)) return [];

  return value
    .map(normalizeRequestedItem)
    .filter((item): item is RequestedItem => Boolean(item));
}

function availabilityMeta(row: any) {
  return row?.availabilityMeta && typeof row.availabilityMeta === 'object'
    ? (row.availabilityMeta as Record<string, unknown>)
    : {};
}

function homeDrawSupported(row: any) {
  const meta = availabilityMeta(row);
  return meta.homeDrawSupported !== false;
}

function labWalkInSupported(row: any) {
  const meta = availabilityMeta(row);
  return meta.labWalkInSupported !== false;
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

    homeDrawSupported: homeDrawSupported(row),
    labWalkInSupported: labWalkInSupported(row),

    availabilityMeta: row.availabilityMeta ?? null,
  };
}

function projectPanel(row: any) {
  const items = Array.isArray(row.items) ? row.items : [];
  const tests = items.map((item: any) => projectOfferedTest(item.offeredTest));

  const derivedPriceCents = tests.reduce(
    (sum: number, test: any) => sum + Number(test.priceCents || 0),
    0,
  );

  const derivedTurnaroundHours = tests.reduce(
    (max: number, test: any) => Math.max(max, Number(test.turnaroundHours || 0)),
    0,
  );

  return {
    id: row.id,
    labId: row.labId,
    code: row.code,
    name: row.name,
    description: row.description ?? null,
    active: row.active,

    priceCents: row.priceCents ?? derivedPriceCents,
    panelPriceCents: row.priceCents ?? null,
    derivedPriceCents,

    currency: row.currency ?? tests[0]?.currency ?? 'ZAR',

    turnaroundHours: row.turnaroundHours ?? derivedTurnaroundHours,
    panelTurnaroundHours: row.turnaroundHours ?? null,
    derivedTurnaroundHours,

    tests,
    itemCount: tests.length,
  };
}

function testMatchKeys(row: any) {
  return [
    row.id,
    row.localCode,
    row.localName,
    row.catalogTest?.code,
    row.catalogTest?.name,
    row.catalogTest?.loincCode,
  ]
    .map(normalizeKey)
    .filter(Boolean);
}

function panelMatchKeys(row: any) {
  return [row.id, row.code, row.name]
    .map(normalizeKey)
    .filter(Boolean);
}

function findMatchingTest(requested: RequestedItem, offeredTests: any[]) {
  const wanted = [
    normalizeKey(requested.code),
    normalizeKey(requested.name),
  ].filter(Boolean);

  if (!wanted.length) return null;

  return (
    offeredTests.find((row) => {
      const keys = testMatchKeys(row);
      return wanted.some((key) => keys.includes(key));
    }) || null
  );
}

function findMatchingPanel(requested: RequestedItem, panels: any[]) {
  const wanted = [
    normalizeKey(requested.code),
    normalizeKey(requested.name),
  ].filter(Boolean);

  if (!wanted.length) return null;

  return (
    panels.find((row) => {
      const keys = panelMatchKeys(row);
      return wanted.some((key) => keys.includes(key));
    }) || null
  );
}

function addUniqueRequirement(
  map: Map<string, any>,
  test: any,
) {
  const key = [
    normalizeKey(test.specimenType),
    normalizeKey(test.containerType),
    test.requiresColdChain ? 'COLD' : 'AMBIENT',
  ].join(':');

  const existing = map.get(key);

  if (existing) {
    existing.testIds.push(test.id);
    existing.containerCount += 1;
    return;
  }

  map.set(key, {
    specimenType: test.specimenType,
    containerType: test.containerType ?? null,
    containerCount: 1,
    requiresColdChain: Boolean(test.requiresColdChain),
    requiredTempMinC: test.requiredTempMinC ?? null,
    requiredTempMaxC: test.requiredTempMaxC ?? null,
    maxTransitMins: test.maxTransitMins ?? null,
    testIds: [test.id],
  });
}

async function assertLabOfferAccess(req: NextRequest, labId: string, who: any) {
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

async function loadDemandFromOrder(orderId: string): Promise<OfferDemand | null> {
  const [draw, eligibilityRows] = await Promise.all([
    prisma.draw.findFirst({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.medReachOrderEligibleLab.findMany({
      where: { orderId },
      select: {
        notes: true,
      },
      orderBy: {
        invitedAt: 'asc',
      },
    }),
  ]);

  const firstNotes = eligibilityRows.find((row) => !!row.notes)?.notes ?? null;
  const eligibilityMeta = safeJson<any>(firstNotes) || {};
  const drawTests = safeJson<any>((draw as any)?.testsSnapshot) || {};

  const tests =
    normalizeRequestedArray(drawTests?.tests).length > 0
      ? normalizeRequestedArray(drawTests?.tests)
      : normalizeRequestedArray(eligibilityMeta?.tests);

  const panels =
    normalizeRequestedArray(drawTests?.panels).length > 0
      ? normalizeRequestedArray(drawTests?.panels)
      : normalizeRequestedArray(eligibilityMeta?.panels);

  const fulfillmentMode =
    cleanString(drawTests?.fulfillmentMode) ||
    cleanString(eligibilityMeta?.fulfillmentMode) ||
    null;

  if (!tests.length && !panels.length) return null;

  return {
    orderId,
    tests,
    panels,
    fulfillmentMode,
  };
}

async function loadDemandFromRequest(
  req: NextRequest,
  body?: Record<string, unknown>,
): Promise<OfferDemand | null> {
  const url = new URL(req.url);
  const orderId = cleanString(url.searchParams.get('orderId') || body?.orderId);

  if (orderId) {
    const demandFromOrder = await loadDemandFromOrder(orderId);

    if (demandFromOrder) return demandFromOrder;
  }

  const tests = normalizeRequestedArray(body?.tests);
  const panels = normalizeRequestedArray(body?.panels ?? body?.panelInfo);
  const fulfillmentMode =
    cleanString(body?.fulfillmentMode || url.searchParams.get('fulfillmentMode')) ||
    null;

  if (!tests.length && !panels.length) return null;

  return {
    orderId: orderId || null,
    tests,
    panels,
    fulfillmentMode,
  };
}

function buildOffer(params: {
  lab: any;
  demand: OfferDemand;
  offeredTests: any[];
  panels: any[];
}) {
  const { lab, demand, offeredTests, panels } = params;

  const matchedDirectTests: any[] = [];
  const matchedPanels: any[] = [];
  const missingTests: RequestedItem[] = [];
  const missingPanels: RequestedItem[] = [];
  const coveredByPanelTestIds = new Set<string>();
  const directDuplicateOfPanel: RequestedItem[] = [];

  for (const requestedPanel of demand.panels) {
    const panel = findMatchingPanel(requestedPanel, panels);

    if (!panel) {
      missingPanels.push(requestedPanel);
      continue;
    }

    matchedPanels.push(panel);

    for (const item of panel.items || []) {
      if (item.offeredTest?.id) {
        coveredByPanelTestIds.add(item.offeredTest.id);
      }
    }
  }

  for (const requestedTest of demand.tests) {
    const test = findMatchingTest(requestedTest, offeredTests);

    if (!test) {
      missingTests.push(requestedTest);
      continue;
    }

    if (coveredByPanelTestIds.has(test.id)) {
      directDuplicateOfPanel.push(requestedTest);
      continue;
    }

    if (!matchedDirectTests.some((existing) => existing.id === test.id)) {
      matchedDirectTests.push(test);
    }
  }

  const projectedPanels = matchedPanels.map(projectPanel);
  const projectedDirectTests = matchedDirectTests.map(projectOfferedTest);

  const testsInsidePanels = matchedPanels.flatMap((panel) =>
    (panel.items || [])
      .map((item: any) => item.offeredTest)
      .filter(Boolean),
  );

  const allMatchedTests = [...testsInsidePanels, ...matchedDirectTests];

  const requirements = new Map<string, any>();

  for (const test of allMatchedTests) {
    addUniqueRequirement(requirements, test);
  }

  const directTestsPriceCents = projectedDirectTests.reduce(
    (sum, test) => sum + Number(test.priceCents || 0),
    0,
  );

  const panelPriceCents = projectedPanels.reduce(
    (sum, panel) => sum + Number(panel.priceCents || 0),
    0,
  );

  const totalPriceCents = directTestsPriceCents + panelPriceCents;

  const turnaroundHours = allMatchedTests.reduce(
    (max, test) => Math.max(max, Number(test.turnaroundHours || 0)),
    0,
  );

  const panelTurnaroundHours = projectedPanels.reduce(
    (max, panel) => Math.max(max, Number(panel.turnaroundHours || 0)),
    0,
  );

  const etaHours = Math.max(turnaroundHours, panelTurnaroundHours, 24);
  const etaDays = Math.max(1, Math.ceil(etaHours / 24));

  const requiresColdChain = allMatchedTests.some((test) =>
    Boolean(test.requiresColdChain),
  );

  const supportHomeDraw = allMatchedTests.every(homeDrawSupported);
  const supportLabWalkIn = allMatchedTests.every(labWalkInSupported);

  const requestedMode = normalizeKey(demand.fulfillmentMode);
  const fulfillmentModeSupported =
    !requestedMode ||
    requestedMode === 'ANY' ||
    (requestedMode === 'HOME_DRAW' && supportHomeDraw) ||
    (requestedMode === 'LAB_WALK_IN' && supportLabWalkIn) ||
    (requestedMode === 'WALK_IN' && supportLabWalkIn);

  const canFulfill =
    missingTests.length === 0 &&
    missingPanels.length === 0 &&
    allMatchedTests.length > 0 &&
    fulfillmentModeSupported;

  const currencies = [
    ...projectedDirectTests.map((test) => test.currency),
    ...projectedPanels.map((panel) => panel.currency),
  ].filter(Boolean);

  const currency = currencies[0] || lab.currency || 'ZAR';

  return {
    labId: lab.id,
    labName: lab.name,
    orderId: demand.orderId ?? null,

    canFulfill,
    fulfillmentModeSupported,
    requestedFulfillmentMode: demand.fulfillmentMode ?? null,

    supportHomeDraw,
    supportLabWalkIn,

    currency,
    totalPriceCents,
    totalPriceZAR: totalPriceCents / 100,
    directTestsPriceCents,
    panelPriceCents,

    etaHours,
    etaDays,

    requiresColdChain,
    specimenRequirements: Array.from(requirements.values()),

    requested: {
      tests: demand.tests,
      panels: demand.panels,
    },

    matched: {
      tests: projectedDirectTests,
      panels: projectedPanels,
      allTestCount: allMatchedTests.length,
      directDuplicateOfPanel,
    },

    missing: {
      tests: missingTests,
      panels: missingPanels,
    },

    warnings: [
      ...(fulfillmentModeSupported
        ? []
        : [`Requested fulfillment mode is not supported by this lab/test combination.`]),
      ...(directDuplicateOfPanel.length
        ? [`Some requested tests were already covered inside a selected panel and were not double-charged.`]
        : []),
    ],
  };
}

async function handleOfferRequest(
  req: NextRequest,
  labId: string,
  body?: Record<string, unknown>,
) {
  const who = readIdentity(req.headers);

  if (!labId) {
    return NextResponse.json(
      { ok: false, error: 'missing_labId' },
      { status: 400 },
    );
  }

  const allowed = await assertLabOfferAccess(req, labId, who);

  if (!allowed) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const lab = await prisma.labPartner.findUnique({
    where: { id: labId },
    select: {
      id: true,
      name: true,
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

  const demand = await loadDemandFromRequest(req, body);

  if (!demand) {
    return NextResponse.json(
      {
        ok: false,
        error: 'missing_offer_demand',
        detail: 'Provide orderId, or provide tests/panels in the request body.',
      },
      { status: 400 },
    );
  }

  const [offeredTests, panels] = await Promise.all([
    prisma.medReachLabOfferedTest.findMany({
      where: {
        labId,
        active: true,
      },
      include: {
        catalogTest: true,
      },
      orderBy: [{ localName: 'asc' }],
    }),
    prisma.medReachLabPanel.findMany({
      where: {
        labId,
        active: true,
      },
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
      orderBy: [{ name: 'asc' }],
    }),
  ]);

  const offer = buildOffer({
    lab,
    demand,
    offeredTests,
    panels,
  });

  return NextResponse.json({
    ok: true,
    data: offer,
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { labId: string } },
) {
  return handleOfferRequest(req, cleanString(params.labId));
}

export async function POST(
  req: NextRequest,
  { params }: { params: { labId: string } },
) {
  let body: Record<string, unknown>;

  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  return handleOfferRequest(req, cleanString(params.labId), body);
}