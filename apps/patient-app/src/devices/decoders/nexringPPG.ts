// ===================================================================================
// apps/patient-app/src/devices/decoders/nexringPPG.ts
// PPG Uint16 stream (FEE0/FEE2). Sends frames to InsightCore.
// ===================================================================================

import { API } from '@/src/lib/config';

const FEE0 = '0000fee0-0000-1000-8000-00805f9b34fb';
const FEE2 = '0000fee2-0000-1000-8000-00805f9b34fb';

export type PpgFrame = {
  ts: number;
  cadenceHz: number;
  samples: Uint16Array;
};

export type NexRingPPGConnection = {
  device: BluetoothDevice;
  disconnect: () => Promise<void>;
};

function getBluetooth(): Bluetooth {
  if (typeof navigator === 'undefined' || !navigator.bluetooth) {
    throw new Error(
      'Web Bluetooth is not available in this browser. Use Chrome or Edge over HTTPS or localhost.'
    );
  }

  return navigator.bluetooth;
}

function dataViewToUint16Array(dv: DataView): Uint16Array {
  const u8 = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
  const evenLength = u8.length & ~1;
  const samples = new Uint16Array(evenLength / 2);

  for (let i = 0; i < evenLength; i += 2) {
    samples[i >> 1] = u8[i] | (u8[i + 1] << 8);
  }

  return samples;
}

function uint16ArrayToBase64(samples: Uint16Array): string {
  const bytes = new Uint8Array(
    samples.buffer,
    samples.byteOffset,
    samples.byteLength
  );

  let binary = '';

  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }

  return window.btoa(binary);
}

async function sendInsightFrame(frame: PpgFrame, roomId: string): Promise<void> {
  const payloadB64 = uint16ArrayToBase64(frame.samples);

  await fetch(`${API}/api/insight/frame`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      kind: 'ppg_u16',
      cadenceHz: frame.cadenceHz,
      ts: frame.ts,
      roomId,
      payloadB64,
    }),
  });
}

export async function connectNexRingPPG(
  onFrame: (frame: PpgFrame) => void,
  roomId?: string
): Promise<NexRingPPGConnection> {
  const bluetooth = getBluetooth();

  const device = await bluetooth.requestDevice({
    filters: [{ services: [FEE0] }, { namePrefix: 'NexRing' }],
    optionalServices: [FEE0, 0x180d, 0x180a],
  });

  if (!device.gatt) {
    throw new Error('Selected NexRing device has no GATT server.');
  }

  const server = await device.gatt.connect();
  const service = await server.getPrimaryService(FEE0);
  const ppgCharacteristic = await service.getCharacteristic(FEE2);

  const handler: EventListener = (event) => {
    const value = (event.target as BluetoothRemoteGATTCharacteristic | null)?.value;

    if (!value) return;

    const samples = dataViewToUint16Array(value);

    const frame: PpgFrame = {
      ts: Date.now(),
      cadenceHz: 50,
      samples,
    };

    onFrame(frame);

    if (roomId) {
      sendInsightFrame(frame, roomId).catch(() => {
        // Do not interrupt live PPG streaming if telemetry upload fails.
      });
    }
  };

  ppgCharacteristic.addEventListener('characteristicvaluechanged', handler);
  await ppgCharacteristic.startNotifications();

  return {
    device,
    disconnect: async (): Promise<void> => {
      try {
        await ppgCharacteristic.stopNotifications();
      } catch {
        // Ignore notification shutdown failures.
      }

      try {
        ppgCharacteristic.removeEventListener('characteristicvaluechanged', handler);
      } catch {
        // Ignore listener cleanup failures.
      }

      try {
        server.disconnect();
      } catch {
        // Ignore disconnect failures.
      }
    },
  };
}