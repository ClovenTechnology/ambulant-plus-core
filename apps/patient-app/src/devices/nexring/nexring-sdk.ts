/* eslint-disable @typescript-eslint/no-explicit-any */
// apps/patient-app/src/devices/nexring/nexring-sdk.ts

export type NexRingSdkAny = Record<string, any>;

declare const require: (moduleName: string) => any;

let cachedSdk: NexRingSdkAny | null = null;

function resolveSdkExport(mod: any): NexRingSdkAny {
  const sdk =
    mod?.default ??
    mod?.SDK ??
    mod?.ringSDK ??
    mod;

  if (!sdk || typeof sdk !== 'object') {
    throw new Error('Failed to load NexRing vendor SDK');
  }

  return sdk as NexRingSdkAny;
}

export async function loadNexRingSdk(): Promise<NexRingSdkAny> {
  if (cachedSdk) return cachedSdk;

  /**
   * The vendor SDK is a UMD/webpack bundle, not an ES module.
   * It assigns to module.exports when CommonJS globals are available,
   * so requiring it is safer than dynamic import() here.
   */
  const mod = await Promise.resolve().then(() =>
    require('../../../../../vendor/smart-ring-js-sdk/Smart Ring RN SDK_V1.3.7/lib/ringSDK.js')
  );

  cachedSdk = resolveSdkExport(mod);
  return cachedSdk;
}

export function getSdkDebugSummary(sdk: NexRingSdkAny) {
  const topKeys = safeKeys(sdk);
  const sendCmd = sdk?.SendCmd;
  const sendCmdKeys = safeKeys(sendCmd);

  const candidateCommandKeys = topKeys.filter((key) =>
    /(command|handler|sendcmd|historical|battery|deviceinfo|health|time|step|temp|exercise|sport|ppg)/i.test(
      key
    )
  );

  return {
    topKeys,
    sendCmdKeys,
    candidateCommandKeys,
    hasStartDetect:
      typeof sdk?.startDetect === 'function' ||
      typeof sdk?.StartDetect === 'function',
    hasPushRawData:
      typeof sdk?.pushRawData === 'function' ||
      typeof sdk?.PushRawData === 'function',
  };
}

export function getSendCmdMap(sdk: NexRingSdkAny): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const sendCmd = sdk?.SendCmd;

  if (!sendCmd || typeof sendCmd !== 'object') {
    return out;
  }

  for (const key of Object.keys(sendCmd)) {
    try {
      out[key] = sendCmd[key];
    } catch {
      out[key] = '[unreadable]';
    }
  }

  return out;
}

export function getExactCommandValue(
  sdk: NexRingSdkAny,
  names: string[]
): string | number | undefined {
  const sendCmd = sdk?.SendCmd;

  if (!sendCmd || typeof sendCmd !== 'object') {
    return undefined;
  }

  for (const name of names) {
    const value = sendCmd?.[name];

    if (typeof value === 'string' || typeof value === 'number') {
      return value;
    }
  }

  return undefined;
}

export function callAny<T = any>(
  sdk: NexRingSdkAny,
  names: string[],
  ...args: any[]
): T | undefined {
  for (const name of names) {
    const fn = sdk?.[name];

    if (typeof fn !== 'function') {
      continue;
    }

    try {
      return Reflect.apply(fn, sdk, args) as T;
    } catch (err) {
      console.warn(`[NexRing SDK] call ${name} failed`, err);

      try {
        return fn(...args) as T;
      } catch (err2) {
        console.warn(`[NexRing SDK] fallback call ${name} failed`, err2);
      }
    }
  }

  return undefined;
}

export function maybeRegisterListener(
  sdk: NexRingSdkAny,
  names: string[],
  cb: (...args: any[]) => void
): (() => void) | undefined {
  for (const name of names) {
    const fn = sdk?.[name];

    if (typeof fn !== 'function') {
      continue;
    }

    try {
      Reflect.apply(fn, sdk, [cb]);
    } catch {
      try {
        fn(cb);
      } catch {
        continue;
      }
    }

    return () => {
      const removeNames = [
        name.replace(/^register/i, 'unregister'),
        name.replace(/^set/i, 'clear'),
        name.replace(/^add/i, 'remove'),
        name.replace(/^register/i, 'unRegister'),
        name.replace(/^set/i, 'unRegister'),
      ];

      for (const removeName of removeNames) {
        const removeFn = sdk?.[removeName];

        if (typeof removeFn !== 'function') {
          continue;
        }

        try {
          Reflect.apply(removeFn, sdk, [cb]);
        } catch {
          try {
            removeFn(cb);
          } catch {
            // Ignore listener cleanup failures.
          }
        }

        return;
      }
    };
  }

  return undefined;
}

export function pushRawDataToSdk(sdk: NexRingSdkAny, bytes: Uint8Array): void {
  const fn =
    sdk?.pushRawData ??
    sdk?.PushRawData ??
    sdk?.handleRawData ??
    sdk?.onRawData;

  if (typeof fn !== 'function') {
    throw new Error('NexRing SDK does not expose pushRawData');
  }

  try {
    Reflect.apply(fn, sdk, [bytes]);
  } catch {
    fn(bytes);
  }
}

export function getMacFromAdvertising(
  sdk: NexRingSdkAny,
  advBytes: Uint8Array
): string | undefined {
  const result = callAny<string | undefined>(
    sdk,
    ['getMacFromAdvertising', 'GetMacFromAdvertising'],
    advBytes
  );

  return typeof result === 'string' && result ? result : undefined;
}

export function getBroadcastData(
  sdk: NexRingSdkAny,
  advBytes: Uint8Array
): unknown {
  return callAny(
    sdk,
    ['getBroadcastData', 'GetBroadcastData'],
    advBytes
  );
}

export function startDetectPacket(
  sdk: NexRingSdkAny,
  cmd: string | number,
  payload: number[] = []
): Uint8Array {
  const raw = callAny<any>(sdk, ['startDetect', 'StartDetect'], cmd, payload);

  if (!raw) {
    throw new Error(
      `NexRing SDK startDetect returned empty result for cmd=${String(cmd)}`
    );
  }

  if (raw instanceof Uint8Array) {
    return raw;
  }

  if (Array.isArray(raw)) {
    return Uint8Array.from(raw.map((value) => Number(value) & 0xff));
  }

  if (raw?.buffer instanceof ArrayBuffer) {
    return new Uint8Array(raw.buffer);
  }

  throw new Error('Unsupported startDetect return type');
}

function safeKeys(obj: any): string[] {
  if (!obj || typeof obj !== 'object') {
    return [];
  }

  try {
    return Object.keys(obj);
  } catch {
    return [];
  }
}