export class DeviceReliabilityRegistry {
  get(deviceClass?: string | null) {
    switch (deviceClass) {
      case 'multi_vital_monitor':
        return 0.94;
      case 'wearable_ring':
        return 0.82;
      default:
        return 0.72;
    }
  }
}