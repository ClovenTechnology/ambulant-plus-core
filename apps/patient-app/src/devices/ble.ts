// apps/patient-app/src/devices/ble.ts
// Thin Web Bluetooth helper + smart subscribe router for multiplexed vendor streams.

import { DEVICE_MAP, DeviceKey } from './serviceMap';

export type BleConn = {
  device: BluetoothDevice;
  server: BluetoothRemoteGATTServer;
  services: Map<string, BluetoothRemoteGATTService>;
  chars: Map<string, BluetoothRemoteGATTCharacteristic>;
  stopAll: () => Promise<void>;
  write: (charKey: string, data: Uint8Array) => Promise<void>;
};

export async function connectBle(key: DeviceKey): Promise<BleConn> {
  const spec = DEVICE_MAP[key];
  if (!spec || spec.transport !== 'ble') throw new Error('Not a BLE device');

  const filters: BluetoothRequestDeviceFilter[] = [];
  if (spec.filters?.namePrefix?.length) {
    for (const p of spec.filters.namePrefix) filters.push({ namePrefix: p });
  }
  const optionalServices = spec.filters?.services ?? [];

  const device = await navigator.bluetooth.requestDevice({
    filters: filters.length ? filters : undefined,
    optionalServices,
    acceptAllDevices: filters.length === 0,
  });

  const server = await device.gatt!.connect();
  const services = new Map<string, BluetoothRemoteGATTService>();
  for (const sid of optionalServices) {
    try { services.set(sid, await server.getPrimaryService(sid)); } catch {}
  }

  const chars = new Map<string, BluetoothRemoteGATTCharacteristic>();
  if (spec.characteristics) {
    for (const [k, c] of Object.entries(spec.characteristics)) {
      let found: BluetoothRemoteGATTCharacteristic | null = null;
      for (const svc of services.values()) {
        try {
          const ch = await svc.getCharacteristic(c.uuid);
          if (ch) { found = ch; break; }
        } catch {}
      }
      if (found) chars.set(k, found);
    }
  }

  const stopAll = async () => {
    try {
      // best-effort: stop notifications on all chars we started
      for (const ch of chars.values()) {
        try { await ch.stopNotifications(); } catch {}
      }
    } catch {}
    try { device.gatt?.disconnect(); } catch {}
  };

  const write = async (charKey: string, data: Uint8Array) => {
    const ch = chars.get(charKey);
    if (!ch) throw new Error(`Char not found: ${charKey}`);
    // prefer writeWithoutResponse, fall back to writeValue
    if ('writeValueWithoutResponse' in ch) {
      // @ts-ignore
      await ch.writeValueWithoutResponse?.(data);
    } else {
      await ch.writeValue?.(data);
    }
  };

  return { device, server, services, chars, stopAll, write };
}

/** -----------------------------
 *  Smart subscribe “router”
 *  -----------------------------
 *  - If the requested charKey exists directly, subscribe to it (your original behavior).
 *  - Otherwise, if a multiplexed stream (vendor_notify) exists, subscribe once and demux:
 *      · infer logical packet type using simple heuristics (ranges/lengths)
 *      · also synthesize HR updates from BP/SpO₂ frames when available
 *  - Returns an unsubscribe() like before.
 */
export async function subscribe(
  conn: BleConn,
  charKey: string,
  onValue: (data: DataView) => void
): Promise<() => void> {
  const direct = conn.chars.get(charKey);
  if (direct) {
    await direct.startNotifications();
    const handler = (e: Event) => {
      const dv = (e.target as BluetoothRemoteGATTCharacteristic).value!;
      onValue(dv);
    };
    direct.addEventListener('characteristicvaluechanged', handler as any);
    return () => direct.removeEventListener('characteristicvaluechanged', handler as any);
  }

  // Fallback to vendor multiplexed stream
  const mux = conn.chars.get('vendor_notify');
  if (!mux) throw new Error(`Char not found: ${charKey}`);

  await mux.startNotifications();

  const listeners = new Map<string, (dv: DataView) => void>();
  // Register the requested logical key
  listeners.set(charKey, onValue);

  const handler = (e: Event) => {
    const dv = (e.target as BluetoothRemoteGATTCharacteristic).value!;
    const u8 = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);

    const len = u8.length;

    // ---------- tiny helpers (inline) ----------
    const within = (v: number, lo: number, hi: number) => v >= lo && v <= hi;
    const isMostlyAscii = (arr: Uint8Array) => {
      let printable = 0;
      for (let i=0;i<arr.length;i++) {
        const c = arr[i];
        if (c === 9 || c === 10 || c === 13 || (c >= 32 && c < 127)) printable++;
      }
      return printable / (arr.length || 1) > 0.8;
    };
    // synthesize a minimal Heart Rate Measurement (0x2A37-like) packet: [flags=0x00, hr8]
    const emitSyntheticHR = (hr: number) => {
      if (!listeners.has('hr')) return;
      const pkt = new Uint8Array([0x00, Math.max(0, Math.min(255, Math.round(hr)))]);
      listeners.get('hr')!(new DataView(pkt.buffer));
    };

    // 1) ECG/PPG waveform: lots of bytes, even length; forward to both if present.
    const looksLikeWave = len >= 20 && (len % 2 === 0);
    if (looksLikeWave) {
      if (listeners.has('ecg_wave')) listeners.get('ecg_wave')!(dv);
      if (listeners.has('spo2_wave')) listeners.get('spo2_wave')!(dv);
      return;
    }

    // 2) HR (0x2A37-ish): flags + 8/16-bit HR
    if (len >= 2) {
      const flags = u8[0];
      const is16 = (flags & 0x01) === 0x01;
      const hr = is16 && len >= 3 ? (u8[1] | (u8[2] << 8)) : u8[1];
      if (hr >= 30 && hr <= 230) {
        if (listeners.has('hr')) listeners.get('hr')!(dv);
        // fall through: other parsers might also consume this dv
      }
    }

    // 3) Blood pressure: sys/dia/pulse in plausible ranges → also synthesize HR from pulse
    if (len >= 5) {
      const sys = u8[0] | (u8[1] << 8);
      const dia = u8[2] | (u8[3] << 8);
      const pulse = u8[4];
      if (within(sys, 60, 260) && within(dia, 30, 200) && within(pulse, 30, 220)) {
        if (listeners.has('bp')) listeners.get('bp')!(dv);
        // NEW: emit HR from pulse
        emitSyntheticHR(pulse);
        return;
      }
    }
    if (len >= 4) {
      const sys = u8[0] | (u8[1] << 8);
      const dia = u8[2] | (u8[3] << 8);
      if (within(sys, 60, 260) && within(dia, 30, 200)) {
        if (listeners.has('bp')) listeners.get('bp')!(dv);
        return;
      }
    }

    // 4) Temperature: float32 (20–50°C) or uint16 scaled
    if (len >= 4) {
      const f32 = new DataView(u8.buffer, u8.byteOffset, u8.byteLength).getFloat32(0, true);
      if (f32 > 20 && f32 < 50) {
        if (listeners.has('temp')) listeners.get('temp')!(dv);
        return;
      }
    }
    if (len >= 2) {
      const n = u8[0] | (u8[1] << 8);
      if ((n > 2000 && n < 5000) || (n > 200 && n < 500)) {
        if (listeners.has('temp')) listeners.get('temp')!(dv);
        return;
      }
    }

    // 5) Glucose: float/uint/ascii heuristics
    if (len >= 4) {
      const f = new DataView(u8.buffer, u8.byteOffset, u8.byteLength).getFloat32(0, true);
      if (f >= 1 && f <= 40) {
        if (listeners.has('glucose')) listeners.get('glucose')!(dv);
        return;
      }
    }
    if (len >= 2) {
      const n = u8[0] | (u8[1] << 8);
      if (n >= 40 && n <= 600) {
        if (listeners.has('glucose')) listeners.get('glucose')!(dv);
        return;
      }
    }

    // 6) ASCII fallbacks (often for SpO₂ vendor UART)
    if (len && isMostlyAscii(u8)) {
      let ascii = '';
      try { ascii = new TextDecoder().decode(u8).trim(); } catch {}

      if (ascii) {
        // SpO2-ish: "SpO2:97", "97%", "SPO2,97,HR,75", "SPO2=98 HR=72"
        const spo2Hit =
          /spo2/i.test(ascii) ||
          /\b\d{2}\s?%/.test(ascii) ||
          /^(9[0-9]|8[5-9])$/.test(ascii);

        if (spo2Hit) {
          if (listeners.has('spo2_wave')) listeners.get('spo2_wave')!(dv);

          // NEW: try to extract HR from the same ASCII line and synthesize HR packet
          // patterns: "HR,75" | "HR=75" | ",75" after SpO2 or "... HR 75"
          const hrMatch =
            /HR[^0-9]{0,3}(\d{2,3})/i.exec(ascii) ||
            /,\s*\d{2,3}(?!.*%)/.exec(ascii); // last plain number after comma (best-effort)

          if (hrMatch) {
            const hr = parseInt(hrMatch[1] || hrMatch[0].replace(',', '').trim(), 10);
            if (Number.isFinite(hr) && hr >= 30 && hr <= 230) emitSyntheticHR(hr);
          }
          return;
        }

        // Generic UART stream if caller asked for it
        if (listeners.has('uart')) listeners.get('uart')!(dv);
        return;
      }
    }
  };

  mux.addEventListener('characteristicvaluechanged', handler as any);

  return () => {
    try { mux.removeEventListener('characteristicvaluechanged', handler as any); } catch {}
  };
}
