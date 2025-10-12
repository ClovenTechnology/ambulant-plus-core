'use client';

import { useEffect, useState } from 'react';
import CalendarPreview from '../../../components/CalendarPreview';

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_ORIGIN ?? '';
type DayKey = 'mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun';
const DAYS: DayKey[] = ['mon','tue','wed','thu','fri','sat','sun'];
const DAY_LABEL: Record<DayKey,string> = { mon:'Mon', tue:'Tue', wed:'Wed', thu:'Thu', fri:'Fri', sat:'Sat', sun:'Sun' };

type SlotRange = { start: string; end: string };
type DayTemplate = { enabled: boolean; ranges: SlotRange[] };
type Exception = { date: string; reason?: string };
type ScheduleConfig = {
  country: string;
  timezone: string;
  template: Record<DayKey, DayTemplate>;
  exceptions: Exception[];
};
type ConsultSettings = {
  defaultMinutes: number;
  bufferMinutes: number;
  minAdvanceMinutes: number;
  maxAdvanceDays: number;
};

const DEFAULT: ScheduleConfig = {
  country: 'ZA',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Johannesburg',
  template: {
    mon:{enabled:true, ranges:[{start:'09:00',end:'12:00'},{start:'13:00',end:'17:00'}]},
    tue:{enabled:true, ranges:[{start:'09:00',end:'12:00'},{start:'13:00',end:'17:00'}]},
    wed:{enabled:true, ranges:[{start:'09:00',end:'12:00'},{start:'13:00',end:'17:00'}]},
    thu:{enabled:true, ranges:[{start:'09:00',end:'12:00'},{start:'13:00',end:'17:00'}]},
    fri:{enabled:true, ranges:[{start:'09:00',end:'12:00'},{start:'13:00',end:'17:00'}]},
    sat:{enabled:false, ranges:[{start:'09:00',end:'12:00'}]},
    sun:{enabled:false, ranges:[]},
  },
  exceptions: [],
};

export default function SchedulePage(){
  const [cfg,setCfg] = useState<ScheduleConfig>(DEFAULT);
  const [consult,setConsult] = useState<ConsultSettings|null>(null);
  const [saved,setSaved] = useState(false);
  const [loading,setLoading] = useState(true);

  useEffect(()=>{
    (async()=>{
      setLoading(true);
      try{
        const [r1,r2] = await Promise.all([
          fetch(`${GATEWAY}/api/settings/schedule`, {cache:'no-store', headers:{'x-uid':'clinician-local-001','x-role':'clinician'}}),
          fetch(`${GATEWAY}/api/settings/consult`,  {cache:'no-store', headers:{'x-uid':'clinician-local-001','x-role':'clinician'}}),
        ]);
        const s = r1.ok ? await r1.json() : DEFAULT;
        const c = r2.ok ? await r2.json() : { defaultMinutes:25, bufferMinutes:5, minAdvanceMinutes:30, maxAdvanceDays:30 };
        setCfg({ ...DEFAULT, ...s, template:{...DEFAULT.template, ...(s?.template||{})} });
        setConsult(c);
      } finally { setLoading(false); }
    })();
  },[]);

  function addRange(d:DayKey){
    const next = structuredClone(cfg);
    next.template[d].ranges.push({start:'09:00', end:'12:00'});
    setCfg(next);
  }
  function setRange(d:DayKey, i:number, key:'start'|'end', val:string){
    const next = structuredClone(cfg);
    next.template[d].ranges[i][key] = val;
    setCfg(next);
  }
  function delRange(d:DayKey, i:number){
    const next = structuredClone(cfg);
    next.template[d].ranges.splice(i,1);
    setCfg(next);
  }
  function copyMonToWeekdays(){
    const next = structuredClone(cfg);
    for (const d of ['tue','wed','thu','fri'] as DayKey[]) next.template[d] = structuredClone(next.template.mon);
    setCfg(next);
  }
  function addException(){
    const date = new Date().toISOString().slice(0,10);
    setCfg({...cfg, exceptions:[...cfg.exceptions,{date}]});
  }
  function setException(i:number, date:string){
    const next = structuredClone(cfg);
    next.exceptions[i].date = date;
    setCfg(next);
  }
  function delException(i:number){
    const next = structuredClone(cfg);
    next.exceptions.splice(i,1);
    setCfg(next);
  }

  async function save(){
    setSaved(false);
    const r = await fetch(`${GATEWAY}/api/settings/schedule`, {
      method:'PUT',
      headers:{'content-type':'application/json','x-uid':'clinician-local-001','x-role':'clinician'},
      body: JSON.stringify(cfg),
    });
    setSaved(r.ok);
  }

  if (loading) return <main className="p-6">Loading…</main>;

  return (
    <main className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Clinician Schedule</h1>
        <div className="flex items-center gap-2">
          <button onClick={copyMonToWeekdays} className="px-3 py-1 border rounded">Copy Mon → Weekdays</button>
          <button onClick={save} className="px-3 py-1 border rounded bg-black text-white">Save</button>
          {saved && <span className="text-green-700 text-sm">Saved ✓</span>}
        </div>
      </header>

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="border rounded p-4 bg-white">
          <div className="font-medium mb-3">Weekly Template</div>
          <div className="space-y-4">
            {DAYS.map(d=>(
              <div key={d} className="border rounded p-3">
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-sm w-20">{DAY_LABEL[d]}</label>
                  <input type="checkbox" checked={cfg.template[d].enabled} onChange={e=>{
                    const next = structuredClone(cfg);
                    next.template[d].enabled = e.target.checked; setCfg(next);
                  }} /> <span className="text-xs text-gray-500">Enabled</span>
                  <button onClick={()=>addRange(d)} className="ml-auto px-2 py-1 border rounded text-xs">Add Range</button>
                </div>
                {cfg.template[d].ranges.map((r,i)=>(
                  <div key={i} className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-500">From</span>
                    <input value={r.start} onChange={e=>setRange(d,i,'start',e.target.value)} className="border rounded px-2 py-1 w-24 text-sm"/>
                    <span className="text-xs text-gray-500">to</span>
                    <input value={r.end} onChange={e=>setRange(d,i,'end',e.target.value)} className="border rounded px-2 py-1 w-24 text-sm"/>
                    <button onClick={()=>delRange(d,i)} className="ml-auto px-2 py-1 border rounded text-xs">Remove</button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="border rounded p-4 bg-white">
          <div className="font-medium mb-3">Exceptions & Holidays</div>
          <div className="flex items-center gap-2 mb-3">
            <label className="text-sm">Country</label>
            <input value={cfg.country} onChange={e=>setCfg({...cfg, country:e.target.value.toUpperCase()})} className="border rounded px-2 py-1 w-24 text-sm"/>
            <label className="text-sm ml-4">Timezone</label>
            <input value={cfg.timezone} onChange={e=>setCfg({...cfg, timezone:e.target.value})} className="border rounded px-2 py-1 text-sm w-[280px]"/>
          </div>
          <div className="space-y-2">
            {cfg.exceptions.map((ex,i)=>(
              <div key={i} className="flex items-center gap-2">
                <input type="date" value={ex.date} onChange={e=>setException(i,e.target.value)} className="border rounded px-2 py-1 text-sm"/>
                <input placeholder="reason (optional)" value={ex.reason||''} onChange={e=>{
                  const next=structuredClone(cfg); next.exceptions[i].reason=e.target.value; setCfg(next);
                }} className="border rounded px-2 py-1 text-sm w-64"/>
                <button onClick={()=>delException(i)} className="px-2 py-1 border rounded text-xs">Remove</button>
              </div>
            ))}
            <button onClick={addException} className="px-2 py-1 border rounded text-xs">Add Exception</button>
          </div>
        </div>
      </section>

      {/* NEW: Read-only calendar preview fed by /api/schedule/slots */}
      <CalendarPreview clinicianId="clinician-local-001" initialView="week" />
    </main>
  );
}
