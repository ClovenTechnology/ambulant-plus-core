import { normalizeSleepMetric } from '../nexring-normalizer';

describe('NexRing SR09 legacy sleep truth', () => {
  it('does not count awake time as true asleep time', () => {
    const metric = normalizeSleepMetric({
      startTime: 1_700_000_000,
      endTime: 1_700_028_800,
      remMinutes: 90,
      deepMinutes: 80,
      lightMinutes: 250,
      awakeMinutes: 60,
    });
    expect(metric.asleepMinutes).toBe(420);
    expect(metric.totalMinutes).toBe(420);
    expect(metric.timeInBedMinutes).toBe(480);
  });
});
