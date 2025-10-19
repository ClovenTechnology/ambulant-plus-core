'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from '../../components/ToastMount';
import { DEFAULT_THRESHOLDS, type Thresholds } from '../../mock/selfcheck';
import PillRemindersWrapper from '@/components/PillRemindersWrapper';
import { Pill } from '@/types';

type Entry = {
  date: string;
  hr?: number;
  spo2?: number;
  sys?: number;
  dia?: number;
  note?: string;
};

const LS_KEY = 'ambulant.selfcheck';
const PILLS_KEY = 'ambulant.manual-pills';

function today() { return new Date().toISOString().slice(0,10); }
function inRange(v: number|undefined, min: number, max: number) {
  if (v == null || Number.isNaN(v)) return true;
  return v >= min && v <= max;
}

export default function SelfCheckPage() {
  const [cfg, setCfg] = useState<Thresholds>(DEFAULT_THRESHOLDS);
  const [list, setList] = useState<Entry[]>([]);
  const [e, setE] = useState<Entry>({ date: today() });
  const [manualPills, setManualPills] = useState<Pill[]>([]);
  const [erxPills, setErxPills] = useState<Pill[]>([]);
  const [creating, setCreating] = useState(false);
  const [undoBuffer, setUndoBuffer] = useState<{ action: 'create'|'delete'; pills: Pill[] } | null>(null);

  // Load local storage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY); if (raw) setList(JSON.parse(raw));
      const pillsRaw = localStorage.getItem(PILLS_KEY);
      if (pillsRaw) {
        const parsed = JSON.parse(pillsRaw);
        if (Array.isArray(parsed)) setManualPills(parsed.filter((p:any) => p && p.id && p.name));
      }
      const cfgRaw = localStorage.getItem('ambulant.selfcheck.cfg'); if (cfgRaw) setCfg(JSON.parse(cfgRaw));
    } catch (err) { console.warn('Failed to load local storage', err); }
  }, []);

  // Persist
  useEffect(() => { try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch {} }, [list]);
  useEffect(() => { try { localStorage.setItem(PILLS_KEY, JSON.stringify(manualPills)); } catch {} }, [manualPills]);
  useEffect(() => { try { localStorage.setItem('ambulant.selfcheck.cfg', JSON.stringify(cfg)); } catch {} }, [cfg]);

  // Fetch erx
  useEffect(() => {
    async function fetchErx() {
      try {
        const res = await fetch('/api/erx');
        if (!res.ok) throw new Error('Failed to fetch eRx');
        const data: any = await res.json();
        if (Array.isArray(data)) {
          const safe = data
            .filter((p:any) => p && (p.id || p.drug))
            .map((p:any) => ({
              id: String(p.id ?? crypto.randomUUID()),
              name: String(p.name ?? p.drug ?? 'Unknown'),
              dose: String(p.dose ?? (p.sig ?? '')),
              time: String((p as any).time ?? ''),
              status: (p.status ?? 'Pending') as Pill['status'],
            }));
          setErxPills(safe);
        }
      } catch (err) {
        console.warn('Error fetching eRx pills', err);
        setErxPills([]);
      }
    }
    fetchErx();
  }, []);

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
    if (anyFlag) toast('Some values are out of range — keep monitoring', 'error');
    else toast('Daily check saved', 'success');
  }

  // prompt clinician
  const promptDoctor = useMemo(() => {
    const lastN = [...list].reverse().slice(0, cfg.repeatDays);
    if (lastN.length < cfg.repeatDays) return false;
    return lastN.every(it => {
      const f = {
        hr: !inRange(it.hr, cfg.hr.min, cfg.hr.max),
        spo2: !inRange(it.spo2, cfg.spo2.min, cfg.spo2.max),
        sys: !inRange(it.sys, cfg.sys.min, cfg.sys.max),
        dia: !inRange(it.dia, cfg.dia.min, cfg.dia.max),
      };
      return Object.values(f).some(Boolean);
    });
  }, [list, cfg]);

  useEffect(() => { if (promptDoctor) toast('Repeated out-of-range readings — please see a clinician', 'error'); }, [promptDoctor]);

  // Create manual pill: optimistic local + server PUT -> reconcile
  const addManualPill = async (pill: Partial<Pill>) => {
    const toCreate: Pill = {
      id: pill.id ?? crypto.randomUUID(),
      name: String(pill.name ?? 'New Pill'),
      dose: String(pill.dose ?? ''),
      time: String(pill.time ?? new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })),
      status: (pill.status ?? 'Pending') as Pill['status'],
    };

    // optimistic local add
    setManualPills(prev => {
      const updated = [...prev, toCreate];
      try { localStorage.setItem(PILLS_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });

    // set undo buffer for create
    setUndoBuffer({ action: 'create', pills: [toCreate] });

    // analytics event for creation (fire-and-forget)
    try {
      fetch('/api/analytics', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ event: 'manual_pill_create', props: { id: toCreate.id, name: toCreate.name }, ts: Date.now() }) });
    } catch {}

    setCreating(true);
    try {
      const res = await fetch('/api/reminders/confirm', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(toCreate),
      });
      if (!res.ok) {
        toast('Saved locally (server failed)', 'warning');
        return;
      }
      const data = await res.json().catch(() => null);
      // reconcile server returned items when available
      if (data?.created) {
        setManualPills(prev => {
          // remove optimistic with same id(s)
          const ids = data.created.map((c:any) => String(c.id));
          const filtered = prev.filter(p => !ids.includes(p.id));
          const createdNormalized: Pill[] = data.created.map((c:any) => ({
            id: String(c.id),
            name: String(c.name ?? c.drug ?? 'Unknown'),
            dose: String(c.dose ?? ''),
            time: String(c.time ?? ''),
            status: (c.status ?? 'Pending') as Pill['status'],
          }));
          const merged = [...filtered, ...createdNormalized];
          try { localStorage.setItem(PILLS_KEY, JSON.stringify(merged)); } catch {}
          return merged;
        });
        toast('Manual reminder synced', 'success');
      } else if (data?.created?.length === 0 && data?.created === undefined) {
        // no created info — leave optimistic
        toast('Manual reminder created (server accepted)', 'success');
      }
    } catch (err) {
      console.warn('Network error creating reminder', err);
      toast('Saved locally (network error)', 'warning');
    } finally {
      setCreating(false);
      // clear undo buffer after a short window (user can click undo from toast if they want)
      setTimeout(() => setUndoBuffer(null), 10_000);
    }
  };

  // Delete manual pill (local + server)
  const deleteManualPill = async (id: string) => {
    const target = manualPills.find(p => p.id === id);
    if (!target) return;
    // optimistic remove
    setManualPills(prev => {
      const updated = prev.filter(p => p.id !== id);
      try { localStorage.setItem(PILLS_KEY, JSON.stringify(updated)); } catch {}
      return updated;
    });

    // set undo buffer
    setUndoBuffer({ action: 'delete', pills: [target] });

    // show toast with undo
    toast(`${target.name} removed — undo?`, 'info');

    // attempt server delete
    try {
      const res = await fetch('/api/reminders/confirm', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        toast('Deleted locally (server failed)', 'warning');
      } else {
        // analytics
        try {
          fetch('/api/analytics', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ event: 'manual_pill_delete', props: { id, name: target.name }, ts: Date.now() }) });
        } catch {}
      }
    } catch (err) {
      console.warn('Network error deleting reminder', err);
      toast('Deleted locally (network error)', 'warning');
    }

    // allow undo window: 8s
    setTimeout(() => {
      // if still same undo buffer -> clear permanently (can't undo)
      setUndoBuffer(prev => (prev && prev.action === 'delete' && prev.pills[0].id === id ? null : prev));
    }, 8000);
  };

  // Undo handler for both create and delete (reverts last optimistic action)
  const handleUndo = async () => {
    if (!undoBuffer) return;
    if (undoBuffer.action === 'create') {
      // remove created pills (local) and call DELETE to server
      const ids = undoBuffer.pills.map(p => p.id);
      setManualPills(prev => {
        const updated = prev.filter(p => !ids.includes(p.id));
        try { localStorage.setItem(PILLS_KEY, JSON.stringify(updated)); } catch {}
        return updated;
      });
      try { await fetch('/api/reminders/confirm', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids }) }); } catch {}
      toast('Create undone', 'success');
    } else if (undoBuffer.action === 'delete') {
      // re-add deleted pills locally and call PUT to server
      const toReAdd = undoBuffer.pills;
      setManualPills(prev => {
        const updated = [...prev, ...toReAdd];
        try { localStorage.setItem(PILLS_KEY, JSON.stringify(updated)); } catch {}
        return updated;
      });
      try { await fetch('/api/reminders/confirm', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(toReAdd) }); } catch {}
      toast('Delete undone', 'success');
    }
    setUndoBuffer(null);
  };

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Self-Check</h1>
        <div className="text-sm text-gray-500">Guided daily vitals with soft alerts</div>
      </header>

      <section className="grid md:grid-cols-3 gap-4">
        <div className="bg-white border rounded p-4 space-y-3">
          <div className="font-medium">Today’s Readings</div>
          <label className="block">
            <div className="text-sm text-gray-600 mb-1">Date</div>
            <input type="date" value={e.date} onChange={ev=>setE({...e, date: ev.target.value})} className="w-full border rounded px-3 py-2"/>
          </label>

          <div className="grid grid-cols-2 gap-3">
            {['hr','spo2','sys','dia'].map((field) => {
              const label = field.toUpperCase();
              const val = (e as any)[field] ?? '';
              const flag = (flags as any)[field];
              return (
                <label key={field} className="block">
                  <div className="text-sm text-gray-600 mb-1">{label}</div>
                  <input type="number" value={val} onChange={ev=>setE({...e, [field]: Number(ev.target.value||0)})}
                         className={`w-full border rounded px-3 py-2 ${flag ? 'border-rose-400 bg-rose-50' : ''}`} />
                </label>
              );
            })}
          </div>

          <label className="block">
            <div className="text-sm text-gray-600 mb-1">Note</div>
            <textarea value={e.note ?? ''} onChange={ev=>setE({...e, note: ev.target.value})}
                      className="w-full border rounded px-3 py-2 min-h-[80px]" />
          </label>

          <button onClick={save} className="px-3 py-2 border rounded bg-indigo-600 text-white hover:bg-indigo-700">Save Today</button>

          {/* Add Manual Pill */}
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => addManualPill({ name: 'New Pill', dose: '100 mg', time: new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }), status: 'Pending' })}
              disabled={creating}
              className="px-3 py-2 border rounded bg-green-600 text-white hover:bg-green-700"
            >
              {creating ? 'Adding…' : 'Add Manual Pill'}
            </button>

            {undoBuffer && (
              <button onClick={handleUndo} className="px-3 py-2 border rounded bg-yellow-500 text-white">
                Undo
              </button>
            )}
          </div>
        </div>

        <div className="bg-white border rounded p-4 space-y-3 md:col-span-2">
          <div className="font-medium">History</div>
          <div className="overflow-auto">
            <table className="w-full text-sm border rounded">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-2">Date</th>
                  <th className="text-left p-2">HR</th>
                  <th className="text-left p-2">SpO₂</th>
                  <th className="text-left p-2">SYS</th>
                  <th className="text-left p-2">DIA</th>
                  <th className="text-left p-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {[...list].reverse().map((r,i)=>(
                  <tr key={i} className="border-t">
                    <td className="p-2">{r.date}</td>
                    <td className={`p-2 ${!inRange(r.hr, cfg.hr.min, cfg.hr.max)?'text-rose-600 font-medium':''}`}>{r.hr ?? '—'}</td>
                    <td className={`p-2 ${!inRange(r.spo2, cfg.spo2.min, cfg.spo2.max)?'text-rose-600 font-medium':''}`}>{r.spo2 ?? '—'}</td>
                    <td className={`p-2 ${!inRange(r.sys, cfg.sys.min, cfg.sys.max)?'text-rose-600 font-medium':''}`}>{r.sys ?? '—'}</td>
                    <td className={`p-2 ${!inRange(r.dia, cfg.dia.min, cfg.dia.max)?'text-rose-600 font-medium':''}`}>{r.dia ?? '—'}</td>
                    <td className="p-2">{r.note ?? ''}</td>
                  </tr>
                ))}
                {list.length===0 && (<tr><td colSpan={6} className="p-3 text-gray-500">No entries yet.</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pill Reminders */}
        <div className="bg-white border rounded p-4 space-y-3 md:col-span-3">
          <div className="font-medium">Pill Reminders (Manual + eRx)</div>

          {/* Small editor list for manual pills */}
          <div className="mb-3">
            <div className="text-xs text-gray-600 mb-2">Manual reminders</div>
            {manualPills.length === 0 ? (
              <div className="text-gray-500 text-sm">No manual reminders yet.</div>
            ) : (
              <div className="space-y-2">
                {manualPills.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-gray-500">{p.dose} • {p.time}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          // quick edit inline: prompt for name (simple)
                          const newName = prompt('Edit reminder name', p.name);
                          if (!newName || newName.trim() === '') return;
                          const updated = manualPills.map(x => x.id === p.id ? { ...x, name: newName } : x);
                          setManualPills(updated);
                          try { localStorage.setItem(PILLS_KEY, JSON.stringify(updated)); } catch {}
                          // sync small PUT to server (idempotent)
                          fetch('/api/reminders/confirm', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: p.id, name: newName }) }).catch(()=>{});
                        }}
                        className="px-2 py-1 text-xs border rounded"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteManualPill(p.id)}
                        className="px-2 py-1 text-xs border rounded bg-rose-500 text-white"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <PillRemindersWrapper manualPills={manualPills} erxPills={erxPills} />
        </div>
      </section>
    </main>
  );
}
