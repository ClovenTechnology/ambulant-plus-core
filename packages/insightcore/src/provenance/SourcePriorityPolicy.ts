export class SourcePriorityPolicy {
  get(args: { deviceClass?: string | null; sourceType?: string | null }) {
    if (args.sourceType === 'clinician_measured') return 98;
    if (args.deviceClass === 'multi_vital_monitor') return 95;
    if (args.deviceClass === 'wearable_ring') return 78;
    return 60;
  }
}