// apps/patient-app/mock/clinicians-shared.ts
export type ClinicianClass = 'Doctor' | 'Allied Health' | 'Wellness';

export type CountryCode =
  | 'ZA'
  | 'NG'
  | 'KE'
  | 'GH'
  | 'BW'
  | 'ZW'
  | 'DRC'
  | 'BR'
  | 'AR'
  | 'NZ'
  | 'UK'
  | 'USA'
  | 'CA'
  | 'UAE'
  | 'KSA'
  | 'AU'
  | 'CU'
  | 'SG'
  | 'JM'
  | 'DM';

export type Clinician = {
  id: string;
  country: CountryCode;
  cls: ClinicianClass;

  name: string;
  specialty: string;
  location: string;

  rating: number; // 0..5
  priceZAR: number; // keep field name for now so existing UI keeps working
  online: boolean;

  // NEW
  speaks?: string[];
  yearsExp?: number;
};

export const DEFAULT_DOC_SPECIALTIES = [
  'Family Medicine',
  'Internal Medicine',
  'Cardiology',
  'Endocrinology',
  'Dermatology',
  'Neurology',
  'Paediatrics',
  'Obstetrics & Gynaecology',
  'Psychiatry',
  'Orthopaedics',
];

export const DEFAULT_ALLIED_SPECIALTIES = [
  'Physiotherapy',
  'Pharmacist',
  'Nursing',
  'Occupational Therapy',
  'Dietetics',
  'Speech Therapy',
];

export const DEFAULT_WELLNESS_SPECIALTIES = [
  'Nutrition Coach',
  'Fitness Coach',
  'Mental Wellness',
  'Lifestyle Medicine',
];

function pick<T>(arr: T[], i: number) {
  return arr[i % arr.length];
}
function price(base: number, i: number) {
  return Math.round((base + (i % 7) * 50) / 10) * 10;
}
function rating(i: number) {
  return 3.9 + ((i * 73) % 12) / 10;
}
function online(i: number) {
  return (i % 3) !== 0;
}
function clsSlug(cls: ClinicianClass) {
  return cls.toLowerCase().replace(/\s/g, '');
}
function pickLanguages(pool: string[], i: number) {
  const a = pick(pool, i * 2 + 1);
  const b = pick(pool, i * 3 + 2);
  const c = pick(pool, i * 5 + 3);
  const out = Array.from(new Set([a, b, c].filter(Boolean)));
  return out.slice(0, 3);
}
function yearsExp(i: number) {
  // 2..27 years, deterministic
  return 2 + ((i * 7) % 26);
}

export type CountryClinicianSeed = {
  country: CountryCode;
  cities: string[];
  names: {
    doctors: string[];
    allied: string[];
    wellness: string[];
  };
  languages: string[];
  specialties?: {
    doctors?: string[];
    allied?: string[];
    wellness?: string[];
  };
  basePrice?: {
    Doctor?: number;
    'Allied Health'?: number;
    Wellness?: number;
  };
};

function buildGroup(args: {
  country: CountryCode;
  cities: string[];
  names: string[];
  cls: ClinicianClass;
  specs: string[];
  basePrice: number;
  languages: string[];
}): Clinician[] {
  const { country, cities, names, cls, specs, basePrice, languages } = args;

  return names.map((name, i) => ({
    id: `${country.toLowerCase()}-${clsSlug(cls)}-${i + 1}`,
    country,
    cls,
    name,
    specialty: pick(specs, i),
    location: pick(cities, i * 7 + 3),
    rating: Math.min(5, Math.max(3.5, parseFloat(rating(i).toFixed(1)))),
    priceZAR: price(basePrice, i), // stays “priceZAR” for now
    online: online(i),
    speaks: pickLanguages(languages, i),
    yearsExp: yearsExp(i),
  }));
}

export function buildCountryClinicians(seed: CountryClinicianSeed): Clinician[] {
  const docSpecs = seed.specialties?.doctors?.length
    ? seed.specialties.doctors
    : DEFAULT_DOC_SPECIALTIES;
  const alliedSpecs = seed.specialties?.allied?.length
    ? seed.specialties.allied
    : DEFAULT_ALLIED_SPECIALTIES;
  const wellSpecs = seed.specialties?.wellness?.length
    ? seed.specialties.wellness
    : DEFAULT_WELLNESS_SPECIALTIES;

  const baseDoc = seed.basePrice?.Doctor ?? 650;
  const baseAllied = seed.basePrice?.['Allied Health'] ?? 450;
  const baseWell = seed.basePrice?.Wellness ?? 350;

  return [
    ...buildGroup({
      country: seed.country,
      cities: seed.cities,
      names: seed.names.doctors,
      cls: 'Doctor',
      specs: docSpecs,
      basePrice: baseDoc,
      languages: seed.languages,
    }),
    ...buildGroup({
      country: seed.country,
      cities: seed.cities,
      names: seed.names.allied,
      cls: 'Allied Health',
      specs: alliedSpecs,
      basePrice: baseAllied,
      languages: seed.languages,
    }),
    ...buildGroup({
      country: seed.country,
      cities: seed.cities,
      names: seed.names.wellness,
      cls: 'Wellness',
      specs: wellSpecs,
      basePrice: baseWell,
      languages: seed.languages,
    }),
  ];
}
