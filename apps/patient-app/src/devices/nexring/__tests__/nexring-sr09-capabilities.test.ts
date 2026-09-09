import {
  buildSr09SportParameters,
  capabilitiesForModel,
  detectNexRingModel,
} from '../nexring-capabilities';

describe('NexRing SR09 capability truth', () => {
  it('detects SR09 by advertised name', () => {
    expect(detectNexRingModel({ id: 'x', name: 'SR09_93B7' }, null)).toBe('sr09');
  });

  it('keeps SR09 legacy sport separate from SR28 advanced exercise', () => {
    const sr09 = capabilitiesForModel('sr09');
    expect(sr09.legacySport).toBe(true);
    expect(sr09.pauseContinue).toBe(false);
    expect(sr09.mindfulness).toBe(false);

    const sr28 = capabilitiesForModel('sr28');
    expect(sr28.legacySport).toBe(false);
    expect(sr28.pauseContinue).toBe(true);
    expect(sr28.mindfulness).toBe(true);
  });

  it('uses the vendor SR09 object field names and limits', () => {
    expect(buildSr09SportParameters({ switch: 1, mode: 1, timeInterval: 10, duration: 5 }))
      .toEqual({ switch: 1, timeInterval: 10, duration: 5, mode: 1 });
    expect(buildSr09SportParameters({ switch: 0 }))
      .toEqual({ switch: 0, timeInterval: 0, duration: 0, mode: 0 });
    expect(() => buildSr09SportParameters({ switch: 1, mode: 1, timeInterval: 9, duration: 5 }))
      .toThrow();
    expect(() => buildSr09SportParameters({ switch: 1, mode: 1, timeInterval: 10, duration: 181 }))
      .toThrow();
  });
});
