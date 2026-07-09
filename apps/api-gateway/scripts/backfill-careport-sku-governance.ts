import { PrismaClient } from '@prisma/client';
import { normaliseCarePortSkuForCatalogue } from '../src/careport/catalogue/normalisation';

const prisma = new PrismaClient();

type AnyRecord = Record<string, any>;

const REVIEW_FINAL_STATUSES = new Set(['ADMIN_VERIFIED', 'GLOBAL_CATALOGUE_MATCHED', 'REJECTED']);

function argValue(name: string, fallback = '') {
  const prefix = name + '=';
  const found = process.argv.find((item) => item.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function asInt(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function absent(value: unknown) {
  if (value === null || typeof value === 'undefined') return true;
  if (typeof value === 'string' && !value.trim()) return true;
  return false;
}

function asObject(value: unknown): AnyRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as AnyRecord;
}

function governanceGapWhere() {
  return {
    OR: [
      { normalisationConfidence: null },
      { normalisationNotes: null },
      { globalProductKey: null },
      { canonicalName: null },
    ],
  };
}

async function counts() {
  const total = await prisma.carePortPharmacySku.count();

  const missingGovernance = await prisma.carePortPharmacySku.count({
    where: governanceGapWhere(),
  });

  const reviewRequired = await prisma.carePortPharmacySku.count({
    where: { reviewRequired: true },
  });

  const byStatus = await prisma.carePortPharmacySku
    .groupBy({
      by: ['normalisationStatus'],
      _count: { _all: true },
    })
    .catch(() => []);

  return {
    total,
    missingGovernance,
    reviewRequired,
    byStatus,
  };
}

function buildInputFromSku(sku: AnyRecord) {
  return {
    name: sku.name,
    drugCode: sku.drugCode,
    skuCode: sku.skuCode,
    productType: sku.productType,
    category: sku.category,
    subcategory: sku.subcategory,
    otc: sku.otc,
    prescriptionRequired: sku.prescriptionRequired,
    marketplaceVisible: sku.marketplaceVisible,
    sellableOnline: sku.sellableOnline,
    brand: sku.brand,
    manufacturer: sku.manufacturer,
    barcode: sku.barcode,
    description: sku.description,
    imageUrl: sku.imageUrl,
    packSize: sku.packSize,
    variantGroupKey: sku.variantGroupKey,
    variantName: sku.variantName,
    variantAttributes: asObject(sku.variantAttributes),
    attributes: asObject(sku.attributes),
    stockOnHand: sku.stockOnHand,
    reservedStock: sku.reservedStock,
    lowStockThreshold: sku.lowStockThreshold,
    maxOrderQty: sku.maxOrderQty,
    ageRestricted: sku.ageRestricted,
    regulatedSchedule: sku.regulatedSchedule,
    taxCategory: sku.taxCategory,
  };
}

function buildBackfillPatch(sku: AnyRecord, governance: AnyRecord) {
  const data: AnyRecord = {};
  const status = String(sku.normalisationStatus || '');
  const hasFinalReviewDecision = Boolean(sku.reviewedAt) || REVIEW_FINAL_STATUSES.has(status);

  if (absent(sku.normalisationConfidence)) data.normalisationConfidence = governance.normalisationConfidence;
  if (absent(sku.normalisationNotes)) data.normalisationNotes = governance.normalisationNotes;
  if (absent(sku.globalProductKey)) data.globalProductKey = governance.globalProductKey;
  if (absent(sku.canonicalName)) data.canonicalName = governance.canonicalName;

  if (absent(sku.customAttributeValues) && governance.customAttributeValues) {
    data.customAttributeValues = governance.customAttributeValues;
  }

  if (absent(sku.normalisedAttributes) && governance.normalisedAttributes) {
    data.normalisedAttributes = governance.normalisedAttributes;
  }

  if (!hasFinalReviewDecision) {
    const looksLegacyDefault =
      status === 'RAW_PHARMACY_SUPPLIED' &&
      absent(sku.normalisationConfidence) &&
      absent(sku.normalisationNotes) &&
      absent(sku.globalProductKey) &&
      absent(sku.canonicalName);

    if (looksLegacyDefault) {
      data.catalogueSource = governance.catalogueSource;
      data.normalisationStatus = governance.normalisationStatus;
      data.reviewRequired = governance.reviewRequired;
    }

    if (absent(sku.reviewReason) && governance.reviewReason) {
      data.reviewReason = governance.reviewReason;
    }
  }

  return data;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const includeAll = process.argv.includes('--all');
  const limit = Math.min(asInt(argValue('--limit', '1000'), 1000), 10000);
  const source = (argValue('--source', 'PHARMACY_SUPPLIED') || 'PHARMACY_SUPPLIED') as any;

  const before = await counts();

  const rows = await prisma.carePortPharmacySku.findMany({
    where: includeAll ? {} : governanceGapWhere(),
    orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }],
    take: limit,
    select: {
      id: true,
      orgId: true,
      pharmacyId: true,
      name: true,
      drugCode: true,
      skuCode: true,
      isGeneric: true,
      productType: true,
      category: true,
      subcategory: true,
      otc: true,
      prescriptionRequired: true,
      marketplaceVisible: true,
      sellableOnline: true,
      brand: true,
      manufacturer: true,
      barcode: true,
      description: true,
      imageUrl: true,
      packSize: true,
      variantGroupKey: true,
      variantName: true,
      variantAttributes: true,
      attributes: true,
      stockOnHand: true,
      reservedStock: true,
      lowStockThreshold: true,
      maxOrderQty: true,
      ageRestricted: true,
      regulatedSchedule: true,
      taxCategory: true,
      catalogueSource: true,
      normalisationStatus: true,
      normalisationConfidence: true,
      normalisationNotes: true,
      globalProductKey: true,
      canonicalName: true,
      customAttributeValues: true,
      normalisedAttributes: true,
      reviewRequired: true,
      reviewReason: true,
      reviewedBy: true,
      reviewedAt: true,
      updatedAt: true,
    },
  });

  const samples: AnyRecord[] = [];
  const errors: AnyRecord[] = [];

  let wouldUpdate = 0;
  let updated = 0;
  let skippedNoPatch = 0;
  let reviewQueued = 0;
  let mappedToTemplate = 0;

  for (const sku of rows as AnyRecord[]) {
    try {
      const governance = normaliseCarePortSkuForCatalogue(buildInputFromSku(sku), source);
      const data = buildBackfillPatch(sku, governance);

      if (!Object.keys(data).length) {
        skippedNoPatch += 1;
        continue;
      }

      wouldUpdate += 1;

      if (data.reviewRequired === true) reviewQueued += 1;
      if (data.normalisationStatus === 'MAPPED_TO_TEMPLATE') mappedToTemplate += 1;

      if (samples.length < 25) {
        samples.push({
          id: sku.id,
          name: sku.name,
          skuCode: sku.skuCode,
          productTypeBefore: sku.productType,
          categoryBefore: sku.category,
          currentStatus: sku.normalisationStatus,
          patch: data,
        });
      }

      if (apply) {
        await prisma.carePortPharmacySku.update({
          where: { id: sku.id },
          data,
        });

        updated += 1;
      }
    } catch (error: any) {
      errors.push({
        id: sku.id,
        name: sku.name,
        message: error?.message || String(error),
      });
    }
  }

  const after = apply ? await counts() : before;

  console.log(
    JSON.stringify(
      {
        ok: errors.length === 0,
        mode: apply ? 'apply' : 'dry-run',
        includeAll,
        limit,
        source,
        before,
        scanned: rows.length,
        wouldUpdate,
        updated,
        skippedNoPatch,
        reviewQueued,
        mappedToTemplate,
        errors,
        samples,
        after,
      },
      null,
      2,
    ),
  );

  if (errors.length) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
