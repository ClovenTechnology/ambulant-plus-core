// ===================================================================================
// (Optional) apps/patient-app/app/myCare/devices/ble-debug/page.tsx
// Minimal dynamic inspector (no hardcoded vendor UUIDs).
// ===================================================================================
'use client';

import { useState } from 'react';

export default function Page() {
  const [log, setLog] = useState<string[]>([]);
  const push = (s: string) => setLog((L) => [...L, s]);

  const scan = async () => {
    try {
      const dev = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          0x180F, 0x180A,
          '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
          '0000fee0-0000-1000-8000-00805f9b34fb',
        ],
      });
      push(`Connected ${dev.name || dev.id}`);
      const g = await dev.gatt!.connect();
      const svcs = await g.getPrimaryServices();
      push(`Primary services: ${svcs.length}`);
      for (const s of svcs) {
        push(`Service: ${s.uuid}`);
        const chs = await s.getCharacteristics();
        for (const c of chs) push(`  Char: ${c.uuid} props=${JSON.stringify({
          read: c.properties.read, write: c.properties.write, notify: c.properties.notify,
        })}`);
      }
    } catch (e: any) { push(`ERR: ${e?.message}`); }
  };

  return (
    <main className="p-4 text-xs">
      <button className="border rounded px-3 py-1" onClick={scan}>Scan</button>
      <pre className="mt-3 whitespace-pre-wrap">{log.join('\n')}</pre>
    </main>
  );
}
