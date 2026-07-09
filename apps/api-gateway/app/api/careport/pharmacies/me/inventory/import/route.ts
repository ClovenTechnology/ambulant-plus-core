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
  if (['true', '1', 'yes', 'y', 'generic', 'active', 'available'].includes(raw)) return true;
  if (['false', '0', 'no', 'n', 'brand', 'original', 'inactive', 'unavailable'].includes(raw)) return false;
  return fallback;
}

function asPriceCents(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.round(value));
  const raw = clean(value, 40).replace(/[^0-9.\-]/g, '');
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return raw.includes('.') ? Math.max(0, Math.round(n * 100)) : Math.max(0, Math.round(n));
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"' && quoted && next === '"') {
      cur += '"';
      i += 1;
      continue;
    }

    if (ch === '"') {
      quoted = !quoted;
      continue;
    }

    if (ch === ',' && !quoted) {
      out.push(cur.trim());
      cur = '';
      continue;
    }

    cur += ch;
  }

  out.push(cur.trim());
  return out;
}

function normalizeHeader(value: string) {
  return clean(value, 80)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function parseCsv(text: string) {
  const rows = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!rows.length) return [];

  const rawHeaders = splitCsvLine(rows[0]);
  const normalizedHeaders = rawHeaders.map(normalizeHeader);
  const knownHeaders = new Set([
    'name',
    'displayname',
    'drugname',
    'medication',
    'label',
    'drugcode',
    'code',
    'nappi',
    'nappicode',
    'rxnorm',
    'rxnormcode',
    'rxcui',
    'skucode',
    'sku',
    'pharmacysku',
    'localsku',
    'stockcode',
    'productcode',
    'price',
    'pricecents',
    'unitprice',
    'unitpricecents',
    'currency',
    'isgeneric',
    'generic',
    'isactive',
    'active',
  ]);

  const hasHeader = normalizedHeaders.some((h) => knownHeaders.has(h));
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const fallbackHeaders = ['drugcode', 'name', 'pricecents', 'currency', 'isgeneric', 'isactive'];
  const keys = hasHeader ? normalizedHeaders : fallbackHeaders;

  return dataRows.map((line, index) => {
    const cells = splitCsvLine(line);
    const row: any = { _line: hasHeader ? index + 2 : index + 1 };

    keys.forEach((key, i) => {
      row[key] = cells[i] ?? '';
    });

    return row;
  });
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    const s = clean(value, 160);
    if (s) return s;
  }
  return '';
}

async function resolvePharmacyId(req: NextRequest, who: ReturnType<typeof readIdentity>) {
  const orgId = orgIdFromHeaders(req.headers);
  const explicit = clean(req.nextUrl.searchParams.get('pharmacyId'), 120);

  if (who.role === 'admin' && explicit) return explicit;
  if (who.role === 'pharmacy' && who.uid) return String(who.uid);
  if (who.role === 'pharmacy_staff' && who.uid) return await pharmacyIdForStaff(orgId, who.uid);

  return null;
}

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', 'access-control-allow-origin': '*' },
  });
}

function normalizeRow(row: any, pharmacyCurrency: string) {
  const name = firstString(row.name, row.displayname, row.drugname, row.medication, row.label);

  const skuCode = firstString(
    row.skucode,
    row.sku,
    row.pharmacysku,
    row.localsku,
    row.stockcode,
    row.productcode,
  ) || null;

  const nappiCode = firstString(row.nappi, row.nappicode);
  const rxnormCode = firstString(row.rxnorm, row.rxnormcode, row.rxcui);
  const explicitDrugCode = firstString(row.drugcode, row.code, row.medicinecode);
  const drugCode = nappiCode || rxnormCode || explicitDrugCode || null;
  const codeSystem = nappiCode ? 'NAPPI' : rxnormCode ? 'RXNORM' : drugCode ? 'LOCAL_OR_UNKNOWN' : null;

  const priceCents = asPriceCents(row.pricecents ?? row.unitpricecents ?? row.price ?? row.unitprice);
  const currency = clean(row.currency, 10).toUpperCase() || pharmacyCurrency || 'ZAR';

  return {
    name,
    skuCode,
    drugCode,
    codeSystem,
    priceCents,
    currency,
    isGeneric: asBool(row.isgeneric ?? row.generic, false),
    isActive: asBool(row.isactive ?? row.active, true),
  };
}

function dedupeKey(row: any) {
  if (row.skuCode) return 'sku:' + row.skuCode.toLowerCase();
  if (row.drugCode) return 'drug:' + row.drugCode.toLowerCase() + '|name:' + row.name.toLowerCase();
  return 'name:' + row.name.toLowerCase() + '|price:' + row.priceCents;
}


const CAREPORT_PRODUCT_TYPES = new Set([
  'MEDICATION',
  'OTC_MEDICATION',
  'SUPPLEMENT',
  'MEDICAL_DEVICE',
  'PERSONAL_CARE',
  'SKINCARE',
  'HAIRCARE',
  'BABY_CARE',
  'HOUSEHOLD',
  'GENERAL_MERCHANDISE',
]);

function careportCleanToken(value: unknown, fallback = '') {
  const raw = clean(value, 80)
    .toUpperCase()
    .replace(/[^A-Z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return raw || fallback;
}

function careportOptionalInt(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(String(value).replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.trunc(n));
}

function careportJsonObject(value: unknown): Record<string, any> | null {
  if (value == null || value === '') return null;
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;

  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeCarePortProductType(value: unknown, fallback = 'MEDICATION') {
  const token = careportCleanToken(value, fallback);

  if (CAREPORT_PRODUCT_TYPES.has(token)) return token;
  if (['OTC', 'OVER_THE_COUNTER', 'NON_PRESCRIPTION_MEDICATION'].includes(token)) return 'OTC_MEDICATION';
  if (['VITAMIN', 'VITAMINS', 'MULTIVITAMIN', 'SUPPLEMENTS'].includes(token)) return 'SUPPLEMENT';
  if (['DEVICE', 'MEDICAL_DEVICES'].includes(token)) return 'MEDICAL_DEVICE';
  if (['MERCHANDISE', 'GENERAL', 'RETAIL', 'OTHER'].includes(token)) return 'GENERAL_MERCHANDISE';

  return fallback;
}

function normalizeCarePortExtendedSkuInput(body: any) {
  const productType = normalizeCarePortProductType(body?.productType ?? body?.type ?? body?.itemType, 'MEDICATION');
  const otc = asBool(body?.otc ?? body?.isOtc ?? body?.overTheCounter, productType === 'OTC_MEDICATION');

  const prescriptionRequired = asBool(
    body?.prescriptionRequired ?? body?.requiresPrescription ?? body?.rxRequired,
    productType === 'MEDICATION' && !otc,
  );

  return {
    productType,
    category: clean(body?.category ?? body?.department, 120) || null,
    subcategory: clean(body?.subcategory ?? body?.subCategory, 120) || null,
    otc,
    prescriptionRequired,
    marketplaceVisible: asBool(body?.marketplaceVisible ?? body?.visibleInMarketplace ?? body?.public, !prescriptionRequired),
    sellableOnline: asBool(body?.sellableOnline ?? body?.onlineSale ?? body?.canBuyOnline, true),
    brand: clean(body?.brand, 160) || null,
    manufacturer: clean(body?.manufacturer ?? body?.supplier, 160) || null,
    barcode: clean(body?.barcode ?? body?.gtin ?? body?.ean ?? body?.upc, 120) || null,
    description: clean(body?.description ?? body?.details, 2000) || null,
    imageUrl: clean(body?.imageUrl ?? body?.image ?? body?.photoUrl, 1000) || null,
    packSize: clean(body?.packSize ?? body?.pack ?? body?.size, 120) || null,
    variantGroupKey: clean(body?.variantGroupKey ?? body?.parentSku ?? body?.styleCode, 160) || null,
    variantName: clean(body?.variantName ?? body?.variant ?? body?.optionName, 160) || null,
    variantAttributes: careportJsonObject(body?.variantAttributes ?? body?.variants ?? body?.options),
    attributes: careportJsonObject(body?.attributes ?? body?.metadata),
    stockOnHand: careportOptionalInt(body?.stockOnHand ?? body?.stock ?? body?.quantityOnHand),
    reservedStock: careportOptionalInt(body?.reservedStock) ?? 0,
    lowStockThreshold: careportOptionalInt(body?.lowStockThreshold ?? body?.reorderLevel),
    maxOrderQty: careportOptionalInt(body?.maxOrderQty ?? body?.maxQuantity),
    ageRestricted: asBool(body?.ageRestricted ?? body?.adultOnly, false),
    regulatedSchedule: clean(body?.regulatedSchedule ?? body?.schedule ?? body?.medicineSchedule, 80) || null,
    taxCategory: clean(body?.taxCategory ?? body?.vatCategory, 80) || null,
  };
}

function normalizeCarePortExtendedSkuPatch(body: any) {
  const data: Record<string, any> = {};

  if (body.productType !== undefined || body.type !== undefined || body.itemType !== undefined) {
    data.productType = normalizeCarePortProductType(body.productType ?? body.type ?? body.itemType, 'MEDICATION');
  }

  if (body.category !== undefined || body.department !== undefined) data.category = clean(body.category ?? body.department, 120) || null;
  if (body.subcategory !== undefined || body.subCategory !== undefined) data.subcategory = clean(body.subcategory ?? body.subCategory, 120) || null;
  if (body.otc !== undefined || body.isOtc !== undefined || body.overTheCounter !== undefined) data.otc = asBool(body.otc ?? body.isOtc ?? body.overTheCounter, false);
  if (body.prescriptionRequired !== undefined || body.requiresPrescription !== undefined || body.rxRequired !== undefined) data.prescriptionRequired = asBool(body.prescriptionRequired ?? body.requiresPrescription ?? body.rxRequired, true);
  if (body.marketplaceVisible !== undefined || body.visibleInMarketplace !== undefined || body.public !== undefined) data.marketplaceVisible = asBool(body.marketplaceVisible ?? body.visibleInMarketplace ?? body.public, false);
  if (body.sellableOnline !== undefined || body.onlineSale !== undefined || body.canBuyOnline !== undefined) data.sellableOnline = asBool(body.sellableOnline ?? body.onlineSale ?? body.canBuyOnline, true);
  if (body.brand !== undefined) data.brand = clean(body.brand, 160) || null;
  if (body.manufacturer !== undefined || body.supplier !== undefined) data.manufacturer = clean(body.manufacturer ?? body.supplier, 160) || null;
  if (body.barcode !== undefined || body.gtin !== undefined || body.ean !== undefined || body.upc !== undefined) data.barcode = clean(body.barcode ?? body.gtin ?? body.ean ?? body.upc, 120) || null;
  if (body.description !== undefined || body.details !== undefined) data.description = clean(body.description ?? body.details, 2000) || null;
  if (body.imageUrl !== undefined || body.image !== undefined || body.photoUrl !== undefined) data.imageUrl = clean(body.imageUrl ?? body.image ?? body.photoUrl, 1000) || null;
  if (body.packSize !== undefined || body.pack !== undefined || body.size !== undefined) data.packSize = clean(body.packSize ?? body.pack ?? body.size, 120) || null;
  if (body.variantGroupKey !== undefined || body.parentSku !== undefined || body.styleCode !== undefined) data.variantGroupKey = clean(body.variantGroupKey ?? body.parentSku ?? body.styleCode, 160) || null;
  if (body.variantName !== undefined || body.variant !== undefined || body.optionName !== undefined) data.variantName = clean(body.variantName ?? body.variant ?? body.optionName, 160) || null;
  if (body.variantAttributes !== undefined || body.variants !== undefined || body.options !== undefined) data.variantAttributes = careportJsonObject(body.variantAttributes ?? body.variants ?? body.options);
  if (body.attributes !== undefined || body.metadata !== undefined) data.attributes = careportJsonObject(body.attributes ?? body.metadata);
  if (body.stockOnHand !== undefined || body.stock !== undefined || body.quantityOnHand !== undefined) data.stockOnHand = careportOptionalInt(body.stockOnHand ?? body.stock ?? body.quantityOnHand);
  if (body.reservedStock !== undefined) data.reservedStock = careportOptionalInt(body.reservedStock) ?? 0;
  if (body.lowStockThreshold !== undefined || body.reorderLevel !== undefined) data.lowStockThreshold = careportOptionalInt(body.lowStockThreshold ?? body.reorderLevel);
  if (body.maxOrderQty !== undefined || body.maxQuantity !== undefined) data.maxOrderQty = careportOptionalInt(body.maxOrderQty ?? body.maxQuantity);
  if (body.ageRestricted !== undefined || body.adultOnly !== undefined) data.ageRestricted = asBool(body.ageRestricted ?? body.adultOnly, false);
  if (body.regulatedSchedule !== undefined || body.schedule !== undefined || body.medicineSchedule !== undefined) data.regulatedSchedule = clean(body.regulatedSchedule ?? body.schedule ?? body.medicineSchedule, 80) || null;
  if (body.taxCategory !== undefined || body.vatCategory !== undefined) data.taxCategory = clean(body.taxCategory ?? body.vatCategory, 80) || null;

  return data;
}

function normalizeCarePortExtendedCsvSku(row: Record<string, any>) {
  const productType = normalizeCarePortProductType(row.producttype ?? row.product_type ?? row.type ?? row.itemtype ?? row.item_type, 'MEDICATION');
  const otc = asBool(row.otc ?? row.isotc ?? row.is_otc ?? row.over_the_counter, productType === 'OTC_MEDICATION');

  const prescriptionRequired = asBool(
    row.prescriptionrequired ?? row.prescription_required ?? row.rxrequired ?? row.rx_required,
    productType === 'MEDICATION' && !otc,
  );

  return {
    productType,
    category: clean(row.category ?? row.department, 120) || null,
    subcategory: clean(row.subcategory ?? row.sub_category, 120) || null,
    otc,
    prescriptionRequired,
    marketplaceVisible: asBool(row.marketplacevisible ?? row.marketplace_visible ?? row.public, !prescriptionRequired),
    sellableOnline: asBool(row.sellableonline ?? row.sellable_online ?? row.online_sale, true),
    brand: clean(row.brand, 160) || null,
    manufacturer: clean(row.manufacturer ?? row.supplier, 160) || null,
    barcode: clean(row.barcode ?? row.gtin ?? row.ean ?? row.upc, 120) || null,
    description: clean(row.description, 2000) || null,
    imageUrl: clean(row.imageurl ?? row.image_url ?? row.image, 1000) || null,
    packSize: clean(row.packsize ?? row.pack_size ?? row.size, 120) || null,
    variantGroupKey: clean(row.variantgroupkey ?? row.variant_group_key ?? row.parent_sku ?? row.style_code, 160) || null,
    variantName: clean(row.variantname ?? row.variant_name ?? row.variant ?? row.option_name, 160) || null,
    variantAttributes: careportJsonObject(row.variantattributes ?? row.variant_attributes ?? row.variants ?? row.options),
    attributes: careportJsonObject(row.attributes ?? row.metadata),
    stockOnHand: careportOptionalInt(row.stockonhand ?? row.stock_on_hand ?? row.stock ?? row.quantity),
    reservedStock: careportOptionalInt(row.reservedstock ?? row.reserved_stock) ?? 0,
    lowStockThreshold: careportOptionalInt(row.lowstockthreshold ?? row.low_stock_threshold ?? row.reorderlevel ?? row.reorder_level),
    maxOrderQty: careportOptionalInt(row.maxorderqty ?? row.max_order_qty ?? row.maxquantity ?? row.max_quantity),
    ageRestricted: asBool(row.agerestricted ?? row.age_restricted ?? row.adult_only, false),
    regulatedSchedule: clean(row.regulatedschedule ?? row.regulated_schedule ?? row.schedule ?? row.medicine_schedule, 80) || null,
    taxCategory: clean(row.taxcategory ?? row.tax_category ?? row.vat_category, 80) || null,
  };
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
    const rowsRaw = Array.isArray(body?.items)
      ? body.items
      : Array.isArray(body?.rows)
        ? body.rows
        : parseCsv(clean(body?.csv ?? body?.text, 400_000));

    if (!rowsRaw.length) return json({ ok: false, error: 'no_inventory_rows' }, 400);

    const errors: any[] = [];
    const valid: any[] = [];
    const seen = new Set<string>();

    rowsRaw.slice(0, 1000).forEach((row: any, index: number) => {
      const normalized = normalizeRow(row, pharmacy.currency || 'ZAR');
      const extended = normalizeCarePortExtendedCsvSku(row);
      const line = row?._line ?? index + 1;

      if (!normalized.name) {
        errors.push({ line, error: 'name_required' });
        return;
      }

      if (!normalized.priceCents) {
        errors.push({ line, error: 'valid_price_required', name: normalized.name });
        return;
      }

      if (pharmacy.currency && normalized.currency !== pharmacy.currency) {
        errors.push({
          line,
          error: 'currency_must_match_pharmacy_currency',
          name: normalized.name,
          pharmacyCurrency: pharmacy.currency,
        });
        return;
      }

      const key = dedupeKey(normalized);
      if (seen.has(key)) {
        errors.push({ line, error: 'duplicate_row_in_upload', name: normalized.name, drugCode: normalized.drugCode, skuCode: normalized.skuCode });
        return;
      }

      seen.add(key);
      valid.push({
        line,
        key,
        orgId,
        pharmacyId,
        name: normalized.name,
        skuCode: normalized.skuCode,
        drugCode: normalized.drugCode,
        codeSystem: normalized.codeSystem,
        priceCents: normalized.priceCents,
        currency: normalized.currency,
        isGeneric: normalized.isGeneric,
        isActive: normalized.isActive,
        ...extended,
      });
    });

    if (!valid.length) return json({ ok: false, error: 'no_valid_rows', errors }, 400);

    let created = 0;
    let updated = 0;
    const codeSystems: Record<string, number> = {};

    await (prisma as any).$transaction(async (tx: any) => {
      for (const row of valid) {
        if (row.codeSystem) codeSystems[row.codeSystem] = (codeSystems[row.codeSystem] || 0) + 1;

        const duplicateWhere: any[] = [];
        if (row.skuCode) duplicateWhere.push({ skuCode: row.skuCode });
        if (row.barcode) duplicateWhere.push({ barcode: row.barcode });
        if (row.drugCode) duplicateWhere.push({ drugCode: row.drugCode, name: { equals: row.name, mode: 'insensitive' } });

        const existing = duplicateWhere.length
          ? await tx.carePortPharmacySku.findFirst({
              where: { orgId, pharmacyId, OR: duplicateWhere },
              orderBy: { updatedAt: 'desc' },
            })
          : null;

        const data = {
          orgId,
          pharmacyId,
          name: row.name,
          skuCode: row.skuCode,
          drugCode: row.drugCode,
          priceCents: row.priceCents,
          currency: row.currency,
          isGeneric: row.isGeneric,
          isActive: row.isActive,
          productType: row.productType,
          category: row.category,
          subcategory: row.subcategory,
          otc: row.otc,
          prescriptionRequired: row.prescriptionRequired,
          marketplaceVisible: row.marketplaceVisible,
          sellableOnline: row.sellableOnline,
          brand: row.brand,
          manufacturer: row.manufacturer,
          barcode: row.barcode,
          description: row.description,
          imageUrl: row.imageUrl,
          packSize: row.packSize,
          variantGroupKey: row.variantGroupKey,
          variantName: row.variantName,
          variantAttributes: row.variantAttributes,
          attributes: row.attributes,
          stockOnHand: row.stockOnHand,
          reservedStock: row.reservedStock,
          lowStockThreshold: row.lowStockThreshold,
          maxOrderQty: row.maxOrderQty,
          ageRestricted: row.ageRestricted,
          regulatedSchedule: row.regulatedSchedule,
          taxCategory: row.taxCategory,
        };

        if (existing) {
          await tx.carePortPharmacySku.update({ where: { id: existing.id }, data });
          updated += 1;
        } else {
          await tx.carePortPharmacySku.create({ data });
          created += 1;
        }
      }

      await tx.auditEvent.create({
        data: {
          kind: 'careport_inventory_imported',
          actorId: who.uid ?? null,
          actorRole: who.role ?? null,
          subjectId: pharmacyId,
          meta: {
            orgId,
            pharmacyId,
            submitted: rowsRaw.length,
            valid: valid.length,
            created,
            updated,
            errorCount: errors.length,
            codeSystems,
            duplicateStrategy: 'skuCode_or_drugCode_name_updates_existing',
          },
        },
      });
    });

    return json({
      ok: true,
      submitted: rowsRaw.length,
      valid: valid.length,
      created,
      updated,
      errors,
      codeSystems,
    });
  } catch (error: any) {
    return json({ ok: false, error: error?.message || 'inventory_import_failed' }, error?.status || 500);
  }
}
