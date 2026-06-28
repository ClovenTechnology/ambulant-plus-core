// apps/api-gateway/app/api/medreach/test-catalog/route.ts
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

function roleOf(who: any) {
  return String(who.role || '').toLowerCase();
}

function canReadCatalog(role: string) {
  return ['admin', 'lab', 'lab_staff', 'clinician', 'patient', 'system'].includes(role);
}

function projectCatalogTest(row: any) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    loincCode: row.loincCode ?? null,
    specimenTypeDefault: row.specimenTypeDefault ?? null,
    containerTypeDefault: row.containerTypeDefault ?? null,
    requiresColdChainDefault: row.requiresColdChainDefault,
    requiredTempMinCDefault: row.requiredTempMinCDefault ?? null,
    requiredTempMaxCDefault: row.requiredTempMaxCDefault ?? null,
    prepNotes: row.prepNotes ?? null,
    active: row.active,
    createdAt: row.createdAt?.toISOString?.() ?? null,
    updatedAt: row.updatedAt?.toISOString?.() ?? null,
  };
}

export async function GET(req: NextRequest) {
  const who = readIdentity(req.headers);
  const role = roleOf(who);

  if (!canReadCatalog(role)) {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  const url = new URL(req.url);
  const q = cleanString(url.searchParams.get('q'));
  const category = cleanString(url.searchParams.get('category'));
  const active = cleanBoolean(url.searchParams.get('active'), role === 'admin' ? undefined : true);
  const limit = cleanInt(url.searchParams.get('limit'), 100, 1, 300);

  const where: Record<string, any> = {};

  if (active !== undefined) where.active = active;
  if (category) where.category = category;

  if (q) {
    where.OR = [
      { code: { contains: q, mode: 'insensitive' } },
      { name: { contains: q, mode: 'insensitive' } },
      { category: { contains: q, mode: 'insensitive' } },
      { loincCode: { contains: q, mode: 'insensitive' } },
    ];
  }

  const rows = await prisma.medReachTestCatalog.findMany({
    where,
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
    take: limit,
  });

  return NextResponse.json({
    ok: true,
    data: rows.map(projectCatalogTest),
    meta: {
      count: rows.length,
      role,
    },
  });
}

export async function POST(req: NextRequest) {
  const who = readIdentity(req.headers);
  const role = roleOf(who);

  if (role !== 'admin') {
    return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  }

  let body: Record<string, unknown>;

  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const code = cleanString(body.code).toUpperCase();
  const name = cleanString(body.name);
  const category = cleanString(body.category);

  if (!code || !name || !category) {
    return NextResponse.json(
      { ok: false, error: 'missing_code_name_or_category' },
      { status: 400 },
    );
  }

  const row = await prisma.medReachTestCatalog.upsert({
    where: { code },
    create: {
      code,
      name,
      category,
      loincCode: cleanString(body.loincCode) || null,
      specimenTypeDefault: cleanString(body.specimenTypeDefault ?? body.specimenType) || null,
      containerTypeDefault: cleanString(body.containerTypeDefault ?? body.containerType) || null,
      requiresColdChainDefault: cleanBoolean(body.requiresColdChainDefault, false) ?? false,
      requiredTempMinCDefault: cleanNumber(body.requiredTempMinCDefault),
      requiredTempMaxCDefault: cleanNumber(body.requiredTempMaxCDefault),
      prepNotes: cleanString(body.prepNotes) || null,
      active: cleanBoolean(body.active, true) ?? true,
    },
    update: {
      name,
      category,
      loincCode: cleanString(body.loincCode) || null,
      specimenTypeDefault: cleanString(body.specimenTypeDefault ?? body.specimenType) || null,
      containerTypeDefault: cleanString(body.containerTypeDefault ?? body.containerType) || null,
      requiresColdChainDefault: cleanBoolean(body.requiresColdChainDefault, false) ?? false,
      requiredTempMinCDefault: cleanNumber(body.requiredTempMinCDefault),
      requiredTempMaxCDefault: cleanNumber(body.requiredTempMaxCDefault),
      prepNotes: cleanString(body.prepNotes) || null,
      active: cleanBoolean(body.active, true) ?? true,
    },
  });

  await prisma.auditEvent.create({
    data: {
      kind: 'medreach_test_catalog_upserted',
      actorId: who.uid,
      actorRole: who.role,
      subjectId: row.id,
      meta: {
        catalogTestId: row.id,
        code: row.code,
        name: row.name,
      },
    },
  });

  return NextResponse.json(
    {
      ok: true,
      data: projectCatalogTest(row),
    },
    { status: 201 },
  );
}

export async function PATCH(req: NextRequest) {
  const who = readIdentity(req.headers);
  const role = roleOf(who);

  if (role !== 'admin') {
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
    return NextResponse.json({ ok: false, error: 'missing_id_or_code' }, { status: 400 });
  }

  const existing = id
    ? await prisma.medReachTestCatalog.findUnique({ where: { id } })
    : await prisma.medReachTestCatalog.findUnique({ where: { code } });

  if (!existing) {
    return NextResponse.json({ ok: false, error: 'catalog_test_not_found' }, { status: 404 });
  }

  const data: Record<string, any> = {};

  if ('code' in body) data.code = code;
  if ('name' in body) data.name = cleanString(body.name);
  if ('category' in body) data.category = cleanString(body.category);
  if ('loincCode' in body) data.loincCode = cleanString(body.loincCode) || null;
  if ('specimenTypeDefault' in body || 'specimenType' in body) {
    data.specimenTypeDefault =
      cleanString(body.specimenTypeDefault ?? body.specimenType) || null;
  }
  if ('containerTypeDefault' in body || 'containerType' in body) {
    data.containerTypeDefault =
      cleanString(body.containerTypeDefault ?? body.containerType) || null;
  }
  if ('requiresColdChainDefault' in body) {
    data.requiresColdChainDefault =
      cleanBoolean(body.requiresColdChainDefault, existing.requiresColdChainDefault) ??
      existing.requiresColdChainDefault;
  }
  if ('requiredTempMinCDefault' in body) {
    data.requiredTempMinCDefault = cleanNumber(body.requiredTempMinCDefault);
  }
  if ('requiredTempMaxCDefault' in body) {
    data.requiredTempMaxCDefault = cleanNumber(body.requiredTempMaxCDefault);
  }
  if ('prepNotes' in body) data.prepNotes = cleanString(body.prepNotes) || null;
  if ('active' in body) data.active = cleanBoolean(body.active, existing.active);

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: false, error: 'no_changes' }, { status: 400 });
  }

  if ('code' in data && !data.code) {
    return NextResponse.json({ ok: false, error: 'missing_code' }, { status: 400 });
  }
  if ('name' in data && !data.name) {
    return NextResponse.json({ ok: false, error: 'missing_name' }, { status: 400 });
  }
  if ('category' in data && !data.category) {
    return NextResponse.json({ ok: false, error: 'missing_category' }, { status: 400 });
  }

  const row = await prisma.medReachTestCatalog.update({
    where: { id: existing.id },
    data,
  });

  await prisma.auditEvent.create({
    data: {
      kind: 'medreach_test_catalog_updated',
      actorId: who.uid,
      actorRole: who.role,
      subjectId: row.id,
      meta: {
        catalogTestId: row.id,
        changedFields: Object.keys(data),
      },
    },
  });

  return NextResponse.json({
    ok: true,
    data: projectCatalogTest(row),
  });
}