// apps/patient-app/mock/practices/practices.factory.ts
import { daysAgo, type Practice, type PracticeKind, type PlanTier } from './types';
import { getMockMedicalAidsForCountry } from '../medical-aid';

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

export type PracticeCountryConfig = {
  seed: string;
  countryCode: string;
  countryName: string;
  timezone?: string;
  cities: string[];
  regions: string[]; // e.g. states/provinces/regions

  nameStyle: NameStyle;

  counts?: { teams?: number; clinics?: number; hospitals?: number };

  // ZAR-normalized “starting from” price per kind for current UI
  basePriceFromZAR?: Partial<Record<PracticeKind, number>>;
};

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
  const n = Math.max(min, Math.min(max, min + Math.floor(rng() * (max - min + 1))));
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

function ratingFor(i: number, rng: () => number) {
  const r = 4.1 + ((i * 0.13) % 0.7) + rng() * 0.3;
  return clamp(parseFloat(r.toFixed(1)), 3.8, 5);
}

function ratingCountFor(i: number, rng: () => number) {
  const base = 35 + (i * 17) % 220;
  return Math.max(5, Math.round(base + rng() * 60));
}

function moneyJitter(base: number, rng: () => number) {
  const mult = 0.85 + rng() * 0.35; // +/- ~17.5%
  const v = Math.round((base * mult) / 10) * 10;
  return Math.max(0, v);
}

const TEAM_SUBTYPES = [
  'Virtual interdisciplinary care team',
  'Chronic care partnership',
  'Mental wellness & counselling collective',
  'Rehab & pain management partnership',
  'Women’s health virtual team',
  'Home-visit coordination team',
];

const CLINIC_SUBTYPES = [
  'Primary care clinic',
  'Multi-specialty day clinic',
  'Outpatient mental health',
  'Rehab (Orthopaedic & Neuro)',
  'Women’s health & fertility',
  'Renal & dialysis',
  'Paediatrics & family clinic',
];

const HOSPITAL_SUBTYPES = [
  'Multi-specialty hospital',
  'Rehabilitation hospital',
  'Inpatient mental health',
  'Mother & child hospital',
  'Specialist surgical hospital',
];

const NAME_BITS: Record<NameStyle, { team: string[]; clinic: string[]; hospital: string[] }> = {
  southern_africa: {
    team: ['Care Circle', 'Health Collective', 'Wellness Partners', 'Clinical Team'],
    clinic: ['Clinic', 'Health Centre', 'Day Clinic', 'Medical Centre'],
    hospital: ['Hospital', 'Specialist Hospital', 'Rehab Hospital', 'Medical Hospital'],
  },
  west_africa: {
    team: ['Care Network', 'Health Collective', 'Wellness Team', 'Clinical Partners'],
    clinic: ['Clinic', 'Care Centre', 'Medical Clinic', 'Health Centre'],
    hospital: ['Hospital', 'Specialist Hospital', 'Teaching Hospital', 'Medical Hospital'],
  },
  east_africa: {
    team: ['Care Network', 'Wellness Collective', 'Clinical Team', 'Partners'],
    clinic: ['Clinic', 'Health Centre', 'Medical Centre', 'Care Clinic'],
    hospital: ['Hospital', 'Referral Hospital', 'Specialist Hospital', 'Medical Hospital'],
  },
  central_africa: {
    team: ['Réseau de Soins', 'Collectif Santé', 'Équipe Clinique', 'Partenaires'],
    clinic: ['Clinique', 'Centre Médical', 'Centre de Santé', 'Clinique de Jour'],
    hospital: ['Hôpital', 'Hôpital Spécialisé', 'Hôpital Général', 'Hôpital Médical'],
  },
  latam: {
    team: ['Red de Salud', 'Equipo Clínico', 'Colectivo Salud', 'Socios Médicos'],
    clinic: ['Clínica', 'Centro Médico', 'Centro de Salud', 'Clínica de Día'],
    hospital: ['Hospital', 'Hospital Especialista', 'Hospital General', 'Hospital Médico'],
  },
  anglosphere: {
    team: ['Care Team', 'Health Partnership', 'Wellness Collective', 'Clinical Group'],
    clinic: ['Clinic', 'Health Centre', 'Medical Centre', 'Day Clinic'],
    hospital: ['Hospital', 'Specialist Hospital', 'Rehab Hospital', 'Medical Hospital'],
  },
  europe: {
    team: ['Care Team', 'Health Partnership', 'Clinical Group', 'Wellness Collective'],
    clinic: ['Clinic', 'Medical Centre', 'Health Centre', 'Day Clinic'],
    hospital: ['Hospital', 'Specialist Hospital', 'Medical Hospital', 'Rehab Hospital'],
  },
  middle_east: {
    team: ['Care Team', 'Health Network', 'Wellness Partners', 'Clinical Group'],
    clinic: ['Clinic', 'Medical Centre', 'Health Centre', 'Day Clinic'],
    hospital: ['Hospital', 'Specialist Hospital', 'Medical Hospital', 'Rehab Hospital'],
  },
  asia_pacific: {
    team: ['Care Team', 'Health Network', 'Wellness Partners', 'Clinical Group'],
    clinic: ['Clinic', 'Medical Centre', 'Health Centre', 'Day Clinic'],
    hospital: ['Hospital', 'Specialist Hospital', 'Medical Hospital', 'Rehab Hospital'],
  },
  caribbean: {
    team: ['Care Team', 'Wellness Collective', 'Health Partners', 'Clinical Group'],
    clinic: ['Clinic', 'Health Centre', 'Medical Centre', 'Day Clinic'],
    hospital: ['Hospital', 'Medical Hospital', 'Specialist Hospital', 'Rehab Hospital'],
  },
};

function planTierFor(i: number, rng: () => number): PlanTier {
  // stable-ish distribution: free/basic common, pro/host rarer
  const x = (i * 17 + Math.floor(rng() * 100)) % 100;
  if (x < 10) return 'host';
  if (x < 25) return 'pro';
  if (x < 60) return 'basic';
  return 'free';
}

function makeName(rng: () => number, style: NameStyle, kind: PracticeKind, city: string) {
  const bits = NAME_BITS[style];
  const suffix = kind === 'team' ? pick(rng, bits.team) : kind === 'clinic' ? pick(rng, bits.clinic) : pick(rng, bits.hospital);

  // small deterministic “descriptor”
  const prefixPool =
    kind === 'team'
      ? ['Family', 'Chronic', 'Mindful', 'Rehab', 'Women’s', 'Community', 'Integrated']
      : kind === 'clinic'
        ? ['Family', 'Community', 'Rehab', 'MindSpring', 'Riverside', 'Harbour', 'Unity']
        : ['General', 'Specialist', 'Gracefield', 'Harbourview', 'Unity', 'Central', 'Starlight'];

  return `${city} ${pick(rng, prefixPool)} ${suffix}`.replace(/\s+/g, ' ').trim();
}

export function buildPracticesForCountry(cfg: PracticeCountryConfig): Practice[] {
  const rng = mulberry32(hashSeed(cfg.seed));
  const covers = getMockMedicalAidsForCountry(cfg.countryCode);
  const coverNames = covers.map((c) => c.name);

  const counts = {
    teams: cfg.counts?.teams ?? 8,
    clinics: cfg.counts?.clinics ?? 10,
    hospitals: cfg.counts?.hospitals ?? 6,
  };

  const base = {
    team: cfg.basePriceFromZAR?.team ?? 480,
    clinic: cfg.basePriceFromZAR?.clinic ?? 520,
    hospital: cfg.basePriceFromZAR?.hospital ?? 850,
  };

  const out: Practice[] = [];
  let idx = 0;

  function add(kind: PracticeKind, n: number, subTypes: string[]) {
    for (let i = 0; i < n; i++) {
      const city = pick(rng, cfg.cities);
      const region = pick(rng, cfg.regions);
      const location = `${city}, ${region}`;

      const accepts = coverNames.length > 0 ? rng() > 0.22 : false;
      const acceptedSchemes = accepts ? pickManyUnique(rng, coverNames, 1, Math.min(4, coverNames.length)) : [];

      const hasEncounter = rng() > 0.55;
      const days = 1 + Math.floor(rng() * 75);

      out.push({
        id: `${cfg.countryCode.toLowerCase()}-${kind}-${idx + 1}`,
        kind,
        name: makeName(rng, cfg.nameStyle, kind, city),
        subType: pick(rng, subTypes),
        location,
        rating: ratingFor(idx, rng),
        ratingCount: ratingCountFor(idx, rng),
        priceFromZAR: moneyJitter(base[kind], rng),
        acceptsMedicalAid: accepts,
        acceptedSchemes: accepts ? acceptedSchemes : undefined,
        planTier: planTierFor(idx, rng),
        hasEncounter,
        lastEncounterAt: hasEncounter ? daysAgo(days) : null,
        encounterCount: hasEncounter ? Math.max(1, Math.round(rng() * 420)) : 0,
      });

      idx++;
    }
  }

  add('team', counts.teams, TEAM_SUBTYPES);
  add('clinic', counts.clinics, CLINIC_SUBTYPES);
  add('hospital', counts.hospitals, HOSPITAL_SUBTYPES);

  // deterministic shuffle to mix kinds
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }

  return out;
}
