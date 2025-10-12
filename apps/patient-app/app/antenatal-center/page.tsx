// ============================================================================
// apps/patient-app/app/antenatal-center/page.tsx
// UI: in-app reminders, calendar options (location/telehealth), eRx, due-date booking.
// ============================================================================
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Baby, CalendarDays, ChevronDown, ChevronRight, Download, HeartPulse, Stethoscope, X, Eye, EyeOff, Check, Copy, Pill, Bell, Plus, Trash2, Link as LinkIcon, MapPin } from 'lucide-react';
import { AntenatalSetup } from '@/src/screens/AntenatalSetup';
import {
  addDaysISO, calcEDD, gestationalAge, trimester, buildVisitSchedule, nextVisit,
  loadAntenatalPrefs, type AntenatalPrefs, loadAntenatalLogs, saveAntenatalLog, type AntenatalLog, riskFlags,
  buildChecklist, loadChecklistDone, saveChecklistDone, statusFor, checkDrugSafety, type ChecklistWithDates,
  type ERx, loadERx, saveERx, removeERx
} from '@/src/analytics/antenatal';
import { buildAntenatalICSUrlFromPrefs, buildKickICSUrl, buildLabICSUrl } from '@/src/analytics/ics';
import { generateHealthReport } from '@/src/analytics/report';
import { encodeAntenatalShareToken } from '@/src/analytics/share';
import { loadReminders, requestNotifyPermission, saveReminder, removeReminder, startReminderLoop, type Reminder } from '@/src/analytics/reminders';

function useMounted(){ const [m,set]=useState(false); useEffect(()=>set(true),[]); return m; }
const todayISO = () => new Date().toISOString().slice(0,10);

export default function AntenatalCenter() {
  const mounted = useMounted();
  const [privacy, setPrivacy] = useState(false);
  useEffect(()=>{ try{ const p=localStorage.getItem('antenatal:privacy'); if(p) setPrivacy(p==='1'); }catch{} },[]);
  useEffect(()=>{ try{ localStorage.setItem('antenatal:privacy', privacy?'1':'0'); }catch{} },[privacy]);

  const [showSetup, setShowSetup] = useState(true);
  const [showSchedule, setShowSchedule] = useState(true);
  const [showLogs, setShowLogs] = useState(true);
  const [showLabs, setShowLabs] = useState(true);
  const [showSafety, setShowSafety] = useState(false);
  const [showKick, setShowKick] = useState(true);
  const [showERx, setShowERx] = useState(false);

  const prefs: AntenatalPrefs | null = useMemo(()=> mounted ? loadAntenatalPrefs() : null, [mounted]);
  const edd = useMemo(()=> (!mounted ? '' : (prefs?.edd || (prefs?.lmp ? calcEDD(prefs.lmp, prefs.cycleDays ?? 28) : ''))), [mounted, prefs]);

  const ga = useMemo(()=> (edd ? gestationalAge(todayISO(), edd) : {weeks:0,days:0}), [edd]);
  const tri = useMemo(()=> trimester(ga.weeks), [ga.weeks]);
  const schedule = useMemo(()=> (edd ? buildVisitSchedule(edd) : []), [edd]);
  const upcoming = useMemo(()=> nextVisit(schedule, todayISO()), [schedule]);

  const [logs, setLogs] = useState<AntenatalLog[]>([]);
  useEffect(()=>{ if(!mounted) return; setLogs(loadAntenatalLogs()); }, [mounted]);
  const flags = useMemo(()=> riskFlags(logs), [logs]);

  // Calendar options (ICS) — allow auto-fill from prefs.address / prefs.telehealth
  const [location, setLocation] = useState('Ambulant+ Virtual Clinic');
  const [telehealth, setTelehealth] = useState('');

  // Auto-fill calendar inputs from persisted prefs when available
  useEffect(() => {
    if (!mounted) return;
    if (prefs?.address) {
      // prefer first line as concise location but allow full address via "addr" param
      const first = (prefs.address || '').split('\n').map(s=>s.trim()).filter(Boolean)[0];
      if (first) setLocation(first);
      else setLocation(prefs.address);
    }
    if (prefs?.telehealth) {
      setTelehealth(prefs.telehealth);
    }
  }, [mounted, prefs]);

  // Labs & per-item reminders
  const [doneMap, setDoneMap] = useState(loadChecklistDone());
  const checklist = useMemo(()=> (edd ? buildChecklist(edd) : []), [edd]);
  const toggleDone = (code: string) => {
    const map = { ...doneMap };
    if (map[code]?.doneDate) delete map[code]; else map[code] = { doneDate: todayISO() };
    setDoneMap(map); saveChecklistDone(map);
  };

  // Drug safety
  const [drugQuery, setDrugQuery] = useState('');
  const safety = useMemo(()=> drugQuery ? checkDrugSafety(drugQuery, ga.weeks) : null, [drugQuery, ga.weeks]);

  // Kick counter
  const [kickTime, setKickTime] = useState('20:00');
  const [kickOn, setKickOn] = useState(false);
  const [kickCount, setKickCount] = useState(0);
  const icsKickUrl = useMemo(()=> (mounted ? buildKickICSUrl(window.location.origin, kickTime) : ''), [mounted, kickTime]);
  const startKick = () => { setKickOn(true); setKickCount(0); };
  const stopKick = () => {
    setKickOn(false);
    const date = todayISO();
    const existing = logs.find(l => l.date === date) ?? { date };
    saveAntenatalLog({ ...existing, fetalMovements: kickCount });
    setLogs(loadAntenatalLogs());
  };

  // In-app reminders
  const [reminders, setReminders] = useState<Reminder[]>([]);
  useEffect(()=>{ if(!mounted) return; setReminders(loadReminders()); startReminderLoop(); }, [mounted]);
  const addLabReminder = async (it: ChecklistWithDates, status: string) => {
    const perm = await requestNotifyPermission();
    if (perm !== 'granted') alert('Enable notifications in your browser to receive reminders.');
    const when = (status === 'overdue') ? new Date().toISOString() : `${it.dueDate}T09:00:00Z`;
    const id = `lab:${it.code}`;
    saveReminder({ id, title: `${it.name} reminder`, whenISO: when, repeatDaily: status==='overdue', payload:{ body:`Window ${it.startDate}–${it.endDate}` }, active: true, createdAt: new Date().toISOString() });
    setReminders(loadReminders());
  };
  const addKickReminder = async () => {
    const perm = await requestNotifyPermission();
    if (perm !== 'granted') alert('Enable notifications to receive reminders.');
    const [hh, mm] = kickTime.split(':').map(n=>parseInt(n||'0',10));
    const d = new Date(); d.setHours(hh, mm, 0, 0);
    saveReminder({ id:'kick:daily', title:'Fetal kick count', whenISO:d.toISOString(), repeatDaily:true, active:true, payload:{body:'Take 1 hour to count fetal movements.'}, createdAt:new Date().toISOString() });
    setReminders(loadReminders());
  };
  const deleteReminder = (id:string)=> { removeReminder(id); setReminders(loadReminders()); };

  // Share links (as before)
  const partnerUrl = useMemo(()=> (!mounted || !edd) ? null : `${window.location.origin}/share/antenatal/${encodeAntenatalShareToken({ edd, role:'partner' })}`, [mounted, edd]);
  const providerUrl = useMemo(()=> (!mounted || !edd) ? null : `${window.location.origin}/share/antenatal/${encodeAntenatalShareToken({ edd, role:'provider' })}`, [mounted, edd]);

  // eRx
  const [erx, setErx] = useState<ERx[]>([]);
  useEffect(()=>{ setErx(loadERx()); },[]);
  const addRx = (rx: ERx) => { saveERx(rx); setErx(loadERx()); };
  const deleteRx = (id: string) => { removeERx(id); setErx(loadERx()); };

  // Handoff PDF
  const downloadHandoff = async () => {
    const { blob } = await generateHealthReport('current-user', { antenatalHandoff: true });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'antenatal_handoff.pdf'; a.click();
  };

  // ICS helpers - note buildAntenatalICSUrlFromPrefs now prefers prefs.telehealth / prefs.address
  const scheduleIcsUrl = useMemo(()=> mounted ? buildAntenatalICSUrlFromPrefs((prefs ?? null) as AntenatalPrefs, window.location.origin, { location, telehealth, address: prefs?.address, geo: prefs?.geo ?? undefined }) : null, [mounted, edd, location, telehealth, prefs]);

  // Due-date booking: one-off event at EDD-7
  const bookDueDateCheck = () => {
    if (!edd || !mounted) return;
    const d = addDaysISO(edd, -7);
    const url = buildLabICSUrl(window.location.origin, edd, 'US1', 'end', false).replace('/antenatal-lab', '/antenatal'); // reuse schedule ICS path pattern
    alert(`Consider booking a pre-delivery check around ${d}. Use schedule ICS to add appointments with your clinic.`);
  };

  // Toast (Subscribe) – reused
  const [toastOpen, setToastOpen] = useState(false);
  const [toastCopied, setToastCopied] = useState(false);
  const [toastUrl, setToastUrl] = useState<string>('');
  useEffect(()=>{ if(!toastOpen) return; const t=setTimeout(()=>setToastOpen(false), 5000); return ()=>clearTimeout(t); },[toastOpen]);
  const openToast = (url: string) => { setToastUrl(url); setToastCopied(false); setToastOpen(true); };
  const copyToast = async () => { try { await navigator.clipboard.writeText(toastUrl); setToastCopied(true); } catch {} };

  return (
    <main>
      <div className="max-w-7xl mx-auto p-6 sm:p-8 space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between rounded-2xl bg-white/70 backdrop-blur px-5 py-4 border border-gray-200 shadow-sm">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold">🤰 Antenatal Center</h1>
            <p className="text-gray-600 mt-1">Schedule, labs, safety, reminders, eRx, clinical exports.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={()=> setPrivacy(v=>!v)} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50">{privacy ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />} <span className="hidden sm:inline">{privacy?'Show':'Quick Hide'}</span></button>
            <button onClick={downloadHandoff} className="px-3 py-2 rounded-xl bg-pink-600 text-white hover:bg-pink-700"><Download className="w-4 h-4 inline mr-1" /> Handoff PDF</button>
          </div>
        </header>

        {/* Insight chips */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Chip label="Gestational Age" value={edd ? `${ga.weeks}w ${ga.days}d` : '—'} privacy={privacy} />
          <Chip label="Trimester" value={edd ? `${tri}` : '—'} privacy={privacy} />
          <Chip label="EDD" value={edd || '—'} privacy={privacy} />
          <Chip label="Next visit" value={upcoming ? `${upcoming.date}` : '—'} privacy={privacy} />
        </section>

        {/* Setup */}
        <Collapser title={<><Stethoscope className="inline-block w-4 h-4 mr-1" /> Setup</>} open={showSetup} onToggle={()=>setShowSetup(v=>!v)}>
          <AntenatalSetup />
          <div className="mt-3 grid md:grid-cols-2 gap-3">
            <div className="rounded-xl border p-3">
              <div className="text-sm font-medium mb-1"><MapPin className="inline w-4 h-4 mr-1" /> Calendar options</div>
              <label className="block text-sm mb-2">Location
                <input value={location} onChange={(e)=>setLocation(e.target.value)} className="border rounded-lg p-2 w-full" />
              </label>
              <label className="block text-sm">Telehealth URL (optional)
                <input value={telehealth} onChange={(e)=>setTelehealth(e.target.value)} className="border rounded-lg p-2 w-full" placeholder="https://ambulant.plus/..." />
              </label>
              <div className="mt-3 text-xs text-gray-500">
                Location auto-filled from saved clinic address when available. Telehealth URL will be included in scheduled ICS events.
              </div>
            </div>
            <div className="rounded-xl border p-3">
              <div className="text-sm font-medium mb-1">Share & Book</div>
              <div className="flex gap-3 text-sm mb-2">
                {partnerUrl && <a href={partnerUrl} target="_blank" className="underline">Partner link</a>}
                {providerUrl && <a href={providerUrl} target="_blank" className="underline">Provider link</a>}
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                {/* Find OB/GYN televisit button: explicit flow to clinicians listing pre-filtered */}
                <a href={`/clinicians?specialties=OB%2FGYN&class=Doctors&online=1`} className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-100 text-center">
                  Find OB/GYN televisit
                </a>

                {/* Download / subscribe schedule */}
                <button onClick={()=> openToast(scheduleIcsUrl!)} className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-100">Subscribe Schedule</button>
                <a href={scheduleIcsUrl ?? '#'} target="_blank" className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-100"><LinkIcon className="inline w-4 h-4 mr-1" /> Download .ics</a>
              </div>
            </div>
          </div>
        </Collapser>

        {/* Care Schedule */}
        <Collapser title={<><CalendarDays className="inline-block w-4 h-4 mr-1" /> Care Schedule</>} open={showSchedule} onToggle={()=>setShowSchedule(v=>!v)}>
          {!edd ? <Empty>Set your EDD to generate a schedule.</Empty> : (
            <>
              <div className="flex items-center gap-2 mb-3">
                <button onClick={()=> openToast(scheduleIcsUrl!)} className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-100">Subscribe in Calendar</button>
                <a href={scheduleIcsUrl ?? '#'} target="_blank" className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-100"><LinkIcon className="inline w-4 h-4 mr-1" /> Download .ics</a>
                <button onClick={bookDueDateCheck} className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-100">Book due-date check</button>
              </div>
              <ul className="divide-y rounded-xl border overflow-hidden">
                {schedule.map((v)=>(

                  <li key={v.date} className="p-3 flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="font-medium">{v.label}</div>
                      <div className="text-xs text-gray-500">{v.purpose}</div>
                    </div>
                    <div className="text-sm tabular-nums">{v.date}</div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Collapser>

        {/* Labs & Vaccines with per-item reminders */}
        <Collapser title="Labs & Vaccines" open={showLabs} onToggle={()=>setShowLabs(v=>!v)}>
          {!edd ? <Empty>Set your EDD to compute GA windows.</Empty> : (
            <div className="space-y-2">
              <ul className="divide-y rounded-xl border overflow-hidden">
                {checklist.map((it: ChecklistWithDates)=> {
                  const st = statusFor(it, doneMap, todayISO());
                  const badge = st==='completed'?'bg-green-600': st==='due'?'bg-amber-600': st==='overdue'?'bg-red-600':'bg-gray-500';
                  const overdue = st==='overdue';
                  const buildLink = (when:'start'|'due'|'end') => buildLabICSUrl(window.location.origin, edd, it.code, when, overdue && when!=='end');
                  return (
                    <li key={it.code} className="p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium">{it.name} <span className="text-xs text-gray-500">({it.code})</span></div>
                        <div className="text-xs text-gray-500">Window {it.startDate} – {it.endDate} • Due {it.dueDate} {it.notes ? `• ${it.notes}` : ''}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs text-white px-2 py-1 rounded-full ${badge}`}>{st.toUpperCase()}</span>
                        <button onClick={()=> openToast(buildLink('due'))} className="px-2 py-1.5 rounded-lg border text-sm hover:bg-gray-100 inline-flex items-center gap-1">
                          <Bell className="w-4 h-4" /> Calendar
                        </button>
                        <button onClick={()=> addLabReminder(it, st)} className="px-2 py-1.5 rounded-lg border text-sm hover:bg-gray-100">In-app</button>
                        <button onClick={()=>toggleDone(it.code)} className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-100">{doneMap[it.code]?.doneDate ? 'Undo' : 'Mark done'}</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="text-xs text-gray-500">Overdue → daily repeats (calendar) and daily in-app reminder.</div>
            </div>
          )}
        </Collapser>

        {/* Drug Safety */}
        <Collapser title={<><Pill className="inline-block w-4 h-4 mr-1" /> Drug Safety (info only)</>} open={showSafety} onToggle={()=>setShowSafety(v=>!v)}>
          <div className="space-y-2">
            <div className="text-sm">Enter a medication name:</div>
            <input value={drugQuery} onChange={(e)=>setDrugQuery(e.target.value)} className="border rounded-lg p-2 w-full" placeholder="e.g., ibuprofen, acetaminophen" />
            {safety && (
              <div className={`rounded-lg border p-3 text-sm ${safety.category==='avoid'?'border-red-200 bg-red-50': safety.category==='caution'?'border-amber-200 bg-amber-50':'border-green-200 bg-green-50'}`}>
                <div className="font-medium capitalize">{safety.category.replace('-', ' ')}</div>
                <div className="text-gray-700">{safety.message}</div>
                <div className="text-xs text-gray-500 mt-1">Always consult your clinician.</div>
              </div>
            )}
          </div>
        </Collapser>

        {/* Vitals & Kick counter + in-app daily reminder */}
        <Collapser title={<><HeartPulse className="inline-block w-4 h-4 mr-1" /> Vitals & Symptoms</>} open={showLogs} onToggle={()=>setShowLogs(v=>!v)}>
          <div className="rounded-xl border p-3">
            <div className="text-sm font-medium mb-2">Kick counter</div>
            <div className="flex items-center gap-2">
              <input type="time" value={kickTime} onChange={(e)=>setKickTime(e.target.value)} className="border rounded-lg p-2" />
              <button onClick={()=> openToast(icsKickUrl)} className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-100">Subscribe</button>
              <a href={icsKickUrl} target="_blank" className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-100">Download .ics</a>
              <button onClick={addKickReminder} className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-100">In-app reminder</button>
            </div>
            <div className="mt-3 flex items-center gap-3">
              {!kickOn ? (
                <button onClick={startKick} className="px-3 py-2 rounded-lg bg-pink-600 text-white hover:bg-pink-700">Start</button>
              ) : (
                <>
                  <button onClick={()=> setKickCount(c=>c+1)} className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-100">+1</button>
                  <div className="text-xl font-semibold tabular-nums">{kickCount}</div>
                  <button onClick={stopKick} className="px-3 py-2 rounded-lg bg-gray-800 text-white hover:bg-gray-900">Stop & Save</button>
                </>
              )}
            </div>
          </div>
        </Collapser>

        {/* eRx (OB/GYN) */}
        <Collapser title="eRx & Medications (OB/GYN)" open={showERx} onToggle={()=>setShowERx(v=>!v)}>
          <ERxForm onAdd={addRx} />
          <ul className="mt-3 divide-y rounded-xl border overflow-hidden">
            {erx.length===0 && <li className="p-3 text-sm text-gray-500">No eRx recorded.</li>}
            {erx.map(rx=>(
              <li key={rx.id} className="p-3 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-medium">{rx.drug} <span className="text-xs text-gray-500">({rx.dose})</span></div>
                  <div className="text-xs text-gray-500">{rx.sig} • By {rx.prescriber} • {rx.date}{rx.notes?` • ${rx.notes}`:''}</div>
                </div>
                <button onClick={()=>deleteRx(rx.id)} className="p-2 rounded-lg border hover:bg-gray-100" title="Delete"><Trash2 className="w-4 h-4" /></button>
              </li>
            ))}
          </ul>
        </Collapser>

        {/* Subscribe Toast */}
        {toastOpen && (
          <div className="fixed right-6 bottom-6 z-50 w-[min(100%,32rem)]">
            <div className="rounded-2xl border border-gray-200 bg-white shadow-xl p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold mb-1">Subscribe in Calendar</div>
                  <div className="text-xs text-gray-600 break-all">{toastUrl}</div>
                </div>
                <button className="p-1 rounded hover:bg-gray-100" onClick={()=>setToastOpen(false)} aria-label="Close"><X className="w-4 h-4 text-gray-500" /></button>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={async()=>{ await navigator.clipboard.writeText(toastUrl); setToastCopied(true); }} className={`px-3 py-1.5 rounded-xl border text-sm ${toastCopied ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-800 border-gray-200 hover:bg-gray-50'}`}>
                  <Copy className="inline-block w-4 h-4 mr-1" /> {toastCopied ? 'Copied' : 'Copy URL'}
                </button>
                <a href={toastUrl} target="_blank" className="px-3 py-1.5 rounded-xl border text-sm bg-white text-gray-800 border-gray-200 hover:bg-gray-50">Open</a>
              </div>
            </div>
          </div>
        )}

        <div className="text-sm text-gray-600 text-center">
          Don’t have a wearable? <a href="https://nexring.cloventechnology.com/" target="_blank" className="underline decoration-pink-400 hover:text-pink-700">Get NexRing for better insights →</a>
        </div>

        <section className="p-4 border rounded-2xl bg-yellow-50 text-sm text-gray-700">
          ⚠ Clinical info only; not a diagnosis.
        </section>
      </div>
    </main>
  );
}

function Chip({ label, value, privacy }: { label: string; value: string; privacy: boolean }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white/70 px-4 py-3 shadow-sm">
      <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`text-base font-semibold tabular-nums ${privacy?'blur-sm':''}`} suppressHydrationWarning>{value}</div>
    </div>
  );
}
function Collapser({ title, open, onToggle, children }: { title: React.ReactNode; open: boolean; onToggle: ()=>void; children: React.ReactNode }) {
  return (
    <>
      <button onClick={onToggle} className="flex items-center gap-3 p-3 border rounded-2xl bg-white/70 border-gray-200 shadow-sm hover:bg-gray-50 w-full text-left">
        {open ? <ChevronDown/> : <ChevronRight/>} <span className="font-semibold">{title}</span>
      </button>
      {open && <section className="p-5 border rounded-2xl bg-white/70 shadow-sm border-gray-200">{children}</section>}
    </>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="border border-dashed rounded-xl p-4 text-sm text-gray-500">{children}</div>;
}

function ERxForm({ onAdd }: { onAdd: (rx: ERx)=>void }) {
  const [date, setDate] = useState(todayISO());
  const [drug, setDrug] = useState('');
  const [dose, setDose] = useState('');
  const [sig, setSig] = useState('');
  const [prescriber, setPrescriber] = useState('OB/GYN');
  const [notes, setNotes] = useState('');
  const add = () => {
    if (!drug || !dose || !sig) { alert('Fill drug, dose, sig'); return; }
    onAdd({ id: `rx-${Date.now()}`, date, drug, dose, sig, prescriber, notes: notes || undefined });
    setDrug(''); setDose(''); setSig(''); setNotes('');
  };
  return (
    <div className="grid md:grid-cols-5 gap-2">
      <input value={date} onChange={(e)=>setDate(e.target.value)} type="date" className="border rounded-lg p-2" />
      <input value={drug} onChange={(e)=>setDrug(e.target.value)} placeholder="Drug" className="border rounded-lg p-2" />
      <input value={dose} onChange={(e)=>setDose(e.target.value)} placeholder="Dose" className="border rounded-lg p-2" />
      <input value={sig} onChange={(e)=>setSig(e.target.value)} placeholder="Directions (sig)" className="border rounded-lg p-2" />
      <div className="flex gap-2">
        <button onClick={add} className="px-3 py-2 rounded-lg border hover:bg-gray-100"><Plus className="w-4 h-4 inline mr-1" /> Add</button>
      </div>
      <input value={prescriber} onChange={(e)=>setPrescriber(e.target.value)} placeholder="Prescriber" className="md:col-span-2 border rounded-lg p-2" />
      <input value={notes} onChange={(e)=>setNotes(e.target.value)} placeholder="Notes (opt.)" className="md:col-span-3 border rounded-lg p-2" />
    </div>
  );
}
