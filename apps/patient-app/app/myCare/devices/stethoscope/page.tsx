// ============================================================================
// 4) PATH: apps/patient-app/app/myCare/devices/stethoscope/page.tsx  (NEW)
// Why: Simple console: connect, visualize packet count, record, download WAV.
// ============================================================================
'use client';
import { useEffect, useRef, useState } from 'react';
import { StethoscopeNUS } from '@/src/devices/decoders/stethoscopeNUS';
import { WavRecorder, type PcmChunk } from '@/src/devices/decoders/wav';

export default function StethoscopeConsole() {
  const [connected, setConnected] = useState(false);
  const [packets, setPackets] = useState(0);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<WavRecorder | null>(null);
  const stethRef = useRef<StethoscopeNUS | null>(null);

  useEffect(() => () => { stethRef.current?.stop(); }, []);

  const connect = async () => {
    const recorder = new WavRecorder(8000);
    recorderRef.current = recorder;
    const st = new StethoscopeNUS({
      sampleRate: 8000,
      playToSpeaker: true,
      roomId: 'room-demo',
      onChunk: (c: PcmChunk) => {
        setPackets(p => p + 1);
        if (recording) recorder.push(c);
      },
    });
    stethRef.current = st;
    await st.requestAndConnect();
    setConnected(true);
  };

  const toggleRecord = () => setRecording(v => !v);

  const download = () => {
    if (!recorderRef.current) return;
    const blob = recorderRef.current.flush();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'stethoscope.wav';
    a.click();
    URL.revokeObjectURL(url);
  };

  const stop = async () => {
    await stethRef.current?.stop();
    setConnected(false);
  };

  return (
    <main className="p-4 space-y-3">
      <h1 className="text-lg font-semibold">Stethoscope (HC-21)</h1>
      <div className="flex gap-2">
        <button className="border rounded px-3 py-1" onClick={connect} disabled={connected}>Connect</button>
        <button className="border rounded px-3 py-1" onClick={toggleRecord} disabled={!connected}>{recording?'Stop rec':'Record'}</button>
        <button className="border rounded px-3 py-1" onClick={download} disabled={!connected}>Download WAV</button>
        <button className="border rounded px-3 py-1" onClick={stop} disabled={!connected}>Disconnect</button>
      </div>
      <div className="text-sm">Packets: {packets}</div>
    </main>
  );
}
