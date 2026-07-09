import { attributeTemplates, categories, standardOptions } from './taxonomy';

export type CarePortCatalogueSource =
  | 'PHARMACY_SUPPLIED'
  | 'CSV_IMPORT'
  | 'ADMIN_CREATED'
  | 'GLOBAL_CATALOGUE'
  | 'PARTNER_FEED'
  | 'NAPPI'
  | 'RXNORM'
  | 'GTIN';

type AnySkuLike = Record<string, any>;

function clean(value: unknown, max = 500): string {
  return String(value ?? '').trim().slice(0, max);
}

function canonicalKey(value: unknown) {
  return clean(value, 160)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normaliseUnitText(value: unknown) {
  return clean(value, 160)
    .replace(/\s+/g, ' ')
    .replace(/(\d)\s*(mg|mcg|g|ml|mL|l|L|iu|IU|%)\b/g, '$1 $2')
    .replace(/\bml\b/g, 'mL')
    .replace(/\bl\b/g, 'L')
    .replace(/\biu\b/g, 'IU')
    .trim();
}

function standardMap(values: string[]) {
  const map = new Map<string, string>();

  for (const value of values) {
    map.set(canonicalKey(value), value);
  }

  return map;
}

const optionMaps = {
  colours: standardMap(standardOptions.colours),
  flavours: standardMap(standardOptions.flavours),
  dosageForms: standardMap(standardOptions.dosageForms),
  packUnits: standardMap(standardOptions.packUnits),
  skinTypes: standardMap(standardOptions.skinTypes),
  hairTypes: standardMap(standardOptions.hairTypes),
  materials: standardMap(standardOptions.materials),
  ageBands: standardMap(standardOptions.ageBands),
  regulatorySchedules: standardMap(standardOptions.regulatorySchedules),
};

const attributeToOptionMap: Record<string, Map<string, string>> = {
  colour: optionMaps.colours,
  color: optionMaps.colours,
  flavour: optionMaps.flavours,
  flavor: optionMaps.flavours,
  dosageForm: optionMaps.dosageForms,
  form: optionMaps.dosageForms,
  skinType: optionMaps.skinTypes,
  hairType: optionMaps.hairTypes,
  material: optionMaps.materials,
  ageBand: optionMaps.ageBands,
  regulatedSchedule: optionMaps.regulatorySchedules,
};

const highRiskSchedules = new Set(['S3', 'S4', 'S5', 'S6', 'CONTROLLED', 'COUNTRY_SPECIFIC']);

function coerceObject(value: unknown): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, any>;
}

function pickAttributeValues(input: AnySkuLike) {
  const values: Record<string, any> = {
    ...coerceObject(input.variantAttributes),
    ...coerceObject(input.attributes),
  };

  const directKeys = [
    'dosageForm',
    'form',
    'strength',
    'packSize',
    'flavour',
    'flavor',
    'colour',
    'color',
    'size',
    'material',
    'capacity',
    'skinType',
    'hairType',
    'ageBand',
    'regulatedSchedule',
  ];

  for (const key of directKeys) {
    if (input[key] !== undefined && input[key] !== null && clean(input[key])) {
      values[key] = input[key];
    }
  }

  return values;
}

function normaliseAttributeValue(key: string, value: unknown) {
  const raw = clean(value, 300);
  if (!raw) return { raw, normalised: null, custom: false };

  const optionMap = attributeToOptionMap[key];

  if (optionMap) {
    const canonical = optionMap.get(canonicalKey(raw));

    if (canonical && canonical !== 'Other') {
      return { raw, normalised: canonical, custom: false };
    }

    if (canonical === 'Other') {
      return { raw, normalised: 'Other', custom: true };
    }

    return { raw, normalised: raw, custom: true };
  }

  if (['strength', 'packSize', 'capacity', 'size'].includes(key)) {
    return { raw, normalised: normaliseUnitText(raw), custom: false };
  }

  return { raw, normalised: raw, custom: !attributeTemplates[key] };
}

function categoryLooksKnown(category: unknown) {
  const key = canonicalKey(category);

  if (!key) return false;

  return categories.some((item) => item.key === key || canonicalKey(item.label) === key);
}

function productTypeLooksKnown(productType: unknown) {
  const key = clean(productType, 80).toUpperCase();

  return [
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
  ].includes(key);
}

export function normaliseCarePortSkuForCatalogue(
  input: AnySkuLike,
  source: CarePortCatalogueSource = 'PHARMACY_SUPPLIED',
) {
  const issues: string[] = [];
  const customAttributeValues: Record<string, any> = {};
  const normalisedAttributes: Record<string, any> = {};

  const productType = clean(input.productType, 80).toUpperCase() || 'MEDICATION';
  const category = clean(input.category, 120);
  const regulatedSchedule = clean(input.regulatedSchedule, 80).toUpperCase();
  const name = clean(input.name, 500);
  const barcode = clean(input.barcode, 120);
  const drugCode = clean(input.drugCode, 160);

  if (!productTypeLooksKnown(productType)) issues.push('unknown_product_type');
  if (category && !categoryLooksKnown(category)) issues.push('unknown_category');

  if (input.marketplaceVisible === true && input.prescriptionRequired === true) {
    issues.push('prescription_required_item_marked_marketplace_visible');
  }

  if (highRiskSchedules.has(regulatedSchedule)) {
    issues.push('regulated_schedule_requires_review');
  }

  if (productType === 'MEDICATION' && !barcode && !drugCode) {
    issues.push('medicine_missing_barcode_or_drug_code');
  }

  if ((productType === 'OTC_MEDICATION' || productType === 'SUPPLEMENT') && !barcode && !drugCode) {
    issues.push('otc_or_supplement_missing_barcode_or_code');
  }

  const attributes = pickAttributeValues(input);

  for (const [key, value] of Object.entries(attributes)) {
    const normalised = normaliseAttributeValue(key, value);

    if (!normalised.raw) continue;

    normalisedAttributes[key] = normalised.normalised ?? normalised.raw;

    if (normalised.custom) {
      customAttributeValues[key] = normalised.raw;
    }
  }

  const hasCustomValues = Object.keys(customAttributeValues).length > 0;

  if (hasCustomValues) issues.push('custom_attribute_values_require_catalogue_review');

  const canonicalParts = [
    name,
    normalisedAttributes.strength,
    normalisedAttributes.dosageForm ?? normalisedAttributes.form,
    normalisedAttributes.packSize,
    normalisedAttributes.colour ?? normalisedAttributes.color,
    normalisedAttributes.flavour ?? normalisedAttributes.flavor,
  ].filter(Boolean);

  const canonicalName = canonicalParts.length ? canonicalParts.join(' · ') : name || null;
  const globalProductKey = canonicalName ? canonicalKey([productType, canonicalName, barcode || drugCode].filter(Boolean).join('|')) : null;

  const reviewRequired = issues.length > 0;
  const normalisationStatus = reviewRequired ? 'RAW_PHARMACY_SUPPLIED' : 'MAPPED_TO_TEMPLATE';

  let confidence = 0.78;

  if (barcode) confidence += 0.08;
  if (drugCode) confidence += 0.08;
  if (!reviewRequired) confidence += 0.05;
  if (hasCustomValues) confidence -= 0.18;
  if (issues.includes('regulated_schedule_requires_review')) confidence -= 0.15;

  confidence = Math.max(0.1, Math.min(0.99, Number(confidence.toFixed(2))));

  return {
    catalogueSource: source,
    normalisationStatus,
    normalisationConfidence: confidence,
    normalisationNotes: issues.length
      ? 'Automatic catalogue normalisation flagged: ' + issues.join(', ')
      : 'Automatically mapped to current CarePort catalogue taxonomy.',
    globalProductKey,
    canonicalName,
    customAttributeValues: hasCustomValues ? customAttributeValues : null,
    normalisedAttributes: Object.keys(normalisedAttributes).length ? normalisedAttributes : null,
    reviewRequired,
    reviewReason: issues.length ? issues.join(', ') : null,
    reviewedBy: null,
    reviewedAt: null,
  };
}
