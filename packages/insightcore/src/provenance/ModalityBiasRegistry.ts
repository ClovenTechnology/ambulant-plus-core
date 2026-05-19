export class ModalityBiasRegistry {
  get(deviceClass?: string | null) {
    if (deviceClass === 'wearable_ring') {
      return ['motion_artifact_risk'];
    }
    if (deviceClass === 'multi_vital_monitor') {
      return [];
    }
    return ['unknown_device_bias_profile'];
  }
}