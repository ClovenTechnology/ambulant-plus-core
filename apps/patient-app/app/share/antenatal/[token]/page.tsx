// ============================================================================
// apps/patient-app/app/share/antenatal/[token]/page.tsx
// Role-based read-only share (partner vs provider).
// ============================================================================
'use client';

import { useMemo, useState } from 'react';
import { decodeAntenatalShareToken, type ShareRole } from '@/src/analytics/share';
import { buildVisitSchedule, gestationalAge, trimester, buildChecklist } from '@/src/analytics/antenatal';
import { buildAntenatalICSUrlFromPrefs, buildLabICSUrl } from '@/src/analytics/ics';
import { Copy, CalendarPlus, Printer, Bell } from 'lucide-react';

export default function AntenatalSharePage({ params }: { params: { token: string } }) {
  const data = useMemo(() => decodeAntenatalShareToken(params.token), [params.token]);
  const [copied, setCopied] = useState(false);
  if (!data?.edd) return <main className="max-w-3xl mx-auto p-6"><h1 className="text-2xl font-bold">Antenatal</h1><p className="text-red-600 mt-2">Invalid link.</p></main>;

  const role: ShareRole = data.role;
  const edd = data.edd;
  const ga = gestationalAge(new Date().toISOString().slice(0,10), edd);
  const tri = trimester(ga.weeks);
  const schedule = buildVisitSchedule(edd);
  const icsUrl = typeof window !== 'undefined' ? buildAntenatalICSUrlFromPrefs({ edd }, window.location.origin) : null;
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const copy = async (v: string) => { try { await navigator.clipboard.writeText(v); setCopied(true); setTimeout(()=>setCopied(false), 1200); } catch {} };

  const checklist = useMemo(()=> buildChecklist(edd), [edd]); // provider only

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Antenatal Schedule ({role})</h1>
          <p className="text-gray-600">{data.name ? `For ${data.name} • ` : ''}EDD {edd} • GA {ga.weeks}w {ga.days}d (T{tri})</p>
        </div>
        <div className="flex gap-2">
          <a href={icsUrl ?? '#'} target="_blank" className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-100 inline-flex items-center gap-2"><CalendarPlus className="w-4 h-4" /> Calendar</a>
          <button onClick={()=>window.print()} className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-100 inline-flex items-center gap-2"> <Printer className="w-4 h-4" /> Print</button>
        </div>
      </header>

      <section className="rounded-xl border bg-white/70 backdrop-blur p-4">
        <div className="text-sm text-gray-700">Share this link.</div>
        <div className="mt-2 flex items-center gap-2">
          <input className="w-full border rounded-lg px-3 py-2 text-sm" value={shareUrl} readOnly />
          <button onClick={()=>copy(shareUrl)} className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-100 inline-flex items-center gap-2"><Copy className="w-4 h-4" /> {copied ? 'Copied' : 'Copy'}</button>
        </div>
      </section>

      <section className="rounded-xl border bg-white/70 backdrop-blur">
        <ul className="divide-y">
          {schedule.map((v)=>(
            <li key={v.date} className="p-3 flex items-center justify-between">
              <div className="min-w-0">
                <div className="font-medium">{v.label}</div>
                <div className="text-xs text-gray-500">{role==='partner' ? '' : v.purpose}</div>
              </div>
              <div className="text-sm tabular-nums">{v.date}</div>
            </li>
          ))}
        </ul>
      </section>

      {role === 'provider' && (
        <section className="rounded-xl border bg-white/70 backdrop-blur p-4 space-y-2">
          <div className="font-semibold mb-2">Labs & Vaccines Windows</div>
          <ul className="divide-y rounded-xl border overflow-hidden">
            {checklist.map(it=>(
              <li key={it.code} className="p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium">{it.name} <span className="text-xs text-gray-500">({it.code})</span></div>
                  <div className="text-xs text-gray-500">Window {it.startDate} – {it.endDate} • Due {it.dueDate} {it.notes ? `• ${it.notes}` : ''}</div>
                </div>
                <div className="flex items-center gap-2">
                  <a href={typeof window === 'undefined' ? '#' : buildLabICSUrl(window.location.origin, edd, it.code, 'due', false)} target="_blank" className="px-2 py-1.5 rounded-lg border text-sm hover:bg-gray-100 inline-flex items-center gap-1">
                    <Bell className="w-4 h-4" /> Reminder
                  </a>
                </div>
              </li>
            ))}
          </ul>
          <div className="text-xs text-gray-500">No patient notes/meds are shown on shared links.</div>
        </section>
      )}

      <footer className="text-center text-xs text-gray-500">
        Read-only; no personal logs displayed.
      </footer>
    </main>
  );
}
