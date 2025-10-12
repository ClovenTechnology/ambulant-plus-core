// apps/patient-app/components/iomt/WearablePane.tsx
'use client';
import { useEffect, useMemo, useRef, useState } from 'react';

const OPTIONS = [
  'NexRing','Oura','Whoop','Fitbit','Apple Watch','Garmin','Samsung Watch','Amazfit','Xiaomi Band','Withings'
];

function Doughnut({segments}:{segments:{label:string;value:number}[]}) {
  const total = segments.reduce((a,b)=>a+b.value,0) || 1;
  let acc = 0;
  return (
    <svg viewBox="0 0 42 42" className="w-36 h-36">
      {segments.map((s,i)=>{
        const val = (s.value/total)*100;
        const strokeDasharray = `${val} ${100-val}`;
        const strokeDashoffset = 25 - (acc/100)*100;
        acc += val;
        return <circle key={i} r="15.915" cx="21" cy="21"
          fill="transparent" stroke="currentColor" strokeWidth="6"
          strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset}
          className="text-zinc-900/80" />;
      })}
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fontSize="6">Activity</text>
    </svg>
  );
}

function Spark({points}:{points:number[]}) {
  const max = Math.max(...points, 1);
  const d = points.map((y,i)=>{
    const px = (i/(points.length-1))*100;
    const py = 100 - (y/max)*100;
    return `${i===0?'M':'L'} ${px},${py}`;
  }).join(' ');
  return <svg viewBox="0 0 100 100" className="w-full h-20"><path d={d} stroke="currentColor" fill="none"/></svg>;
}

export default function WearablePane() {
  const [sel, setSel] = useState('NexRing');
  const [connected, setConnected] = useState(false);
  const [hr, setHr] = useState<number[]>(() => Array.from({length:40},()=>60+Math.random()*20));
  const [stress, setStress] = useState<number[]>(() => Array.from({length:40},()=>Math.random()*100));
  const [act, setAct] = useState<{label:string;value:number}[]>([
    {label:'Rest', value:50}, {label:'Walk', value:30}, {label:'Run', value:20}
  ]);

  const timer = useRef<any>(null);

  useEffect(()=>{
    if(!connected) return;
    timer.current = setInterval(()=>{
      setHr(p=>[...p.slice(1), 60+Math.random()*30]);
      setStress(p=>[...p.slice(1), Math.random()*100]);
    },1500);
    return ()=> clearInterval(timer.current);
  },[connected]);

  const notIntegrated = sel!=='NexRing';

  function onStart() {
    if (notIntegrated) return;
    // Trigger BLE enablement only now (placeholder – real SDK goes here)
    setConnected(true);
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <select className="border rounded-xl px-3 py-2" value={sel} onChange={e=>setSel(e.target.value)}>
          {OPTIONS.map(x=><option key={x} value={x}>{x}</option>)}
        </select>
        <button onClick={onStart}
          className="px-4 py-2 rounded-xl border bg-zinc-900 text-white disabled:opacity-50"
          disabled={notIntegrated}>{connected?'Connected':'Start'}</button>
      </div>

      {notIntegrated && (
        <div className="text-sm p-3 rounded-xl border bg-yellow-50">
          Wearable not yet integrated, contact Admin to request device integration.
        </div>
      )}

      {/* Mock-first UI, overridden when live connection arrives */}
      {!notIntegrated && (
        <div className="grid md:grid-cols-3 gap-4">
          <div className="border rounded-xl p-4">
            <div className="text-sm mb-2">Activities</div>
            <Doughnut segments={act}/>
          </div>

          <div className="border rounded-xl p-4">
            <div className="text-sm mb-2">Sleep pattern (hrs)</div>
            <div className="flex items-end gap-2 h-28">
              {[6,7,8,5,7,6,8].map((h,i)=>(
                <div key={i} className="w-6 bg-zinc-900/80 rounded"
                  style={{height:`${(h/8)*100}%`}} title={`${h}h`}/>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="border rounded-xl p-3">
              <div className="text-sm mb-1">Heart Rate</div>
              <Spark points={hr}/>
            </div>
            <div className="border rounded-xl p-3">
              <div className="text-sm mb-1">Daytime Stress</div>
              <Spark points={stress}/>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
