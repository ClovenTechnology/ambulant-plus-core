// apps/patient-app/mock/clinicians.factory.ts
export type ClinicianClass = 'Doctor' | 'Allied Health' | 'Wellness';

export type Clinician = {
  id: string;
  cls: ClinicianClass;
  name: string;
  specialty: string;
  location: string; // City (or City, State)
  rating: number; // 0..5
  online: boolean;

  // Global-ready fee fields
  priceCents: number; // per consult, minor units
  currency: string; // ISO 4217 (e.g. ZAR, USD, GBP)

  // Global directory metadata
  speaks: string[]; // languages spoken
  yearsExperience: number; // since first year of practice
  countryCode: string; // ISO 3166-1 alpha-2
  timezone?: string; // IANA timezone, optional
};

type NameStyle =
  | 'southern_africa'
  | 'west_africa'
  | 'east_africa'
  | 'central_africa'
  | 'latam'
  | 'anglosphere'
  | 'europe'
  | 'middle_east'
  | 'asia_pacific'
  | 'caribbean';

type CountryConfig = {
  seed: string;
  countryCode: string;
  countryName: string;
  currency: string;
  timezone?: string;
  cities: string[];
  languages: string[]; // pool to sample from
  nameStyle: NameStyle;

  counts?: { doctors?: number; allied?: number; wellness?: number };

  // base consult fees per class (minor units)
  basePriceCents?: {
    doctor?: number;
    allied?: number;
    wellness?: number;
  };
};

const docSpecialties = [
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

const alliedSpecs = [
  'Physiotherapy',
  'Pharmacist',
  'Nursing',
  'Occupational Therapy',
  'Dietetics',
  'Speech Therapy',
];

const wellSpecs = ['Nutrition Coach', 'Fitness Coach', 'Mental Wellness', 'Lifestyle Medicine'];

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(rng: () => number, arr: T[]) {
  return arr[Math.floor(rng() * arr.length)];
}

function pickManyUnique(rng: () => number, arr: string[], min = 1, max = 3) {
  const n = Math.max(min, Math.min(max, 1 + Math.floor(rng() * max)));
  const pool = arr.slice();
  const out: string[] = [];
  while (out.length < n && pool.length) {
    const idx = Math.floor(rng() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function moneyJitter(baseCents: number, rng: () => number) {
  // +/- up to ~18% variation, rounded to neat explains
  const mult = 0.82 + rng() * 0.36;
  const v = Math.round((baseCents * mult) / 500) * 500; // round to 5.00 units
  return Math.max(0, v);
}

function ratingFor(i: number, rng: () => number) {
  const r = 3.7 + ((i * 0.17) % 0.8) + rng() * 0.4;
  return clamp(parseFloat(r.toFixed(1)), 3.4, 5);
}

function onlineFor(i: number) {
  return (i % 3) !== 0;
}

function yearsExperienceFor(i: number, rng: () => number) {
  // 2..30
  const y = 2 + ((i * 5) % 18) + Math.floor(rng() * 11);
  return clamp(y, 2, 30);
}

const NAME_BITS: Record<NameStyle, { first: string[]; last: string[] }> = {
  southern_africa: {
    first: ['Thabo', 'Ayanda', 'Lerato', 'Sipho', 'Nomsa', 'Zanele', 'Kabelo', 'Nandi', 'Themba', 'Nokuthula'],
    last: ['Mokoena', 'Dlamini', 'Nkosi', 'Khumalo', 'Ndlovu', 'Molefe', 'Mthembu', 'Zondo', 'Mabuza', 'Sithole'],
  },
  west_africa: {
    first: ['Chinedu', 'Amina', 'Tunde', 'Ifeoma', 'Kofi', 'Ama', 'Kwame', 'Ngozi', 'Bola', 'Yaa'],
    last: ['Okafor', 'Adeyemi', 'Balogun', 'Mensah', 'Owusu', 'Boateng', 'Nwankwo', 'Osei', 'Agyeman', 'Eze'],
  },
  east_africa: {
    first: ['Asha', 'Wanjiku', 'Kamau', 'Otieno', 'Njeri', 'Amina', 'Juma', 'Wairimu', 'Kiptoo', 'Fatuma'],
    last: ['Mwangi', 'Odhiambo', 'Kipchoge', 'Omondi', 'Mutua', 'Wekesa', 'Njoroge', 'Karanja', 'Ochieng', 'Chebet'],
  },
  central_africa: {
    first: ['Chantal', 'Jean', 'Patrice', 'Aline', 'Cédric', 'Clarisse', 'Moïse', 'Nadine', 'Blaise', 'Estelle'],
    last: ['Kabongo', 'Mukendi', 'Kasongo', 'Ilunga', 'Tshimanga', 'Kabasele', 'Mbuyi', 'Lukusa', 'Katumba', 'Masika'],
  },
  latam: {
    first: ['Camila', 'Mateo', 'Sofia', 'Lucas', 'Valentina', 'Thiago', 'Mariana', 'Gabriel', 'Isabella', 'Juan'],
    last: ['Silva', 'Santos', 'Oliveira', 'Pereira', 'Rodriguez', 'Gomez', 'Fernandez', 'Lopez', 'Costa', 'Martinez'],
  },
  anglosphere: {
    first: ['James', 'Olivia', 'Noah', 'Amelia', 'Liam', 'Emma', 'Ethan', 'Ava', 'Mason', 'Sophia'],
    last: ['Smith', 'Johnson', 'Brown', 'Taylor', 'Wilson', 'Davies', 'Miller', 'Anderson', 'Moore', 'Thomas'],
  },
  europe: {
    first: ['Oliver', 'Charlotte', 'Harry', 'Isla', 'George', 'Emily', 'Jack', 'Grace', 'Leo', 'Mia'],
    last: ['Wright', 'Walker', 'Thompson', 'Evans', 'Roberts', 'Hall', 'Green', 'Clarke', 'Lewis', 'Baker'],
  },
  middle_east: {
    first: ['Ahmed', 'Fatima', 'Omar', 'Aisha', 'Khalid', 'Mariam', 'Yousef', 'Noura', 'Hassan', 'Layla'],
    last: ['Almutairi', 'Alqahtani', 'Alharbi', 'Alshammari', 'Alotaibi', 'Aldossary', 'Alshehri', 'Alzahrani', 'Alnasser', 'Almohammed'],
  },
  asia_pacific: {
    first: ['Wei', 'Mei', 'Arjun', 'Ananya', 'Hiro', 'Yuki', 'Min', 'Jihoon', 'Siti', 'Nur'],
    last: ['Tan', 'Lim', 'Lee', 'Wong', 'Singh', 'Kumar', 'Chen', 'Ng', 'Rahman', 'Park'],
  },
  caribbean: {
    first: ['Jamal', 'Aaliyah', 'Kiana', 'Andre', 'Shanice', 'Dwayne', 'Renee', 'Marvin', 'Sasha', 'Keisha'],
    last: ['Campbell', 'Brown', 'Williams', 'Johnson', 'Reid', 'Taylor', 'Thomas', 'Smith', 'Gordon', 'Clarke'],
  },
};

function genName(rng: () => number, style: NameStyle) {
  const bits = NAME_BITS[style];
  return `${pick(rng, bits.first)} ${pick(rng, bits.last)}`;
}

function buildGroup(args: {
  rng: () => number;
  countryCode: string;
  timezone?: string;
  cities: string[];
  languages: string[];
  style: NameStyle;
  cls: ClinicianClass;
  specs: string[];
  basePriceCents: number;
  count: number;
  idPrefix: string;
}): Clinician[] {
  const { rng, countryCode, timezone, cities, languages, style, cls, specs, basePriceCents, count, idPrefix } = args;

  const out: Clinician[] = [];
  for (let i = 0; i < count; i++) {
    const name = genName(rng, style);
    const location = pick(rng, cities);
    out.push({
      id: `${idPrefix}-${i + 1}`,
      cls,
      name,
      specialty: specs[i % specs.length],
      location,
      rating: ratingFor(i, rng),
      online: onlineFor(i),
      priceCents: moneyJitter(basePriceCents, rng),
      currency: 'XXX', // filled by wrapper
      speaks: pickManyUnique(rng, languages, 1, 3),
      yearsExperience: yearsExperienceFor(i, rng),
      countryCode,
      timezone,
    });
  }
  return out;
}

export function buildCliniciansForCountry(cfg: CountryConfig): Clinician[] {
  const rng = mulberry32(hashSeed(cfg.seed));

  const counts = {
    doctors: cfg.counts?.doctors ?? 24,
    allied: cfg.counts?.allied ?? 18,
    wellness: cfg.counts?.wellness ?? 12,
  };

  const base = {
    doctor: cfg.basePriceCents?.doctor ?? 65000,
    allied: cfg.basePriceCents?.allied ?? 45000,
    wellness: cfg.basePriceCents?.wellness ?? 35000,
  };

  const docs = buildGroup({
    rng,
    countryCode: cfg.countryCode,
    timezone: cfg.timezone,
    cities: cfg.cities,
    languages: cfg.languages,
    style: cfg.nameStyle,
    cls: 'Doctor',
    specs: docSpecialties,
    basePriceCents: base.doctor,
    count: counts.doctors,
    idPrefix: `${cfg.countryCode.toLowerCase()}-doc`,
  });

  const allied = buildGroup({
    rng,
    countryCode: cfg.countryCode,
    timezone: cfg.timezone,
    cities: cfg.cities,
    languages: cfg.languages,
    style: cfg.nameStyle,
    cls: 'Allied Health',
    specs: alliedSpecs,
    basePriceCents: base.allied,
    count: counts.allied,
    idPrefix: `${cfg.countryCode.toLowerCase()}-allied`,
  });

  const wellness = buildGroup({
    rng,
    countryCode: cfg.countryCode,
    timezone: cfg.timezone,
    cities: cfg.cities,
    languages: cfg.languages,
    style: cfg.nameStyle,
    cls: 'Wellness',
    specs: wellSpecs,
    basePriceCents: base.wellness,
    count: counts.wellness,
    idPrefix: `${cfg.countryCode.toLowerCase()}-well`,
  });

  // Fill currency on all rows
  const all = [...docs, ...allied, ...wellness].map((c) => ({ ...c, currency: cfg.currency }));

  // Slight shuffle to mix categories but keep deterministic
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = all[i];
    all[i] = all[j];
    all[j] = tmp;
  }

  return all;
}
