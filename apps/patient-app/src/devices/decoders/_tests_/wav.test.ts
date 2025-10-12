// ============================================================================
// 5) PATH: apps/patient-app/src/devices/decoders/__tests__/wav.test.ts  (NEW)
// Run: pnpm --filter patient-app add -D jest ts-jest @types/jest
//      pnpm --filter patient-app jest --init  (or add config below)
// ============================================================================
import { buildWavMono16, WavRecorder } from '../wav';

describe('WAV builder', () => {
  it('emits a valid 16-bit mono WAV', () => {
    const s16 = new Int16Array([0, 32767, -32768, 1000, -1000]);
    const blob = buildWavMono16([{ ts: Date.now(), sampleRate: 8000, samples: s16 }], 8000);
    expect(blob.size).toBeGreaterThan(44);
  });

  it('recorder concatenates chunks', () => {
    const rec = new WavRecorder(8000);
    rec.push({ ts: 1, sampleRate: 8000, samples: new Int16Array([1,2,3]) });
    rec.push({ ts: 2, sampleRate: 8000, samples: new Int16Array([4,5]) });
    const wav = rec.flush();
    expect(wav.size).toBe(44 + (5 * 2));
  });
});
