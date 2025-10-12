'use client';
import { useState } from 'react';

export default function NexRingConsole() {
  const [device, setDevice] = useState<BluetoothDevice|null>(null);
  const [msgs, setMsgs] = useState<string[]>([]);
  const log = (s:string)=>setMsgs(x=>[s,...x].slice(0,300));

  async function connect() {
    const dev = await navigator.bluetooth.requestDevice({
      filters: [{ services: ['0000fee0-0000-1000-8000-00805f9b34fb'] }],
      optionalServices: ['0000180d-0000-1000-8000-00805f9b34fb','0000180a-0000-1000-8000-00805f9b34fb']
    });
    setDevice(dev);
    const gatt = await dev.gatt!.connect();
    const svc = await gatt.getPrimaryService('0000fee0-0000-1000-8000-00805f9b34fb');
    const hrChar = await svc.getCharacteristic('0000fee1-0000-1000-8000-00805f9b34fb');
    hrChar.addEventListener('characteristicvaluechanged', (e:any) => {
      const v = (e.target.value as DataView).getUint8(0);
      log(`HR=${v}`);
    });
    await hrChar.startNotifications();
    log('Connected + HR notifications');
  }

  async function disconnect() {
    try { await device?.gatt?.disconnect(); } catch {}
    log('Disconnected');
  }

  return (
    <main className="p-6 space-y-3">
      <h1 className="text-xl font-semibold">NexRing</h1>
      <div className="flex gap-2">
        <button onClick={connect} className="px-3 py-1 border rounded bg-white">Connect</button>
        <button onClick={disconnect} className="px-3 py-1 border rounded bg-white">Disconnect</button>
      </div>
      <div className="bg-white border rounded p-3 text-sm h-64 overflow-auto whitespace-pre-wrap">
        {msgs.join('\n') || 'No data yet.'}
      </div>
    </main>
  );
}