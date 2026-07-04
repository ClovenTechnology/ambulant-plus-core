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
  if (['true', '1', 'yes', 'y', 'active', 'available'].includes(raw)) return true;
  if (['false', '0', 'no', 'n', 'inactive', 'unavailable'].includes(raw)) return false;
  return fallback;
}

function asPriceCents(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.round(value));
  const raw = clean(value, 40).replace(/[^0-9.\-]/g, '');
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return raw.includes('.') ? Math.max(0, Math.round(n * 100)) : Math.max(0, Math.round(n));
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    const s = clean(value, 160);
    if (s) return s;
  }
  return '';
}

function parseSkuCodes(body: any) {
  const skuCode = firstString(
    body?.skuCode,
    body?.sku_code,
    body?.sku,
    body?.pharmacySku,
    body?.pharmacy_sku,
    body?.localSku,
    body?.local_sku,
    body?.stockCode,
    body?.stock_code,
    body?.productCode,
    body?.product_code,
  ) || null;

  const nappiCode = firstString(body?.nappiCode, body?.nappi_code, body?.nappi);
  const rxnormCode = firstString(body?.rxnormCode, body?.rxnorm_code, body?.rxCui, body?.rxcui, body?.rxnorm);
  const explicitDrugCode = firstString(body?.drugCode, body?.drug_code, body?.code, body?.medicineCode, body?.medicine_code);

  const drugCode = nappiCode || rxnormCode || explicitDrugCode || null;
  const codeSystem = nappiCode ? 'NAPPI' : rxnormCode ? 'RXNORM' : drugCode ? 'LOCAL_OR_UNKNOWN' : null;

  return { skuCode, drugCode, codeSystem };
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
  const name = clean(body?.name ?? body?.displayName ?? body?.drugName ?? body?.medication ?? body?.label, 500);
  const { skuCode, drugCode, codeSystem } = parseSkuCodes(body);
  const currency = clean(body?.currency, 10).toUpperCase() || pharmacyCurrency || 'ZAR';
  const priceCents = asPriceCents(body?.priceCents ?? body?.price ?? body?.unitPriceCents ?? body?.unitPrice);

  return {
    name,
    skuCode,
    drugCode,
    codeSystem,
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
        { skuCode: { contains: q, mode: 'insensitive' } },
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
    if (pharmacy.active === false) return json({ ok: false, error: 'pharmacy_inactive' }, 409);

    const body = await req.json().catch(() => ({}));
    const input = normalizeSkuInput(body, pharmacy.currency || 'ZAR');

    if (!input.name) return json({ ok: false, error: 'name_required' }, 400);
    if (!input.priceCents || input.priceCents < 0) return json({ ok: false, error: 'valid_price_required' }, 400);

    if (pharmacy.currency && input.currency !== pharmacy.currency) {
      return json({ ok: false, error: 'currency_must_match_pharmacy_currency', pharmacyCurrency: pharmacy.currency }, 409);
    }

    const duplicateWhere: any[] = [];
    if (input.skuCode) duplicateWhere.push({ skuCode: input.skuCode });
    if (input.drugCode) duplicateWhere.push({ drugCode: input.drugCode, name: { equals: input.name, mode: 'insensitive' } });

    const existing = duplicateWhere.length
      ? await (prisma as any).carePortPharmacySku.findFirst({
          where: { orgId, pharmacyId, OR: duplicateWhere },
          orderBy: { updatedAt: 'desc' },
        })
      : null;

    const data = {
      orgId,
      pharmacyId,
      name: input.name,
      skuCode: input.skuCode,
      drugCode: input.drugCode,
      priceCents: input.priceCents,
      currency: input.currency,
      isGeneric: input.isGeneric,
      isActive: input.isActive,
    };

    const item = existing
      ? await (prisma as any).carePortPharmacySku.update({ where: { id: existing.id }, data })
      : await (prisma as any).carePortPharmacySku.create({ data });

    await (prisma as any).auditEvent.create({
      data: {
        kind: existing ? 'careport_inventory_sku_upsert_updated' : 'careport_inventory_sku_created',
        actorId: who.uid ?? null,
        actorRole: who.role ?? null,
        subjectId: item.id,
        meta: {
          orgId,
          pharmacyId,
          name: input.name,
          skuCode: input.skuCode,
          drugCode: input.drugCode,
          codeSystem: input.codeSystem,
          isGeneric: input.isGeneric,
          duplicateMatched: Boolean(existing),
        },
      },
    }).catch(() => null);

    return json({ ok: true, item, sku: item, updatedExisting: Boolean(existing) }, existing ? 200 : 201);
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'inventory_create_failed' }, error?.status || 500);
  }
}
