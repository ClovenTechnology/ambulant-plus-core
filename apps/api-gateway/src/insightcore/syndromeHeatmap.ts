// src/insightcore/syndromeHeatmap.ts
import { PrismaClient } from '@prisma/client';
import { startOfISOWeek, differenceInYears } from 'date-fns';
import { inferSyndromeFromIcd10 } from './icd10SyndromeHelper';
import {
  parseRiskAlertPayload,
  type InsightRiskAlertSeverity,
} from './riskAlertTypes';

const prisma = new PrismaClient();

export type HeatmapCell = {
  weekStart: Date;
  country: string;
  region?: string | null;
  district?: string | null;
  postalCode?: string | null;

  syndrome: string;
  ageBand?: string | null;
  gender?: string | null;

  encounterCount: number;
  finalDiagnosisCount: number;
  ruledOutCount: number;
  distinctPatients: number;

  positiveLabCount: number;

  /** Total count of InsightCore risk alerts mapped into this cell */
  alertCount: number;

  /** Split by “soft” (low/moderate) vs “hard” (high) */
  softAlertCount: number;
  hardAlertCount: number;

  population?: number | null;
  incidencePer100k?: number | null;
  alertRatePer100k?: number | null;

  /** Composite 0–100 score combining all signals */
  riskScore?: number | null;

  /** Optional: reserved for nightly cron to fill */
  trendVsPrevWeek?: number | null;
  zScore?: number | null;

  meta?: unknown;
};

type MutableCell = HeatmapCell & {
  encounterIds: Set<string>;
  patientIds: Set<string>;

  /** Count of abnormal vitals events associated with this cell */
  vitalAbnormalEvents: number;

  /** Weighted alert contribution from RuntimeEvent payload+severity */
  alertWeightedScore: number;
};

function ageBandFor(dob: Date | null | undefined, refDate: Date): string | null {
  if (!dob) return null;
  const years = differenceInYears(refDate, dob);
  if (years < 0) return null;
  if (years <= 4) return '0-4';
  if (years <= 14) return '5-14';
  if (years <= 24) return '15-24';
  if (years <= 44) return '25-44';
  if (years <= 64) return '45-64';
  return '65+';
}

function districtDimsForPatient(p: {
  city: string | null;
  postalCode: string | null;
}): { country: string; region: string | null; district: string | null; postalCode: string | null } {
  return {
    country: 'ZA',     // TODO: later derive from patient.country when available
    region: null,      // TODO: plug in province/state when stored
    district: p.city,
    postalCode: p.postalCode,
  };
}

function makeKey(
  weekStart: Date,
  country: string,
  region: string | null,
  district: string | null,
  postalCode: string | null,
  syndrome: string,
  ageBand: string | null,
  gender: string | null,
): string {
  return [
    weekStart.toISOString(),
    country,
    region ?? '',
    district ?? '',
    postalCode ?? '',
    syndrome,
    ageBand ?? '',
    gender ?? '',
  ].join('|');
}

function isAbnormalVital(sample: { vType: string; valueNum: number; unit?: string | null }): boolean {
  const { vType, valueNum } = sample;
  if (valueNum == null) return false;

  switch (vType) {
    case 'hr':
    case 'heartRate':
      return valueNum < 50 || valueNum > 120;
    case 'spo2':
      return valueNum < 94;
    case 'temp':
    case 'tempC':
      return valueNum > 38.0 || valueNum < 35.0;
    case 'sbp':
    case 'sys':
      return valueNum >= 140;
    case 'dbp':
    case 'dia':
      return valueNum >= 90;
    case 'rr':
      return valueNum > 24;
    default:
      return false;
  }
}

/**
 * Map Prisma severity string → conceptual soft/hard classification.
 *
 *  - "high"      => hard
 *  - "moderate"  => soft
 *  - "low"       => soft
 */
function isHardSeverity(severity: InsightRiskAlertSeverity | string | null | undefined): boolean {
  const s = (severity ?? '').toLowerCase();
  return s === 'high';
}

/**
 * Core pipeline: given a date range, compute syndrome × district × week heatmap.
 *
 * This is "live" compute; your nightly cron wraps this and persists into InsightCoreHeatmap.
 */
export async function computeSyndromeHeatmapForRange(
  start: Date,
  end: Date,
): Promise<HeatmapCell[]> {
  // 1) Pull diagnoses in window
  const diagnoses = await prisma.encounterDiagnosis.findMany({
    where: {
      createdAt: {
        gte: start,
        lt: end,
      },
      kind: 'diagnosis',
    },
  });

  if (!diagnoses.length) return [];

  const encounterIds = new Set<string>();
  const patientIds = new Set<string>();

  for (const d of diagnoses) {
    encounterIds.add(d.encounterId);
    patientIds.add(d.patientId);
  }

  // 2) Load patient profiles for geo + demographics
  const patients = await prisma.patientProfile.findMany({
    where: {
      id: {
        in: Array.from(patientIds),
      },
    },
  });

  const patientMap = new Map(
    patients.map((p) => [
      p.id,
      {
        city: p.city ?? null,
        postalCode: p.postalCode ?? null,
        gender: p.gender ?? null,
        dob: p.dob ?? null,
      },
    ]),
  );

  // 3) Build encounter dims + maps for encounters & patient-week buckets
  type EncounterDims = {
    weekStart: Date;
    country: string;
    region: string | null;
    district: string | null;
    postalCode: string | null;
    ageBand: string | null;
    gender: string | null;
  };

  const encounterDims = new Map<string, EncounterDims>();
  const encounterToCellKeys = new Map<string, Set<string>>();
  const patientWeekToCellKeys = new Map<string, Set<string>>();

  const cellMap = new Map<string, MutableCell>();

  for (const d of diagnoses) {
    const patient = patientMap.get(d.patientId) ?? {
      city: null,
      postalCode: null,
      gender: null,
      dob: null,
    };

    const weekStart = startOfISOWeek(d.createdAt);
    const { country, region, district, postalCode } = districtDimsForPatient(patient);
    const ageBand = ageBandFor(patient.dob, d.createdAt);
    const gender = patient.gender;

    if (!encounterDims.has(d.encounterId)) {
      encounterDims.set(d.encounterId, {
        weekStart,
        country,
        region,
        district,
        postalCode,
        ageBand,
        gender,
      });
    }

    const syndrome =
      d.syndrome && d.syndrome.length > 0
        ? d.syndrome
        : inferSyndromeFromIcd10(d.icd10) ?? 'other';

    const key = makeKey(
      weekStart,
      country,
      region,
      district,
      postalCode,
      syndrome,
      ageBand,
      gender,
    );

    let cell = cellMap.get(key);
    if (!cell) {
      cell = {
        weekStart,
        country,
        region,
        district,
        postalCode,
        syndrome,
        ageBand,
        gender,
        encounterCount: 0,
        finalDiagnosisCount: 0,
        ruledOutCount: 0,
        distinctPatients: 0,
        positiveLabCount: 0,
        alertCount: 0,
        softAlertCount: 0,
        hardAlertCount: 0,
        population: null,
        incidencePer100k: null,
        alertRatePer100k: null,
        riskScore: null,
        trendVsPrevWeek: null,
        zScore: null,
        meta: undefined,
        encounterIds: new Set<string>(),
        patientIds: new Set<string>(),
        vitalAbnormalEvents: 0,
        alertWeightedScore: 0,
      };
      cellMap.set(key, cell);
    }

    cell.encounterCount += 1;
    cell.encounterIds.add(d.encounterId);
    cell.patientIds.add(d.patientId);

    if (d.status === 'final') {
      cell.finalDiagnosisCount += 1;
    } else if (d.status === 'ruled_out') {
      cell.ruledOutCount += 1;
    }

    if (!encounterToCellKeys.has(d.encounterId)) {
      encounterToCellKeys.set(d.encounterId, new Set<string>());
    }
    encounterToCellKeys.get(d.encounterId)!.add(key);

    const patientWeekKey = `${d.patientId}|${weekStart.toISOString()}`;
    if (!patientWeekToCellKeys.has(patientWeekKey)) {
      patientWeekToCellKeys.set(patientWeekKey, new Set<string>());
    }
    patientWeekToCellKeys.get(patientWeekKey)!.add(key);
  }

  // 4) Labs in window for those encounters
  const labResults = await prisma.labResult.findMany({
    where: {
      encounterId: {
        in: Array.from(encounterIds),
      },
      createdAt: {
        gte: start,
        lt: end,
      },
    },
  });

  for (const lab of labResults) {
    const isPositive =
      lab.isPositive === true ||
      lab.flag === 'H' ||
      lab.flag === 'L' ||
      lab.flag === 'A';

    if (!isPositive) continue;

    const cellKeys = encounterToCellKeys.get(lab.encounterId);
    if (!cellKeys) continue;

    for (const key of cellKeys) {
      const cell = cellMap.get(key);
      if (!cell) continue;
      cell.positiveLabCount += 1;
    }
  }

  // 5) Vitals in window for those patients – risk booster
  const vitalSamples = await prisma.vitalSample.findMany({
    where: {
      patientId: {
        in: Array.from(patientIds),
      },
      t: {
        gte: start,
        lt: end,
      },
    },
  });

  for (const v of vitalSamples) {
    if (!isAbnormalVital(v)) continue;

    const weekStart = startOfISOWeek(v.t);
    const patientWeekKey = `${v.patientId}|${weekStart.toISOString()}`;
    const cellKeys = patientWeekToCellKeys.get(patientWeekKey);
    if (!cellKeys) continue;

    for (const key of cellKeys) {
      const cell = cellMap.get(key);
      if (!cell) continue;
      cell.vitalAbnormalEvents += 1;
    }
  }

  // 6) Runtime risk alerts → alertCount + soft/hard split + weighted score
  const alertEvents = await prisma.runtimeEvent.findMany({
    where: {
      kind: 'insight.alert.risk',
      ts: {
        gte: BigInt(start.getTime()),
        lt: BigInt(end.getTime()),
      },
    },
  });

  for (const ev of alertEvents) {
    const tsMs = Number(ev.ts);
    const evDate = new Date(tsMs);
    const evWeekStart = startOfISOWeek(evDate);

    const payload = parseRiskAlertPayload(ev.payload ?? null);
    const payloadSyndrome = payload?.syndrome?.toLowerCase?.();

    let cellKeys: Set<string> | undefined;

    // Prefer encounter mapping
    if (ev.encounterId && encounterToCellKeys.has(ev.encounterId)) {
      cellKeys = encounterToCellKeys.get(ev.encounterId);
    } else if (ev.patientId) {
      const patientWeekKey = `${ev.patientId}|${evWeekStart.toISOString()}`;
      cellKeys = patientWeekToCellKeys.get(patientWeekKey);
    }

    if (!cellKeys) continue;

    for (const key of cellKeys) {
      const cell = cellMap.get(key);
      if (!cell) continue;

      // If the alert explicitly targets a syndrome, only apply to matching cells.
      if (payloadSyndrome && cell.syndrome.toLowerCase() !== payloadSyndrome) {
        // NOTE: You could allow "general" / "systemicSepsis" to apply broadly
        // by relaxing this check, depending on how you want to visualise.
        continue;
      }

      const severityRaw = (ev.severity ?? 'moderate').toLowerCase() as InsightRiskAlertSeverity;
      const hard = isHardSeverity(severityRaw);

      cell.alertCount += 1;
      if (hard) cell.hardAlertCount += 1;
      else cell.softAlertCount += 1;

      // Weighting:
      //  - severity: low=1, moderate=2, high=3
      //  - score: 0–100 → 0–1 multiplier (default 1 if missing)
      let severityWeight = 1;
      if (severityRaw === 'moderate') severityWeight = 2;
      else if (severityRaw === 'high') severityWeight = 3;

      const rawScore = typeof payload?.score === 'number' ? payload.score : null;
      const scoreFactor =
        rawScore != null && rawScore >= 0
          ? Math.min(rawScore, 100) / 100
          : 1;

      cell.alertWeightedScore += severityWeight * scoreFactor;
    }
  }

  // 7) Population stats for incidence normalisation
  const year = start.getFullYear();
  const populationStats = await prisma.populationStat.findMany({
    where: {
      year,
    },
  });

  const popMap = new Map<string, { population: number }>();

  for (const p of populationStats) {
    const popKey = [
      p.country,
      p.region ?? '',
      p.district ?? '',
      p.postalCode ?? '',
    ].join('|');
    popMap.set(popKey, { population: p.population });
  }

  // 8) Finalise metrics & convert to plain HeatmapCell[]
  const result: HeatmapCell[] = [];

  for (const cell of cellMap.values()) {
    const {
      encounterIds: encSet,
      patientIds: patSet,
      vitalAbnormalEvents,
      alertWeightedScore,
      ...base
    } = cell;

    const distinctPatients = patSet.size;
    base.distinctPatients = distinctPatients;

    const popKey = [
      base.country,
      base.region ?? '',
      base.district ?? '',
      base.postalCode ?? '',
    ].join('|');

    const popEntry = popMap.get(popKey);
    if (popEntry) {
      base.population = popEntry.population;
      if (popEntry.population > 0) {
        base.incidencePer100k =
          (distinctPatients / popEntry.population) * 100_000;
        base.alertRatePer100k =
          (base.alertCount / popEntry.population) * 100_000;
      }
    }

    // --- Composite riskScore (tune to taste) ---
    const incidenceScore = base.incidencePer100k ?? 0;
    const labScore = base.positiveLabCount * 2;         // each positive lab
    const vitalScore = vitalAbnormalEvents * 0.5;       // each abnormal vital
    const softScore = base.softAlertCount * 3;          // soft alerts
    const hardScore = base.hardAlertCount * 7;          // hard alerts
    const weightedAlertScore = alertWeightedScore * 5;  // severity*score factor

    let rawScore =
      incidenceScore * 0.15 + // incidence as base context
      labScore +
      vitalScore +
      softScore +
      hardScore +
      weightedAlertScore;

    if (rawScore > 100) rawScore = 100;
    base.riskScore = rawScore;

    result.push({
      ...base,
      trendVsPrevWeek: base.trendVsPrevWeek ?? null,
      zScore: base.zScore ?? null,
    });
  }

  return result;
}
