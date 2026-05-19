import type { ProvenanceContext } from '../contracts/provenance';
import type { VitalsSnapshot } from '../contracts';

export class AcquisitionContextResolver {
  resolve(args: {
    source: string;
    currentVitals: VitalsSnapshot;
  }): ProvenanceContext {
    const sourceDevice = args.currentVitals.sourceDevice?.toLowerCase() ?? '';

    const deviceClass =
      sourceDevice.includes('nexring')
        ? 'wearable_ring'
        : sourceDevice.includes('health')
          ? 'multi_vital_monitor'
          : sourceDevice || null;

    const sourcePriority =
      deviceClass === 'multi_vital_monitor'
        ? 95
        : deviceClass === 'wearable_ring'
          ? 75
          : args.source === 'vital'
            ? 80
            : 55;

    return {
      sourceType: args.source === 'vital' ? 'device_auto' : 'derived',
      deviceClass,
      sourcePriority,
      acquisitionContext: sourceDevice ? `captured_via_${sourceDevice}` : 'unspecified_capture',
      signalQuality: 0.78,
      knownBiasFlags: [],
    };
  }
}