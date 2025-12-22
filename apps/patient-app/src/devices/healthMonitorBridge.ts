// apps/patient-app/src/devices/healthMonitorBridge.ts
'use client';

import { connectBle, subscribe, BleConn } from './ble';
import { DEVICE_MAP } from './serviceMap';
import {
  parseHRMeasurement, parseBPMeasurement, parseVendorTemp, parseVendorGlucose,
  parseECGWave, parsePPGWave, autodetectECGorPPG
} from './parsers';

type VitalEmitter = (opts: {
  type: string;
  payload: any;
  deviceId?: string;
  recorded_at?: string;
  meta?: any;
  dedupeKey?: string;
}) => Promise<void>;

type BridgeOpts = {
  patientId: string;
  emitVital: VitalEmitter;
  onStatus?: (s: { connected: boolean; batteryPct?: number | null; rssi?: number | null }) => void;
  // Optional control override per-firmware (e.g., longer frames)
  ctrlOverride?: { start?: Uint8Array; stop?: Uint8Array };
};

const DEVICE_ID = 'duecare.health-monitor';

// Defaults observed on multiple Linktop firmwares
const DEFAULT_START = new Uint8Array([0x01]);
const DEFAULT_STOP  = new Uint8Array([0x02]);

export class HealthMonitorBridge {
  private conn: BleConn | null = null;
  private unsub: Array<() => void> = [];
  private opts!: BridgeOpts;
  private ctrlStart: Uint8Array = DEFAULT_START;
  private ctrlStop: Uint8Array = DEFAULT_STOP;

  async connect(opts: BridgeOpts) {
    this.opts = opts;
    this.ctrlStart = opts.ctrlOverride?.start ?? DEFAULT_START;
    this.ctrlStop  = opts.ctrlOverride?.stop ?? DEFAULT_STOP;

    this.conn = await connectBle(DEVICE_ID);

    // Battery (read once if available)
    try {
      const battChar = this.conn.chars.get('batt');
      let pct: number | null = null;
      if (battChar) {
        const v = await battChar.readValue();
        pct = v.getUint8(0);
      }
      this.telemetry({ connected: true, batteryPct: pct, rssi: null });
    } catch {
      this.telemetry({ connected: true, batteryPct: null, rssi: null });
    }

    // Subscribe optional SIG HR (some OEM builds also broadcast this)
    if (this.conn.chars.get('hr')) {
      this.unsub.push(await subscribe(this.conn, 'hr', async (dv) => {
        const p = parseHRMeasurement(dv);
        if (!p) return;
        await this.opts.emitVital({
          type: 'heart_rate',
          recorded_at: new Date().toISOString(),
          deviceId: DEVICE_ID,
          payload: { hr: p.hr, unit: 'bpm' },
          meta: { contactDetected: p.contactDetected, energyExpended: p.energyExpended, source: 'ble' },
          dedupeKey: 'hr',
        });
      }));
    }

    // Subscribe optional SIG BP spot
    if (this.conn.chars.get('bp')) {
      this.unsub.push(await subscribe(this.conn, 'bp', async (dv) => {
        const p = parseBPMeasurement(dv);
        if (!p) return;
        await this.opts.emitVital({
          type: 'blood_pressure',
          recorded_at: new Date().toISOString(),
          deviceId: DEVICE_ID,
          payload: { systolic: p.systolic, diastolic: p.diastolic, unit: p.unit },
          meta: { source: 'ble' },
          dedupeKey: 'bp',
        });
      }));
    }

    // Subscribe thermometer confirm (optional)
    if (this.conn.chars.get('therm_confirm')) {
      this.unsub.push(await subscribe(this.conn, 'therm_confirm', async (_dv) => {
        // Some firmwares emit a short confirm packet here before temp frames
        // No-op; kept for debugging/logging if needed
      }));
    }

    // Fallback spot notifies for temp/glucose if present on your HW
    if (this.conn.chars.get('temp')) {
      this.unsub.push(await subscribe(this.conn, 'temp', async (dv) => {
        const p = parseVendorTemp(dv);
        if (!p) return;
        await this.opts.emitVital({
          type: 'temperature',
          recorded_at: new Date().toISOString(),
          deviceId: DEVICE_ID,
          payload: { celsius: p.celsius, fahrenheit: p.fahrenheit, unit: 'C' },
          meta: { source: 'ble' },
        });
      }));
    }
    if (this.conn.chars.get('glucose')) {
      this.unsub.push(await subscribe(this.conn, 'glucose', async (dv) => {
        const p = parseVendorGlucose(dv);
        if (!p) return;
        await this.opts.emitVital({
          type: 'blood_glucose',
          recorded_at: new Date().toISOString(),
          deviceId: DEVICE_ID,
          payload: { glucose: p.glucose, unit: p.unit },
          meta: { source: 'ble' },
        });
      }));
    }

    // ---------- Single vendor notify stream (multiplexed) ----------
    if (this.conn.chars.get('vendor_notify')) {
      this.unsub.push(await subscribe(this.conn, 'vendor_notify', async (dv) => {
        // Some firmwares prepend a type byte; keep heuristic resilient:
        let view = dv;
        if (dv.byteLength > 4) {
          // If first byte looks like a small tag and the rest is plausible data, trim it
          const first = dv.getUint8(0);
          const restLen = dv.byteLength - 1;
          const divisible = (restLen % 2 === 0) || (restLen % 3 === 0);
          if (first <= 0x0F && divisible) {
            view = new DataView(dv.buffer, dv.byteOffset + 1, dv.byteLength - 1);
          }
        }

        const guess = autodetectECGorPPG(view);
        if (!guess) return;

        if (guess.kind === 'ecg') {
          window.dispatchEvent(new CustomEvent('iomt:ecg', { detail: guess.chunk }));
        } else if (guess.kind === 'ppg') {
          window.dispatchEvent(new CustomEvent('iomt:ppg', { detail: guess.chunk }));
        }
      }));
    }

    // Let the app know device appeared (pills etc.)
    this.telemetry({ connected: true });
  }

  async startStreaming() {
    const ctrl = this.conn?.chars.get('vendor_ctrl');
    if (!ctrl) return;
    await this.conn!.write('vendor_ctrl', this.ctrlStart);
  }

  async stopStreaming() {
    const ctrl = this.conn?.chars.get('vendor_ctrl');
    if (!ctrl) return;
    await this.conn!.write('vendor_ctrl', this.ctrlStop);
  }

  setControlBytes(start?: Uint8Array, stop?: Uint8Array) {
    if (start) this.ctrlStart = start;
    if (stop)  this.ctrlStop  = stop;
  }

  async disconnect() {
    for (const u of this.unsub.splice(0)) { try { u(); } catch {} }
    try { await this.conn?.stopAll(); } catch {}
    this.telemetry({ connected: false });
    this.conn = null;
  }

  private telemetry(patch: { connected?: boolean; batteryPct?: number | null; rssi?: number | null }) {
    const detail = {
      id: 'duecare-health-monitor',
      name: 'HealthMonitor-001',
      transport: 'ble' as const,
      connected: patch.connected ?? true,
      batteryPct: patch.batteryPct ?? null,
      rssi: patch.rssi ?? null,
    };
    window.dispatchEvent(new CustomEvent('iomt:telemetry', { detail }));
    this.opts?.onStatus?.(detail);
  }
}
