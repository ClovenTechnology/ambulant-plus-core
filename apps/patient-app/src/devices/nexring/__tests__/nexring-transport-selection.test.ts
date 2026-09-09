import { resolveNexRingTransport } from '../nexring-transport-policy';

describe('resolveNexRingTransport', () => {
  it('uses Web Bluetooth in an ordinary browser', () => {
    expect(
      resolveNexRingTransport({
        platform: 'web',
        isNativePlatform: false,
        nativePluginAvailable: false,
      }),
    ).toBe('web');
  });

  it('uses the native Capacitor bridge on Android', () => {
    expect(
      resolveNexRingTransport({
        platform: 'android',
        isNativePlatform: true,
        nativePluginAvailable: true,
      }),
    ).toBe('native-android');
  });

  it('does not silently fall back to Web Bluetooth when the Android plugin is missing', () => {
    expect(() =>
      resolveNexRingTransport({
        platform: 'android',
        isNativePlatform: true,
        nativePluginAvailable: false,
      }),
    ).toThrow('nexring_native_plugin_unavailable');
  });

  it('rejects a fake Android web runtime', () => {
    expect(() =>
      resolveNexRingTransport({
        platform: 'android',
        isNativePlatform: false,
        nativePluginAvailable: true,
      }),
    ).toThrow('nexring_android_native_runtime_required');
  });

  it('rejects unsupported native platforms until they have an explicit transport', () => {
    expect(() =>
      resolveNexRingTransport({
        platform: 'ios',
        isNativePlatform: true,
        nativePluginAvailable: false,
      }),
    ).toThrow('nexring_unsupported_platform:ios');
  });
});
