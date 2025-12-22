// apps/api-gateway/app/api/analytics/medical/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import {
  startOfDay,
  subDays,
  subMonths,
  differenceInYears,
  startOfISOWeek,
  addDays,
} from 'date-fns';
import { inferSyndromeFromIcd10 } from '@/src/insightcore/icd10SyndromeHelper';

const prisma = new PrismaClient();

/* ---------- Types: mirror the admin dashboard page ---------- */

type RangeKey = '7d' | '30d' | '90d' | '12m';
type GeoLevel = 'country' | 'province' | 'city' | 'postalCode';
type AgeBand = 'All' | '0–17' | '18–39' | '40–64' | '65+';
type Gender = 'All' | 'Male' | 'Female' | 'Other';

type SyndromeKey =
  | 'all'
  | 'respiratory'
  | 'gi'
  | 'feverRash'
  | 'neuro'
  | 'cardio'
  | 'utiRenal'
  | 'metabolic'
  | 'obgyn'
  | 'derm'
  | 'mskTrauma'
  | 'mental'
  | 'systemicSepsis'
  | 'general'
  | 'other';

type MedicalKpis = {
  totalCases: number;
  newCases: number;
  testPositivityPct: number;
  suspectedOutbreaks: number;
  paedsSharePct: number;
  highRiskPatientsPct7d: number;
  avgTimeToFirstConsultHours: number;
};

type SyndromePoint = {
  bucket: string; // "YYYY-MM-DD"
  totalCases: number;
  respiratory: number;
  gi: number;
  feverRash: number;
  neuro: number;
  other: number;
};

type IcdTopRow = {
  code: string;
  description: string;
  cases: number;
  patients: number;
  sharePct: number;
  ageBandBreakdown: { band: AgeBand | string; cases: number }[];
};

type GeoIncidenceRow = {
  geoLevel: GeoLevel;
  name: string;
  code: string;
  totalCases: number;
  incidencePer100k: number;
  growthRatePct: number;
  suspectedCluster: boolean;
  dominantSyndrome?: SyndromeKey;
};

type MovementRow = {
  fromName: string;
  fromCode: string;
  toName: string;
  toCode: string;
  patients: number;
  suspectedCases: number;
};

type DemographyRow = {
  ageBand: AgeBand | string;
  gender: Exclude<Gender, 'All'>;
  patients: number;
  cases: number;
  incidencePer100k: number;
  sharePct: number;
  topIcd10: { code: string; description: string; cases: number }[];
};

type MedRow = {
  atcCode?: string | null;
  name: string;
  prescriptions: number;
  patients: number;
  sharePct: number;
  demographicSkew?: string;
};

type LabRow = {
  loincCode?: string | null;
  name: string;
  orders: number;
  positives: number;
  positivityPct: number;
  topIcd10: { code: string; description: string; cases: number }[];
};

type OutbreakSignal = {
  id: string;
  syndrome: SyndromeKey;
  label: string;
  geoLevel: GeoLevel;
  locationName: string;
  signalScore: number; // 0–1
  baselineMultiplier: number;
  rEstimate?: number | null;
  status: 'watch' | 'investigate' | 'incident';
  window: { from: string; to: string };
};

type PaediatricSlice = {
  totalCases: number;
  sharePct: number;
  hospitalisationRatePer1000: number;
  topDiagnoses: { code: string; description: string; cases: number }[];
  topAgeBands: { band: string; cases: number }[];
};

type MedicalAnalyticsPayload = {
  kpis: MedicalKpis;
  topSyndromes: { key: SyndromeKey; label: string; cases: number; sharePct: number }[];
  timeSeries: SyndromePoint[];
  topIcd10: IcdTopRow[];
  geoIncidence: GeoIncidenceRow[];
  movement: MovementRow[];
  demography: DemographyRow[];
  meds: {
    overall: MedRow[];
    paeds: MedRow[];
    adults: MedRow[];
    seniors: MedRow[];
  };
  labs: LabRow[];
  outbreakSignals: OutbreakSignal[];
  paediatrics: PaediatricSlice;
};

/* ---------- Small helpers ---------- */

const SYNDROME_LABELS: Record<Exclude<SyndromeKey, 'all'>, string> = {
  respiratory: 'Respiratory',
  gi: 'GI / diarrhoeal',
  feverRash: 'Fever / rash',
  neuro: 'Neurologic',
  cardio: 'Cardio / chest pain',
  utiRenal: 'UTI / renal',
  metabolic: 'Metabolic / endocrine',
  obgyn: 'OBGYN',
  derm: 'Dermatologic',
  mskTrauma: 'MSK / trauma',
  mental: 'Mental & behavioural',
  systemicSepsis: 'Systemic sepsis / shock',
  general: 'General / constitutional',
  other: 'Other',
};

function parseRange(rangeParam: string | null, now: Date): {
  from: Date;
  to: Date;
  key: RangeKey;
} {
  const to = now;
  let key: RangeKey = '7d';

  if (rangeParam === '30d') key = '30d';
  else if (rangeParam === '90d') key = '90d';
  else if (rangeParam === '12m') key = '12m';
  else if (rangeParam === '7d') key = '7d';

  let from: Date;
  if (key === '7d') from = subDays(to, 7);
  else if (key === '30d') from = subDays(to, 30);
  else if (key === '90d') from = subDays(to, 90);
  else from = subMonths(to, 12);

  return { from, to, key };
}

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function ageFromDob(dob: Date | null | undefined, ref: Date): number | null {
  if (!dob) return null;
  const years = differenceInYears(ref, dob);
  return years >= 0 ? years : null;
}

function ageBandFilter(age: number | null): AgeBand | null {
  if (age == null) return null;
  if (age <= 17) return '0–17';
  if (age <= 39) return '18–39';
  if (age <= 64) return '40–64';
  return '65+';
}

function demographyAgeBand(age: number | null): AgeBand | null {
  // Same bands as filter for now
  return ageBandFilter(age);
}

function matchesAgeFilter(age: number | null, band: AgeBand): boolean {
  if (band === 'All') return true;
  const actual = ageBandFilter(age);
  return actual === band;
}

function matchesGenderFilter(genderVal: string | null | undefined, g: Gender): boolean {
  if (g === 'All') return true;
  if (!genderVal) return false;
  const normalized = genderVal.toLowerCase();
  if (g === 'Male') return normalized === 'male' || normalized === 'm';
  if (g === 'Female') return normalized === 'female' || normalized === 'f';
  return normalized !== 'male' && normalized !== 'female';
}

function isPositiveLab(lab: { isPositive: boolean | null | undefined; flag: string | null }): boolean {
  return (
    lab.isPositive === true ||
    lab.flag === 'H' ||
    lab.flag === 'L' ||
    lab.flag === 'A'
  );
}

function safeSyndromeKey(raw: string | null | undefined): Exclude<SyndromeKey, 'all'> {
  const s = (raw ?? '').toString() as string;
  if ((Object.keys(SYNDROME_LABELS) as string[]).includes(s)) {
    return s as Exclude<SyndromeKey, 'all'>;
  }
  return 'other';
}

function parseGeoLevel(raw: string | null): GeoLevel {
  if (raw === 'country' || raw === 'province' || raw === 'city' || raw === 'postalCode') {
    return raw;
  }
  return 'province';
}

/* ---------- Core handler ---------- */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const now = new Date();

    // Range & filters
    const { from, to, key: rangeKey } = parseRange(searchParams.get('range'), now);
    const geoLevel = parseGeoLevel(searchParams.get('geoLevel'));
    const provinceFilter = searchParams.get('province') ?? 'All';
    const ageBandFilterParam = (searchParams.get('ageBand') ?? 'All') as AgeBand;
    const genderFilterParam = (searchParams.get('gender') ?? 'All') as Gender;
    const syndromeParam = (searchParams.get('syndrome') ?? 'all') as SyndromeKey;
    const icdSearch = searchParams.get('icd')?.trim() ?? '';

    // --- 1) Base diagnoses in range ---
    const diagWhere: any = {
      createdAt: {
        gte: from,
        lt: to,
      },
      kind: 'diagnosis',
    };
    if (syndromeParam !== 'all') {
      diagWhere.syndrome = syndromeParam;
    }
    if (icdSearch) {
      diagWhere.OR = [
        { icd10: { contains: icdSearch, mode: 'insensitive' } },
        { description: { contains: icdSearch, mode: 'insensitive' } },
      ];
    }

    const diagnoses = await prisma.encounterDiagnosis.findMany({
      where: diagWhere,
      select: {
        id: true,
        encounterId: true,
        patientId: true,
        clinicianId: true,
        icd10: true,
        description: true,
        kind: true,
        status: true,
        syndrome: true,
        createdAt: true,
      },
    });

    if (!diagnoses.length) {
      const empty: MedicalAnalyticsPayload = {
        kpis: {
          totalCases: 0,
          newCases: 0,
          testPositivityPct: 0,
          suspectedOutbreaks: 0,
          paedsSharePct: 0,
          highRiskPatientsPct7d: 0,
          avgTimeToFirstConsultHours: 0,
        },
        topSyndromes: [],
        timeSeries: [],
        topIcd10: [],
        geoIncidence: [],
        movement: [],
        demography: [],
        meds: { overall: [], paeds: [], adults: [], seniors: [] },
        labs: [],
        outbreakSignals: [],
        paediatrics: {
          totalCases: 0,
          sharePct: 0,
          hospitalisationRatePer1000: 0,
          topDiagnoses: [],
          topAgeBands: [],
        },
      };
      return NextResponse.json(empty);
    }

    // --- 2) Patient profiles for geo + demo ---
    const patientIds = Array.from(new Set(diagnoses.map((d) => d.patientId)));
    const patients = await prisma.patientProfile.findMany({
      where: { id: { in: patientIds } },
      select: {
        id: true,
        gender: true,
        dob: true,
        city: true,
        postalCode: true,
      },
    });
    const patientMap = new Map(
      patients.map((p) => [p.id, p]),
    );

    // Derived: age per patient
    const patientAgeMap = new Map<string, number | null>();
    for (const p of patients) {
      patientAgeMap.set(p.id, ageFromDob(p.dob, now));
    }

    // --- 3) Apply age/gender/province filters at TS level ---
    const filteredDiagnoses = diagnoses.filter((d) => {
      const p = patientMap.get(d.patientId);
      const age = patientAgeMap.get(d.patientId) ?? null;
      const matchesAge = matchesAgeFilter(age, ageBandFilterParam);
      const matchesGender = matchesGenderFilter(p?.gender ?? null, genderFilterParam);

      let matchesProvince = true;
      if (provinceFilter && provinceFilter !== 'All') {
        // For now, we match province filter against patient.city or postalCode.
        matchesProvince =
          (p?.city && p.city === provinceFilter) ||
          (p?.postalCode && p.postalCode === provinceFilter);
      }

      return matchesAge && matchesGender && matchesProvince;
    });

    if (!filteredDiagnoses.length) {
      const empty: MedicalAnalyticsPayload = {
        kpis: {
          totalCases: 0,
          newCases: 0,
          testPositivityPct: 0,
          suspectedOutbreaks: 0,
          paedsSharePct: 0,
          highRiskPatientsPct7d: 0,
          avgTimeToFirstConsultHours: 0,
        },
        topSyndromes: [],
        timeSeries: [],
        topIcd10: [],
        geoIncidence: [],
        movement: [],
        demography: [],
        meds: { overall: [], paeds: [], adults: [], seniors: [] },
        labs: [],
        outbreakSignals: [],
        paediatrics: {
          totalCases: 0,
          sharePct: 0,
          hospitalisationRatePer1000: 0,
          topDiagnoses: [],
          topAgeBands: [],
        },
      };
      return NextResponse.json(empty);
    }

    /* ---------- 4) Labs for range (and encounters in-range) ---------- */

    const encounterIds = Array.from(new Set(filteredDiagnoses.map((d) => d.encounterId)));
    const labResults = await prisma.labResult.findMany({
      where: {
        encounterId: { in: encounterIds },
        createdAt: { gte: from, lt: to },
      },
      select: {
        id: true,
        encounterId: true,
        patientId: true,
        loincCode: true,
        name: true,
        isPositive: true,
        flag: true,
        createdAt: true,
      },
    });

    const totalLab = labResults.length;
    const positiveLab = labResults.filter((l) => isPositiveLab(l)).length;
    const testPositivityPct = totalLab > 0 ? (positiveLab / totalLab) * 100 : 0;

    /* ---------- 5) KPIs: total, new, paeds share, high-risk patients, etc ---------- */

    const totalCases = filteredDiagnoses.length;
    const last24h = subDays(now, 1);
    const newCases = filteredDiagnoses.filter((d) => d.createdAt >= last24h).length;

    // Paeds share (0–17 yrs)
    let paedsCases = 0;
    const paedsPatientSet = new Set<string>();
    for (const d of filteredDiagnoses) {
      const age = patientAgeMap.get(d.patientId) ?? null;
      if (age != null && age <= 17) {
        paedsCases += 1;
        paedsPatientSet.add(d.patientId);
      }
    }
    const paedsSharePct = totalCases > 0 ? (paedsCases / totalCases) * 100 : 0;

    // High-risk patients (7d) via RuntimeEvent (insight.alert.risk)
    const sevenDaysAgo = subDays(now, 7);
    const diags7d = filteredDiagnoses.filter((d) => d.createdAt >= sevenDaysAgo);
    const patients7d = new Set(diags7d.map((d) => d.patientId));

    const highRiskEvents7d = await prisma.runtimeEvent.findMany({
      where: {
        kind: 'insight.alert.risk',
        ts: {
          gte: BigInt(sevenDaysAgo.getTime()),
          lt: BigInt(now.getTime()),
        },
        severity: { in: ['moderate', 'high'] },
      },
      select: { patientId: true },
    });

    const highRiskPatientsSet = new Set<string>();
    for (const ev of highRiskEvents7d) {
      if (ev.patientId && patients7d.has(ev.patientId)) {
        highRiskPatientsSet.add(ev.patientId);
      }
    }
    const highRiskPatientsPct7d =
      patients7d.size > 0
        ? (highRiskPatientsSet.size / patients7d.size) * 100
        : 0;

    // Average time to "first consult" (approx):
    // For now: approximate as time between first diagnosis in encounter and encounter's createdAt.
    // If you later capture symptomOnsetAt, you can swap this out.
    const encounters = await prisma.encounter.findMany({
      where: { id: { in: encounterIds } },
      select: { id: true, createdAt: true },
    });
    const encCreatedMap = new Map(encounters.map((e) => [e.id, e.createdAt]));
    const firstDiagByEncounter = new Map<string, Date>();

    for (const d of filteredDiagnoses) {
      const existing = firstDiagByEncounter.get(d.encounterId);
      if (!existing || d.createdAt < existing) {
        firstDiagByEncounter.set(d.encounterId, d.createdAt);
      }
    }

    let totalHoursDiff = 0;
    let encCountForAvg = 0;
    for (const [encId, firstDiagAt] of firstDiagByEncounter.entries()) {
      const created = encCreatedMap.get(encId);
      if (!created) continue;
      const diffMs = firstDiagAt.getTime() - created.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      if (diffHours >= 0 && diffHours < 72) {
        totalHoursDiff += diffHours;
        encCountForAvg += 1;
      }
    }
    const avgTimeToFirstConsultHours =
      encCountForAvg > 0 ? totalHoursDiff / encCountForAvg : 0;

    /* ---------- 6) Top syndromes ---------- */

    type SyndAgg = {
      cases: number;
    };
    const syndAgg = new Map<Exclude<SyndromeKey, 'all'>, SyndAgg>();

    for (const d of filteredDiagnoses) {
      const key = safeSyndromeKey(d.syndrome ?? inferSyndromeFromIcd10(d.icd10));
      const agg = syndAgg.get(key) ?? { cases: 0 };
      agg.cases += 1;
      syndAgg.set(key, agg);
    }

    const topSyndromes = Array.from(syndAgg.entries())
      .sort((a, b) => b[1].cases - a[1].cases)
      .map(([key, agg]) => ({
        key: key as SyndromeKey,
        label: SYNDROME_LABELS[key],
        cases: agg.cases,
        sharePct: totalCases > 0 ? Math.round((agg.cases / totalCases) * 100) : 0,
      }))
      .slice(0, 10);

    /* ---------- 7) Time series: daily buckets with syndrome split ---------- */

    const dayKey = (d: Date) => d.toISOString().slice(0, 10);

    // Build map of date -> values
    const tsMap = new Map<
      string,
      {
        total: number;
        respiratory: number;
        gi: number;
        feverRash: number;
        neuro: number;
        other: number;
      }
    >();

    for (const d of filteredDiagnoses) {
      const k = dayKey(startOfDay(d.createdAt));
      let bucket = tsMap.get(k);
      if (!bucket) {
        bucket = { total: 0, respiratory: 0, gi: 0, feverRash: 0, neuro: 0, other: 0 };
        tsMap.set(k, bucket);
      }
      bucket.total += 1;
      const synd = safeSyndromeKey(d.syndrome ?? inferSyndromeFromIcd10(d.icd10));
      if (synd === 'respiratory') bucket.respiratory += 1;
      else if (synd === 'gi') bucket.gi += 1;
      else if (synd === 'feverRash') bucket.feverRash += 1;
      else if (synd === 'neuro') bucket.neuro += 1;
      else bucket.other += 1;
    }

    // Build continuous series from from..to (daily)
    const timeSeries: SyndromePoint[] = [];
    const startDay = startOfDay(from);
    const endDay = startOfDay(to);
    for (let d = startDay; d <= endDay; d = addDays(d, 1)) {
      const k = dayKey(d);
      const v = tsMap.get(k) ?? {
        total: 0,
        respiratory: 0,
        gi: 0,
        feverRash: 0,
        neuro: 0,
        other: 0,
      };
      timeSeries.push({
        bucket: k,
        totalCases: v.total,
        respiratory: v.respiratory,
        gi: v.gi,
        feverRash: v.feverRash,
        neuro: v.neuro,
        other: v.other,
      });
    }

    /* ---------- 8) Top ICD-10 ---------- */

    type IcdAgg = {
      code: string;
      description: string;
      cases: number;
      patients: Set<string>;
      ageBands: Map<AgeBand | string, number>;
    };

    const icdAgg = new Map<string, IcdAgg>();
    for (const d of filteredDiagnoses) {
      const code = d.icd10 || 'UNKNOWN';
      const desc = d.description || '';
      const p = patientMap.get(d.patientId);
      const age = patientAgeMap.get(d.patientId) ?? null;
      const band = demographyAgeBand(age) ?? 'Unknown';

      let agg = icdAgg.get(code);
      if (!agg) {
        agg = {
          code,
          description: desc,
          cases: 0,
          patients: new Set(),
          ageBands: new Map(),
        };
        icdAgg.set(code, agg);
      }
      agg.cases += 1;
      agg.patients.add(d.patientId);
      agg.ageBands.set(band, (agg.ageBands.get(band) ?? 0) + 1);
    }

    const topIcd10: IcdTopRow[] = Array.from(icdAgg.values())
      .sort((a, b) => b.cases - a.cases)
      .slice(0, 20)
      .map((agg) => ({
        code: agg.code,
        description: agg.description,
        cases: agg.cases,
        patients: agg.patients.size,
        sharePct: totalCases > 0 ? Math.round((agg.cases / totalCases) * 100) : 0,
        ageBandBreakdown: Array.from(agg.ageBands.entries()).map(([band, cases]) => ({
          band,
          cases,
        })),
      }));

    /* ---------- 9) Population stats (for geo + demography) ---------- */

    const popYear = now.getFullYear();
    const popStats = await prisma.populationStat.findMany({
      where: { year: popYear },
    });

    const totalPopulation =
      popStats.reduce((sum, p) => sum + p.population, 0) || 1;

    const popMap = new Map<
      string,
      { country: string; region: string | null; district: string | null; postalCode: string | null; population: number }
    >();
    for (const p of popStats) {
      const key = [p.country, p.region ?? '', p.district ?? '', p.postalCode ?? ''].join('|');
      popMap.set(key, {
        country: p.country,
        region: p.region ?? null,
        district: p.district ?? null,
        postalCode: p.postalCode ?? null,
        population: p.population,
      });
    }

    /* ---------- 10) Geo incidence (by chosen geoLevel) ---------- */

    type LocAgg = {
      country: string;
      district: string | null;
      postalCode: string | null;
      cases: number;
      patients: Set<string>;
    };

    const locAgg = new Map<string, LocAgg>();
    for (const d of filteredDiagnoses) {
      const p = patientMap.get(d.patientId);
      const country = 'ZA'; // TODO: use patient.country when available
      const district = p?.city ?? null;
      const postalCode = p?.postalCode ?? null;
      const key = [country, district ?? '', postalCode ?? ''].join('|');

      let agg = locAgg.get(key);
      if (!agg) {
        agg = {
          country,
          district,
          postalCode,
          cases: 0,
          patients: new Set(),
        };
        locAgg.set(key, agg);
      }
      agg.cases += 1;
      agg.patients.add(d.patientId);
    }

    // For growthRatePct we need previous-period cases per geo unit
    const rangeMs = to.getTime() - from.getTime();
    const prevFrom = new Date(from.getTime() - rangeMs);
    const prevTo = from;

    const prevDiagWhere: any = {
      createdAt: { gte: prevFrom, lt: prevTo },
      kind: 'diagnosis',
    };
    if (syndromeParam !== 'all') prevDiagWhere.syndrome = syndromeParam;

    const prevDiags = await prisma.encounterDiagnosis.findMany({
      where: prevDiagWhere,
      select: { patientId: true, createdAt: true },
    });

    const prevLocAgg = new Map<string, number>(); // key -> cases
    for (const d of prevDiags) {
      const p = patientMap.get(d.patientId);
      const country = 'ZA';
      const district = p?.city ?? null;
      const postalCode = p?.postalCode ?? null;
      const key = [country, district ?? '', postalCode ?? ''].join('|');
      prevLocAgg.set(key, (prevLocAgg.get(key) ?? 0) + 1);
    }

    // Reduce into geo-level rows
    type GeoKey = string;
    type GeoAgg = {
      level: GeoLevel;
      name: string;
      code: string;
      cases: number;
      prevCases: number;
      population: number;
    };

    const geoAgg = new Map<GeoKey, GeoAgg>();

    for (const loc of locAgg.values()) {
      // Attach pop to get region if available
      const popKey = [loc.country, '', loc.district ?? '', loc.postalCode ?? ''].join('|');
      const pop = popMap.get(popKey);
      const region = pop?.region ?? null;

      if (geoLevel === 'country') {
        const key: GeoKey = `country|${loc.country}`;
        const prevCases = Array.from(prevLocAgg.entries())
          .filter(([k]) => k.startsWith(loc.country + '|'))
          .reduce((sum, [, c]) => sum + c, 0);

        const existing = geoAgg.get(key);
        if (!existing) {
          geoAgg.set(key, {
            level: 'country',
            name: loc.country,
            code: loc.country,
            cases: loc.cases,
            prevCases,
            population: totalPopulation,
          });
        } else {
          existing.cases += loc.cases;
          existing.prevCases += prevCases;
        }
      } else if (geoLevel === 'province') {
        const provName = region ?? '(Unknown region)';
        const key: GeoKey = `province|${loc.country}|${provName}`;
        const prevCases = Array.from(prevLocAgg.entries())
          .filter(([k]) => {
            const prevPop = popMap.get(k);
            return prevPop?.region === region;
          })
          .reduce((sum, [, c]) => sum + c, 0);

        const popForRegion = popStats
          .filter((p) => p.country === loc.country && p.region === region)
          .reduce((sum, p) => sum + p.population, 0);

        const existing = geoAgg.get(key);
        if (!existing) {
          geoAgg.set(key, {
            level: 'province',
            name: provName,
            code: provName,
            cases: loc.cases,
            prevCases,
            population: popForRegion || 1,
          });
        } else {
          existing.cases += loc.cases;
          existing.prevCases += prevCases;
        }
      } else if (geoLevel === 'city') {
        const cityName = loc.district ?? '(Unknown city)';
        const key: GeoKey = `city|${loc.country}|${cityName}`;
        const prevCases = prevLocAgg.get(
          [loc.country, loc.district ?? '', loc.postalCode ?? ''].join('|'),
        ) ?? 0;

        const popForCity = popStats
          .filter(
            (p) =>
              p.country === loc.country &&
              p.district === loc.district &&
              p.postalCode === loc.postalCode,
          )
          .reduce((sum, p) => sum + p.population, 0);

        const existing = geoAgg.get(key);
        if (!existing) {
          geoAgg.set(key, {
            level: 'city',
            name: cityName,
            code: cityName,
            cases: loc.cases,
            prevCases,
            population: popForCity || 1,
          });
        } else {
          existing.cases += loc.cases;
          existing.prevCases += prevCases;
        }
      } else {
        // postalCode level
        const code = loc.postalCode ?? '(Unknown)';
        const key: GeoKey = `postalCode|${loc.country}|${code}`;
        const prevCases = prevLocAgg.get(
          [loc.country, loc.district ?? '', loc.postalCode ?? ''].join('|'),
        ) ?? 0;

        const popForPostal = popStats
          .filter(
            (p) =>
              p.country === loc.country &&
              p.district === loc.district &&
              p.postalCode === loc.postalCode,
          )
          .reduce((sum, p) => sum + p.population, 0);

        const existing = geoAgg.get(key);
        if (!existing) {
          geoAgg.set(key, {
            level: 'postalCode',
            name: code,
            code,
            cases: loc.cases,
            prevCases,
            population: popForPostal || 1,
          });
        } else {
          existing.cases += loc.cases;
          existing.prevCases += prevCases;
        }
      }
    }

    const geoIncidence: GeoIncidenceRow[] = Array.from(geoAgg.values())
      .map((g) => {
        const incidencePer100k = (g.cases / g.population) * 100_000;
        let growthRatePct = 0;
        if (g.prevCases > 0) {
          growthRatePct = ((g.cases - g.prevCases) / g.prevCases) * 100;
        } else if (g.cases > 0) {
          growthRatePct = 100; // from 0 to >0
        }
        const suspectedCluster = incidencePer100k >= 80 && growthRatePct >= 15;

        return {
          geoLevel: g.level,
          name: g.name,
          code: g.code,
          totalCases: g.cases,
          incidencePer100k,
          growthRatePct,
          suspectedCluster,
          // For now, we don't compute per-geo syndrome mix; you can wire that later
          dominantSyndrome: syndromeParam === 'all' ? undefined : syndromeParam,
        };
      })
      .sort((a, b) => b.incidencePer100k - a.incidencePer100k)
      .slice(0, 30);

    /* ---------- 11) Movement: simple patient city-to-city flows ---------- */

    type PatientDiag = { city: string | null; at: Date };
    const diagsByPatient = new Map<string, PatientDiag[]>();
    for (const d of filteredDiagnoses) {
      const p = patientMap.get(d.patientId);
      const city = p?.city ?? null;
      if (!city) continue;
      let arr = diagsByPatient.get(d.patientId);
      if (!arr) {
        arr = [];
        diagsByPatient.set(d.patientId, arr);
      }
      arr.push({ city, at: d.createdAt });
    }

    type FlowAgg = {
      fromName: string;
      toName: string;
      patients: Set<string>;
    };
    const flowAgg = new Map<string, FlowAgg>();

    for (const [pid, arr] of diagsByPatient.entries()) {
      arr.sort((a, b) => a.at.getTime() - b.at.getTime());
      for (let i = 1; i < arr.length; i++) {
        const prev = arr[i - 1];
        const curr = arr[i];
        if (prev.city === curr.city) continue;
        const key = `${prev.city}|${curr.city}`;
        let agg = flowAgg.get(key);
        if (!agg) {
          agg = {
            fromName: prev.city!,
            toName: curr.city!,
            patients: new Set(),
          };
          flowAgg.set(key, agg);
        }
        agg.patients.add(pid);
      }
    }

    const movement: MovementRow[] = Array.from(flowAgg.values())
      .map((f) => ({
        fromName: f.fromName,
        fromCode: f.fromName,
        toName: f.toName,
        toCode: f.toName,
        patients: f.patients.size,
        suspectedCases: f.patients.size, // you can refine using risk/labs later
      }))
      .sort((a, b) => b.patients - a.patients)
      .slice(0, 20);

    /* ---------- 12) Demography ---------- */

    type DemoKey = string;
    type DemoAgg = {
      ageBand: AgeBand | string;
      gender: Exclude<Gender, 'All'>;
      patients: Set<string>;
      cases: number;
      icdCounts: Map<string, { description: string; cases: number }>;
    };

    const demoAgg = new Map<DemoKey, DemoAgg>();
    for (const d of filteredDiagnoses) {
      const p = patientMap.get(d.patientId);
      const age = patientAgeMap.get(d.patientId) ?? null;
      const band = demographyAgeBand(age) ?? 'Unknown';
      let gender: Exclude<Gender, 'All'> = 'Other';
      const gRaw = p?.gender?.toLowerCase();
      if (gRaw === 'male' || gRaw === 'm') gender = 'Male';
      else if (gRaw === 'female' || gRaw === 'f') gender = 'Female';

      const key = `${band}|${gender}`;
      let agg = demoAgg.get(key);
      if (!agg) {
        agg = {
          ageBand: band,
          gender,
          patients: new Set(),
          cases: 0,
          icdCounts: new Map(),
        };
        demoAgg.set(key, agg);
      }

      agg.cases += 1;
      agg.patients.add(d.patientId);

      const icdCode = d.icd10 || 'UNKNOWN';
      const desc = d.description || '';
      const icdAggEntry = agg.icdCounts.get(icdCode) ?? { description: desc, cases: 0 };
      icdAggEntry.cases += 1;
      agg.icdCounts.set(icdCode, icdAggEntry);
    }

    const demography: DemographyRow[] = Array.from(demoAgg.values())
      .map((agg) => {
        const incidencePer100k = (agg.patients.size / totalPopulation) * 100_000;
        const sharePct = totalCases > 0 ? (agg.cases / totalCases) * 100 : 0;
        const topIcd10 = Array.from(agg.icdCounts.entries())
          .sort((a, b) => b[1].cases - a[1].cases)
          .slice(0, 5)
          .map(([code, val]) => ({
            code,
            description: val.description,
            cases: val.cases,
          }));

        return {
          ageBand: agg.ageBand,
          gender: agg.gender,
          patients: agg.patients.size,
          cases: agg.cases,
          incidencePer100k,
          sharePct,
          topIcd10,
        };
      })
      .sort((a, b) => b.incidencePer100k - a.incidencePer100k);

    /* ---------- 13) Medications (simple aggregate by Medication.name) ---------- */

    const medsRows = await prisma.medication.findMany({
      where: {
        createdAt: { gte: from, lt: to },
      },
      select: {
        id: true,
        patientId: true,
        name: true,
      },
    });

    type MedAgg = {
      name: string;
      atcCode: string | null;
      prescriptions: number;
      patients: Set<string>;
    };

    const medAgg = new Map<string, MedAgg>();
    for (const m of medsRows) {
      const key = m.name;
      let agg = medAgg.get(key);
      if (!agg) {
        agg = {
          name: m.name,
          atcCode: null, // you can parse ATC codes from meta later
          prescriptions: 0,
          patients: new Set(),
        };
        medAgg.set(key, agg);
      }
      agg.prescriptions += 1;
      if (m.patientId) agg.patients.add(m.patientId);
    }

    const totalPrescriptions =
      Array.from(medAgg.values()).reduce((sum, m) => sum + m.prescriptions, 0) || 1;

    const overallMeds: MedRow[] = Array.from(medAgg.values())
      .map((m) => ({
        atcCode: m.atcCode,
        name: m.name,
        prescriptions: m.prescriptions,
        patients: m.patients.size,
        sharePct: (m.prescriptions / totalPrescriptions) * 100,
        demographicSkew: undefined, // could compute from demography later
      }))
      .sort((a, b) => b.prescriptions - a.prescriptions)
      .slice(0, 20);

    // For now, reuse overall as paeds/adults/seniors buckets (placeholder).
    const meds = {
      overall: overallMeds,
      paeds: overallMeds,
      adults: overallMeds,
      seniors: overallMeds,
    };

    /* ---------- 14) Labs breakdown ---------- */

    type LabAgg = {
      loincCode: string | null;
      name: string;
      orders: number;
      positives: number;
      icdCounts: Map<string, { description: string; cases: number }>;
    };

    const diagByEncounter = new Map<string, { icd10: string; description: string }[]>();
    for (const d of filteredDiagnoses) {
      let arr = diagByEncounter.get(d.encounterId);
      if (!arr) {
        arr = [];
        diagByEncounter.set(d.encounterId, arr);
      }
      arr.push({
        icd10: d.icd10 || 'UNKNOWN',
        description: d.description || '',
      });
    }

    const labAgg = new Map<string, LabAgg>();
    for (const l of labResults) {
      const key = l.loincCode || l.name;
      let agg = labAgg.get(key);
      if (!agg) {
        agg = {
          loincCode: l.loincCode,
          name: l.name,
          orders: 0,
          positives: 0,
          icdCounts: new Map(),
        };
        labAgg.set(key, agg);
      }
      agg.orders += 1;
      if (isPositiveLab(l)) agg.positives += 1;

      const diagsForEncounter = diagByEncounter.get(l.encounterId) ?? [];
      for (const dx of diagsForEncounter) {
        const icdAggEntry =
          agg.icdCounts.get(dx.icd10) ??
          { description: dx.description, cases: 0 };
        icdAggEntry.cases += 1;
        agg.icdCounts.set(dx.icd10, icdAggEntry);
      }
    }

    const labs: LabRow[] = Array.from(labAgg.values())
      .map((agg) => ({
        loincCode: agg.loincCode,
        name: agg.name,
        orders: agg.orders,
        positives: agg.positives,
        positivityPct:
          agg.orders > 0 ? (agg.positives / agg.orders) * 100 : 0,
        topIcd10: Array.from(agg.icdCounts.entries())
          .sort((a, b) => b[1].cases - a[1].cases)
          .slice(0, 5)
          .map(([code, val]) => ({
            code,
            description: val.description,
            cases: val.cases,
          })),
      }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 20);

    /* ---------- 15) Outbreak signals via precomputed InsightCoreHeatmap ---------- */

    const fromWeek = startOfISOWeek(from);
    const toWeek = startOfISOWeek(to);

    const heatWhere: any = {
      weekStart: {
        gte: fromWeek,
        lte: toWeek,
      },
    };
    if (syndromeParam !== 'all') {
      heatWhere.syndrome = syndromeParam;
    }

    const heatRows = await prisma.insightCoreHeatmap.findMany({
      where: heatWhere,
      select: {
        id: true,
        weekStart: true,
        country: true,
        region: true,
        district: true,
        postalCode: true,
        syndrome: true,
        incidencePer100k: true,
        alertRatePer100k: true,
        riskScore: true,
        trendVsPrevWeek: true,
        zScore: true,
      },
    });

    const outbreakSignals: OutbreakSignal[] = heatRows
      .filter((h) => h.riskScore != null)
      .sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0))
      .slice(0, 10)
      .map((h) => {
        const riskScore = h.riskScore ?? 0; // assuming 0–100
        let geoLevelForSignal: GeoLevel = 'country';
        let locationName = h.country;
        if (h.postalCode) {
          geoLevelForSignal = 'postalCode';
          locationName = h.postalCode;
        } else if (h.district) {
          geoLevelForSignal = 'city';
          locationName = h.district;
        } else if (h.region) {
          geoLevelForSignal = 'province';
          locationName = h.region;
        }

        const signalScore = clamp01(riskScore / 100);
        const baselineMultiplier =
          h.trendVsPrevWeek != null
            ? 1 + h.trendVsPrevWeek / 100
            : 1 + signalScore; // fallback

        let status: 'watch' | 'investigate' | 'incident' = 'watch';
        if (riskScore >= 70) status = 'incident';
        else if (riskScore >= 40) status = 'investigate';

        const windowFrom = h.weekStart.toISOString();
        const windowTo = addDays(h.weekStart, 7).toISOString();

        const syndKey = safeSyndromeKey(h.syndrome);

        return {
          id: h.id,
          syndrome: syndKey as SyndromeKey,
          label: `${SYNDROME_LABELS[syndKey]} • ${locationName}`,
          geoLevel: geoLevelForSignal,
          locationName,
          signalScore,
          baselineMultiplier,
          rEstimate: h.zScore ?? null, // placeholder: you can wire an actual R
          status,
          window: { from: windowFrom, to: windowTo },
        };
      });

    const suspectedOutbreaks = outbreakSignals.length;

    /* ---------- 16) Paediatric slice ---------- */

    // paedsCases & paedsPatientSet already computed
    // Approx hospitalisationRatePer1000: use severe risk alerts (severity = high) as proxy
    const paedsPatientIds = Array.from(paedsPatientSet);

    let paedsHighSeverityPatients = 0;
    if (paedsPatientIds.length > 0) {
      const paedsHighEvents = await prisma.runtimeEvent.findMany({
        where: {
          kind: 'insight.alert.risk',
          severity: 'high',
          ts: {
            gte: BigInt(from.getTime()),
            lt: BigInt(to.getTime()),
          },
          patientId: { in: paedsPatientIds },
        },
        select: { patientId: true },
      });
      const paedsHighSet = new Set(
        paedsHighEvents
          .map((e) => e.patientId)
          .filter((x): x is string => !!x),
      );
      paedsHighSeverityPatients = paedsHighSet.size;
    }

    const hospitalisationRatePer1000 =
      paedsCases > 0 ? (paedsHighSeverityPatients / paedsCases) * 1000 : 0;

    // Top paeds diagnoses
    const paedsDiagAgg = new Map<string, { description: string; cases: number }>();
    const paedsAgeBandFine = new Map<string, number>(); // '0–4', '5–11', '12–17'
    for (const d of filteredDiagnoses) {
      const age = patientAgeMap.get(d.patientId) ?? null;
      if (age == null || age > 17) continue;

      const code = d.icd10 || 'UNKNOWN';
      const desc = d.description || '';
      const existing = paedsDiagAgg.get(code) ?? { description: desc, cases: 0 };
      existing.cases += 1;
      paedsDiagAgg.set(code, existing);

      let band = '12–17';
      if (age <= 4) band = '0–4';
      else if (age <= 11) band = '5–11';
      paedsAgeBandFine.set(band, (paedsAgeBandFine.get(band) ?? 0) + 1);
    }

    const paedsTopDiagnoses = Array.from(paedsDiagAgg.entries())
      .sort((a, b) => b[1].cases - a[1].cases)
      .slice(0, 5)
      .map(([code, val]) => ({
        code,
        description: val.description,
        cases: val.cases,
      }));

    const paedsTopAgeBands = Array.from(paedsAgeBandFine.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([band, cases]) => ({ band, cases }));

    const paediatrics: PaediatricSlice = {
      totalCases: paedsCases,
      sharePct: paedsSharePct,
      hospitalisationRatePer1000,
      topDiagnoses: paedsTopDiagnoses,
      topAgeBands: paedsTopAgeBands,
    };

    /* ---------- 17) Build payload ---------- */

    const payload: MedicalAnalyticsPayload = {
      kpis: {
        totalCases,
        newCases,
        testPositivityPct,
        suspectedOutbreaks,
        paedsSharePct,
        highRiskPatientsPct7d,
        avgTimeToFirstConsultHours,
      },
      topSyndromes,
      timeSeries,
      topIcd10,
      geoIncidence,
      movement,
      demography,
      meds,
      labs,
      outbreakSignals,
      paediatrics,
    };

    return NextResponse.json(payload);
  } catch (err) {
    console.error('[api/analytics/medical] error', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
