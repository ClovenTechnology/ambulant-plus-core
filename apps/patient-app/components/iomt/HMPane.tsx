// apps/patient-app/components/iomt/HMPane.tsx
'use client';
import { useState } from 'react';

type View = 'home'|'bp'|'spo2'|'hr'|'temp'|'glu'|'ecg';

function Tile({label, onClick}:{label:string; onClick:()=>void}) {
  return <button onClick={onClick} className="border rounded-xl p-4 text-left hover:bg-zinc-50">
    <div className="text-lg font-semibold">{label}</div>
    <div className="text-xs text-zinc-500">Tap to open</div>
  </button>;
}

function RingLoader() {
  return (
    <div className="relative w-28 h-28">
      <div className="absolute inset-0 rounded-full border-4 border-zinc-300 border-t-zinc-900 animate-spin" />
    </div>
  );
}

export default function HMPane() {
  const [view, setView] = useState<View>('home');
  const [measuring, setMeasuring] = useState(false);
  const [value, setValue] = useState<any>(null);

  async function startMeasure(kind: View) {
    // Trigger BLE pairing/permissions ONLY when Start is clicked
    setMeasuring(true);
    setValue(null);

    // Fake timing & results (replace with SDK calls)
    await new Promise(r=>setTimeout(r, kind==='bp' || kind==='temp' ? 3500 : 2000));
    const result = {
      bp: {sys: 118, dia: 76},
      spo2: {spo2: 98, bpm: 72},
      hr: {hr: 74},
      temp: {temp: 36.72},
      glu: {glu: 5.3},
      ecg: {avgHr: 87}
    }[kind!=='home'?kind:'hr'];
    setValue(result);
    setMeasuring(false);
  }

  if (view !== 'home') {
    return (
      <div className="space-y-4">
        <button onClick={()=>setView('home')} className="text-sm underline">← Back</button>
        <div className="text-xl font-semibold capitalize">{view}</div>

        {view==='ecg' && (
          <div className="h-40 border rounded-xl p-2 bg-grid-zinc-100 relative overflow-hidden">
            {/* simple “moving” ECG mock */}
            <div className="absolute inset-0 animate-[pulse_1.5s_ease-in-out_infinite]">
              <svg viewBox="0 0 100 30" className="w-full h-full">
                <polyline points="0,15 10,15 15,5 20,25 25,15 35,15 40,8 45,22 50,15 60,15 65,6 70,24 75,15 85,15 100,15"
                  fill="none" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            </div>
          </div>
        )}

        {view!=='ecg' && measuring && <RingLoader/>}
        {!measuring && value && (
          <pre className="text-sm p-3 rounded-xl border bg-white">{JSON.stringify(value, null, 2)}</pre>
        )}

        <button onClick={()=>startMeasure(view)} className="px-4 py-2 rounded-xl border bg-zinc-900 text-white">
          Start
        </button>
      </div>
    );
  }

  // Home six tiles
  return (
    <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
      <Tile label="Blood Pressure" onClick={()=>setView('bp')} />
      <Tile label="Blood Oxygen" onClick={()=>setView('spo2')} />
      <Tile label="Heart Rate" onClick={()=>setView('hr')} />
      <Tile label="Body Temperature" onClick={()=>setView('temp')} />
      <Tile label="Blood Glucose" onClick={()=>setView('glu')} />
      <Tile label="ECG" onClick={()=>setView('ecg')} />
    </div>
  );
}
