import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  asObject,
  auditEnterpriseFinance,
  json,
  requireEnterpriseFinanceAdmin,
  routeError,
  text,
} from '@/src/enterprise-finance/access-envelope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function boolOrDefault(value: any, fallback: boolean) {
  if (value === undefined || value === null) return fallback;
  return value === true || value === 'true';
}

function boolOrUndefined(value: any) {
  if (value === undefined || value === null) return undefined;
  return value === true || value === 'true';
}

function intValue(value: any, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function cents(value: any, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(n * 100);
}

function dateOrNull(value: any) {
  const raw = text(value, 80);
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function defined(data: Record<string, any>) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
}

function idempotencyKey(req: NextRequest) {
  return text(req.headers.get('Idempotency-Key'), 180) || null;
}

function safeAvailable(quantityOnHand: number, reservedQuantity: number) {
  return Math.max(quantityOnHand - reservedQuantity, 0);
}

function calculateLandingCost(input: any) {
  const baseZar = cents(input.zarEquivalent || input.zarEquivalentZar || input.zarEquivalentCents / 100);
  const importDuty = cents(input.importDuty || input.importDutyZar || input.importDutyCents / 100);
  const tax = cents(input.tax || input.taxZar || input.taxCents / 100);
  const vat = cents(input.vat || input.vatZar || input.vatCents / 100);
  const msp = cents(input.msp || input.mspZar || input.mspCents / 100);
  const shipping = cents(input.shipping || input.shippingZar || input.shippingCents / 100);
  const clearing = cents(input.clearing || input.clearingZar || input.clearingCents / 100);
  const handling = cents(input.handling || input.handlingZar || input.handlingCents / 100);
  const other = cents(input.otherLandingCost || input.otherLandingCostZar || input.otherLandingCostCents / 100);

  const totalLandingCostCents = baseZar + importDuty + tax + vat + msp + shipping + clearing + handling + other;

  return {
    importDutyCents: importDuty,
    taxCents: tax,
    vatCents: vat,
    mspCents: msp,
    shippingCents: shipping,
    clearingCents: clearing,
    handlingCents: handling,
    otherLandingCostCents: other,
    totalLandingCostCents,
  };
}
// A5_M_H_A_ENTERPRISE_FINANCE_INVENTORY_CATEGORY_ROUTE

async function auditCategory(action: string, req: NextRequest, subjectId: string, extra: Record<string, any> = {}) {
  await auditEnterpriseFinance(action, req, {
    model: 'OpsInventoryCategory',
    subjectId,
    idempotencyKey: idempotencyKey(req),
    mutationSurface: 'enterprise_finance_inventory_category',
    ...extra,
  });
}

export async function GET(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;

    const db: any = prisma;
    const { searchParams } = new URL(req.url);

    const active = searchParams.get('active');
    const q = text(searchParams.get('q'), 160);
    const limitRaw = Number(searchParams.get('limit') || 200);
    const limit = Math.max(1, Math.min(Number.isFinite(limitRaw) ? limitRaw : 200, 500));

    const where: any = {};
    if (active === 'true') where.active = true;
    if (active === 'false') where.active = false;

    if (q) {
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    const categories = await db.opsInventoryCategory.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      take: limit,
    });

    return json({ ok: true, envelope: access.envelope, categories, meta: { count: categories.length, limit } });
  } catch (error: any) {
    return routeError(error, 'enterprise_finance_inventory_category_list_failed');
  }
}

export async function POST(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;

    const db: any = prisma;
    const body = await req.json().catch(() => ({}));
    const action = text(body.action || 'create_inventory_category', 120);

    if (action !== 'create_inventory_category') {
      return json({ ok: false, envelope: access.envelope, error: 'unsupported_inventory_category_post_action', action }, 400);
    }

    const code = text(body.code, 180);
    const name = text(body.name, 240);

    if (!code) return json({ ok: false, envelope: access.envelope, error: 'category_code_required' }, 400);
    if (!name) return json({ ok: false, envelope: access.envelope, error: 'category_name_required' }, 400);

    const category = await db.opsInventoryCategory.create({
      data: {
        code,
        name,
        description: text(body.description, 2000),
        parentCategoryId: text(body.parentCategoryId, 180),

        imageUrl: text(body.imageUrl, 1200),
        imageObjectKey: text(body.imageObjectKey, 1200),

        patientVisible: boolOrDefault(body.patientVisible, false),
        clinicianVisible: boolOrDefault(body.clinicianVisible, false),
        medreachVisible: boolOrDefault(body.medreachVisible, false),
        careportVisible: boolOrDefault(body.careportVisible, false),
        adminVisible: boolOrDefault(body.adminVisible, true),

        active: boolOrDefault(body.active, true),
        sortOrder: intValue(body.sortOrder),
        meta: asObject(body.meta || {}),
        createdByUserId: access.envelope.actor.userId,
      },
    });

    await auditCategory('inventory_category_created', req, category.id, {
      code: category.code,
      active: category.active,
    });

    return json({ ok: true, envelope: access.envelope, category }, 201);
  } catch (error: any) {
    return routeError(error, 'enterprise_finance_inventory_category_create_failed');
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const access = await requireEnterpriseFinanceAdmin(req);
    if (!access.ok) return access.response;

    const db: any = prisma;
    const body = await req.json().catch(() => ({}));
    const action = text(body.action, 120);
    const id = text(body.id || body.categoryId, 180);

    if (!action) return json({ ok: false, envelope: access.envelope, error: 'action_required' }, 400);
    if (!id) return json({ ok: false, envelope: access.envelope, error: 'category_id_required' }, 400);

    const existing = await db.opsInventoryCategory.findUnique({ where: { id } });
    if (!existing) return json({ ok: false, envelope: access.envelope, error: 'inventory_category_not_found' }, 404);

    if (
      action === 'update_inventory_category' ||
      action === 'activate_inventory_category' ||
      action === 'archive_inventory_category'
    ) {
      const category = await db.opsInventoryCategory.update({
        where: { id },
        data: defined({
          code: body.code === undefined ? undefined : text(body.code, 180),
          name: body.name === undefined ? undefined : text(body.name, 240),
          description: body.description === undefined ? undefined : text(body.description, 2000),
          parentCategoryId: body.parentCategoryId === undefined ? undefined : text(body.parentCategoryId, 180),

          imageUrl: body.imageUrl === undefined ? undefined : text(body.imageUrl, 1200),
          imageObjectKey: body.imageObjectKey === undefined ? undefined : text(body.imageObjectKey, 1200),

          patientVisible: boolOrUndefined(body.patientVisible),
          clinicianVisible: boolOrUndefined(body.clinicianVisible),
          medreachVisible: boolOrUndefined(body.medreachVisible),
          careportVisible: boolOrUndefined(body.careportVisible),
          adminVisible: boolOrUndefined(body.adminVisible),

          active:
            action === 'activate_inventory_category' ? true :
            action === 'archive_inventory_category' ? false :
            boolOrUndefined(body.active),

          sortOrder: body.sortOrder === undefined ? undefined : intValue(body.sortOrder),
          meta: body.meta === undefined ? undefined : asObject(body.meta),
        }),
      });

      const auditAction =
        action === 'activate_inventory_category' ? 'inventory_category_activated' :
        action === 'archive_inventory_category' ? 'inventory_category_archived' :
        'inventory_category_updated';

      await auditCategory(auditAction, req, category.id, {
        code: category.code,
        active: category.active,
      });

      return json({ ok: true, envelope: access.envelope, category });
    }

    return json({ ok: false, envelope: access.envelope, error: 'unsupported_inventory_category_patch_action', action }, 400);
  } catch (error: any) {
    return routeError(error, 'enterprise_finance_inventory_category_patch_failed');
  }
}
