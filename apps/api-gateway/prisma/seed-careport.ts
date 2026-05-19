// FILE: apps/api-gateway/prisma/seed-careport.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const ORG_ID = "org-default";
const COUNTRY = "ZA";
const CURRENCY = "ZAR";

type SeedPharmacy = {
  id: string;
  name: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  supportsPickup: boolean;
  supportsDelivery: boolean;

  acceptsMedicalAid: boolean;
  acceptedMedicalAids: string[];
  acceptsCard: boolean;
  acceptsRcs: boolean;
  acceptsStoreCard: boolean;
  acceptsCod: boolean;
};

type SeedSku = {
  id: string;
  name: string;
  drugCode?: string;
  skuCode?: string;
  isGeneric: boolean;
  priceCents: number;
  currency: string;
};

type SeedGenericMap = {
  originalSkuId: string;
  genericSkuIds: string[];
};

function jitter(center: number, magnitude: number, i: number): number {
  const x = Math.sin((i + 1) * 999.123) * 10000;
  const frac = x - Math.floor(x);
  return center + (frac - 0.5) * magnitude;
}

async function ensureOrgDefaults() {
  await prisma.organization.upsert({
    where: { id: ORG_ID },
    update: { name: "Ambulant+ (Default Org)" },
    create: { id: ORG_ID, name: "Ambulant+ (Default Org)" },
  });

  await prisma.organizationSettings.upsert({
    where: { orgId: ORG_ID },
    update: {
      defaultCountry: COUNTRY,
      defaultLocale: "en-ZA",
      defaultCurrency: CURRENCY,
      timezone: "Africa/Johannesburg",
    },
    create: {
      orgId: ORG_ID,
      defaultCountry: COUNTRY,
      defaultLocale: "en-ZA",
      defaultCurrency: CURRENCY,
      timezone: "Africa/Johannesburg",
    },
  });
}

function joburgPharmacies(): SeedPharmacy[] {
  const baseLat = -26.1076;
  const baseLng = 28.0567;

  return [
    {
      id: "pharm-za-jhb-001",
      name: "MedCare Sandton",
      address: "Sandton City, Sandton",
      city: "Johannesburg",
      lat: jitter(baseLat, 0.030, 1),
      lng: jitter(baseLng, 0.030, 1),
      supportsPickup: true,
      supportsDelivery: true,
      acceptsMedicalAid: true,
      acceptedMedicalAids: ["Discovery Health", "Bonitas", "Momentum"],
      acceptsCard: true,
      acceptsRcs: false,
      acceptsStoreCard: false,
      acceptsCod: true,
    },
    {
      id: "pharm-za-jhb-002",
      name: "Rosebank Pharmacy+",
      address: "Rosebank Mall, Rosebank",
      city: "Johannesburg",
      lat: jitter(baseLat, 0.035, 2),
      lng: jitter(baseLng, 0.035, 2),
      supportsPickup: true,
      supportsDelivery: true,
      acceptsMedicalAid: true,
      acceptedMedicalAids: ["Discovery Health", "GEMS"],
      acceptsCard: true,
      acceptsRcs: true,
      acceptsStoreCard: false,
      acceptsCod: true,
    },
    {
      id: "pharm-za-jhb-003",
      name: "Bryanston Family Pharmacy",
      address: "Bryanston Shopping Centre, Bryanston",
      city: "Johannesburg",
      lat: jitter(baseLat, 0.040, 3),
      lng: jitter(baseLng, 0.040, 3),
      supportsPickup: true,
      supportsDelivery: false,
      acceptsMedicalAid: false,
      acceptedMedicalAids: [],
      acceptsCard: true,
      acceptsRcs: false,
      acceptsStoreCard: true,
      acceptsCod: false,
    },
    {
      id: "pharm-za-jhb-004",
      name: "Illovo Chemist",
      address: "Oxford Rd, Illovo",
      city: "Johannesburg",
      lat: jitter(baseLat, 0.028, 4),
      lng: jitter(baseLng, 0.028, 4),
      supportsPickup: true,
      supportsDelivery: true,
      acceptsMedicalAid: true,
      acceptedMedicalAids: ["Bonitas", "Momentum"],
      acceptsCard: true,
      acceptsRcs: false,
      acceptsStoreCard: false,
      acceptsCod: true,
    },
    {
      id: "pharm-za-jhb-005",
      name: "Morningside Dispensary",
      address: "Rivonia Rd, Morningside",
      city: "Johannesburg",
      lat: jitter(baseLat, 0.030, 5),
      lng: jitter(baseLng, 0.030, 5),
      supportsPickup: true,
      supportsDelivery: true,
      acceptsMedicalAid: false,
      acceptedMedicalAids: [],
      acceptsCard: true,
      acceptsRcs: true,
      acceptsStoreCard: true,
      acceptsCod: true,
    },
    {
      id: "pharm-za-jhb-006",
      name: "Melrose Arch Pharmacy",
      address: "Melrose Arch, Melrose",
      city: "Johannesburg",
      lat: jitter(baseLat, 0.040, 6),
      lng: jitter(baseLng, 0.040, 6),
      supportsPickup: true,
      supportsDelivery: true,
      acceptsMedicalAid: true,
      acceptedMedicalAids: ["Discovery Health", "GEMS", "Fedhealth"],
      acceptsCard: true,
      acceptsRcs: false,
      acceptsStoreCard: false,
      acceptsCod: false,
    },
    {
      id: "pharm-za-jhb-007",
      name: "Hyde Park Pharmacy",
      address: "Hyde Park Corner, Hyde Park",
      city: "Johannesburg",
      lat: jitter(baseLat, 0.035, 7),
      lng: jitter(baseLng, 0.035, 7),
      supportsPickup: true,
      supportsDelivery: true,
      acceptsMedicalAid: true,
      acceptedMedicalAids: ["Discovery Health"],
      acceptsCard: true,
      acceptsRcs: false,
      acceptsStoreCard: true,
      acceptsCod: true,
    },
    {
      id: "pharm-za-jhb-008",
      name: "Parktown Health Pharmacy",
      address: "Parktown, Johannesburg",
      city: "Johannesburg",
      lat: jitter(baseLat, 0.050, 8),
      lng: jitter(baseLng, 0.050, 8),
      supportsPickup: true,
      supportsDelivery: false,
      acceptsMedicalAid: false,
      acceptedMedicalAids: [],
      acceptsCard: true,
      acceptsRcs: false,
      acceptsStoreCard: false,
      acceptsCod: false,
    },
    {
      id: "pharm-za-jhb-009",
      name: "Randburg QuickMeds",
      address: "Randburg CBD, Randburg",
      city: "Johannesburg",
      lat: jitter(baseLat, 0.070, 9),
      lng: jitter(baseLng, 0.070, 9),
      supportsPickup: true,
      supportsDelivery: true,
      acceptsMedicalAid: true,
      acceptedMedicalAids: ["Momentum", "Bestmed"],
      acceptsCard: true,
      acceptsRcs: true,
      acceptsStoreCard: false,
      acceptsCod: true,
    },
    {
      id: "pharm-za-jhb-010",
      name: "Fourways MediPharm",
      address: "Fourways Mall, Fourways",
      city: "Johannesburg",
      lat: jitter(baseLat, 0.080, 10),
      lng: jitter(baseLng, 0.080, 10),
      supportsPickup: true,
      supportsDelivery: true,
      acceptsMedicalAid: false,
      acceptedMedicalAids: [],
      acceptsCard: true,
      acceptsRcs: false,
      acceptsStoreCard: true,
      acceptsCod: true,
    },
    {
      id: "pharm-za-jhb-011",
      name: "Rivonia ScriptHub",
      address: "Rivonia Blvd, Rivonia",
      city: "Johannesburg",
      lat: jitter(baseLat, 0.045, 11),
      lng: jitter(baseLng, 0.045, 11),
      supportsPickup: true,
      supportsDelivery: true,
      acceptsMedicalAid: true,
      acceptedMedicalAids: ["Discovery Health", "Bonitas"],
      acceptsCard: true,
      acceptsRcs: false,
      acceptsStoreCard: false,
      acceptsCod: true,
    },
    {
      id: "pharm-za-jhb-012",
      name: "Sunninghill Pharmacy",
      address: "Sunninghill Hospital, Sunninghill",
      city: "Johannesburg",
      lat: jitter(baseLat, 0.060, 12),
      lng: jitter(baseLng, 0.060, 12),
      supportsPickup: true,
      supportsDelivery: true,
      acceptsMedicalAid: true,
      acceptedMedicalAids: ["GEMS", "Fedhealth"],
      acceptsCard: true,
      acceptsRcs: false,
      acceptsStoreCard: false,
      acceptsCod: false,
    },
  ];
}

function skuCatalogForPharmacy(pharmacyId: string): { skus: SeedSku[]; genericMaps: SeedGenericMap[] } {
  const currency = CURRENCY;

  const suffix = Number(pharmacyId.split("-").pop() ?? "0");
  const bump = (n: number) => n + (suffix % 5) * 50;

  const skus: SeedSku[] = [
    { id: `${pharmacyId}-sku-augmentin-625-brand`, name: "Augmentin 625mg Tablets (Brand)", drugCode: "amox_clav_625", skuCode: "AUG-625-BRAND", isGeneric: false, priceCents: bump(16500), currency },
    { id: `${pharmacyId}-sku-amoxclav-625-generic`, name: "Amoxicillin/Clavulanic Acid 625mg Tablets (Generic)", drugCode: "amox_clav_625", skuCode: "AMOXCLAV-625-GEN", isGeneric: true, priceCents: bump(9800), currency },

    { id: `${pharmacyId}-sku-panado-500-brand`, name: "Panado 500mg Tablets (Brand)", drugCode: "paracetamol_500", skuCode: "PAN-500-BRAND", isGeneric: false, priceCents: bump(4500), currency },
    { id: `${pharmacyId}-sku-paracetamol-500-generic`, name: "Paracetamol 500mg Tablets (Generic)", drugCode: "paracetamol_500", skuCode: "PARA-500-GEN", isGeneric: true, priceCents: bump(2200), currency },

    { id: `${pharmacyId}-sku-zyrtec-10-brand`, name: "Zyrtec 10mg Tablets (Brand)", drugCode: "cetirizine_10", skuCode: "ZYR-10-BRAND", isGeneric: false, priceCents: bump(8900), currency },
    { id: `${pharmacyId}-sku-cetirizine-10-generic`, name: "Cetirizine 10mg Tablets (Generic)", drugCode: "cetirizine_10", skuCode: "CET-10-GEN", isGeneric: true, priceCents: bump(3900), currency },

    { id: `${pharmacyId}-sku-brufen-400-brand`, name: "Brufen 400mg Tablets (Brand)", drugCode: "ibuprofen_400", skuCode: "BRU-400-BRAND", isGeneric: false, priceCents: bump(7600), currency },
    { id: `${pharmacyId}-sku-ibuprofen-400-generic`, name: "Ibuprofen 400mg Tablets (Generic)", drugCode: "ibuprofen_400", skuCode: "IBU-400-GEN", isGeneric: true, priceCents: bump(3400), currency },

    { id: `${pharmacyId}-sku-nexium-20-brand`, name: "Nexium 20mg Capsules (Brand)", drugCode: "esomeprazole_20", skuCode: "NEX-20-BRAND", isGeneric: false, priceCents: bump(15200), currency },
    { id: `${pharmacyId}-sku-esomeprazole-20-generic`, name: "Esomeprazole 20mg Capsules (Generic)", drugCode: "esomeprazole_20", skuCode: "ESO-20-GEN", isGeneric: true, priceCents: bump(8400), currency },

    { id: `${pharmacyId}-sku-ventolin-brand`, name: "Ventolin Inhaler (Brand)", drugCode: "salbutamol_inhaler", skuCode: "VENT-BRAND", isGeneric: false, priceCents: bump(12900), currency },
    { id: `${pharmacyId}-sku-salbutamol-generic`, name: "Salbutamol Inhaler (Generic)", drugCode: "salbutamol_inhaler", skuCode: "SALB-GEN", isGeneric: true, priceCents: bump(9200), currency },
  ];

  const partialOnlyIds = new Set(["pharm-za-jhb-003", "pharm-za-jhb-008"]);
  const limitedIds = new Set(["pharm-za-jhb-010"]);

  let filtered = skus;

  if (partialOnlyIds.has(pharmacyId)) {
    filtered = skus.filter((s) => ["paracetamol_500", "cetirizine_10", "ibuprofen_400"].includes(s.drugCode ?? ""));
  } else if (limitedIds.has(pharmacyId)) {
    filtered = skus.filter((s) => ["amox_clav_625", "paracetamol_500", "salbutamol_inhaler"].includes(s.drugCode ?? ""));
  }

  const genericMaps: SeedGenericMap[] = [
    { originalSkuId: `${pharmacyId}-sku-augmentin-625-brand`, genericSkuIds: [`${pharmacyId}-sku-amoxclav-625-generic`] },
    { originalSkuId: `${pharmacyId}-sku-panado-500-brand`, genericSkuIds: [`${pharmacyId}-sku-paracetamol-500-generic`] },
    { originalSkuId: `${pharmacyId}-sku-zyrtec-10-brand`, genericSkuIds: [`${pharmacyId}-sku-cetirizine-10-generic`] },
    { originalSkuId: `${pharmacyId}-sku-brufen-400-brand`, genericSkuIds: [`${pharmacyId}-sku-ibuprofen-400-generic`] },
    { originalSkuId: `${pharmacyId}-sku-nexium-20-brand`, genericSkuIds: [`${pharmacyId}-sku-esomeprazole-20-generic`] },
    { originalSkuId: `${pharmacyId}-sku-ventolin-brand`, genericSkuIds: [`${pharmacyId}-sku-salbutamol-generic`] },
  ];

  const skuIdSet = new Set(filtered.map((s) => s.id));
  const validMaps = genericMaps
    .map((m) => ({ originalSkuId: m.originalSkuId, genericSkuIds: m.genericSkuIds.filter((g) => skuIdSet.has(g)) }))
    .filter((m) => skuIdSet.has(m.originalSkuId) && m.genericSkuIds.length > 0);

  return { skus: filtered, genericMaps: validMaps };
}

async function seedPricingRuleZA() {
  await prisma.carePortDeliveryPricingRule.updateMany({
    where: { orgId: ORG_ID, isActive: true, NOT: { id: "cprule-za-default" } },
    data: { isActive: false },
  });

  await prisma.carePortDeliveryPricingRule.upsert({
    where: { id: "cprule-za-default" },
    update: {
      orgId: ORG_ID,
      country: COUNTRY,
      currency: CURRENCY,
      isActive: true,
      baseFeeCents: 4500,
      includedKm: 5,
      extraPerKmCents: 900,
      codEnabled: true,
      codLimitCents: 30000,
    } as any,
    create: {
      id: "cprule-za-default",
      orgId: ORG_ID,
      country: COUNTRY,
      currency: CURRENCY,
      isActive: true,
      baseFeeCents: 4500,
      includedKm: 5,
      extraPerKmCents: 900,
      codEnabled: true,
      codLimitCents: 30000,
    } as any,
  });
}

async function seedPharmaciesAndCatalog() {
  const pharmacies = joburgPharmacies();

  for (const p of pharmacies) {
    await prisma.pharmacyPartner.upsert({
      where: { id: p.id },
      update: {
        name: p.name,
        contact: "+27 11 000 0000",
        active: true,
        address: p.address,
        city: p.city,
        lat: p.lat,
        lng: p.lng,

        country: COUNTRY,
        currency: CURRENCY,

        supportsPickup: p.supportsPickup,
        supportsDelivery: p.supportsDelivery,

        acceptsMedicalAid: p.acceptsMedicalAid,
        acceptedMedicalAids: p.acceptedMedicalAids,
        acceptsCard: p.acceptsCard,
        acceptsRcs: p.acceptsRcs,
        acceptsStoreCard: p.acceptsStoreCard,
        acceptsCod: p.acceptsCod,

        kycStatus: "APPROVED",
        kycSchemaKey: "ZA_SAPC_PHARMACY_v1",
        kycPayload: {
          regulator: "SAPC",
          sapcRegistrationNumber: "SAPC-DEMO-0001",
          practiceNumber: "ZA-DEMO-PRAC-0001",
          country: COUNTRY,
        },
        kycVerifiedAt: new Date(),
        bankAccountMasked: "****1234",
      } as any,
      create: {
        id: p.id,
        name: p.name,
        contact: "+27 11 000 0000",
        active: true,
        address: p.address,
        city: p.city,
        lat: p.lat,
        lng: p.lng,

        country: COUNTRY,
        currency: CURRENCY,

        supportsPickup: p.supportsPickup,
        supportsDelivery: p.supportsDelivery,

        acceptsMedicalAid: p.acceptsMedicalAid,
        acceptedMedicalAids: p.acceptedMedicalAids,
        acceptsCard: p.acceptsCard,
        acceptsRcs: p.acceptsRcs,
        acceptsStoreCard: p.acceptsStoreCard,
        acceptsCod: p.acceptsCod,

        kycStatus: "APPROVED",
        kycSchemaKey: "ZA_SAPC_PHARMACY_v1",
        kycPayload: {
          regulator: "SAPC",
          sapcRegistrationNumber: "SAPC-DEMO-0001",
          practiceNumber: "ZA-DEMO-PRAC-0001",
          country: COUNTRY,
        },
        kycVerifiedAt: new Date(),
        bankAccountMasked: "****1234",
      } as any,
    });

    await prisma.carePortGenericLink.deleteMany({ where: { pharmacyId: p.id } });
    await prisma.carePortPharmacySku.deleteMany({ where: { pharmacyId: p.id } });

    const { skus, genericMaps } = skuCatalogForPharmacy(p.id);

    await prisma.carePortPharmacySku.createMany({
      data: skus.map((s) => ({
        id: s.id,
        orgId: ORG_ID,
        pharmacyId: p.id,
        name: s.name,
        drugCode: s.drugCode ?? null,
        skuCode: s.skuCode ?? null,
        isGeneric: s.isGeneric,
        priceCents: s.priceCents,
        currency: s.currency,
        isActive: true,
      })),
      skipDuplicates: true,
    });

    const links = genericMaps.flatMap((m) =>
      m.genericSkuIds.map((g) => ({
        orgId: ORG_ID,
        pharmacyId: p.id,
        originalSkuId: m.originalSkuId,
        genericSkuId: g,
      }))
    );

    if (links.length) {
      await prisma.carePortGenericLink.createMany({ data: links, skipDuplicates: true });
    }

    await prisma.carePortPharmacyStaff.upsert({
      where: { userId: `pharmstaff-${p.id}-owner` },
      update: { pharmacyId: p.id, orgId: ORG_ID, staffRole: "OWNER" },
      create: { userId: `pharmstaff-${p.id}-owner`, pharmacyId: p.id, orgId: ORG_ID, staffRole: "OWNER" },
    });

    await prisma.carePortPharmacyStaff.upsert({
      where: { userId: `pharmstaff-${p.id}-staff` },
      update: { pharmacyId: p.id, orgId: ORG_ID, staffRole: "STAFF" },
      create: { userId: `pharmstaff-${p.id}-staff`, pharmacyId: p.id, orgId: ORG_ID, staffRole: "STAFF" },
    });
  }
}

async function seedRidersJohannesburg() {
  const baseLat = -26.1076;
  const baseLng = 28.0567;

  const riderCount = 15;

  for (let i = 1; i <= riderCount; i++) {
    const userId = `rider-za-${String(i).padStart(3, "0")}`;
    const lat = jitter(baseLat, 0.060, 100 + i);
    const lng = jitter(baseLng, 0.060, 200 + i);

    await prisma.carePortRiderProfile.upsert({
      where: { userId },
      update: {
        orgId: ORG_ID,
        country: COUNTRY,
        currency: CURRENCY,
        lat,
        lng,
        isActive: true,
        isOnJob: false,
        kyiStatus: "APPROVED",
        kyiSchemaKey: "ZA_RIDER_KYI_v1",
        kyiPayload: { idNumber: "DEMO-900101-5000-08", license: "ZA-DEMO-LIC-001", country: COUNTRY },
        kyiVerifiedAt: new Date(),
        bankAccountMasked: "****9876",
      } as any,
      create: {
        orgId: ORG_ID,
        country: COUNTRY,
        currency: CURRENCY,
        userId,
        lat,
        lng,
        isActive: true,
        isOnJob: false,
        kyiStatus: "APPROVED",
        kyiSchemaKey: "ZA_RIDER_KYI_v1",
        kyiPayload: { idNumber: "DEMO-900101-5000-08", license: "ZA-DEMO-LIC-001", country: COUNTRY },
        kyiVerifiedAt: new Date(),
        bankAccountMasked: "****9876",
      } as any,
    });
  }
}

async function main() {
  await ensureOrgDefaults();
  await seedPricingRuleZA();
  await seedPharmaciesAndCatalog();
  await seedRidersJohannesburg();

  const pharmacyCount = await prisma.pharmacyPartner.count();
  const skuCount = await prisma.carePortPharmacySku.count();
  const linkCount = await prisma.carePortGenericLink.count();
  const riderCount = await prisma.carePortRiderProfile.count();
  const ruleCount = await prisma.carePortDeliveryPricingRule.count();

  console.log("[CarePort Seed] OK", { pharmacyCount, skuCount, linkCount, riderCount, ruleCount });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("[CarePort Seed] FAILED", e);
    await prisma.$disconnect();
    process.exit(1);
  });