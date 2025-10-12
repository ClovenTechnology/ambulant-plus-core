// apps/patient-app/src/analytics/sleep.ts
// Sleep quality scoring from NexRing sleep stages + HRV

export type SleepStages = { rem: number; deep: number; light: number; awake: number };

export function computeSleepQuality(
  stages: SleepStages,
  hrv: number,
  efficiency: number
): { score: number; label: string } {
  const restorative = stages.deep * 2 + stages.rem * 1.5;
  const penalty = stages.awake * 1.2;
  let score = (restorative - penalty) / (stages.deep + stages.rem + stages.light + stages.awake);
  score = score * 100 * (hrv / 50) * efficiency;

  if (score > 80) return { score, label: 'Excellent' };
  if (score > 60) return { score, label: 'Good' };
  return { score, label: 'Poor' };
}
