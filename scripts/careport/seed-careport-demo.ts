import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ORG_ID = process.env.CAREPORT_DEMO_ORG_ID || "org-default";
const PATIENT_USER_ID = "user-careport-demo-patient";
const PATIENT_PROFILE_ID = "patient-careport-demo-001";
const CLINICIAN_ID = "clinician-careport-demo-001";
const ENCOUNTER_ID = "enc-careport-demo-001";
const ERX_ORDER_ID = "erx-careport-demo-001";
const PHARMACY_1_ID = "pharmacy-careport-demo-001";
const PHARMACY_2_ID = "pharmacy-careport-demo-002";
const PHARMACY_3_ID = "pharmacy-careport-demo-003";
const PHARMACY_1_STAFF_USER_ID = "user-careport-demo-pharmacy-staff-001";
const PHARMACY_2_STAFF_USER_ID = "user-careport-demo-pharmacy-staff-002";
const PHARMACY_3_STAFF_USER_ID = "user-careport-demo-pharmacy-staff-003";
const RIDER_USER_ID = "rider-careport-demo-001";

type AnyRecord = Record<string, any>;

function modelDelegate(modelName: string) {
  return (prisma as any)[modelName];
}

function runtimeModel(modelName: string) {
  const models = (prisma as any)._runtimeDataModel?.models ?? {};
  return (
    models[modelName] ??
    models[modelName[0]?.toUpperCase() + modelName.slice(1)] ??
    models[modelName[0]?.toLowerCase() + modelName.slice(1)] ??
    null
  );
}


function modelField(modelName: string, fieldName: string): any | null {
  const fields = runtimeModel(modelName)?.fields ?? [];
  return fields.find((field: any) => String(field.name) === fieldName) ?? null;
}

function coerceForModelField(modelName: string, key: string, value: any) {
  const field = modelField(modelName, key);
  const type = String(field?.type || '');
  if (type === 'String' && value != null && typeof value === 'object') {
    return JSON.stringify(value);
  }
  return value;
}

function fieldNames(modelName: string): Set<string> {
  const fields = runtimeModel(modelName)?.fields ?? [];
  return new Set(fields.map((field: any) => String(field.name)));
}

function unknownArgFrom(error: any): string | null {
  const message = String(error?.message || error || '');
  const match = message.match(/Unknown argument `([^`]+)`/);
  return match?.[1] ?? null;
}

function stripFieldDeep(value: any, field: string): any {
  if (Array.isArray(value)) return value.map((item) => stripFieldDeep(item, field));
  if (!value || typeof value !== 'object') return value;
  const out: AnyRecord = {};
  for (const [key, val] of Object.entries(value)) {
    if (key === field) continue;
    out[key] = stripFieldDeep(val, field);
  }
  return out;
}

function hasField(modelName: string, field: string) {
  return fieldNames(modelName).has(field);
}


function runtimeFields(modelName: string): any[] {
  return runtimeModel(modelName)?.fields ?? [];
}

function defaultForField(field: any) {
  const name = String(field?.name || '');
  const type = String(field?.type || '');
  const kind = String(field?.kind || '');

  if (type === 'String') {
    if (name.toLowerCase().includes('status')) return 'ACTIVE';
    if (name.toLowerCase().includes('mode')) return 'TELEVISIT';
    if (name.toLowerCase().includes('type')) return 'TELEVISIT';
    if (name.toLowerCase().endsWith('id')) return `demo-${name}`;
    return `CarePort demo ${name}`;
  }
  if (type === 'DateTime') return new Date();
  if (type === 'Boolean') return false;
  if (type === 'Int' || type === 'BigInt') return 0;
  if (type === 'Float' || type === 'Decimal') return 0;
  if (type === 'Json') return {};
  if (kind === 'enum') return 'ACTIVE';
  return undefined;
}

function withRequiredScalarDefaults(modelName: string, data: AnyRecord) {
  const out: AnyRecord = { ...data };

  for (const field of runtimeFields(modelName)) {
    const name = String(field?.name || '');
    if (!name || out[name] !== undefined) continue;
    if (field?.isList) continue;
    if (!field?.isRequired) continue;
    if (field?.hasDefaultValue) continue;
    if (!['scalar', 'enum'].includes(String(field?.kind || ''))) continue;

    const value = defaultForField(field);
    if (value !== undefined) out[name] = value;
  }

  return out;
}

function pickModelFields(modelName: string, data: AnyRecord) {
  const fields = fieldNames(modelName);
  if (!fields.size) return data;
  return Object.fromEntries(
    Object.entries(data)
      .filter(([key]) => fields.has(key))
      .map(([key, value]) => [key, coerceForModelField(modelName, key, value)])
  );
}

function whereWithExistingFields(modelName: string, where: AnyRecord) {
  const fields = fieldNames(modelName);
  if (!fields.size) return where;

  const cleanWhere: AnyRecord = {};
  for (const [key, value] of Object.entries(where)) {
    if (fields.has(key)) cleanWhere[key] = value;
  }
  return cleanWhere;
}

async function upsertIfModel(modelName: string, args: any) {
  const model = modelDelegate(modelName);
  if (!model?.upsert) {
    console.log(`[skip] ${modelName}.upsert not available`);
    return null;
  }

  let safeArgs = {
    ...args,
    update: pickModelFields(modelName, args.update ?? {}),
    create: pickModelFields(modelName, args.create ?? {}),
  };

  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      return await model.upsert(safeArgs);
    } catch (error: any) {
      const unknown = unknownArgFrom(error);
      if (!unknown) throw error;
      console.log(`[warn] ${modelName}.upsert stripping unsupported field '${unknown}'`);
      safeArgs = stripFieldDeep(safeArgs, unknown);
    }
  }

  throw new Error(`${modelName}.upsert_failed_after_field_sanitization`);
}

async function createManyIfModel(modelName: string, args: any) {
  const model = modelDelegate(modelName);
  if (!model?.createMany) {
    console.log(`[skip] ${modelName}.createMany not available`);
    return null;
  }

  const rows = Array.isArray(args.data) ? args.data : [];
  let safeArgs = {
    ...args,
    data: rows.map((row: AnyRecord) => pickModelFields(modelName, row)),
  };

  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      return await model.createMany(safeArgs);
    } catch (error: any) {
      const unknown = unknownArgFrom(error);
      if (!unknown) throw error;
      console.log(`[warn] ${modelName}.createMany stripping unsupported field '${unknown}'`);
      safeArgs = stripFieldDeep(safeArgs, unknown);
    }
  }

  throw new Error(`${modelName}.createMany_failed_after_field_sanitization`);
}

async function deleteManyIfModel(modelName: string, args: any) {
  const model = modelDelegate(modelName);
  if (!model?.deleteMany) {
    console.log(`[skip] ${modelName}.deleteMany not available`);
    return null;
  }

  const safeWhere = whereWithExistingFields(modelName, args.where ?? {});
  return model.deleteMany({ ...args, where: safeWhere });
}

async function deleteCarePortOrdersForDemoErx() {
  const modelName = "carePortOrder";
  const model = modelDelegate(modelName);
  if (!model?.deleteMany || !hasField(modelName, "erxOrderId")) return;
  await model.deleteMany({ where: { erxOrderId: ERX_ORDER_ID } }).catch((error: any) => {
    console.log(`[warn] could not delete prior demo CarePort orders: ${error?.message || error}`);
  });
}

async function seedPatient() {
  await upsertIfModel("patientProfile", {
    where: { id: PATIENT_PROFILE_ID },
    update: {
      userId: PATIENT_USER_ID,
      name: "CarePort Demo Patient",
      contactEmail: "careport.patient@ambulant.demo",
      addressLine1: "90 Rivonia Road",
      city: "Johannesburg",
      postalCode: "2196",
      useAsDefaultDelivery: true,
    },
    create: {
      id: PATIENT_PROFILE_ID,
      userId: PATIENT_USER_ID,
      name: "CarePort Demo Patient",
      contactEmail: "careport.patient@ambulant.demo",
      addressLine1: "90 Rivonia Road",
      city: "Johannesburg",
      postalCode: "2196",
      useAsDefaultDelivery: true,
    },
  });
}

async function seedPharmacies() {
  const rows = [
    {
      id: PHARMACY_1_ID,
      name: "CarePort Demo Pharmacy Sandton",
      tradingName: "CarePort Demo Pharmacy Sandton",
      displayName: "CarePort Demo Pharmacy Sandton",
      active: true,
      supportsPickup: true,
      supportsDelivery: true,
      lat: -26.1071,
      lng: 28.0562,
      address: "90 Rivonia Road, Sandton, Johannesburg",
      city: "Johannesburg",
      country: "ZA",
      currency: "ZAR",
      acceptsCard: true,
      acceptsCod: true,
      acceptsMedicalAid: true,
      kycStatus: "APPROVED",
    },
    {
      id: PHARMACY_2_ID,
      name: "CarePort Demo Pharmacy Rosebank",
      tradingName: "CarePort Demo Pharmacy Rosebank",
      displayName: "CarePort Demo Pharmacy Rosebank",
      active: true,
      supportsPickup: true,
      supportsDelivery: true,
      lat: -26.1467,
      lng: 28.0417,
      address: "Rosebank, Johannesburg",
      city: "Johannesburg",
      country: "ZA",
      currency: "ZAR",
      acceptsCard: true,
      acceptsCod: true,
      acceptsMedicalAid: true,
      kycStatus: "APPROVED",
    },
    {
      id: PHARMACY_3_ID,
      name: "CarePort Demo Partial Pharmacy Midrand",
      tradingName: "CarePort Demo Partial Pharmacy Midrand",
      displayName: "CarePort Demo Partial Pharmacy Midrand",
      active: true,
      supportsPickup: true,
      supportsDelivery: false,
      lat: -25.9992,
      lng: 28.1263,
      address: "Midrand, Johannesburg",
      city: "Johannesburg",
      country: "ZA",
      currency: "ZAR",
      acceptsCard: true,
      acceptsCod: false,
      acceptsMedicalAid: true,
      kycStatus: "APPROVED",
    },
  ];

  for (const pharmacy of rows) {
    const data = hasField("pharmacyPartner", "orgId") ? { ...pharmacy, orgId: ORG_ID } : pharmacy;
    await upsertIfModel("pharmacyPartner", {
      where: { id: pharmacy.id },
      update: data,
      create: data,
    });
  }
}


async function seedPharmacyStaff() {
  const modelName = "carePortPharmacyStaff";
  const model = modelDelegate(modelName);
  if (!model?.createMany) {
    console.log(`[skip] ${modelName}.createMany not available`);
    return;
  }

  const pharmacyIds = [PHARMACY_1_ID, PHARMACY_2_ID, PHARMACY_3_ID];
  const where: AnyRecord = { pharmacyId: { in: pharmacyIds } };
  if (hasField(modelName, "orgId")) where.orgId = ORG_ID;

  await deleteManyIfModel(modelName, { where }).catch((error: any) => {
    console.log(`[warn] could not clean prior demo pharmacy staff rows: ${error?.message || error}`);
  });

  const rows = [
    // These first three rows support smoke scripts that authenticate with uid === pharmacyId.
    { id: "staff-cp-001-owner-alias", orgId: ORG_ID, pharmacyId: PHARMACY_1_ID, userId: PHARMACY_1_ID, role: "OWNER", status: "ACTIVE", active: true, email: "pharmacy1@careport.demo", name: "CarePort Demo Pharmacy 1" },
    { id: "staff-cp-002-owner-alias", orgId: ORG_ID, pharmacyId: PHARMACY_2_ID, userId: PHARMACY_2_ID, role: "OWNER", status: "ACTIVE", active: true, email: "pharmacy2@careport.demo", name: "CarePort Demo Pharmacy 2" },
    { id: "staff-cp-003-owner-alias", orgId: ORG_ID, pharmacyId: PHARMACY_3_ID, userId: PHARMACY_3_ID, role: "OWNER", status: "ACTIVE", active: true, email: "pharmacy3@careport.demo", name: "CarePort Demo Pharmacy 3" },

    // These are the more realistic staff identities for UI/proxy testing.
    { id: "staff-cp-001", orgId: ORG_ID, pharmacyId: PHARMACY_1_ID, userId: PHARMACY_1_STAFF_USER_ID, role: "PHARMACIST", status: "ACTIVE", active: true, email: "staff1@careport.demo", name: "CarePort Demo Pharmacist 1" },
    { id: "staff-cp-002", orgId: ORG_ID, pharmacyId: PHARMACY_2_ID, userId: PHARMACY_2_STAFF_USER_ID, role: "PHARMACIST", status: "ACTIVE", active: true, email: "staff2@careport.demo", name: "CarePort Demo Pharmacist 2" },
    { id: "staff-cp-003", orgId: ORG_ID, pharmacyId: PHARMACY_3_ID, userId: PHARMACY_3_STAFF_USER_ID, role: "PHARMACIST", status: "ACTIVE", active: true, email: "staff3@careport.demo", name: "CarePort Demo Pharmacist 3" },
  ];

  await createManyIfModel(modelName, { data: rows, skipDuplicates: true }).catch((error: any) => {
    console.log(`[warn] ${modelName} seed failed; pharmacy accept smoke may need admin fallback: ${error?.message || error}`);
  });
}

async function seedInventory() {
  const pharmacyIds = [PHARMACY_1_ID, PHARMACY_2_ID, PHARMACY_3_ID];

  const skuWhere: AnyRecord = { pharmacyId: { in: pharmacyIds } };
  if (hasField("carePortPharmacySku", "orgId")) skuWhere.orgId = ORG_ID;

  const linkWhere: AnyRecord = { pharmacyId: { in: pharmacyIds } };
  if (hasField("carePortGenericLink", "orgId")) linkWhere.orgId = ORG_ID;

  await deleteManyIfModel("carePortGenericLink", { where: linkWhere }).catch(() => null);
  await deleteManyIfModel("carePortPharmacySku", { where: skuWhere }).catch(() => null);

  const skus = [
    { id: "sku-cp-001-amlo-original", pharmacyId: PHARMACY_1_ID, name: "Amlodipine 5mg tablets", drugCode: "NAPP-AMLO-5", priceCents: 8900, currency: "ZAR", isGeneric: false, isActive: true },
    { id: "sku-cp-001-amlo-generic", pharmacyId: PHARMACY_1_ID, name: "Amlodipine generic 5mg tablets", drugCode: "NAPP-AMLO-5-G", priceCents: 5500, currency: "ZAR", isGeneric: true, isActive: true },
    { id: "sku-cp-001-met-original", pharmacyId: PHARMACY_1_ID, name: "Metformin 500mg tablets", drugCode: "NAPP-METF-500", priceCents: 7600, currency: "ZAR", isGeneric: false, isActive: true },
    { id: "sku-cp-001-met-generic", pharmacyId: PHARMACY_1_ID, name: "Metformin generic 500mg tablets", drugCode: "NAPP-METF-500-G", priceCents: 4200, currency: "ZAR", isGeneric: true, isActive: true },
    { id: "sku-cp-002-amlo-original", pharmacyId: PHARMACY_2_ID, name: "Amlodipine 5mg tablets", drugCode: "NAPP-AMLO-5", priceCents: 9300, currency: "ZAR", isGeneric: false, isActive: true },
    { id: "sku-cp-002-met-original", pharmacyId: PHARMACY_2_ID, name: "Metformin 500mg tablets", drugCode: "NAPP-METF-500", priceCents: 7200, currency: "ZAR", isGeneric: false, isActive: true },
    { id: "sku-cp-003-amlo-original", pharmacyId: PHARMACY_3_ID, name: "Amlodipine 5mg tablets", drugCode: "NAPP-AMLO-5", priceCents: 8800, currency: "ZAR", isGeneric: false, isActive: true },
  ];

  await createManyIfModel("carePortPharmacySku", {
    data: skus.map((sku) => (hasField("carePortPharmacySku", "orgId") ? { ...sku, orgId: ORG_ID } : sku)),
    skipDuplicates: true,
  });

  await createManyIfModel("carePortGenericLink", {
    data: [
      { id: "gl-cp-001-amlo", orgId: ORG_ID, pharmacyId: PHARMACY_1_ID, originalSkuId: "sku-cp-001-amlo-original", genericSkuId: "sku-cp-001-amlo-generic" },
      { id: "gl-cp-001-met", orgId: ORG_ID, pharmacyId: PHARMACY_1_ID, originalSkuId: "sku-cp-001-met-original", genericSkuId: "sku-cp-001-met-generic" },
    ],
    skipDuplicates: true,
  }).catch((error: any) => console.log(`[skip] generic links failed; continue if constraints differ: ${error?.message || error}`));
}



async function seedClinician() {
  for (const modelName of ["clinician", "clinicianProfile"]) {
    const model = modelDelegate(modelName);
    if (!model?.upsert) continue;

    const base = {
      id: CLINICIAN_ID,
      userId: CLINICIAN_ID,
      name: "CarePort Demo Clinician",
      fullName: "CarePort Demo Clinician",
      displayName: "CarePort Demo Clinician",
      email: "careport.clinician@ambulant.demo",
      contactEmail: "careport.clinician@ambulant.demo",
      status: "ACTIVE",
      role: "clinician",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const data = withRequiredScalarDefaults(modelName, pickModelFields(modelName, base));
    await upsertIfModel(modelName, {
      where: hasField(modelName, "id") ? { id: CLINICIAN_ID } : { userId: CLINICIAN_ID },
      update: data,
      create: data,
    }).catch((error: any) => console.log(`[skip] ${modelName} seed failed; continuing: ${error?.message || error}`));
  }
}

async function seedEncounter() {
  const modelName = "encounter";
  const model = modelDelegate(modelName);
  if (!model?.upsert) {
    console.log("[skip] encounter.upsert not available");
    return null;
  }

  const base = {
    id: ENCOUNTER_ID,
    orgId: ORG_ID,
    patientId: PATIENT_PROFILE_ID,
    userId: PATIENT_USER_ID,
    clinicianId: CLINICIAN_ID,
    status: "COMPLETED",
    state: "COMPLETED",
    mode: "TELEVISIT",
    visitMode: "TELEVISIT",
    type: "TELEVISIT",
    title: "CarePort demo eRx encounter",
    reason: "CarePort smoke test encounter",
    chiefComplaint: "CarePort smoke test",
    summary: "Demo encounter created so the CarePort eRx satisfies the ErxOrder encounter foreign key.",
    notes: "CarePort smoke test encounter",
    startedAt: new Date(),
    endedAt: new Date(),
    closedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const data = withRequiredScalarDefaults(modelName, pickModelFields(modelName, base));

  await upsertIfModel(modelName, {
    where: { id: ENCOUNTER_ID },
    update: data,
    create: data,
  }).catch((error: any) => {
    console.log(`[warn] encounter seed failed; retrying eRx without encounterId if schema allows: ${error?.message || error}`);
    throw error;
  });
}

async function seedErx() {
  const meds = [
    { erxMedKey: "amlo-5", drugCode: "NAPP-AMLO-5", name: "Amlodipine 5mg tablets", quantity: 28, directions: "Take one tablet once daily." },
    { erxMedKey: "met-500", drugCode: "NAPP-METF-500", name: "Metformin 500mg tablets", quantity: 56, directions: "Take one tablet twice daily with meals." },
  ];

  const base = {
    id: ERX_ORDER_ID,
    encounterId: ENCOUNTER_ID,
    patientId: PATIENT_PROFILE_ID,
    clinicianId: CLINICIAN_ID,
    kind: "pharmacy",
    status: "SIGNED",
    meds,
    items: meds,
    notes: JSON.stringify({ demo: true, allergySafety: { blocked: false, conflicts: [] } }),
  };

  const data = pickModelFields("erxOrder", base);
  await upsertIfModel("erxOrder", {
    where: { id: ERX_ORDER_ID },
    update: data,
    create: data,
  });
}

async function seedRider() {
  const data = {
    id: "rider-profile-careport-demo-001",
    orgId: ORG_ID,
    userId: RIDER_USER_ID,
    status: "APPROVED",
    kyiStatus: "APPROVED",
    fullName: "CarePort Demo Rider",
    name: "CarePort Demo Rider",
    phone: "+27000000000",
    vehicleType: "MOTORBIKE",
    vehicleRegistration: "CP-DEMO-GP",
    licenceNumber: "CP-DEMO-LIC",
    active: true,
    currentLat: -26.108,
    currentLng: 28.057,
  };

  const where = hasField("carePortRiderProfile", "userId") ? { userId: RIDER_USER_ID } : { id: data.id };
  await upsertIfModel("carePortRiderProfile", {
    where,
    update: data,
    create: data,
  }).catch((error: any) => console.log(`[skip] rider profile model shape differs; continue: ${error?.message || error}`));
}

async function seedAdminConfig() {
  const value = {
    initialRadiusKm: 10,
    expansionIntervalMinutes: 3,
    expansionStepKm: 10,
    maxRadiusKm: 50,
    minCoverageRatio: 0.6,
    minAcceptedOffersBeforeExpansion: 3,
    codEnabled: true,
    codLimitCents: 250000,
    baseDeliveryFeeCents: 3500,
    perKmDeliveryFeeCents: 900,
    maxDeliveryFeeCents: 12000,
    country: "ZA",
    currency: "ZAR",
  };

  for (const modelName of ["carePortOperationalSetting", "carePortSetting", "careportSetting"]) {
    const model = modelDelegate(modelName);
    if (!model?.upsert) continue;

    try {
      const data = pickModelFields(modelName, { orgId: ORG_ID, key: "careport.dispatch_policy", value, payload: value, data: value });

      if (hasField(modelName, "orgId") && hasField(modelName, "key")) {
        await model.upsert({
          where: { orgId_key: { orgId: ORG_ID, key: "careport.dispatch_policy" } },
          update: data,
          create: data,
        });
      } else if (hasField(modelName, "key")) {
        await model.upsert({
          where: { key: "careport.dispatch_policy" },
          update: data,
          create: data,
        });
      }
      console.log(`[ok] ${modelName} careport.dispatch_policy`);
      return;
    } catch (error: any) {
      console.log(`[skip] ${modelName} config upsert failed: ${error?.message || error}`);
    }
  }

  console.log("[skip] operational setting model not available; broadcast defaults will be used");
}

async function main() {
  console.log("Seeding CarePort demo data...");
  await seedPatient();
  await seedPharmacies();
  await seedPharmacyStaff();
  await seedInventory();
  await seedClinician();
  await seedEncounter();
  await seedErx();
  await seedRider();
  await seedAdminConfig();
  await deleteCarePortOrdersForDemoErx();

  console.log("CarePort demo data ready.");
  console.log({ ORG_ID, PATIENT_USER_ID, PATIENT_PROFILE_ID, ERX_ORDER_ID, PHARMACY_1_ID, PHARMACY_2_ID, PHARMACY_3_ID, PHARMACY_1_STAFF_USER_ID, RIDER_USER_ID });
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
