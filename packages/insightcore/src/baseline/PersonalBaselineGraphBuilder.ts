import type { PersonalBaselineHistory } from './PersonalBaselineHistory';

export class PersonalBaselineGraphBuilder {
  build(history: PersonalBaselineHistory) {
    const lastPoints = history.points.slice(-50);

    const avg = (arr: number[]) =>
      arr.length ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2)) : null;

    const hr = avg(lastPoints.map(p => p.restingHr!).filter(Boolean));
    const sleep = avg(lastPoints.map(p => p.sleepHours!).filter(Boolean));
    const systolic = avg(lastPoints.map(p => p.systolic!).filter(Boolean));

    return {
      patientId: history.patientId,
      generatedAt: new Date().toISOString(),
      restingHrBaseline: hr,
      sleepBaseline: sleep,
      systolicBaseline: systolic,
    };
  }
}