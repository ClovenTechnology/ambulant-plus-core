import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';
import { orgIdFromHeaders, pharmacyIdForStaff, requireRole } from '@/src/lib/careport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clean(value: unknown, max = 500): string {
  return String(value ?? '').trim().slice(0, max);
}

function asBool(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  const raw = clean(value, 20).toLowerCase();
  if (['true', '1', 'yes', 'y', 'active'].includes(raw)) return true;
  if (['false', '0', 'no', 'n', 'inactive'].includes(raw)) return false;
  return fallback;
}

function asPriceCents(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.round(value));
  const raw = clean(value, 40).replace(/[^0-9.\-]/g, '');
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return raw.includes('.') ? Math.max(0, Math.round(n * 100)) : Math.max(0, Math.round(n));
}

async function resolvePharmacyId(req: NextRequest, who: ReturnType<typeof readIdentity>) {
  const orgId = orgIdFromHeaders(req.headers);
  const explicit = clean(req.nextUrl.searchParams.get('pharmacyId'), 120);

  if (who.role === 'admin' && explicit) return explicit;
  if (who.role === 'pharmacy' && who.uid) return String(who.uid);

  if (who.role === 'pharmacy_staff' && who.uid) {
    const mapped = await pharmacyIdForStaff(orgId, who.uid);
    return mapped ? String(mapped) : null;
  }

  return null;
}

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'access-control-allow-origin': '*',
    },
  });
}

function normalizeSkuInput(body: any, pharmacyCurrency = 'ZAR') {
  const name = clean(body?.name ?? body?.displayName ?? body?.drugName, 500);
  const drugCode = clean(body?.drugCode ?? body?.code ?? body?.nappiCode ?? body?.rxnormCode, 120) || null;
  const currency = clean(body?.currency, 10).toUpperCase() || pharmacyCurrency || 'ZAR';
  const priceCents = asPriceCents(body?.priceCents ?? body?.price ?? body?.unitPriceCents);

  return {
    name,
    drugCode,
    priceCents,
    currency,
    isGeneric: asBool(body?.isGeneric ?? body?.generic, false),
    isActive: asBool(body?.isActive ?? body?.active, true),
  };
}

export async function GET(req: NextRequest) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);

  try {
    requireRole(who, ['admin', 'pharmacy', 'pharmacy_staff']);

    const pharmacyId = await resolvePharmacyId(req, who);
    if (!pharmacyId) return json({ ok: false, error: 'pharmacyId_unresolved', items: [] }, 409);

    const q = clean(req.nextUrl.searchParams.get('q'), 120);
    const active = clean(req.nextUrl.searchParams.get('active'), 20).toLowerCase();
    const generic = clean(req.nextUrl.searchParams.get('generic'), 20).toLowerCase();
    const limit = Math.min(500, Math.max(1, Number(req.nextUrl.searchParams.get('limit') || 200)));

    const where: any = { orgId, pharmacyId };

    if (active === 'true' || active === '1') where.isActive = true;
    if (active === 'false' || active === '0') where.isActive = false;
    if (generic === 'true' || generic === '1') where.isGeneric = true;
    if (generic === 'false' || generic === '0') where.isGeneric = false;

    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { drugCode: { contains: q, mode: 'insensitive' } },
      ];
    }

    const items = await (prisma as any).carePortPharmacySku.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { isGeneric: 'asc' }, { name: 'asc' }],
      take: limit,
    });

    return json({ ok: true, pharmacyId, items, inventory: items });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'inventory_load_failed', items: [] }, error?.status || 500);
  }
}

export async function POST(req: NextRequest) {
  const who = readIdentity(req.headers);
  const orgId = orgIdFromHeaders(req.headers);

  try {
    requireRole(who, ['admin', 'pharmacy', 'pharmacy_staff']);

    const pharmacyId = await resolvePharmacyId(req, who);
    if (!pharmacyId) return json({ ok: false, error: 'pharmacyId_unresolved' }, 409);

    const pharmacy = await (prisma as any).pharmacyPartner.findUnique({ where: { id: pharmacyId } });
    if (!pharmacy) return json({ ok: false, error: 'pharmacy_not_found' }, 404);

    const body = await req.json().catch(() => ({}));
    const input = normalizeSkuInput(body, pharmacy.currency || 'ZAR');

    if (!input.name) return json({ ok: false, error: 'name_required' }, 400);
    if (!input.priceCents || input.priceCents < 0) return json({ ok: false, error: 'valid_price_required' }, 400);

    if (pharmacy.currency && input.currency !== pharmacy.currency) {
      return json({ ok: false, error: 'currency_must_match_pharmacy_currency', pharmacyCurrency: pharmacy.currency }, 409);
    }

    const created = await (prisma as any).carePortPharmacySku.create({
      data: {
        orgId,
        pharmacyId,
        name: input.name,
        drugCode: input.drugCode,
        priceCents: input.priceCents,
        currency: input.currency,
        isGeneric: input.isGeneric,
        isActive: input.isActive,
      },
    });

    await (prisma as any).auditEvent.create({
      data: {
        kind: 'careport_inventory_sku_created',
        actorId: who.uid ?? null,
        actorRole: who.role ?? null,
        subjectId: created.id,
        meta: { orgId, pharmacyId, name: input.name, drugCode: input.drugCode, isGeneric: input.isGeneric },
      },
    }).catch(() => null);

    return json({ ok: true, item: created, sku: created }, 201);
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'inventory_create_failed' }, error?.status || 500);
  }
}
