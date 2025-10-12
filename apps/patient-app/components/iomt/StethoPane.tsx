// apps/patient-app/components/iomt/StethoPane.tsx
'use client';
import { useEffect, useRef, useState } from 'react';

export default function StethoPane() {
  const [mode, setMode] = useState<'heart'|'lung'>('heart');
  const [rec, setRec] = useState<MediaRecorder|null>(null);
  const [audioURL, setAudioURL] = useState<string|null>(null);
  const chunks = useRef<Blob[]>([]);

  async function start() {
    // pairing/permissions would be triggered here when integrating SDK
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    mr.ondataavailable = e => chunks.current.push(e.data);
    mr.onstop = () => {
      const blob = new Blob(chunks.current, { type: 'audio/webm' });
      chunks.current = [];
      setAudioURL(URL.createObjectURL(blob));
    };
    mr.start();
    setRec(mr);
  }

  function stop() { rec?.stop(); setRec(null); }

  function save() {
    if (!audioURL) return;
    const a = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g,'-');
    a.href = audioURL;
    a.download = `stetho-${ts}-${mode}.webm`; // MP3 requires encoder; convert later server-side
    a.click();
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button onClick={()=>setMode('heart')} className={`px-3 py-1 rounded ${mode==='heart'?'bg-zinc-900 text-white':'border'}`}>Heart</button>
        <button onClick={()=>setMode('lung')} className={`px-3 py-1 rounded ${mode==='lung'?'bg-zinc-900 text-white':'border'}`}>Lung</button>
      </div>

      <div className="flex gap-2">
        {!rec
          ? <button onClick={start} className="px-4 py-2 rounded-xl border bg-zinc-900 text-white">Start Recording</button>
          : <button onClick={stop}  className="px-4 py-2 rounded-xl border bg-red-600 text-white">Stop</button>}
        <button onClick={save} disabled={!audioURL} className="px-4 py-2 rounded-xl border disabled:opacity-50">Save</button>
      </div>

      {audioURL && (
        <div className="space-y-2">
          <div className="text-sm text-zinc-600">Instant playback</div>
          <audio controls src={audioURL} className="w-full"/>
        </div>
      )}

      <div className="text-xs text-zinc-500">
        Tip: Switch to device mic if hardware is unavailable; SDK pairing will replace getUserMedia().
      </div>
    </div>
  );
}
