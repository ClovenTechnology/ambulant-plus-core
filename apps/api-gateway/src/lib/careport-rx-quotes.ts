import { prisma } from "@/src/lib/db";
import { auditEvent, haversineKm } from "@/src/lib/careport";
import { getCarePortProcurementById } from "@/src/lib/careport-rx-procurement";
import { readIdentity } from "@/src/lib/identity";

type Who = ReturnType<typeof readIdentity>;

const QUOTE_TTL_MS = 5 * 60 * 1000;
const TRUSTED_SKU_NORMALISATION_STATUSES = new Set([
  "MAPPED_TO_TEMPLATE",
  "ADMIN_VERIFIED",
  "GLOBAL_CATALOGUE_MATCHED",
]);
const MEDICATION_PRODUCT_TYPES = new Set(["MEDICATION", "OTC_MEDICATION"]);

type QuoteAvailabilityState =
  | "AVAILABLE"
  | "CONFIRMING"
  | "OUTSIDE_HOURS"
  | "NOT_ACCEPTING";

function clean(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function upper(value: unknown, max = 160): string {
  return clean(value, max).toUpperCase();
}

function lower(value: unknown, max = 500): string {
  return clean(value, max).toLowerCase();
}

function numeric(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function availableStock(sku: any): number | null {
  const onHand = numeric(sku?.stockOnHand);
  if (onHand == null) return null;
  return Math.max(0, Math.trunc(onHand) - Math.max(0, Math.trunc(numeric(sku?.reservedStock) ?? 0)));
}

function lineCodes(line: any): string[] {
  return Array.from(
    new Set(
      [line?.codingCode, line?.drugCode]
        .map((v) => clean(v, 240))
        .filter(Boolean),
    ),
  );
}

function meaningfulTokens(value: unknown): string[] {
  const stop = new Set([
    "mg", "mcg", "g", "ml", "tablet", "tablets", "capsule", "capsules",
    "solution", "syrup", "cream", "ointment", "oral", "po", "daily",
  ]);

  return lower(value)
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !stop.has(token));
}

function discoveryNameMatch(line: any, sku: any): boolean {
  const a = meaningfulTokens(line?.name);
  const b = new Set(meaningfulTokens(sku?.canonicalName || sku?.name));
  if (!a.length || !b.size) return false;
  const overlap = a.filter((token) => b.has(token)).length;
  return overlap >= Math.min(2, a.length);
}

function scheduleWindowsForDay(openingHours: any, dayKey: string): any[] {
  if (!openingHours || typeof openingHours !== "object" || Array.isArray(openingHours)) return [];
  const aliases: Record<string, string[]> = {
    mon: ["mon", "monday"], tue: ["tue", "tues", "tuesday"],
    wed: ["wed", "wednesday"], thu: ["thu", "thur", "thurs", "thursday"],
    fri: ["fri", "friday"], sat: ["sat", "saturday"], sun: ["sun", "sunday"],
  };

  const keys = aliases[dayKey] || [dayKey];
  for (const key of keys) {
    const raw = openingHours[key];
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === "object") return [raw];
  }
  return [];
}

function evaluateOpeningHours(pharmacy: any, now = new Date()): {
  state: QuoteAvailabilityState;
  openNow: boolean | null;
  reasonCode: string | null;
} {
  const pauseUntil = pharmacy?.rxOrderPauseUntil ? new Date(pharmacy.rxOrderPauseUntil) : null;
  if (pharmacy?.acceptingRxOrders === false || (pauseUntil && pauseUntil.getTime() > now.getTime())) {
    return { state: "NOT_ACCEPTING", openNow: null, reasonCode: "PHARMACY_NOT_ACCEPTING_RX_ORDERS" };
  }

  const hours = pharmacy?.rxOpeningHours;
  const timeZone = clean(pharmacy?.rxTimeZone, 80);
  if (!hours || !timeZone) {
    return {
      state: "CONFIRMING",
      openNow: null,
      reasonCode: "PHARMACY_AVAILABILITY_CONFIRMING",
    };
  }

  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now);

    const weekday = lower(parts.find((p) => p.type === "weekday")?.value, 20).slice(0, 3);
    const hh = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
    const mm = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
    const minuteOfDay = hh * 60 + mm;
    const windows = scheduleWindowsForDay(hours, weekday);

    if (!windows.length) {
      return { state: "OUTSIDE_HOURS", openNow: false, reasonCode: "PHARMACIES_OUTSIDE_HOURS" };
    }

    const openNow = windows.some((window) => {
      const start = clean(window?.open ?? window?.start, 10);
      const end = clean(window?.close ?? window?.end, 10);
      const parse = (value: string) => {
        const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value);
        return m ? Number(m[1]) * 60 + Number(m[2]) : null;
      };
      const a = parse(start);
      const b = parse(end);
      if (a == null || b == null) return false;
      return a <= b
        ? minuteOfDay >= a && minuteOfDay < b
        : minuteOfDay >= a || minuteOfDay < b;
    });

    return openNow
      ? { state: "AVAILABLE", openNow: true, reasonCode: null }
      : { state: "OUTSIDE_HOURS", openNow: false, reasonCode: "PHARMACIES_OUTSIDE_HOURS" };
  } catch {
    return {
      state: "CONFIRMING",
      openNow: null,
      reasonCode: "PHARMACY_AVAILABILITY_CONFIRMING",
    };
  }
}

function attributeText(value: any, keys: string[]): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  for (const key of keys) {
    const raw = value[key];
    if (raw == null) continue;
    if (typeof raw === "string" || typeof raw === "number") return clean(raw, 500) || null;
    if (typeof raw === "object") {
      const text = clean(raw.value ?? raw.label ?? raw.display, 500);
      if (text) return text;
    }
  }
  return null;
}

function serializeOption(option: any) {
  return {
    id: option.id,
    skuId: option.skuId,
    globalProductId: option.globalProductId ?? null,
    globalProductKey: option.globalProductKey ?? null,
    matchAuthority: option.matchAuthority,
    selectable: Boolean(option.selectable),
    requiresPharmacistReview: Boolean(option.requiresPharmacistReview),
    isGeneric: Boolean(option.isGeneric),
    displayName: option.displayName,
    canonicalName: option.canonicalName ?? null,
    brand: option.brand ?? null,
    manufacturer: option.manufacturer ?? null,
    ingredientText: option.ingredientText ?? null,
    strengthText: option.strengthText ?? null,
    dosageFormText: option.dosageFormText ?? null,
    packSize: option.packSize ?? null,
    productCodeSystem: option.productCodeSystem ?? null,
    productCode: option.productCode ?? null,
    listedPriceCents: option.listedPriceCents,
    currency: option.currency,
    stock: {
      known: Boolean(option.stockKnown),
      onHand: option.stockOnHandSnapshot ?? null,
      reserved: option.reservedStockSnapshot ?? 0,
      available: option.availableStockSnapshot ?? null,
    },
  };
}

export function serializeCarePortRxQuote(quote: any) {
  return {
    id: quote.id,
    sessionId: quote.sessionId,
    pharmacy: {
      id: quote.pharmacy?.id ?? quote.pharmacyId,
      name: quote.pharmacy?.name ?? null,
      address: quote.pharmacy?.address ?? null,
      city: quote.pharmacy?.city ?? null,
      country: quote.pharmacy?.country ?? null,
      supportsPickup: Boolean(quote.pharmacy?.supportsPickup),
      supportsDelivery: Boolean(quote.pharmacy?.supportsDelivery),
    },
    coverage: {
      status: quote.coverageStatus,
      includedLineCount: quote.includedLineCount,
      coveredLineCount: quote.coveredLineCount,
      ratio: quote.coverageRatio,
    },
    availability: {
      state: quote.availabilityState,
      reasonCode: quote.reasonCode ?? null,
      pharmacyOpenNow: quote.pharmacyOpenNow ?? null,
      acceptingOrders: Boolean(quote.acceptingOrders),
    },
    distanceKm: quote.distanceKm ?? null,
    generatedAt: quote.generatedAt?.toISOString?.() ?? quote.generatedAt,
    expiresAt: quote.expiresAt?.toISOString?.() ?? quote.expiresAt,
    currency: quote.currency,
    pricingTruth: "DISCOVERY_LIST_PRICE_ONLY_REVALIDATE_IN_CP_RX_3",
    lines: (quote.lines || []).map((line: any) => ({
      id: line.id,
      procurementLineId: line.procurementLineId,
      coverageState: line.coverageState,
      productTruthState: line.productTruthState,
      matchedOptionCount: line.matchedOptionCount,
      options: (line.options || []).map(serializeOption),
    })),
  };
}

function quoteInclude() {
  return {
    pharmacy: {
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        country: true,
        supportsPickup: true,
        supportsDelivery: true,
      },
    },
    lines: { include: { options: true } },
  } as const;
}

export async function listCarePortRxQuotes(args: {
  who: Who;
  orgId: string;
  sessionId: string;
}) {
  await getCarePortProcurementById({ who: args.who, orgId: args.orgId, sessionId: args.sessionId });
  const now = new Date();

  const quotes = await (prisma as any).carePortRxPharmacyQuote.findMany({
    where: {
      orgId: args.orgId,
      sessionId: args.sessionId,
      expiresAt: { gt: now },
    },
    include: quoteInclude(),
    orderBy: [
      { coverageRatio: "desc" },
      { distanceKm: "asc" },
      { generatedAt: "desc" },
    ],
  });

  return quotes;
}

export async function generateCarePortRxQuotes(args: {
  who: Who;
  orgId: string;
  sessionId: string;
  correlationId: string;
}) {
  const session = await getCarePortProcurementById({
    who: args.who,
    orgId: args.orgId,
    sessionId: args.sessionId,
  });

  if (session.status !== "BASKET_DRAFT" && session.status !== "PHARMACY_DISCOVERY") {
    const err = new Error("procurement_session_not_discoverable");
    (err as any).status = 409;
    throw err;
  }

  const includedLines = (session.lines || []).filter((line: any) => line.state === "INCLUDED");
  if (!includedLines.length) {
    const err = new Error("no_included_prescription_lines");
    (err as any).status = 409;
    throw err;
  }

  const pharmacies = await (prisma as any).pharmacyPartner.findMany({
    where: {
      active: true,
      kycStatus: "APPROVED",
      kycVerifiedAt: { not: null },
    },
    include: {
      careportSkus: {
        where: {
          orgId: args.orgId,
          isActive: true,
          reviewRequired: false,
          normalisationStatus: { in: Array.from(TRUSTED_SKU_NORMALISATION_STATUSES) },
        },
      },
      careportGenericLinks: { where: { orgId: args.orgId } },
    },
  });

  const allSkus = pharmacies.flatMap((p: any) => p.careportSkus || []);
  const skuIds = allSkus.map((s: any) => String(s.id));
  const directGlobalProductIds = allSkus
    .map((s: any) => clean(s.globalProductId, 191))
    .filter(Boolean);

  const skuMaps = skuIds.length
    ? await (prisma as any).carePortPharmacySkuGlobalProductMap.findMany({
        where: {
          orgId: args.orgId,
          skuId: { in: skuIds },
          matchStatus: "ACTIVE",
        },
      })
    : [];

  const mappedGlobalIds = skuMaps
    .map((m: any) => clean(m.globalProductId, 191))
    .filter(Boolean);

  const sourceCodes = Array.from(new Set(includedLines.flatMap(lineCodes)));

  const codeRows = sourceCodes.length
    ? await (prisma as any).carePortGlobalProductCode.findMany({
        where: {
          orgId: args.orgId,
          isActive: true,
          code: { in: sourceCodes },
        },
      })
    : [];

  const codeGlobalIds = codeRows.map((r: any) => clean(r.globalProductId, 191)).filter(Boolean);
  const allGlobalIds = Array.from(
    new Set([...directGlobalProductIds, ...mappedGlobalIds, ...codeGlobalIds]),
  );

  const globalProducts = allGlobalIds.length
    ? await (prisma as any).carePortGlobalProduct.findMany({
        where: {
          orgId: args.orgId,
          id: { in: allGlobalIds },
          catalogueStatus: "ACTIVE",
        },
      })
    : [];

  const globalById = new Map(globalProducts.map((p: any) => [String(p.id), p]));
  const mapsBySku = new Map<string, any[]>();
  for (const row of skuMaps) {
    const list = mapsBySku.get(String(row.skuId)) || [];
    list.push(row);
    mapsBySku.set(String(row.skuId), list);
  }

  const productIdsByCode = new Map<string, Set<string>>();
  for (const row of codeRows) {
    const key = clean(row.code, 240);
    const id = clean(row.globalProductId, 191);
    if (!key || !id || !globalById.has(id)) continue;
    const set = productIdsByCode.get(key) || new Set<string>();
    set.add(id);
    productIdsByCode.set(key, set);
  }

  function skuGlobalProduct(sku: any): any | null {
    const direct = clean(sku.globalProductId, 191);
    if (direct && globalById.has(direct)) return globalById.get(direct) || null;
    for (const row of mapsBySku.get(String(sku.id)) || []) {
      const id = clean(row.globalProductId, 191);
      if (id && globalById.has(id)) return globalById.get(id) || null;
    }
    return null;
  }

  function lineResolvedProductIds(line: any): Set<string> {
    const ids = new Set<string>();
    for (const code of lineCodes(line)) {
      for (const id of productIdsByCode.get(code) || []) ids.add(id);
    }
    return ids;
  }

  function exactMatchAuthority(line: any, sku: any, gp: any): string | null {
    const resolved = lineResolvedProductIds(line);
    if (gp && resolved.has(String(gp.id))) return "EXACT_GLOBAL_PRODUCT_CODE";

    const lineDrugCode = clean(line?.drugCode, 240);
    const skuDrugCode = clean(sku?.drugCode, 240);
    if (gp && lineDrugCode && skuDrugCode && lineDrugCode === skuDrugCode) {
      return "EXACT_SOURCE_DRUG_CODE_WITH_TRUSTED_PRODUCT";
    }

    return null;
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + QUOTE_TTL_MS);
  const origin =
    numeric(session.searchLat) != null && numeric(session.searchLng) != null
      ? { lat: Number(session.searchLat), lng: Number(session.searchLng) }
      : null;

  let outsideHoursCount = 0;
  let notAcceptingCount = 0;
  let confirmingCount = 0;

  const candidates = pharmacies.map((pharmacy: any) => {
    const availability = evaluateOpeningHours(pharmacy, now);
    if (availability.state === "OUTSIDE_HOURS") outsideHoursCount++;
    if (availability.state === "NOT_ACCEPTING") notAcceptingCount++;
    if (availability.state === "CONFIRMING") confirmingCount++;

    const pLat = numeric(pharmacy.lat);
    const pLng = numeric(pharmacy.lng);
    const distanceKm =
      origin && pLat != null && pLng != null
        ? haversineKm(origin, { lat: pLat, lng: pLng })
        : null;

    const skus = (pharmacy.careportSkus || []).filter((sku: any) => {
      const productType = upper(sku.productType, 80);
      return MEDICATION_PRODUCT_TYPES.has(productType) && sku.isActive !== false;
    });

    const skuById = new Map(skus.map((sku: any) => [String(sku.id), sku]));
    const genericIdsByOriginal = new Map<string, string[]>();

    for (const link of pharmacy.careportGenericLinks || []) {
      const originalId = String(link.originalSkuId || "");
      const genericId = String(link.genericSkuId || "");
      if (!originalId || !genericId || !skuById.has(genericId)) continue;
      const list = genericIdsByOriginal.get(originalId) || [];
      list.push(genericId);
      genericIdsByOriginal.set(originalId, list);
    }

    const lineResults = includedLines.map((line: any) => {
      const exact = skus
        .map((sku: any) => ({ sku, gp: skuGlobalProduct(sku) }))
        .map((row: any) => ({
          ...row,
          authority: exactMatchAuthority(line, row.sku, row.gp),
        }))
        .filter((row: any) => Boolean(row.authority));

      const exactOriginalIds = exact
        .filter((row: any) => !row.sku.isGeneric)
        .map((row: any) => String(row.sku.id));

      const genericLinked: any[] = [];
      for (const originalId of exactOriginalIds) {
        for (const genericId of genericIdsByOriginal.get(originalId) || []) {
          const sku = skuById.get(genericId);
          if (!sku) continue;
          const gp = skuGlobalProduct(sku);
          if (!gp) continue;
          genericLinked.push({
            sku,
            gp,
            authority: "PHARMACY_GENERIC_LINK_REQUIRES_PHARMACIST_REVIEW",
          });
        }
      }

      const authoritative = Array.from(
        new Map(
          [...exact, ...genericLinked].map((row: any) => [String(row.sku.id), row]),
        ).values(),
      );

      const discoveryOnly = skus
        .filter((sku: any) => discoveryNameMatch(line, sku))
        .filter((sku: any) => !authoritative.some((row: any) => String(row.sku.id) === String(sku.id)))
        .slice(0, 5)
        .map((sku: any) => ({
          sku,
          gp: skuGlobalProduct(sku),
          authority: "NAME_TOKEN_DISCOVERY_ONLY",
        }));

      const allOptions = [...authoritative, ...discoveryOnly].map((row: any) => {
        const sku = row.sku;
        const gp = row.gp;
        const available = availableStock(sku);
        const stockKnown = available != null;
        const authoritativeMatch = row.authority !== "NAME_TOKEN_DISCOVERY_ONLY";
        const requiresReview = row.authority === "PHARMACY_GENERIC_LINK_REQUIRES_PHARMACIST_REVIEW";
        const selectable = authoritativeMatch && stockKnown && Number(available) > 0;
        const normalised = sku.normalisedAttributes || gp?.normalisedAttributes || null;

        return {
          skuId: String(sku.id),
          globalProductId: gp?.id ? String(gp.id) : null,
          globalProductKey: clean(gp?.globalProductKey ?? sku.globalProductKey, 180) || null,
          matchAuthority: row.authority,
          selectable,
          requiresPharmacistReview: requiresReview,
          isGeneric: Boolean(sku.isGeneric),
          displayName: clean(sku.name, 500) || clean(gp?.canonicalName, 500) || "Medication",
          canonicalName: clean(gp?.canonicalName ?? sku.canonicalName, 500) || null,
          brand: clean(sku.brand ?? gp?.brand, 160) || null,
          manufacturer: clean(sku.manufacturer ?? gp?.manufacturer, 160) || null,
          ingredientText:
            attributeText(normalised, ["activeIngredient", "ingredient", "genericName"]) ||
            null,
          strengthText:
            clean(gp?.strength, 160) ||
            attributeText(normalised, ["strength"]) ||
            null,
          dosageFormText:
            clean(gp?.dosageForm, 160) ||
            attributeText(normalised, ["dosageForm", "form"]) ||
            null,
          packSize:
            clean(sku.packSize ?? gp?.packSize, 120) || null,
          productCodeSystem:
            clean(
              codeRows.find((c: any) => String(c.globalProductId) === String(gp?.id))?.system,
              120,
            ) || null,
          productCode:
            clean(
              codeRows.find((c: any) => String(c.globalProductId) === String(gp?.id))?.code,
              180,
            ) || clean(sku.drugCode, 180) || null,
          listedPriceCents: Math.max(0, Math.trunc(Number(sku.priceCents || 0))),
          currency: clean(sku.currency, 3) || clean(pharmacy.currency, 3) || "ZAR",
          stockOnHandSnapshot: numeric(sku.stockOnHand) == null ? null : Math.trunc(Number(sku.stockOnHand)),
          reservedStockSnapshot: Math.max(0, Math.trunc(numeric(sku.reservedStock) ?? 0)),
          availableStockSnapshot: available,
          stockKnown,
          productSnapshot: {
            skuUpdatedAt: sku.updatedAt ?? null,
            normalisationStatus: sku.normalisationStatus ?? null,
            catalogueStatus: gp?.catalogueStatus ?? null,
            sourceDrugCode: line.drugCode ?? null,
            sourceCodingSystem: line.codingSystem ?? null,
            sourceCodingCode: line.codingCode ?? null,
          },
        };
      });

      const selectableCount = allOptions.filter((option: any) => option.selectable).length;
      const exactSelectableCount = allOptions.filter(
        (option: any) => option.selectable && !option.requiresPharmacistReview,
      ).length;

      return {
        procurementLineId: String(line.id),
        coverageState:
          selectableCount > 0
            ? exactSelectableCount > 0
              ? "AUTHORITATIVE_AVAILABLE"
              : "GENERIC_REVIEW_REQUIRED_AVAILABLE"
            : allOptions.length > 0
              ? "DISCOVERY_CANDIDATES_ONLY"
              : "UNMATCHED",
        productTruthState:
          exactSelectableCount > 0
            ? "AUTHORITATIVE_PRODUCT_MATCH"
            : selectableCount > 0
              ? "PHARMACIST_REVIEW_REQUIRED"
              : allOptions.length > 0
                ? "UNVERIFIED_DISCOVERY_ONLY"
                : "NO_MATCH",
        matchedOptionCount: selectableCount,
        sourceLineSnapshot: {
          erxMedKey: line.erxMedKey,
          drugCode: line.drugCode ?? null,
          codingSystem: line.codingSystem ?? null,
          codingCode: line.codingCode ?? null,
          codingDisplay: line.codingDisplay ?? null,
          name: line.name,
          ingredientText: line.ingredientText ?? null,
          formText: line.formText ?? null,
          strengthText: line.strengthText ?? null,
          prescribedQuantityValue: line.prescribedQuantityValue ?? null,
          prescribedQuantityUnit: line.prescribedQuantityUnit ?? null,
        },
        options: allOptions,
      };
    });

    const coveredLineCount = lineResults.filter((line: any) => line.matchedOptionCount > 0).length;
    const coverageRatio = coveredLineCount / includedLines.length;
    const coverageStatus =
      coveredLineCount === includedLines.length
        ? "FULL"
        : coveredLineCount > 0
          ? "PARTIAL"
          : "NONE";

    return {
      pharmacy,
      availability,
      distanceKm,
      lineResults,
      coveredLineCount,
      coverageRatio,
      coverageStatus,
    };
  });

  const liveCandidates = candidates
    .filter((row: any) => row.coveredLineCount > 0)
    .filter((row: any) => row.availability.state === "AVAILABLE" || row.availability.state === "CONFIRMING")
    .sort((a: any, b: any) => {
      if (a.coverageStatus !== b.coverageStatus) return a.coverageStatus === "FULL" ? -1 : 1;
      if (b.coverageRatio !== a.coverageRatio) return b.coverageRatio - a.coverageRatio;
      if (a.availability.state !== b.availability.state) return a.availability.state === "AVAILABLE" ? -1 : 1;
      if (a.distanceKm == null && b.distanceKm != null) return 1;
      if (a.distanceKm != null && b.distanceKm == null) return -1;
      return Number(a.distanceKm ?? 0) - Number(b.distanceKm ?? 0);
    });

  const result = await prisma.$transaction(async (tx: any) => {
    await tx.carePortRxPharmacyQuote.deleteMany({
      where: { orgId: args.orgId, sessionId: session.id },
    });

    const created: any[] = [];

    for (const row of liveCandidates) {
      const quote = await tx.carePortRxPharmacyQuote.create({
        data: {
          orgId: args.orgId,
          sessionId: session.id,
          pharmacyId: row.pharmacy.id,
          coverageStatus: row.coverageStatus,
          availabilityState: row.availability.state,
          reasonCode: row.availability.reasonCode,
          includedLineCount: includedLines.length,
          coveredLineCount: row.coveredLineCount,
          coverageRatio: row.coverageRatio,
          distanceKm: row.distanceKm,
          pharmacyOpenNow: row.availability.openNow,
          acceptingOrders: row.availability.state !== "NOT_ACCEPTING",
          currency: clean(row.pharmacy.currency, 3) || "ZAR",
          generatedAt: now,
          expiresAt,
          lines: {
            create: row.lineResults.map((line: any) => ({
              procurementLineId: line.procurementLineId,
              coverageState: line.coverageState,
              productTruthState: line.productTruthState,
              matchedOptionCount: line.matchedOptionCount,
              sourceLineSnapshot: line.sourceLineSnapshot,
              options: { create: line.options },
            })),
          },
        },
        include: quoteInclude(),
      });
      created.push(quote);
    }

    await tx.carePortRxProcurementSession.update({
      where: { id: session.id },
      data: { status: "PHARMACY_DISCOVERY" },
    });

    return created;
  });

  const fullCount = result.filter((quote: any) => quote.coverageStatus === "FULL").length;
  const partialCount = result.filter((quote: any) => quote.coverageStatus === "PARTIAL").length;

  let reasonCode: string | null = null;
  let availabilityState = "AVAILABLE";

  if (!result.length) {
    availabilityState = "UNAVAILABLE";
    if (!pharmacies.length) reasonCode = "NO_PARTICIPATING_PHARMACIES_AREA";
    else if (outsideHoursCount > 0 && outsideHoursCount + notAcceptingCount === pharmacies.length) {
      reasonCode = "PHARMACIES_OUTSIDE_HOURS";
    } else {
      reasonCode = "NO_PHARMACY_WITH_SELECTED_ITEMS";
    }
  } else if (!fullCount && partialCount > 0) {
    availabilityState = "PARTIAL_ONLY";
    reasonCode = "PHARMACIES_PARTIAL_ONLY";
  } else if (result.every((quote: any) => quote.availabilityState === "CONFIRMING")) {
    availabilityState = "CONFIRMING";
    reasonCode = "PHARMACY_AVAILABILITY_CONFIRMING";
  }

  await auditEvent({
    kind: "careport_rx_quote_discovery_generated",
    actorId: args.who.uid ?? null,
    actorRole: args.who.role ?? null,
    subjectId: session.id,
    meta: {
      orgId: args.orgId,
      correlationId: args.correlationId,
      includedLineCount: includedLines.length,
      eligibleProviderCount: pharmacies.length,
      quoteCount: result.length,
      fullCoverageCount: fullCount,
      partialCoverageCount: partialCount,
      outsideHoursCount,
      notAcceptingCount,
      confirmingCount,
      reasonCode,
      quoteTtlSeconds: Math.trunc(QUOTE_TTL_MS / 1000),
    },
  }).catch(() => null);

  return {
    session,
    quotes: result,
    availability: {
      state: availabilityState,
      reasonCode,
      searchPhase: "COMPLETE",
      searchStartedAt: now.toISOString(),
      nextAutomaticRetryAt: null,
      eligibleProviderCount: pharmacies.length,
      onlineProviderCount: null,
      busyProviderCount: null,
      offersSentCount: 0,
      offersDeclinedCount: 0,
      offersExpiredCount: 0,
      serviceZoneId: null,
      fallbackActions: result.length ? [] : ["CHANGE_SEARCH_LOCATION", "RETRY"],
      patientMessageKey: reasonCode,
      technicalCorrelationId: args.correlationId,
    },
  };
}
