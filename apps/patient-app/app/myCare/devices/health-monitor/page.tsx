'use client';
import { useState } from 'react';

export default function HealthMonitorConsole(){
  const [log, setLog] = useState<string[]>([]);
  const [device, setDevice] = useState<BluetoothDevice|null>(null);
  const push = (s:string)=>setLog(x=>[s,...x].slice(0,300));

  async function connect() {
    const dev = await navigator.bluetooth.requestDevice({
      filters: [{ services: ['0000180d-0000-1000-8000-00805f9b34fb'] }],
      optionalServices: ['00001810-0000-1000-8000-00805f9b34fb','0000180f-0000-1000-8000-00805f9b34fb']
    });
    setDevice(dev);
    const gatt = await dev.gatt!.connect();
    const hrSvc = await gatt.getPrimaryService('0000180d-0000-1000-8000-00805f9b34fb');
    const hrChar = await hrSvc.getCharacteristic('00002a37-0000-1000-8000-00805f9b34fb');
    hrChar.addEventListener('characteristicvaluechanged', (e: any) => {
      const dv = e.target.value as DataView;
      const hr = dv.getUint8(1);
      push(`HR=${hr} bpm`);
    });
    await hrChar.startNotifications();
    push('Connected + HR notify');
  }

  async function disconnect() {
    try { await device?.gatt?.disconnect(); } catch {}
    push('Disconnected');
  }

  return (
    <main className="p-6 space-y-3">
      <h1 className="text-xl font-semibold">Health Monitor</h1>
      <div className="flex gap-2">
        <button onClick={connect} className="px-3 py-1 border rounded bg-white">Connect HR</button>
        <button onClick={disconnect} className="px-3 py-1 border rounded bg-white">Disconnect</button>
      </div>
      <div className="bg-white border rounded p-3 text-sm h-64 overflow-auto whitespace-pre-wrap">
        {log.join('\n') || 'No data yet.'}
      </div>
    </main>
  );
}