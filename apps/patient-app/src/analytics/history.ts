// apps/patient-app/src/analytics/history.ts

/**
 * History persistence with browser fallback (localStorage)
 * and optional React Native AsyncStorage (only in RN runtime).
 */

async function getAsyncStorage() {
  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.product === 'ReactNative'
    ) {
      // 🚨 Use eval so bundler won't try to resolve this on web
      const pkg = '@react-native-async-storage/async-storage';
      const mod = await (eval(`import("${pkg}")`) as Promise<any>);
      return mod.default;
    }
  } catch (err) {
    console.warn('AsyncStorage not available (safe to ignore on web).');
  }
  return null;
}

export async function loadHistory(
  deviceId: string,
  modality: string,
  useAsyncStorage = false
): Promise<any[]> {
  try {
    const key = `history:${deviceId}:${modality}`;

    if (useAsyncStorage) {
      const AsyncStorage = await getAsyncStorage();
      if (AsyncStorage) {
        const raw = await AsyncStorage.getItem(key);
        return raw ? JSON.parse(raw) : [];
      }
    }

    // ✅ Browser fallback
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    }

    return [];
  } catch (e) {
    console.error('Failed to load history', e);
    return [];
  }
}

export async function saveHistory(
  deviceId: string,
  modality: string,
  data: any[],
  useAsyncStorage = false
) {
  try {
    const key = `history:${deviceId}:${modality}`;
    const raw = JSON.stringify(data);

    if (useAsyncStorage) {
      const AsyncStorage = await getAsyncStorage();
      if (AsyncStorage) {
        await AsyncStorage.setItem(key, raw);
        return;
      }
    }

    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, raw);
    }
  } catch (e) {
    console.error('Failed to save history', e);
  }
}
