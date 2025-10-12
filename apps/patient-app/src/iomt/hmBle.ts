import { DEVICE_MAP } from '@/src/devices/serviceMap';

type StartOpts = { roomId: string };
let aborter: AbortController | null = null;

export async function startHM({ roomId }: StartOpts) {
  const spec = DEVICE_MAP['duecare.health-monitor'];
  const filters = [{ services: spec.filters?.services || [] }];
  const device = await navigator.bluetooth.requestDevice({ filters, optionalServices: spec.filters?.services });

  const server = await device.gatt!.connect();
  // vendor PPG pleth (your map says FFF3)
  const ppgUuid = spec.characteristics?.spo2_wave?.uuid!;
  const svcHint = (spec.filters?.services || [])[0];
  const service = await server.getPrimaryService(svcHint);
  const char = await service.getCharacteristic(ppgUuid);

  aborter = new AbortController();
  await char.startNotifications();
  char.addEventListener('characteristicvaluechanged', (e: any) => {
    const dv: DataView = e.target.value;
    // Example decode: 16-bit little endian samples
    const len = dv.byteLength / 2;
    for (let i = 0; i < len; i++) {
      const raw = dv.getInt16(i * 2, true);
      const value = Math.max(0, raw); // clamp if needed
      // throttle to ~25 Hz equivalent: send every sample or downsample as you prefer
      fetch('/api/iomt/push', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ roomId, type: 'PPG', value, unit: 'a.u.' }),
        keepalive: true,
      }).catch(() => {});
    }
  }, { signal: aborter.signal });
}

export async function stopHM() {
  aborter?.abort(); aborter = null;
}
