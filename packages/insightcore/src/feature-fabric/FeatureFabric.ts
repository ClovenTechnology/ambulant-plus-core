import {
  EvidenceItem,
  FeatureVector,
  PatientContextWindow,
  VitalsSnapshot,
} from '../contracts';
import { AcquisitionContextResolver } from '../provenance/AcquisitionContextResolver';

export interface FeatureFabricInput {
  patientId: string;
  orgId?: string;
  currentVitals: VitalsSnapshot;
  previousVitals?: VitalsSnapshot | null;
  context: PatientContextWindow;
}

export class FeatureFabric {
  build(input: FeatureFabricInput): FeatureVector {
    const { patientId, orgId, currentVitals, previousVitals, context } = input;
    const evidence: EvidenceItem[] = [];

    const acquisitionResolver = new AcquisitionContextResolver();

    const addEvidence = (
      code: string,
      label: string,
      value: string | number | boolean | null | undefined,
      source: EvidenceItem['source'],
      unit?: string,
      weight?: number,
    ) => {
      if (value === undefined) return;
      evidence.push({
        code,
        label,
        value: value ?? null,
        source,
        unit,
        weight,
        observedAt: currentVitals.recordedAt ?? context.generatedAt,
        provenance: acquisitionResolver.resolve({
          source,
          currentVitals,
        }),
      });
    };

    const deltaHr =
      this.delta(currentVitals.hr, previousVitals?.hr) ??
      null;
    const deltaSpo2 =
      this.delta(currentVitals.spo2, previousVitals?.spo2) ??
      null;
    const deltaTempC =
      this.delta(currentVitals.tempC, previousVitals?.tempC) ??
      null;

    const tachycardia = typeof currentVitals.hr === 'number' && currentVitals.hr > 110;
    const lowSpo2 = typeof currentVitals.spo2 === 'number' && currentVitals.spo2 < 94;
    const fever = typeof currentVitals.tempC === 'number' && currentVitals.tempC >= 38;
    const bpElevated =
      typeof currentVitals.systolic === 'number' &&
      typeof currentVitals.diastolic === 'number' &&
      (currentVitals.systolic > 140 || currentVitals.diastolic > 90);

    const lowHydration =
      typeof context.lifestyle.hydrationGlassesPerDay === 'number' &&
      context.lifestyle.hydrationGlassesPerDay < 5;

    const poorSleep =
      typeof context.lifestyle.sleepHours === 'number' &&
      context.lifestyle.sleepHours < 6;

    const sedentary =
      (typeof context.lifestyle.avgStepsPerDay === 'number' &&
        context.lifestyle.avgStepsPerDay < 5000) ||
      (typeof context.lifestyle.activityMinutesPerWeek === 'number' &&
        context.lifestyle.activityMinutesPerWeek < 90);

    const highStress =
      typeof context.lifestyle.stressScore0to10 === 'number' &&
      context.lifestyle.stressScore0to10 >= 7;

    addEvidence('vital.hr', 'Heart rate', currentVitals.hr, 'vital', 'bpm', tachycardia ? 0.9 : 0.4);
    addEvidence('vital.spo2', 'Oxygen saturation', currentVitals.spo2, 'vital', '%', lowSpo2 ? 1 : 0.5);
    addEvidence('vital.temp', 'Temperature', currentVitals.tempC, 'vital', '°C', fever ? 0.8 : 0.3);
    addEvidence('vital.bp.sys', 'Systolic BP', currentVitals.systolic, 'vital', 'mmHg', bpElevated ? 0.8 : 0.3);
    addEvidence('vital.bp.dia', 'Diastolic BP', currentVitals.diastolic, 'vital', 'mmHg', bpElevated ? 0.7 : 0.3);
    addEvidence('adherence.medication', 'Medication adherence', context.lifestyle.medicationAdherencePct, 'adherence', '%', 0.75);
    addEvidence('behavior.sleep', 'Sleep duration', context.lifestyle.sleepHours, 'lifestyle', 'h', poorSleep ? 0.6 : 0.25);
    addEvidence('behavior.hydration', 'Hydration glasses/day', context.lifestyle.hydrationGlassesPerDay, 'lifestyle', 'glasses', lowHydration ? 0.45 : 0.2);
    addEvidence('behavior.stress', 'Stress score', context.lifestyle.stressScore0to10, 'lifestyle', '/10', highStress ? 0.55 : 0.2);

    for (const c of context.activeConditions) {
      addEvidence(`condition.${c}`, `Condition: ${c}`, true, 'condition', undefined, 0.65);
    }

    for (const a of context.allergies) {
      addEvidence(`allergy.${a}`, `Allergy: ${a}`, true, 'allergy', undefined, 0.4);
    }

    evidence.push(
      ...(Array.isArray(context.allergyProfiles)
        ? context.allergyProfiles.slice(0, 12).map((a: any) => ({
            code: `allergy.profile.${String(a.substance || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
            label: `Allergy profile: ${String(a.substance || 'Unknown')}`,
            value: a.reaction || a.severity || true,
            source: 'allergy' as const,
            observedAt: a.notedAt || undefined,
            weight:
              String(a.severity || '').toLowerCase() === 'severe'
                ? 0.78
                : String(a.severity || '').toLowerCase() === 'moderate'
                  ? 0.64
                  : 0.52,
          }))
        : []),
      ...(Array.isArray(context.allergyReactionLogs)
        ? context.allergyReactionLogs.slice(0, 12).map((r: any) => ({
            code: `allergy.reaction.${String(r.suspectedTrigger || 'unknown').toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
            label: `Allergy reaction log: ${String(r.suspectedTrigger || 'Unknown trigger')}`,
            value: r.severity || 'unknown',
            source: 'allergy' as const,
            observedAt: r.occurredAtISO || r.occurredAt || undefined,
            weight:
              String(r.severity || '').toLowerCase() === 'severe'
                ? 0.82
                : String(r.severity || '').toLowerCase() === 'moderate'
                  ? 0.68
                  : 0.54,
          }))
        : []),
    );

    for (const s of context.encounters.recentSymptoms) {
      addEvidence(`symptom.${s}`, `Recent symptom: ${s}`, true, 'encounter', undefined, 0.55);
    }

    for (const d of context.encounters.recentDiagnoses) {
      addEvidence(`diagnosis.${d}`, `Recent diagnosis: ${d}`, true, 'encounter', undefined, 0.7);
    }

    for (const p of context.encounters.recentProcedureTypes) {
      addEvidence(`procedure.${p}`, `Recent procedure: ${p}`, true, 'encounter', undefined, 0.7);
    }

    for (const v of context.vaccinationsRecent30d) {
      addEvidence(`vaccination.${v}`, `Recent vaccination: ${v}`, true, 'vaccination', undefined, 0.45);
    }

    if (context.domain.antenatal?.highRiskPregnancy) {
      addEvidence('antenatal.highRisk', 'High-risk pregnancy', true, 'antenatal', undefined, 0.85);
    }

    if (context.domain.antenatal?.recentEmergencyFlag) {
      addEvidence('antenatal.emergency', 'Recent antenatal emergency flag', true, 'antenatal', undefined, 0.95);
    }

    if (context.domain.ladyCenter?.fertilityWindow) {
      addEvidence('ladycenter.fertilityWindow', 'In fertility window', true, 'fertility', undefined, 0.25);
    }

    return {
      patientId,
      orgId,
      generatedAt: context.generatedAt,
      hr: currentVitals.hr ?? null,
      spo2: currentVitals.spo2 ?? null,
      tempC: currentVitals.tempC ?? null,
      systolic: currentVitals.systolic ?? null,
      diastolic: currentVitals.diastolic ?? null,
      respiratoryRate: currentVitals.respiratoryRate ?? null,
      glucoseInstabilityScore: currentVitals.glucoseInstabilityScore ?? null,
      hrv: currentVitals.hrv ?? null,

      deltaHr,
      deltaSpo2,
      deltaTempC,

      bpElevated,
      lowSpo2,
      tachycardia,
      fever,

      medicationAdherencePct: context.lifestyle.medicationAdherencePct ?? null,
      missedMedicationCount7d: context.medication.missedMedicationCount7d ?? null,
      lowHydration,
      poorSleep,
      sedentary,
      highStress,

      activeConditions: context.activeConditions,
      allergies: context.allergies,
      allergyProfiles: context.allergyProfiles || [],
      allergyReactionLogs: context.allergyReactionLogs || [],
      recentDiagnoses: context.encounters.recentDiagnoses,
      recentSymptoms: context.encounters.recentSymptoms,
      recentProcedureTypes: context.encounters.recentProcedureTypes,
      recentSideEffects: context.medication.recentSideEffects,
      recentVaccinations: context.vaccinationsRecent30d,
      clinicalPhase: context.clinicalPhase,

      pregnancyHighRisk: context.domain.antenatal?.highRiskPregnancy ?? false,
      postpartumRecent: context.clinicalPhase === 'post_partum',
      recentEmergencyFlag: context.domain.antenatal?.recentEmergencyFlag ?? false,
      fertilityWindow: context.domain.ladyCenter?.fertilityWindow ?? false,

      evidence,
    };
  }

  private delta(current?: number | null, previous?: number | null): number | undefined {
    if (typeof current !== 'number' || typeof previous !== 'number') return undefined;
    return Number((current - previous).toFixed(2));
  }
}