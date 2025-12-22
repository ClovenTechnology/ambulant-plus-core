// apps/patient-app/src/analytics/history.ts
/**
 * History persistence with browser fallback (localStorage)
 * and optional React Native AsyncStorage (only in RN runtime).
 *
 * Added helper: appendHistory(deviceId, modality, record) — keeps a timestamped list.
 */

async function getAsyncStorage() {
  try {
    if (typeof navigator !== 'undefined' && (navigator as any).product === 'ReactNative') {
      // Use dynamic import to avoid bundler resolution on web builds
      const pkg = '@react-native-async-storage/async-storage';
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = await (eval(`import("${pkg}")`) as Promise<any>);
      return mod?.default ?? null;
    }
  } catch (err) {
    // safe to ignore on web
    // eslint-disable-next-line no-console
    console.warn('AsyncStorage not available (safe to ignore on web).', err);
  }
  return null;
}

/**
 * Load history for a given deviceId & modality (e.g., deviceId='duecare.nexring', modality='vitals')
 */
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

    // Browser fallback
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    }

    return [];
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Failed to load history', e);
    return [];
  }
}

/**
 * Save full history array for given deviceId & modality
 */
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
    // eslint-disable-next-line no-console
    console.error('Failed to save history', e);
  }
}

/**
 * appendHistory(deviceId, modality, record)
 * - Loads existing history
 * - Appends the provided record (automatically adds timestamp if missing)
 * - Trims to a reasonable cap (e.g., last 365 entries) to avoid unbounded growth
 * - Persists back to storage
 *
 * Record shape is flexible; recommended form:
 * { timestamp: ISOString, data: {...} }
 */
export async function appendHistory(
  deviceId: string,
  modality: string,
  record: any,
  useAsyncStorage = false,
  maxEntries = 365
) {
  try {
    const key = `history:${deviceId}:${modality}`;
    const existing = (await loadHistory(deviceId, modality, useAsyncStorage)) || [];
    const rec = {
      timestamp: record?.timestamp ?? new Date().toISOString(),
      data: record?.data ?? record ?? {},
    };
    existing.push(rec);
    // keep latest maxEntries
    const trimmed = existing.slice(-maxEntries);
    await saveHistory(deviceId, modality, trimmed, useAsyncStorage);
    return trimmed;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Failed to append history', e);
    return null;
  }
}
