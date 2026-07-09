import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type AnyRecord = Record<string, any>;

function argValue(name: string, fallback = '') {
  const prefix = name + '=';
  const found = process.argv.find((item) => item.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function asInt(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function asObject(value: unknown): AnyRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as AnyRecord;
}

function clean(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function inferCodeSystem(code: unknown) {
  const value = clean(code, 180).toUpperCase();

  if (!value) return 'LOCAL';
  if (value.startsWith('NAPPI') || value.startsWith('NAPP_') || value.startsWith('NAP_')) return 'NAPPI';
  if (value.startsWith('RXNORM') || value.startsWith('RXCUI')) return 'RXNORM';
  if (/^\d{8,14}$/.test(value)) return 'GTIN';

  return 'LOCAL';
}

function canonicalStatusFromSku(sku: AnyRecord) {
  if (sku.reviewRequired) return 'NEEDS_REVIEW';
  if (String(sku.normalisationStatus || '') === 'REJECTED') return 'REJECTED';
  return 'ACTIVE';
}

function marketplaceAllowedFromSku(sku: AnyRecord) {
  return Boolean(
    sku.isActive &&
      sku.marketplaceVisible &&
      sku.sellableOnline &&
      sku.prescriptionRequired === false,
  );
}

function globalProductDataFromSku(sku: AnyRecord) {
  const normalised = asObject(sku.normalisedAttributes);
  const attrs = {
    ...asObject(sku.attributes),
    ...asObject(sku.variantAttributes),
  };

  return {
    orgId: sku.orgId || 'org-default',
    globalProductKey: sku.globalProductKey,
    canonicalName: sku.canonicalName || sku.name,
    productType: sku.productType || 'MEDICATION',
    category: sku.category,
    subcategory: sku.subcategory,
    otc: Boolean(sku.otc),
    prescriptionRequired: sku.prescriptionRequired !== false,
    marketplaceAllowed: marketplaceAllowedFromSku(sku),
    sellableOnline: sku.sellableOnline !== false,
    brand: sku.brand,
    manufacturer: sku.manufacturer,
    description: sku.description,
    imageUrl: sku.imageUrl,
    packSize: sku.packSize,
    dosageForm: normalised.dosageForm || normalised.form || attrs.dosageForm || attrs.form || null,
    strength: normalised.strength || attrs.strength || null,
    route: normalised.route || attrs.route || null,
    unit: normalised.unit || attrs.unit || null,
    regulatedSchedule: sku.regulatedSchedule,
    taxCategory: sku.taxCategory,
    primaryBarcode: sku.barcode,
    primaryNappi: inferCodeSystem(sku.drugCode) === 'NAPPI' ? sku.drugCode : null,
    primaryRxNorm: inferCodeSystem(sku.drugCode) === 'RXNORM' ? sku.drugCode : null,
    primaryGtin: inferCodeSystem(sku.barcode) === 'GTIN' ? sku.barcode : null,
    attributes: Object.keys(attrs).length ? attrs : null,
    normalisedAttributes: Object.keys(normalised).length ? normalised : null,
    sourceMeta: {
      seededFrom: 'CarePortPharmacySku',
      firstSkuId: sku.id,
      firstPharmacyId: sku.pharmacyId,
      skuNormalisationStatus: sku.normalisationStatus,
      skuCatalogueSource: sku.catalogueSource,
    },
    catalogueStatus: canonicalStatusFromSku(sku),
    catalogueSource: 'SKU_BACKFILL',
    confidence: sku.normalisationConfidence,
    notes: sku.normalisationNotes || 'Seeded from pharmacy SKU catalogue governance backfill.',
  };
}

async function upsertProductFromSku(sku: AnyRecord, apply: boolean) {
  const data = globalProductDataFromSku(sku);

  if (!apply) {
    return {
      id: null,
      globalProductKey: data.globalProductKey,
      canonicalName: data.canonicalName,
      wouldCreateOrUpdate: true,
      data,
    };
  }

  const existing = await prisma.carePortGlobalProduct.findUnique({
    where: { globalProductKey: data.globalProductKey },
  });

  if (existing) {
    const product = await prisma.carePortGlobalProduct.update({
      where: { id: existing.id },
      data: {
        canonicalName: data.canonicalName,
        productType: data.productType,
        category: data.category,
        subcategory: data.subcategory,
        otc: data.otc,
        prescriptionRequired: data.prescriptionRequired,
        marketplaceAllowed: data.marketplaceAllowed,
        sellableOnline: data.sellableOnline,
        brand: data.brand,
        manufacturer: data.manufacturer,
        description: data.description,
        imageUrl: data.imageUrl,
        packSize: data.packSize,
        dosageForm: data.dosageForm,
        strength: data.strength,
        route: data.route,
        unit: data.unit,
        regulatedSchedule: data.regulatedSchedule,
        taxCategory: data.taxCategory,
        primaryBarcode: data.primaryBarcode,
        primaryNappi: data.primaryNappi,
        primaryRxNorm: data.primaryRxNorm,
        primaryGtin: data.primaryGtin,
        attributes: data.attributes,
        normalisedAttributes: data.normalisedAttributes,
        sourceMeta: data.sourceMeta,
        catalogueStatus: data.catalogueStatus,
        catalogueSource: data.catalogueSource,
        confidence: data.confidence,
        notes: data.notes,
      },
    });

    return {
      id: product.id,
      globalProductKey: product.globalProductKey,
      canonicalName: product.canonicalName,
      created: false,
      updated: true,
    };
  }

  const product = await prisma.carePortGlobalProduct.create({
    data,
  });

  return {
    id: product.id,
    globalProductKey: product.globalProductKey,
    canonicalName: product.canonicalName,
    created: true,
    updated: false,
  };
}

async function upsertCode(params: {
  orgId: string;
  globalProductId: string;
  globalProductKey: string;
  system: string;
  code: string;
  display?: string | null;
  country?: string | null;
  source?: string;
  isPrimary?: boolean;
  apply: boolean;
}) {
  const code = clean(params.code, 180);
  if (!code) return null;

  if (!params.apply) {
    return {
      system: params.system,
      code,
      wouldCreateOrUpdate: true,
    };
  }

  const existing = await prisma.carePortGlobalProductCode.findFirst({
    where: {
      system: params.system,
      code,
      country: params.country || null,
    },
  });

  if (existing) {
    return prisma.carePortGlobalProductCode.update({
      where: { id: existing.id },
      data: {
        orgId: params.orgId,
        globalProductId: params.globalProductId,
        globalProductKey: params.globalProductKey,
        display: params.display || null,
        source: params.source || 'SKU_BACKFILL',
        isPrimary: Boolean(params.isPrimary),
        isActive: true,
      },
    });
  }

  return prisma.carePortGlobalProductCode.create({
    data: {
      orgId: params.orgId,
      globalProductId: params.globalProductId,
      globalProductKey: params.globalProductKey,
      system: params.system,
      code,
      display: params.display || null,
      country: params.country || null,
      source: params.source || 'SKU_BACKFILL',
      isPrimary: Boolean(params.isPrimary),
      isActive: true,
    },
  });
}

async function upsertSkuMap(sku: AnyRecord, product: AnyRecord, apply: boolean) {
  if (!apply) {
    return {
      skuId: sku.id,
      globalProductKey: sku.globalProductKey,
      wouldCreateOrUpdate: true,
    };
  }

  const existing = await prisma.carePortPharmacySkuGlobalProductMap.findFirst({
    where: {
      skuId: sku.id,
      globalProductKey: sku.globalProductKey,
    },
  });

  const data = {
    orgId: sku.orgId || 'org-default',
    pharmacyId: sku.pharmacyId,
    skuId: sku.id,
    globalProductId: product.id,
    globalProductKey: sku.globalProductKey,
    matchSource: 'SKU_BACKFILL',
    matchStatus: 'ACTIVE',
    confidence: sku.normalisationConfidence,
    notes: 'Mapped to canonical global product from existing SKU globalProductKey.',
  };

  if (existing) {
    return prisma.carePortPharmacySkuGlobalProductMap.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.carePortPharmacySkuGlobalProductMap.create({ data });
}

async function main() {
  const apply = process.argv.includes('--apply');
  const limit = Math.min(asInt(argValue('--limit', '5000'), 5000), 20000);

  const skus = await prisma.carePortPharmacySku.findMany({
    where: {
      globalProductKey: { not: null },
      canonicalName: { not: null },
    },
    orderBy: [{ canonicalName: 'asc' }, { id: 'asc' }],
    take: limit,
    select: {
      id: true,
      orgId: true,
      pharmacyId: true,
      name: true,
      drugCode: true,
      skuCode: true,
      isGeneric: true,
      isActive: true,
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
      ageRestricted: true,
      regulatedSchedule: true,
      taxCategory: true,
      catalogueSource: true,
      normalisationStatus: true,
      normalisationConfidence: true,
      normalisationNotes: true,
      globalProductKey: true,
      globalProductId: true,
      canonicalName: true,
      customAttributeValues: true,
      normalisedAttributes: true,
      reviewRequired: true,
      reviewReason: true,
    },
  });

  const representativeByKey = new Map<string, AnyRecord>();

  for (const sku of skus as AnyRecord[]) {
    if (!sku.globalProductKey) continue;

    const existing = representativeByKey.get(sku.globalProductKey);
    if (!existing) {
      representativeByKey.set(sku.globalProductKey, sku);
      continue;
    }

    const existingScore =
      Number(Boolean(existing.barcode)) +
      Number(Boolean(existing.drugCode)) +
      Number(Boolean(existing.normalisedAttributes)) +
      Number(existing.reviewRequired === false);

    const nextScore =
      Number(Boolean(sku.barcode)) +
      Number(Boolean(sku.drugCode)) +
      Number(Boolean(sku.normalisedAttributes)) +
      Number(sku.reviewRequired === false);

    if (nextScore > existingScore) representativeByKey.set(sku.globalProductKey, sku);
  }

  const samples: AnyRecord[] = [];
  const errors: AnyRecord[] = [];

  let productsCreated = 0;
  let productsUpdated = 0;
  let productsWouldUpsert = 0;
  let codesTouched = 0;
  let mapsTouched = 0;
  let skuIdsUpdated = 0;

  for (const representative of representativeByKey.values()) {
    try {
      const product = await upsertProductFromSku(representative, apply);
      productsWouldUpsert += 1;

      if (product.created) productsCreated += 1;
      if (product.updated) productsUpdated += 1;

      if (samples.length < 20) {
        samples.push({
          globalProductKey: representative.globalProductKey,
          canonicalName: representative.canonicalName,
          representativeSkuId: representative.id,
          product,
        });
      }
    } catch (error: any) {
      errors.push({
        phase: 'product',
        skuId: representative.id,
        globalProductKey: representative.globalProductKey,
        message: error?.message || String(error),
      });
    }
  }

  if (apply) {
    const productByKey = new Map<string, AnyRecord>();

    const products = await prisma.carePortGlobalProduct.findMany({
      where: {
        globalProductKey: {
          in: Array.from(representativeByKey.keys()),
        },
      },
      select: {
        id: true,
        orgId: true,
        globalProductKey: true,
        canonicalName: true,
      },
    });

    for (const product of products as AnyRecord[]) {
      productByKey.set(product.globalProductKey, product);
    }

    for (const sku of skus as AnyRecord[]) {
      const product = productByKey.get(sku.globalProductKey);
      if (!product) continue;

      try {
        if (sku.globalProductId !== product.id) {
          await prisma.carePortPharmacySku.update({
            where: { id: sku.id },
            data: { globalProductId: product.id },
          });

          skuIdsUpdated += 1;
        }

        await upsertSkuMap(sku, product, true);
        mapsTouched += 1;

        if (sku.drugCode) {
          await upsertCode({
            orgId: sku.orgId || 'org-default',
            globalProductId: product.id,
            globalProductKey: product.globalProductKey,
            system: inferCodeSystem(sku.drugCode),
            code: sku.drugCode,
            display: sku.canonicalName || sku.name,
            country: 'ZA',
            source: 'SKU_BACKFILL',
            isPrimary: true,
            apply: true,
          });

          codesTouched += 1;
        }

        if (sku.barcode) {
          await upsertCode({
            orgId: sku.orgId || 'org-default',
            globalProductId: product.id,
            globalProductKey: product.globalProductKey,
            system: inferCodeSystem(sku.barcode),
            code: sku.barcode,
            display: sku.canonicalName || sku.name,
            country: 'ZA',
            source: 'SKU_BACKFILL',
            isPrimary: !sku.drugCode,
            apply: true,
          });

          codesTouched += 1;
        }

        if (sku.skuCode) {
          await upsertCode({
            orgId: sku.orgId || 'org-default',
            globalProductId: product.id,
            globalProductKey: product.globalProductKey,
            system: 'PHARMACY_SKU',
            code: sku.skuCode,
            display: sku.canonicalName || sku.name,
            country: 'ZA',
            source: 'SKU_BACKFILL',
            isPrimary: false,
            apply: true,
          });

          codesTouched += 1;
        }
      } catch (error: any) {
        errors.push({
          phase: 'sku-map',
          skuId: sku.id,
          globalProductKey: sku.globalProductKey,
          message: error?.message || String(error),
        });
      }
    }
  } else {
    mapsTouched = skus.length;
    codesTouched = skus.filter((sku: AnyRecord) => sku.drugCode || sku.barcode || sku.skuCode).length;
  }

  const after = apply
    ? {
        globalProducts: await prisma.carePortGlobalProduct.count(),
        globalProductCodes: await prisma.carePortGlobalProductCode.count(),
        skuGlobalProductMaps: await prisma.carePortPharmacySkuGlobalProductMap.count(),
        skusWithGlobalProductKey: await prisma.carePortPharmacySku.count({
          where: { globalProductKey: { not: null } },
        }),
        skusWithGlobalProductId: await prisma.carePortPharmacySku.count({
          where: { globalProductId: { not: null } },
        }),
      }
    : null;

  console.log(
    JSON.stringify(
      {
        ok: errors.length === 0,
        mode: apply ? 'apply' : 'dry-run',
        scannedSkus: skus.length,
        distinctGlobalProducts: representativeByKey.size,
        productsWouldUpsert,
        productsCreated,
        productsUpdated,
        skuIdsUpdated,
        mapsTouched,
        codesTouched,
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
