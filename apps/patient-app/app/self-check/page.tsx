'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from '../../components/ToastMount';
import { DEFAULT_THRESHOLDS, type Thresholds } from '../../mock/selfcheck';

type Entry = {
  date: string; // yyyy-mm-dd
  hr?: number;
  spo2?: number;
  sys?: number;
  dia?: number;
  note?: string;
};

const LS_KEY = 'ambulant.selfcheck';
const CFG_KEY = 'ambulant.selfcheck.cfg';

function today() { return new Date().toISOString().slice(0,10); }
function inRange(v: number|undefined, min: number, max: number) {
  if (v==null || Number.isNaN(v)) return true;
  return v >= min && v <= max;
}

export default function SelfCheckPage() {
  const [cfg, setCfg] = useState<Thresholds>(DEFAULT_THRESHOLDS);
  const [list, setList] = useState<Entry[]>([]);
  const [e, setE] = useState<Entry>({ date: today() });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY); if (raw) setList(JSON.parse(raw));
      const c = localStorage.getItem(CFG_KEY); if (c) setCfg(JSON.parse(c));
    } catch {}
  }, []);

  useEffect(() => { try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch {} }, [list]);
  useEffect(() => { try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch {} }, [cfg]);

  const flags = useMemo(() => ({
    hr:   !inRange(e.hr,   cfg.hr.min,  cfg.hr.max),
    spo2: !inRange(e.spo2, cfg.spo2.min, cfg.spo2.max),
    sys:  !inRange(e.sys,  cfg.sys.min, cfg.sys.max),
    dia:  !inRange(e.dia,  cfg.dia.min, cfg.dia.max),
  }), [e, cfg]);

  function save() {
    setList(prev => {
      const others = prev.filter(x => x.date !== e.date);
      return [...others, e].sort((a,b)=>a.date.localeCompare(b.date));
    });
    const anyFlag = Object.values(flags).some(Boolean);
    if (anyFlag) toast('Some values are out of range â€” keep monitoring', 'error');
    else toast('Daily check saved', 'success');
  }

  // detect successive out-of-range by days
  const promptDoctor = useMemo(() => {
    const lastN = [...list].reverse().slice(0, cfg.repeatDays);
    if (lastN.length < cfg.repeatDays) return false;
    const abnormal = lastN.every(it => {
      const f = {
        hr: !inRange(it.hr, cfg.hr.min, cfg.hr.max),
        spo2: !inRange(it.spo2, cfg.spo2.min, cfg.spo2.max),
        sys: !inRange(it.sys, cfg.sys.min, cfg.sys.max),
        dia: !inRange(it.dia, cfg.dia.min, cfg.dia.max),
      };
      return Object.values(f).some(Boolean);
    });
    return abnormal;
  }, [list, cfg]);

  useEffect(() => {
    if (promptDoctor) toast('Repeated out-of-range readings â€” please see a clinician', 'error');
  }, [promptDoctor]);

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Self-Check</h1>
        <div className="text-sm text-gray-500">Guided daily vitals with soft alerts</div>
      </header>

      <section className="grid md:grid-cols-3 gap-4">
        <div className="bg-white border rounded p-4 space-y-3">
          <div className="font-medium">Todayâ€™s Readings</div>
          <label className="block">
            <div className="text-sm text-gray-600 mb-1">Date</div>
            <input type="date" value={e.date} onChange={ev=>setE({...e, date: ev.target.value})} className="w-full border rounded px-3 py-2"/>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <div className="text-sm text-gray-600 mb-1">HR (bpm)</div>
              <input type="number" value={e.hr ?? ''} onChange={ev=>setE({...e, hr: Number(ev.target.value||0)})}
                     className={`w-full border rounded px-3 py-2 ${flags.hr ? 'border-rose-400 bg-rose-50' : ''}`} />
            </label>
            <label className="block">
              <div className="text-sm text-gray-600 mb-1">SpOâ‚‚ (%)</div>
              <input type="number" value={e.spo2 ?? ''} onChange={ev=>setE({...e, spo2: Number(ev.target.value||0)})}
                     className={`w-full border rounded px-3 py-2 ${flags.spo2 ? 'border-rose-400 bg-rose-50' : ''}`} />
            </label>
            <label className="block">
              <div className="text-sm text-gray-600 mb-1">SYS (mmHg)</div>
              <input type="number" value={e.sys ?? ''} onChange={ev=>setE({...e, sys: Number(ev.target.value||0)})}
                     className={`w-full border rounded px-3 py-2 ${flags.sys ? 'border-rose-400 bg-rose-50' : ''}`} />
            </label>
            <label className="block">
              <div className="text-sm text-gray-600 mb-1">DIA (mmHg)</div>
              <input type="number" value={e.dia ?? ''} onChange={ev=>setE({...e, dia: Number(ev.target.value||0)})}
                     className={`w-full border rounded px-3 py-2 ${flags.dia ? 'border-rose-400 bg-rose-50' : ''}`} />
            </label>
          </div>

          <label className="block">
            <div className="text-sm text-gray-600 mb-1">Note</div>
            <textarea value={e.note ?? ''} onChange={ev=>setE({...e, note: ev.target.value})}
                      className="w-full border rounded px-3 py-2 min-h-[80px]" />
          </label>

          <button onClick={save} className="px-3 py-2 border rounded bg-indigo-600 text-white hover:bg-indigo-700">
            Save Today
          </button>
        </div>

        <div className="bg-white border rounded p-4 space-y-3 md:col-span-2">
          <div className="font-medium">History</div>
          <div className="overflow-auto">
            <table className="w-full text-sm border rounded">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-2">Date</th>
                  <th className="text-left p-2">HR</th>
                  <th className="text-left p-2">SpOâ‚‚</th>
                  <th className="text-left p-2">SYS</th>
                  <th className="text-left p-2">DIA</th>
                  <th className="text-left p-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {[...list].reverse().map((r,i)=>(
                  <tr key={i} className="border-t">
                    <td className="p-2">{r.date}</td>
                    <td className={`p-2 ${!inRange(r.hr, cfg.hr.min, cfg.hr.max)?'text-rose-600 font-medium':''}`}>{r.hr ?? 'â€”'}</td>
                    <td className={`p-2 ${!inRange(r.spo2, cfg.spo2.min, cfg.spo2.max)?'text-rose-600 font-medium':''}`}>{r.spo2 ?? 'â€”'}</td>
                    <td className={`p-2 ${!inRange(r.sys, cfg.sys.min, cfg.sys.max)?'text-rose-600 font-medium':''}`}>{r.sys ?? 'â€”'}</td>
                    <td className={`p-2 ${!inRange(r.dia, cfg.dia.min, cfg.dia.max)?'text-rose-600 font-medium':''}`}>{r.dia ?? 'â€”'}</td>
                    <td className="p-2">{r.note ?? ''}</td>
                  </tr>
                ))}
                {list.length===0 && (
                  <tr><td colSpan={6} className="p-3 text-gray-500">No entries yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border rounded p-4 space-y-3 md:col-span-3">
          <div className="font-medium">Admin Thresholds (Demo)</div>
          <div className="grid md:grid-cols-5 gap-3">
            <label className="block">
              <div className="text-xs text-gray-600 mb-1">HR min</div>
              <input type="number" value={cfg.hr.min} onChange={e=>setCfg({...cfg, hr:{...cfg.hr, min:Number(e.target.value)}})} className="w-full border rounded px-2 py-1"/>
            </label>
            <label className="block">
              <div className="text-xs text-gray-600 mb-1">HR max</div>
              <input type="number" value={cfg.hr.max} onChange={e=>setCfg({...cfg, hr:{...cfg.hr, max:Number(e.target.value)}})} className="w-full border rounded px-2 py-1"/>
            </label>
            <label className="block">
              <div className="text-xs text-gray-600 mb-1">SpOâ‚‚ min</div>
              <input type="number" value={cfg.spo2.min} onChange={e=>setCfg({...cfg, spo2:{...cfg.spo2, min:Number(e.target.value)}})} className="w-full border rounded px-2 py-1"/>
            </label>
            <label className="block">
              <div className="text-xs text-gray-600 mb-1">SYS max</div>
              <input type="number" value={cfg.sys.max} onChange={e=>setCfg({...cfg, sys:{...cfg.sys, max:Number(e.target.value)}})} className="w-full border rounded px-2 py-1"/>
            </label>
            <label className="block">
              <div className="text-xs text-gray-600 mb-1">DIA max</div>
              <input type="number" value={cfg.dia.max} onChange={e=>setCfg({...cfg, dia:{...cfg.dia, max:Number(e.target.value)}})} className="w-full border rounded px-2 py-1"/>
            </label>
            <label className="block">
              <div className="text-xs text-gray-600 mb-1">Repeat days</div>
              <input type="number" value={cfg.repeatDays} onChange={e=>setCfg({...cfg, repeatDays:Number(e.target.value||1)})} className="w-full border rounded px-2 py-1"/>
            </label>
          </div>
          <div className="text-xs text-gray-500">
            When out-of-range values occur for <strong>{cfg.repeatDays}</strong> consecutive day(s), weâ€™ll prompt the patient to see a clinician.
          </div>
        </div>
      </section>
    </main>
  );
}
