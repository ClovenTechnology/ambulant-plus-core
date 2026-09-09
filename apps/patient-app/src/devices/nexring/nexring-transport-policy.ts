export type NexRingTransportKind = 'web' | 'native-android';

export type NexRingTransportEnvironment = {
  platform: string;
  isNativePlatform: boolean;
  nativePluginAvailable: boolean;
};

export function resolveNexRingTransport(
  environment: NexRingTransportEnvironment,
): NexRingTransportKind {
  const platform = String(environment.platform || '').trim().toLowerCase();

  if (platform === 'web') {
    return 'web';
  }

  if (platform === 'android') {
    if (!environment.isNativePlatform) {
      throw new Error('nexring_android_native_runtime_required');
    }

    if (!environment.nativePluginAvailable) {
      throw new Error('nexring_native_plugin_unavailable');
    }

    return 'native-android';
  }

  throw new Error(`nexring_unsupported_platform:${platform || 'unknown'}`);
}
