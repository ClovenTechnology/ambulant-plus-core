// apps/clinician-app/app/televisit/[id]/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState, useCallback, memo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { LiveKitRoom, VideoConference, useRoomContext } from '@livekit/components-react';
import { DataPacket_Kind } from 'livekit-client';

// Local project components
import DeviceAttachmentsPanel from '@/components/DeviceAttachmentsPanel';
import DeviceDock from '@/components/DeviceDock';
import useVitalsSSE from '@/components/useVitalsSSE';
import ClinicianXRBridge from '@/components/ClinicianXRBridge';
import HoloVitalsOverlay from '@/components/HoloVitalsOverlay';
import ClinicianVitalsPanel from '@/components/ClinicianVitalsPanel';

// Live device read-only panels
import HealthMonitorPanel from '@/components/HealthMonitorPanel';
import NexRingPanel from '@/components/NexRingPanel';
import StethoscopePanel from '@/components/StethoscopePanel';
import OtoscopePanel from '@/components/OtoscopePanel';

// Shared countdown UI
import SessionCountdown from '@/src/components/SessionCountdown';

// Shared autocomplete hook + search helpers
import { useAutocomplete, icdSearch, rxnormSearch } from '@/src/hooks/useAutocomplete';
import type { ICD10Hit, RxNormHit } from '@/src/hooks/useAutocomplete';

/** ---------- Device Settings (prod=RTC, fallback on env or failure) ---------- */
function SafeDeviceSettings() {
  return <div className="text-sm text-gray-600">Safe device settings (fallback)</div>;
}
const DeviceSettings = dynamic(async () => {
  if (process.env.NEXT_PUBLIC_USE_SAFE_SETTINGS === '1') return { default: SafeDeviceSettings };
  try {
    const m = await import('@ambulant/rtc');
    return { default: m.DeviceSettings };
  } catch {
    return { default: SafeDeviceSettings };
  }
}, { ssr: false });

/** ---------- types & helpers ---------- */
type Appt = {
  id: string; when: string; patientId?: string; patientName: string; clinicianName: string; reason: string; status: string; roomId: string;
};
type InsightReply = { summary?: string; goals?: string[]; notes?: string };
type VitalsPkt = { hr?: number; spo2?: number; tempC?: number; rr?: number; bpSys?: number; bpDia?: number; ts?: number };

function normalizeAppt(a: any): Appt {
  const statusRaw = (a?.status ?? 'Scheduled').toString().replace(/_/g, ' ').toLowerCase();
  const status = statusRaw.charAt(0).toUpperCase() + statusRaw.slice(1);
  return {
    id: a?.id ?? '',
    when: a?.when ?? a?.whenISO ?? a?.date ?? '',
    patientId: a?.patientId ?? a?.patient?.id ?? undefined,
    patientName: a?.patientName ?? a?.patient?.name ?? '—',
    clinicianName: a?.clinicianName ?? a?.clinician?.name ?? '—',
    reason: a?.reason ?? a?.caseName ?? '',
    status,
    roomId: a?.roomId ?? a?.room ?? '',
  };
}
async function fetchLiveKitToken(roomId: string, identity: string) {
  try {
    const r = await fetch('/api/rtc/token', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ roomId, identity, room: roomId, user: identity }),
      cache: 'no-store',
    });
    if (r.ok) return (await r.json())?.token as string;
  } catch {}
  const qs = new URLSearchParams({ room: roomId, user: identity }).toString();
  const g = await fetch(`/api/rtc/token?${qs}`, { cache: 'no-store' });
  if (!g.ok) throw new Error(`token HTTP ${g.status}`);
  return (await g.json())?.token as string;
}
const anon = (seed = 'clinician') => `${seed}-${Math.random().toString(36).slice(2, 7)}`;
const num2 = (x?: number) => (typeof x === 'number' && Number.isFinite(x) ? Number(x).toFixed(2) : '—');
function fmtBP(sys?: number, dia?: number) {
  return Number.isFinite(sys!) && Number.isFinite(dia!)
    ? `${Math.round(sys!)} / ${Math.round(dia!)} mmHg`
    : '—/— mmHg';
}

/** ---------- tiny shared UI helpers ---------- */
function Collapse({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div className={`overflow-hidden transition-all duration-300 motion-reduce:transition-none ${open ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
      <div className="pt-2">{children}</div>
    </div>
  );
}
function CollapseBtn({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      className={`text-xs px-2 py-1 border rounded ${open ? 'bg-gray-100' : 'bg-white hover:bg-gray-50'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2`}
      onClick={onClick}
      aria-expanded={open}
      title={open ? 'Collapse' : 'Expand'}
      aria-label={open ? 'Collapse' : 'Expand'}
    >
      {open ? 'Collapse' : 'Expand'}
    </button>
  );
}
function Card({
  title, children, toolbar, className, dense, gradient,
}: {
  title: React.ReactNode; children: React.ReactNode; toolbar?: React.ReactNode; className?: string; dense?: boolean; gradient?: boolean;
}) {
  return (
    <section className={`border rounded bg-white ${className || ''}`}>
      <div className={`flex items-center justify-between ${dense ? 'px-2 py-1.5' : 'px-3 py-2'} border-b ${gradient ? 'bg-gradient-to-b from-gray-50 to-white' : 'bg-gray-50'} rounded-t min-h-[42px]`}>
        <div className="text-sm font-medium">{title}</div>{toolbar ? <div>{toolbar}</div> : null}
      </div>
      <div className={`${dense ? 'p-2 space-y-1.5' : 'p-3 space-y-2'}`}>{children}</div>
    </section>
  );
}
function Field({ label, value, bold = false }: { label: string; value: React.ReactNode; bold?: boolean }) {
  return (
    <div className="text-sm flex items-center justify-between">
      <div className="text-gray-500">{label}</div>
      <div className={bold ? 'font-semibold' : 'font-medium'} suppressHydrationWarning>{value as any}</div>
    </div>
  );
}
function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border p-3 bg-white min-h-[64px]">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
function TextBlock({ label, value, onChange, multiline }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-gray-500">{label}</div>
      {multiline
        ? <textarea className="w-full border rounded px-2 py-1 text-sm" rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
        : <input className="w-full border rounded px-2 py-1 text-sm" value={value} onChange={(e) => onChange(e.target.value)} />}
    </div>
  );
}
function PremiumBanner({ text }: { text: string }) {
  return (
    <div className="mb-2 p-2 text-xs rounded border bg-amber-50 text-amber-800">
      {text}: saving to the consultation summary is a premium feature. Download to device remains available.
    </div>
  );
}
const Badge = memo(function Badge({ label, active, color }: { label: string; active: boolean; color: 'emerald'|'indigo'|'sky'|'red'|'gray' }) {
  const base = 'px-2 py-0.5 rounded text-xs font-medium transition-opacity duration-300';
  const map: Record<typeof color, string> = {
    emerald: 'bg-emerald-600 text-white',
    indigo:  'bg-indigo-600 text-white',
    sky:     'bg-sky-600 text-white',
    red:     'bg-red-600 text-white',
    gray:    'bg-gray-900 text-white',
  };
  const inactive = 'bg-gray-700 text-gray-200 opacity-70';
  return <span className={`${base} ${active ? map[color] : inactive}`}>{label}</span>;
});
function Tabs<T extends string>({ active, onChange, items }:{ active: T; onChange: (k: T)=>void; items: { key: T; label: string }[] }) {
  return (
    <div className="bg-white border rounded">
      <div className="flex gap-1 p-1">
        {items.map(it => {
          const is = it.key === active;
          return (
            <button
              key={String(it.key)}
              onClick={() => onChange(it.key)}
              className={`px-3 py-1.5 text-sm rounded transition-colors ${is ? 'bg-gray-900 text-white' : 'bg-white hover:bg-gray-100 border'}`}
              aria-pressed={is}
              title={it.label}
              aria-label={it.label}
            >
              {it.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** ---------- tolerant extractors (no new deps) ---------- */
const ICD_CODE_RE = /^([A-TV-Z][0-9][0-9AB](?:\.[0-9A-TV-Z]{1,4})?)/i;
function extractIcdCode(s: string) { const m = ICD_CODE_RE.exec((s || '').trim()); return m ? m[1].toUpperCase() : ''; }
function normalize(s: string) { return (s || '').replace(/\s+/g, ' ').trim(); }

/** ---------- lightweight suggestions (backstops) ---------- */
const DRUG_SUGGESTIONS: string[] = [
  'Amoxicillin 500 mg capsule',
  'Paracetamol 500 mg tablet',
  'Ibuprofen 200 mg tablet',
  'Azithromycin 250 mg tablet',
  'Metformin 500 mg tablet',
];
const ICD10_SUGGESTIONS: string[] = [
  'J20.9 — Acute bronchitis, unspecified',
  'R50.9 — Fever, unspecified',
  'R05.9 — Cough, unspecified',
  'I10 — Essential (primary) hypertension',
  'E11.9 — Type 2 diabetes mellitus without complications',
];

/** ---------- broadcast helpers inside LiveKitRoom ---------- */
function ControlPublisher({ state }: { state: { overlay: boolean; captions: boolean; vitals: boolean; recording: boolean; xr: boolean } }) {
  const room = useRoomContext();
  const last = useRef(JSON.stringify(state));
  useEffect(() => {
    const now = JSON.stringify(state);
    if (now === last.current) return;
    last.current = now;
    (async () => {
      try {
        await room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ type: 'overlay',  value: state.overlay })), DataPacket_Kind.RELIABLE, 'control');
        await room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ type: 'captions', value: state.captions })), DataPacket_Kind.RELIABLE, 'control');
        await room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ type: 'vitals',   value: state.vitals })),   DataPacket_Kind.RELIABLE, 'control');
        await room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ type: 'recording',value: state.recording })),DataPacket_Kind.RELIABLE, 'control');
        await room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify({ type: 'xr',       value: state.xr })),       DataPacket_Kind.RELIABLE, 'control');
      } catch {}
    })();
  }, [room, state]);
  return null;
}

/** ---------- page ---------- */
export default function TelevisitWorkspace({ params }: { params: { id: string } }) {
  const { id } = params;

  // Appointment
  const [appt, setAppt] = useState<Appt | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Loader with 404→mock fallback (dev convenience)
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setErr(null);
      try {
        const res = await fetch(`/api/appointments/${encodeURIComponent(id)}`, { cache: 'no-store' });
        if (res.status === 404) {
          const mock = {
            id,
            when: new Date().toISOString(),
            patientId: 'pt-dev',
            patientName: 'Demo Patient',
            clinicianName: 'Demo Clinician',
            reason: 'Acute bronchitis (demo)',
            status: 'Scheduled',
            roomId: 'dev',
          };
          if (alive) setAppt(mock);
        } else if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        } else {
          const raw = await res.json();
          if (alive) setAppt(normalizeAppt(raw));
        }
      } catch (e: any) {
        if (alive) setErr(e?.message || 'Failed to load appointment');
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [id]);

  // LiveKit join
  const lkUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  const [lkToken, setLkToken] = useState<string | null>(null);
  const [lkErr, setLkErr] = useState<string | null>(null);
  const [connected, setConnected] = useState(true); // auto-join

  useEffect(() => {
    let alive = true;
    (async () => {
      setLkToken(null); setLkErr(null);
      if (!appt?.roomId) return;
      if (!lkUrl) { setLkErr('Missing NEXT_PUBLIC_LIVEKIT_URL'); return; }
      try {
        const identity = anon(appt?.clinicianName?.split(' ')?.[0] || 'clinician');
        const token = await fetchLiveKitToken(appt.roomId, identity);
        if (alive) setLkToken(token);
      } catch (e: any) { if (alive) setLkErr(e?.message || 'Failed to fetch LiveKit token'); }
    })();
    return () => { alive = false; };
  }, [appt?.roomId, lkUrl]);

  // SSE vitals + SFU vitals (from bridge/topic)
  const sseVitals = useVitalsSSE(appt?.roomId);
  const [sfuVitals, setSfuVitals] = useState<VitalsPkt | null>(null);

  // Toggles
  const [showOverlay, setShowOverlay] = useState(true);
  const [captionsOn, setCaptionsOn] = useState(false);
  const [showMonitor, setShowMonitor] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [xrEnabled, setXrEnabled] = useState(false);

  // eRx state
  type RxRow = { drug: string; dose: string; route: string; freq: string; duration: string; qty: string; refills: number; notes?: string };
  const [rxRows, setRxRows] = useState<RxRow[]>([{ drug: '', dose: '', route: '', freq: '', duration: '', qty: '', refills: 0 }]);
  const addRxRow = () => setRxRows((r) => [...r, { drug: '', dose: '', route: '', freq: '', duration: '', qty: '', refills: 0 }]);
  const removeRxRow = (i: number) => setRxRows((r) => r.filter((_, j) => j !== i));
  const [erxResult, setErxResult] = useState<any>(null);

  const [soap, setSoap] = useState({ s: '', o: '', a: '', p: '' });
  useEffect(() => { try { localStorage.setItem(`televisit-soap-v3-${id}`, JSON.stringify(soap)); } catch {} }, [soap, id]);

  async function sendErx() {
    try {
      if (!appt?.id) throw new Error('Missing appointment id');
      const meds = rxRows
        .filter((r) => r.drug && (r.dose || r.freq))
        .map((r) => ({ drug: r.drug, sig: [r.dose, r.route, r.freq, r.duration].filter(Boolean).join(' '), qty: r.qty, refills: r.refills, notes: r.notes }));
      const r = await fetch('/api/erx', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ appointmentId: appt.id, meds }) });
      const js = await r.json();
      setErxResult(js);
    } catch (e: any) {
      setErxResult({ error: e?.message || 'Failed' });
    }
  }

  async function pushOrder(kind: 'CarePort' | 'MedReach') {
    try {
      const primary = rxRows.find((r) => r.drug && (r.dose || r.freq));
      if (!primary) return alert('Add at least one medication row');
      const payload = { encounterId: appt?.id || `enc-${Date.now()}`, eRx: { drug: primary.drug, sig: [primary.dose, primary.route, primary.freq, primary.duration].filter(Boolean).join(' ') } };
      const r = await fetch('/api/erx/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const js = await r.json();
      if (!js?.ok) throw new Error(js?.error || 'Order error');
      alert(`${kind} order created: ${js.id || js.order?.id}`);
    } catch (e: any) { alert(e?.message || 'Failed to create order'); }
  }

  // InsightCore
  const [insightBusy, setInsightBusy] = useState(false);
  const [insight, setInsight] = useState<InsightReply | null>(null);
  async function analyzeWithInsight() {
    setInsightBusy(true);
    try {
      const payload = { soap, patient: appt?.patientName, clinician: appt?.clinicianName, reason: appt?.reason, meds: rxRows };
      const res = await fetch('/api/insightcore', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      setInsight(((await res.json()) as InsightReply) ?? { summary: 'No insight returned' });
    } catch {
      setInsight({ summary: 'InsightCore unavailable. Try again later.' });
    } finally { setInsightBusy(false); }
  }

  const whenPretty = useMemo(() => (appt?.when ? new Date(appt.when).toLocaleString() : '—'), [appt?.when]);

  // Collapsible device panes (match SFU)
  const [showSession, setShowSession] = useState(true);
  const [showIomt, setShowIomt] = useState(true);
  const [showGraph, setShowGraph] = useState(true);
  const [showHealth, setShowHealth] = useState(true);
  const [showRing, setShowRing] = useState(true);
  const [showSteth, setShowSteth] = useState(true);
  const [showOto, setShowOto] = useState(true);

  // Right tabs + visibility (match SFU)
  type TabKey = 'soap' | 'erx' | 'devices' | 'insight';
  const [rightTab, setRightTab] = useState<TabKey>('soap');
  const [rightPanelsOpen, setRightPanelsOpen] = useState(true);

  // ICD-10 + RxNorm autocomplete (parity with SFU)
  const icdDxAuto = useAutocomplete<ICD10Hit>(icdSearch);
  const [dxCode, setDxCode] = useState<string>('');
  const icdDxOptions = icdDxAuto.opts.map(h => ({ code: h.code, text: `${h.code} — ${h.title}` }));
  const icdDxOptionsFinal = icdDxOptions.length ? icdDxOptions : ICD10_SUGGESTIONS.map((t, i) => ({ code: extractIcdCode(t) || `SUG-${i}`, text: t }));

  const icdSympAuto = useAutocomplete<ICD10Hit>(icdSearch);
  const [sympCode, setSympCode] = useState<string>('');
  const icdSympOptions = icdSympAuto.opts.map(h => ({ code: h.code, text: `${h.code} — ${h.title}` }));
  const icdSympOptionsFinal = icdSympOptions.length ? icdSympOptions : ICD10_SUGGESTIONS.map((t, i) => ({ code: extractIcdCode(t) || `SUG-${i}`, text: t }));

  const rxAuto = useAutocomplete<RxNormHit>(rxnormSearch);
  const rxOptionsFinal: { name: string; rxcui?: string }[] =
    (rxAuto.opts as RxNormHit[]).length
      ? (rxAuto.opts as RxNormHit[])
      : DRUG_SUGGESTIONS.map((name) => ({ name }));

  return (
    <main className="min-h-screen bg-gray-50">
      <HoloVitalsOverlay roomId={appt?.roomId} visible={xrEnabled} />

      <header className="sticky top-0 z-40 flex items-center justify-between p-4 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 shadow-sm">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">Televisit Workspace</h1>
          {appt && <span className="text-xs text-gray-500">When: {whenPretty}</span>}
          {appt && <span className="px-2 py-1 rounded border bg-white text-xs">Session: {appt.id}</span>}
          {lkErr && <span className="text-xs text-red-600">LiveKit: {lkErr}</span>}
        </div>

        <div className="flex items-center gap-2">
          <button
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full border ${xrEnabled ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 bg-white hover:bg-gray-50'} text-xs`}
            onClick={() => setXrEnabled(v => !v)} title="XR mode (broadcasts to patient)"
            aria-pressed={xrEnabled}
          >
            XR: {xrEnabled ? 'ON' : 'OFF'}
          </button>

          <button
            onClick={() => setShowMonitor(v=>!v)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-gray-200 bg-white shadow-sm hover:bg-gray-50 text-xs"
            title={showMonitor ? 'Hide Monitor' : 'Show Monitor'}
            aria-pressed={showMonitor}
          >
            {showMonitor ? 'Hide Monitor' : 'Show Monitor'}
          </button>

          <button
            onClick={() => setCaptionsOn(v=>!v)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-gray-200 bg-white shadow-sm hover:bg-gray-50 text-xs"
            title={captionsOn ? 'Stop Captions' : 'Start Captions'}
            aria-pressed={captionsOn}
          >
            {captionsOn ? 'Stop Captions' : 'Start Captions'}
          </button>

          <button
            onClick={() => setShowOverlay(v=>!v)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-gray-200 bg-white shadow-sm hover:bg-gray-50 text-xs"
            title={showOverlay ? 'Hide Overlay' : 'Show Overlay'}
            aria-pressed={showOverlay}
          >
            {showOverlay ? 'Hide Overlay' : 'Show Overlay'}
          </button>

          {!isRecording ? (
            <button className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-gray-200 bg-white shadow-sm hover:bg-gray-50 text-xs" onClick={() => setIsRecording(true)}>Start Rec</button>
          ) : (
            <button className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-red-200 bg-red-50 shadow-sm hover:bg-red-100 text-xs" onClick={() => setIsRecording(false)}>Stop Rec</button>
          )}

          <details className="relative">
            <summary className="list-none inline-flex">
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-gray-200 bg-white shadow-sm hover:bg-gray-50 text-xs">Devices…</span>
            </summary>
            <div className="absolute right-0 mt-2 border rounded bg-white p-3 w-[820px] max-w-[95vw] max-h-[80vh] overflow-auto shadow-xl z-50">
              <DeviceSettings />
            </div>
          </details>

          <Link href="/appointments" className="text-sm text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">Back</Link>
        </div>
      </header>

      {loading && <Banner kind="info">Loading appointment…</Banner>}
      {err && <Banner kind="error">Error: {err}</Banner>}
      {!loading && !appt && !err && <Banner kind="info">Appointment not found.</Banner>}

      {appt && (
        <div className="transition-all duration-300 motion-reduce:transition-none container mx-auto px-4 py-6">
          <div className={`grid md:gap-6 gap-3 lg:grid-cols-[1.2fr_2fr_1.2fr]`}>
            {/* LEFT: Session Info + device panels */}
            <div className="flex flex-col space-y-4">
              <Card title="Session Information" gradient toolbar={<CollapseBtn open={showSession} onClick={()=>setShowSession(v=>!v)} />}>
                <Collapse open={showSession}>
                  <Field label="Patient Name" value={appt.patientName} />
                  <Field label="Patient ID" value={(appt.patientId ?? appt.patientName).toString().replace(/\s+/g, '').toUpperCase().slice(0, 8)} />
                  <Field label="Case Name" value={appt.reason || '—'} bold />
                  <Field label="Case ID" value={<span className="font-mono">{`CASE-${appt.id.slice(-4)}`}</span>} />
                  <Field label="Session ID" value={<span className="font-mono">{appt.id}</span>} />
                  <Field label="Session Date" value={whenPretty} />
                  <Field label="Clinician" value={appt.clinicianName} />
                  <Field label="Status" value={appt.status} />
                </Collapse>
              </Card>

              {showMonitor && sfuVitals && (
                <Card title="Live Monitor (via SFU)" gradient toolbar={<CollapseBtn open={!!showMonitor} onClick={()=>setShowMonitor(v=>!v)} />}>
                  <Collapse open={!!showMonitor}>
                    <div className="grid grid-cols-2 gap-3">
                      <Tile label="HR"   value={`${num2(sfuVitals.hr)} bpm`} />
                      <Tile label="SpO₂" value={`${num2(sfuVitals.spo2)} %`} />
                      <Tile label="Temp" value={`${num2(sfuVitals.tempC)} °C`} />
                      <Tile label="RR"   value={`${num2(sfuVitals.rr)} /min`} />
                      <Tile label="BP"   value={fmtBP(sfuVitals.bpSys, sfuVitals.bpDia)} />
                    </div>
                  </Collapse>
                </Card>
              )}

              <Card title="Health Monitor (IoMT)" gradient toolbar={<CollapseBtn open={showHealth} onClick={()=>setShowHealth(v=>!v)} />}>
                <Collapse open={showHealth}>
                  <PremiumBanner text="Health Monitor" />
                  <HealthMonitorPanel roomId={appt.roomId} />
                </Collapse>
              </Card>

              <Card title="Stethoscope" gradient toolbar={<CollapseBtn open={showSteth} onClick={()=>setShowSteth(v=>!v)} />}>
                <Collapse open={showSteth}>
                  <PremiumBanner text="Stethoscope recordings" />
                  <StethoscopePanel roomId={appt.roomId} />
                </Collapse>
              </Card>

              <Card title="Otoscope" gradient toolbar={<CollapseBtn open={showOto} onClick={()=>setShowOto(v=>!v)} />}>
                <Collapse open={showOto}>
                  <PremiumBanner text="Otoscope captures" />
                  <OtoscopePanel roomId={appt.roomId} />
                </Collapse>
              </Card>

              <Card title="NexRing (Wearable)" gradient toolbar={<CollapseBtn open={showRing} onClick={()=>setShowRing(v=>!v)} />}>
                <Collapse open={showRing}>
                  <PremiumBanner text="NexRing" />
                  <NexRingPanel roomId={appt.roomId} />
                </Collapse>
              </Card>
            </div>

            {/* CENTER: Video + session conclusions */}
            <div className="flex flex-col space-y-4">
              <Card
                title={`Consultation — ${appt.patientName}`}
                gradient
              >
                <div className="relative aspect-video w-full rounded overflow-hidden bg-black ring-1 ring-gray-200">
                  {appt.roomId && lkUrl && lkToken ? (
                    <LiveKitRoom token={lkToken} serverUrl={lkUrl} connect={connected} audio video onDisconnected={() => setConnected(false)}>
                      <VideoConference />
                      <ClinicianXRBridge roomId={appt.roomId} onChange={(enabled: boolean) => setXrEnabled(enabled)} />
                      <ControlPublisher state={{ overlay: showOverlay, captions: captionsOn, vitals: showMonitor, recording: isRecording, xr: xrEnabled }} />
                    </LiveKitRoom>
                  ) : (
                    <div className="w-full h-full grid place-items-center text-sm text-gray-400">
                      {!appt.roomId ? 'No room assigned.' : !lkUrl ? 'Missing LiveKit URL.' : 'Joining…'}
                    </div>
                  )}

                  {/* Status ribbon */}
                  <div className="absolute top-3 right-3 flex gap-1 drop-shadow-sm">
                    <Badge label="Vitals" active={showMonitor} color="emerald" />
                    <Badge label="Captions" active={captionsOn} color="indigo" />
                    <Badge label="Overlay" active={showOverlay} color="sky" />
                    {isRecording && <Badge label="● Recording" active color="red" />}
                    <Badge label="XR" active={xrEnabled} color="gray" />
                  </div>
                </div>
              </Card>

              <SessionConclusions
                clinicianId={'clinician-local-001'}
                encounterId={appt.id ? `enc-${appt.id}` : ''}
                apptStartISO={appt.when}
              />
            </div>

            {/* RIGHT: Graph, Room Chat, Tabs with Clerk Desk / eRx / Devices / Insight, IoMT vitals at bottom */}
            <div className="flex flex-col space-y-4">
              <Card title="Bedside Monitor (live)" gradient toolbar={<CollapseBtn open={showGraph} onClick={()=>setShowGraph(v=>!v)} />}>
                <Collapse open={showGraph}>
                  <ClinicianVitalsPanel room={null as any} defaultCollapsed={false} maxPoints={240} showDockBadge={false} liveVitals={sseVitals} />
                </Collapse>
              </Card>

              <RoomChat appt={appt} />

              <div className="sticky top-20 z-10 shadow-sm bg-white rounded">
                <div className="flex items-center justify-between p-1">
                  <Tabs
                    active={rightTab}
                    onChange={setRightTab}
                    items={[
                      { key: 'soap', label: 'SOAP' },
                      { key: 'erx',  label: 'eRx' },
                      { key: 'devices', label: 'Devices' },
                      { key: 'insight', label: 'Insight' },
                    ]}
                  />
                  <button
                    className="ml-2 px-2 py-1 text-xs border rounded"
                    onClick={() => setRightPanelsOpen(v=>!v)}
                    aria-pressed={rightPanelsOpen}
                    title={rightPanelsOpen ? 'Collapse panels' : 'Expand panels'}
                  >
                    {rightPanelsOpen ? 'Collapse' : 'Expand'}
                  </button>
                </div>
              </div>

              <Collapse open={rightPanelsOpen}>
                {/* SOAP/Clerk Desk with ICD-10 */}
                {rightTab === 'soap' && (
                  <Card title="Clerk Desk" gradient>
                    {/* Symptoms with ICD-10 autocomplete */}
                    <div className="space-y-1">
                      <div className="text-xs text-gray-500">Symptoms (ICD-10 autocomplete; free text allowed)</div>
                      <input
                        list="icd10-suggest-symptoms"
                        className="w-full border rounded px-2 py-1 text-sm"
                        value={icdSympAuto.q || soap.s}
                        onChange={(e) => {
                          icdSympAuto.setQ(e.target.value);
                          setSympCode('');
                          setSoap(s => ({ ...s, s: e.target.value }));
                        }}
                        onFocus={(e) => { const v = e.currentTarget.value; if (v) icdSympAuto.setQ(v); }}
                        onBlur={(e) => {
                          const v = e.currentTarget.value;
                          const direct = extractIcdCode(v);
                          if (direct) { setSympCode(direct); return; }
                          const norm = normalize(v).toLowerCase();
                          const opt = icdSympOptionsFinal.find(o =>
                            normalize(o.text).toLowerCase() === norm ||
                            normalize(o.text).toLowerCase().startsWith(norm) ||
                            o.code.toLowerCase() === norm
                          );
                          if (opt) setSympCode(opt.code);
                        }}
                        placeholder="Type to search ICD-10 (free text allowed)"
                        aria-label="Symptoms"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                      />
                      <datalist id="icd10-suggest-symptoms">
                        {icdSympOptionsFinal.map(o => <option key={o.code} value={o.text} />)}
                      </datalist>
                      {sympCode && (
                        <div className="text-[11px] text-gray-600">
                          Selected code: <span className="font-mono">{sympCode}</span>
                        </div>
                      )}
                    </div>

                    <TextBlock label="Allergies" value={soap.o} onChange={(v) => setSoap({ ...soap, o: v })} />
                    <TextBlock label="Presenting Complaints" value={soap.a} onChange={(v) => setSoap({ ...soap, a: v })} />
                    <TextBlock label="History of Present Illness (HPI)" value={soap.p} onChange={(v) => setSoap({ ...soap, p: v })} multiline />

                    {/* ICD-10 Diagnosis */}
                    <div className="space-y-1">
                      <div className="text-xs text-gray-500">Diagnosis (ICD-10)</div>
                      <input
                        list="icd10-suggest-dx"
                        className="w-full border rounded px-2 py-1 text-sm"
                        value={icdDxAuto.q}
                        onChange={(e) => { icdDxAuto.setQ(e.target.value); setDxCode(''); }}
                        onFocus={(e) => { const v = e.currentTarget.value; if (v) icdDxAuto.setQ(v); }}
                        onBlur={(e) => {
                          const v = e.currentTarget.value;
                          const direct = extractIcdCode(v);
                          if (direct) { setDxCode(direct); return; }
                          const norm = normalize(v).toLowerCase();
                          const matched = icdDxOptionsFinal.find(o =>
                            normalize(o.text).toLowerCase() === norm ||
                            normalize(o.text).toLowerCase().startsWith(norm) ||
                            o.code.toLowerCase() === norm
                          );
                          if (matched) setDxCode(matched.code);
                        }}
                        placeholder="Type to search ICD-10 (free text allowed)"
                        aria-label="Diagnosis"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                      />
                      <datalist id="icd10-suggest-dx">
                        {icdDxOptionsFinal.map(o => <option key={o.code} value={o.text} />)}
                      </datalist>
                      {dxCode && (
                        <div className="text-[11px] text-gray-600">
                          Selected code: <span className="font-mono">{dxCode}</span>
                        </div>
                      )}
                    </div>

                    <ReferralPanel />
                    <TextBlock label="Patient Education" value={''} onChange={() => {}} multiline />
                  </Card>
                )}

                {/* eRx with RxNorm autocomplete + Lab orders (same as SFU) */}
                {rightTab === 'erx' && (
                  <ErxComposer
                    rxRows={rxRows}
                    setRxRows={setRxRows}
                    addRxRow={addRxRow}
                    removeRxRow={removeRxRow}
                    rxOptionsFinal={rxOptionsFinal}
                    rxAuto={rxAuto}
                    sendErx={sendErx}
                    pushOrder={pushOrder}
                    erxResult={erxResult}
                  />
                )}

                {/* Devices */}
                {rightTab === 'devices' && (
                  <>
                    <Card title="Attachments & Devices" gradient>
                      <DeviceDock patientId={appt.patientId} roomId={appt.roomId} />
                      <DeviceAttachmentsPanel patientId={appt.patientId} roomId={appt.roomId} />
                    </Card>

                    <Card title="Stethoscope" gradient toolbar={<CollapseBtn open={showSteth} onClick={()=>setShowSteth(v=>!v)} />}>
                      <Collapse open={showSteth}>
                        <PremiumBanner text="Stethoscope recordings" />
                        <StethoscopePanel roomId={appt.roomId} />
                      </Collapse>
                    </Card>

                    <Card title="Otoscope" gradient toolbar={<CollapseBtn open={showOto} onClick={()=>setShowOto(v=>!v)} />}>
                      <Collapse open={showOto}>
                        <PremiumBanner text="Otoscope captures" />
                        <OtoscopePanel roomId={appt.roomId} />
                      </Collapse>
                    </Card>
                  </>
                )}

                {/* Insight */}
                {rightTab === 'insight' && (
                  <Card title="InsightCore" gradient toolbar={<button className="text-xs px-2 py-1 border rounded" onClick={analyzeWithInsight} disabled={insightBusy}>{insightBusy ? 'Analyzing…' : 'Analyze Notes'}</button>}>
                    {insight ? (
                      <div className="space-y-2 text-sm">
                        {insight.summary && <p className="font-medium">{insight.summary}</p>}
                        {Array.isArray(insight.goals) && insight.goals.length > 0 && (<ul className="list-disc pl-5 space-y-1">{insight.goals.map((g, i) => <li key={i}>{g}</li>)}</ul>)}
                        {insight.notes && <p className="text-gray-600">{insight.notes}</p>}
                        <div className="flex gap-2 pt-1">
                          <button className="px-2 py-1 border rounded text-xs">Accept</button>
                          <button className="px-2 py-1 border rounded text-xs">Adjust</button>
                          <button className="px-2 py-1 border rounded text-xs">Decline</button>
                        </div>
                      </div>
                    ) : (<div className="text-sm text-gray-600">Run analysis to get AI-assisted goals & notes.</div>)}
                  </Card>
                )}
              </Collapse>

              {/* IoMT numbers summary at very bottom (match SFU placement) */}
              <Card title="Vitals from IoMTs (live)" gradient toolbar={<CollapseBtn open={showIomt} onClick={()=>setShowIomt(v=>!v)} />}>
                <Collapse open={showIomt}>
                  {sseVitals?.length ? (
                    <div className="grid grid-cols-2 gap-3">
                      {/* take the latest aggregate by type if you have structured packets; here we just show recent entries */}
                      {sseVitals.slice(-6).reverse().map((v, i) => (
                        <div key={i} className="text-sm flex items-center justify-between border rounded p-2 bg-white">
                          <span className="font-mono text-xs text-gray-500">{new Date(v.t).toLocaleTimeString()}</span>
                          <span>{v.type}</span>
                          <span className="font-semibold">{v.value}{v.unit ? ` ${v.unit}` : ''}</span>
                        </div>
                      ))}
                    </div>
                  ) : <div className="text-sm text-gray-500">No live vitals yet.</div>}
                </Collapse>
              </Card>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* ----- small UI bits ----- */
function Banner({ kind, children }: { kind: 'info' | 'error'; children: React.ReactNode }) {
  const cls = kind === 'error' ? 'p-3 border rounded bg-red-50 text-sm text-red-700' : 'p-3 border rounded bg-white text-sm';
  return <div className={cls}>{children}</div>;
}

/* ----- Room Chat with same shell ----- */
function RoomChat({ appt }: { appt: Appt }) {
  const room = useRoomContext();
  const [chat, setChat] = useState<{ from: string; text: string }[]>([]);
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [unread, setUnread] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const onData = (payload: Uint8Array, _p: any, _k: any, topic?: string) => {
      if (topic !== 'chat') return;
      try {
        const data = JSON.parse(new TextDecoder().decode(payload));
        setChat(c => [...c, { from: data.from || 'remote', text: data.text || '' }]);
        const el = boxRef.current;
        const atBottom = el ? (el.scrollHeight - el.scrollTop - el.clientHeight < 8) : true;
        if (!visible || !atBottom) setUnread(u => u + 1);
      } catch {}
    };
    room.on('dataReceived' as any, onData);
    return () => { room.off('dataReceived' as any, onData); };
  }, [room, visible]);

  useEffect(() => {
    if (!visible) return;
    const el = boxRef.current; if (!el) return;
    el.scrollTop = el.scrollHeight; setUnread(0);
  }, [visible, chat.length]);

  const send = async () => {
    const text = msg.trim(); if (!text) return; setMsg(''); setSending(true);
    setChat(c => [...c, { from: 'me', text }]);
    try {
      await room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ text, from: appt?.clinicianName || 'clinician' })), DataPacket_Kind.RELIABLE, 'chat'
      );
      const el = boxRef.current; if (el) el.scrollTop = el.scrollHeight;
    } finally { setSending(false); }
  };

  return (
    <Card
      title={<span>Room Chat {unread > 0 ? <span className="ml-1 inline-flex items-center justify-center text-[11px] leading-none px-1.5 py-0.5 rounded-full bg-red-600 text-white">{unread}</span> : null}</span>}
      gradient
      toolbar={<CollapseBtn open={visible} onClick={() => { setVisible(v => !v); if (!visible) setUnread(0); }} />}
    >
      <Collapse open={visible}>
        <div ref={boxRef} className="h-40 overflow-auto border rounded p-2 text-sm bg-white">
          {chat.map((c, i) => (<div key={i} className="mb-1"><span className="text-gray-500 font-mono">{c.from}:</span> {c.text}</div>))}
          {chat.length === 0 && <div className="text-gray-400 text-sm">No messages yet</div>}
        </div>
        <div className="mt-2 flex gap-2">
          <textarea
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={2}
            className="border rounded px-2 py-1 text-sm flex-1 resize-y"
            placeholder="Type message… (Enter to send, Shift+Enter for newline)"
          />
          <button onClick={send} disabled={sending || !msg.trim()} className="px-3 py-1.5 border rounded bg-blue-50 hover:bg-blue-100 disabled:opacity-50">Send</button>
        </div>
      </Collapse>
    </Card>
  );
}

/* ----- Session Conclusions (parity with SFU) ----- */
function SessionConclusions({ clinicianId, encounterId, apptStartISO }: { clinicianId: string; encounterId: string; apptStartISO: string }) {
  type K = 'end' | 'follow' | 'ref';
  const [tab, setTab] = useState<K>('end');
  const [confirmEnd, setConfirmEnd] = useState<null | 'save' | 'discharge'>(null);

  const appointment = useMemo(() => {
    const start = new Date(apptStartISO);
    const end = new Date(start.getTime() + 15 * 60 * 1000);
    return { id: 'appt-local', start: start.toISOString(), end: end.toISOString(), patient: { name: '—' } } as any;
  }, [apptStartISO]);

  return (
    <Card title="Session Conclusions" gradient>
      <div className="mb-2">
        <Tabs<K>
          active={tab}
          onChange={setTab}
          items={[
            { key: 'end', label: 'End/Save Session' },
            { key: 'follow', label: 'Book Follow-up' },
            { key: 'ref', label: 'Referral' },
          ]}
        />
      </div>

      {tab === 'end' && (
        <div className="space-y-3">
          <SessionCountdown appointment={appointment} loading={false} />
          <div className="flex items-center justify-end gap-2">
            <button className="px-3 py-2 rounded-md bg-white border hover:bg-gray-50" onClick={() => setConfirmEnd('save')} title="Save encounter">Save</button>
            <button className="px-3 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setConfirmEnd('discharge')} title="Discharge patient">Discharge</button>
          </div>

          {confirmEnd && (
            <div className="fixed inset-0 z-50 bg-black/50 grid place-items-center p-4" onClick={() => setConfirmEnd(null)}>
              <div className="bg-white rounded shadow-xl p-4 w-full max-w-md" onClick={(e)=>e.stopPropagation()}>
                <div className="text-base font-semibold mb-1">
                  {confirmEnd === 'save' ? 'Save Encounter' : 'Discharge Patient'}
                </div>
                <div className="text-sm text-gray-600 mb-3">Rx data become read-only after finalization.</div>
                <div className="flex items-center justify-end gap-2">
                  <button className="px-3 py-1.5 border rounded" onClick={() => setConfirmEnd(null)}>Cancel</button>
                  {confirmEnd === 'save' ? (
                    <button
                      className="px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                      onClick={() => {
                        if (!encounterId) { alert('Missing encounterId — pass one if needed'); return; }
                        window.location.href = `/encounters/${encodeURIComponent(encounterId)}`;
                      }}
                    >
                      Save &amp; Complete
                    </button>
                  ) : (
                    <button
                      className="px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                      onClick={() => { window.location.href = '/consults/discharge'; }}
                    >
                      Save &amp; Send Discharge
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'follow' && <FollowupSlotPicker clinicianId={clinicianId} />}

      {tab === 'ref' && <ReferralPanel />}
    </Card>
  );
}

function FollowupSlotPicker({ clinicianId }: { clinicianId: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [slots, setSlots] = useState<Record<string, { start: string; end: string; label?: string }[]>>({});
  const [sel, setSel] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setBusy(true); setErr(null);
      try {
        const start = new Date(); start.setHours(0,0,0,0);
        const startStr = start.toISOString().slice(0,10);
        const url = `/api/schedule/slots/batch?start=${encodeURIComponent(startStr)}&days=14&clinicianId=${encodeURIComponent(clinicianId)}`;
        const r = await fetch(url, { cache: 'no-store' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const js = await r.json();
        setSlots(js.slots || {});
      } catch (e:any) {
        setErr(e?.message || 'Failed to load slots');
      } finally { setBusy(false); }
    })();
  }, [clinicianId]);

  const days = useMemo(() => {
    const d0 = new Date(); d0.setHours(0,0,0,0);
    return Array.from({ length: 14 }).map((_,i) => { const d = new Date(d0); d.setDate(d0.getDate()+i); return d; });
  }, []);

  return (
    <div className="space-y-3">
      <div className="border rounded p-3">
        <div className="text-sm font-medium mb-2">Clinician Calendar (live)</div>
        {busy && <div className="text-sm text-gray-600">Loading…</div>}
        {err && <div className="text-sm text-rose-600">Error: {err}</div>}
        {!busy && !err && (
          <div className="grid grid-cols-1 md:grid-cols-7 gap-2 text-xs">
            {days.map(d => (
              <div key={d.toISOString()} className="border rounded p-2">
                <div className="font-medium mb-1">{d.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' })}</div>
                <div className="flex flex-col gap-1">
                  {(slots[d.toISOString().slice(0,10)] || []).length === 0 ? <span className="text-gray-400">—</span> :
                    (slots[d.toISOString().slice(0,10)] || []).map((s,i) => {
                      const t = new Date(s.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      const id = `${s.start}|${s.end}`;
                      const active = sel === id;
                      return (
                        <button
                          key={i}
                          onClick={() => setSel(id)}
                          className={`border rounded px-2 py-1 hover:bg-gray-50 ${active ? 'bg-gray-900 text-white' : ''}`}
                          title={`${new Date(s.start).toLocaleString()} → ${new Date(s.end).toLocaleTimeString()}`}
                        >
                          {t}
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border rounded p-3">
        <div className="text-sm font-medium mb-1">Investigations ETA</div>
        <ul className="text-sm list-disc pl-5 text-gray-700">
          <li>CBC — ETA 24–48h</li>
          <li>CXR — ETA 24h</li>
          <li>SARS-CoV-2 PCR — ETA 24–72h</li>
        </ul>
      </div>

      <div className="flex justify-end">
        <button
          disabled={!sel}
          className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          onClick={() => { if (!sel) return; alert(`Selected slot: ${sel}`); }}
        >
          Confirm
        </button>
      </div>
    </div>
  );
}

/** ---------- Referral Panel (Internal + External) ---------- */
function ReferralPanel() {
  type Clin = {
    id: string; name: string; specialty: string; location: string;
    gender?: string; cls?: 'Doctor' | 'Allied Health' | 'Wellness';
    priceZAR?: number; rating?: number; online?: boolean;
  };
  const UI_CLASSES = ['Doctors', 'Allied Health', 'Wellness'] as const;
  type UIClass = typeof UI_CLASSES[number];
  const toDataClass = (tab: UIClass): Clin['cls'] => (tab === 'Doctors' ? 'Doctor' : tab);

  const [rawList, setRawList] = useState<Clin[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Filters
  const [tab, setTab] = useState<UIClass>('Doctors');
  const [filters, setFilters] = useState({ q: '', specialty: '', gender: '', location: '' });

  // Exclusivity: internal vs external
  const [mode, setMode] = useState<'internal' | 'external' | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await fetch('/api/clinicians?limit=500', { cache: 'no-store' });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const js = await r.json();
        const items = (js?.items || []) as Clin[];
        if (!Array.isArray(items) || items.length === 0) throw new Error('empty');
        setRawList(
          items.map((c: any) => ({
            id: c.id,
            name: c.name,
            specialty: c.specialty || '',
            location: c.location || '',
            gender: (c.gender || '').trim(),
            cls: c.cls || 'Doctor',
            priceZAR: c.priceZAR,
            rating: c.rating,
            online: c.online,
          }))
        );
      } catch {
        const mock: Clin[] = [
          { id: 'clin-za-001', name: 'Dr Ama Ndlovu', specialty: 'GP', location: 'Johannesburg', gender: 'Female', cls: 'Doctor', priceZAR: 500, rating: 4.7, online: true },
          { id: 'clin-za-002', name: 'Dr Jane Smith', specialty: 'Cardiology', location: 'Cape Town', gender: 'Female', cls: 'Doctor', priceZAR: 850, rating: 4.8, online: true },
          { id: 'clin-za-003', name: 'Dr Adam Lee', specialty: 'ENT', location: 'Johannesburg', gender: 'Male', cls: 'Doctor', priceZAR: 700, rating: 4.6, online: true },
          { id: 'clin-za-101', name: 'RN T. Dube', specialty: 'Nurse', location: 'Durban', gender: 'Male', cls: 'Allied Health', priceZAR: 300, rating: 4.5, online: false },
          { id: 'clin-za-201', name: 'Coach L. Maseko', specialty: 'Therapist', location: 'Pretoria', gender: 'Female', cls: 'Wellness', priceZAR: 400, rating: 4.4, online: true },
        ];
        setRawList(mock);
      } finally { setLoading(false); }
    })();
  }, []);

  const scoped = useMemo(() => rawList.filter(c => c.cls === toDataClass(tab)), [rawList, tab]);
  const specialties = useMemo(() => Array.from(new Set(scoped.map(c => c.specialty))).filter(Boolean), [scoped]);
  const genders = useMemo(() => {
    const set = new Set(scoped.map(c => (c.gender || '').trim()).filter(Boolean));
    const arr = Array.from(set);
    return arr.length ? arr : ['Male', 'Female', 'Other'];
  }, [scoped]);
  const locations = useMemo(() => Array.from(new Set(scoped.map(c => c.location))).filter(Boolean), [scoped]);

  const filtered = useMemo(() => {
    let L = scoped;
    const q = filters.q.trim().toLowerCase();
    if (q) L = L.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.specialty.toLowerCase().includes(q) ||
      c.location.toLowerCase().includes(q)
    );
    if (filters.specialty) L = L.filter(c => c.specialty === filters.specialty);
    if (filters.gender)    L = L.filter(c => (c.gender || '').trim() === filters.gender);
    if (filters.location)  L = L.filter(c => c.location === filters.location);
    L = [...L].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    return L;
  }, [scoped, filters]);

  // Internal selection
  const [selId, setSelId] = useState<string>('');
  const sel = filtered.find(c => c.id === selId) || null;

  // External manual
  const [extName, setExtName] = useState('');
  const [extEmail, setExtEmail] = useState('');
  const [extPhone, setExtPhone] = useState('');

  const emailOk = useMemo(() => {
    if (!extEmail.trim()) return false;
    const re = /^[^\s"<>@]+@[^\s"<>@]+\.[A-Za-z]{2,}$/;
    return re.test(extEmail.trim());
  }, [extEmail]);
  const phoneOk = useMemo(() => /^\d{7,15}$/.test(extPhone), [extPhone]);

  useEffect(() => { if (selId) setMode('internal'); }, [selId]);
  useEffect(() => { if (extName || extEmail || extPhone) setMode('external'); }, [extName, extEmail, extPhone]);

  const disableInternal = mode === 'external';
  const disableExternal = mode === 'internal';

  return (
    <div className="space-y-4 mt-4">
      <div className={`border rounded p-3 ${disableInternal ? 'opacity-60' : ''}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium">Refer within Ambulant+</div>
          <div className="flex items-center gap-2">
            {(['Doctors','Allied Health','Wellness'] as const).map(cls => (
              <button
                key={cls}
                onClick={() => { setTab(cls); setSelId(''); setMode('internal'); }}
                className={`px-2 py-1 text-xs rounded border ${tab === cls ? 'bg-gray-900 text-white' : 'bg-white hover:bg-gray-100'}`}
                disabled={disableInternal}
              >
                {cls}
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="grid md:grid-cols-4 gap-2 mb-2">
          <input
            type="text"
            placeholder="Search name or specialty"
            value={filters.q}
            onChange={e => { setFilters(f => ({ ...f, q: e.target.value })); setMode('internal'); }}
            className="rounded border p-2 text-sm"
            disabled={disableInternal || loading}
          />
          <select
            value={filters.specialty}
            onChange={e => { setFilters(f => ({ ...f, specialty: e.target.value })); setMode('internal'); }}
            className="rounded border p-2 text-sm"
            disabled={disableInternal || loading}
          >
            <option value="">All Specialties</option>
            {specialties.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={filters.gender}
            onChange={e => { setFilters(f => ({ ...f, gender: e.target.value })); setMode('internal'); }}
            className="rounded border p-2 text-sm"
            disabled={disableInternal || loading}
          >
            <option value="">Any Gender</option>
            {genders.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select
            value={filters.location}
            onChange={e => { setFilters(f => ({ ...f, location: e.target.value })); setMode('internal'); }}
            className="rounded border p-2 text-sm"
            disabled={disableInternal || loading}
          >
            <option value="">All Locations</option>
            {locations.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* List */}
        <div className="grid sm:grid-cols-2 gap-2">
          {loading ? <div className="text-sm text-gray-600">Loading…</div> :
            filtered.length === 0 ? <div className="text-sm text-gray-500">No matches.</div> :
            filtered.map(c => {
              const active = selId === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelId(c.id)}
                  disabled={disableInternal}
                  className={`text-left border rounded p-2 bg-white hover:bg-gray-50 ${active ? 'ring-2 ring-gray-900' : ''}`}
                >
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-gray-600">{c.specialty} · {c.location}</div>
                  <div className="text-[11px] text-gray-500">Rating {c.rating ?? '—'} · {c.online ? 'Online' : 'Offline'}</div>
                </button>
              );
            })}
        </div>

        <div className="flex justify-end mt-2">
          <button
            disabled={!sel || disableInternal}
            className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            onClick={() => { if (!sel) return; alert(`Internal referral → ${sel.name} (${sel.specialty})`); }}
          >
            Refer Internally
          </button>
        </div>
      </div>

      {/* External */}
      <div className={`border rounded p-3 ${disableExternal ? 'opacity-60' : ''}`}>
        <div className="text-sm font-medium mb-2">Refer outside Ambulant+</div>
        <div className="grid md:grid-cols-3 gap-2 mb-2">
          <input className="rounded border p-2 text-sm" placeholder="Clinician / Facility name" value={extName} onChange={e=>{ setExtName(e.target.value); setMode('external'); }} disabled={disableExternal} />
          <input className="rounded border p-2 text-sm" placeholder="Email" value={extEmail} onChange={e=>{ setExtEmail(e.target.value); setMode('external'); }} disabled={disableExternal} />
          <input className="rounded border p-2 text-sm" placeholder="Phone (digits only)" value={extPhone} onChange={e=>{ setExtPhone(e.target.value); setMode('external'); }} disabled={disableExternal} />
        </div>
        <div className="flex justify-end">
          <button
            disabled={!extName || !(emailOk || phoneOk) || disableExternal}
            className="px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            onClick={() => { alert(`External referral → ${extName}${extEmail ? `, ${extEmail}` : ''}${extPhone ? `, ${extPhone}` : ''}`); }}
          >
            Refer Externally
          </button>
        </div>
      </div>
    </div>
  );
}

/** ---------- eRx Composer (parity with SFU’s rightTab = 'erx') ---------- */
function ErxComposer({
  rxRows, setRxRows, addRxRow, removeRxRow,
  rxOptionsFinal, rxAuto, sendErx, pushOrder, erxResult,
}: {
  rxRows: { drug: string; dose: string; route: string; freq: string; duration: string; qty: string; refills: number; notes?: string }[];
  setRxRows: React.Dispatch<React.SetStateAction<any>>;
  addRxRow: () => void;
  removeRxRow: (i: number) => void;
  rxOptionsFinal: { name: string; rxcui?: string }[];
  rxAuto: ReturnType<typeof useAutocomplete<RxNormHit>>;
  sendErx: () => void;
  pushOrder: (k: 'CarePort'|'MedReach') => void;
  erxResult: any;
}) {
  return (
    <Card title="eRx Composer" gradient toolbar={<button className="text-xs px-2 py-1 border rounded" onClick={sendErx}>Send eRx</button>}>
      <datalist id="rxnorm-suggest">
        {rxOptionsFinal.map((o, k) => (<option key={`${o.rxcui || k}-${o.name}`} value={o.name || ''} />))}
      </datalist>

      <div className="text-sm font-semibold mb-1">Pharmacy</div>
      <div className="text-xs text-gray-500 mb-1">Drug on its own line; then Dose, Route, Frequency, Duration, Qty, Refills on a single row.</div>

      {rxRows.map((r, i) => (
        <div key={i} className="mt-2 space-y-2 border rounded p-2 bg-white">
          <input
            className="border rounded px-2 py-1 w-full"
            placeholder="Drug (start typing…)"
            list="rxnorm-suggest"
            value={r.drug}
            onFocus={(e) => { const v = e.currentTarget.value; if (v) (rxAuto as any).setQ(v); }}
            onChange={(e) => {
              const v = e.target.value;
              (rxAuto as any).setQ(v);
              setRxRows((x: any[]) => x.map((y, j) => j === i ? { ...y, drug: v } : y));
            }}
            onBlur={(e) => {
              const pickedName = normalize(e.currentTarget.value);
              if (!pickedName) return;
              const opts = ((rxAuto as any).opts as RxNormHit[]) || [];
              const picked =
                opts.find(o => normalize(o.name || '').toLowerCase() === pickedName.toLowerCase()) ||
                opts.find(o => normalize(o.name || '').toLowerCase().startsWith(pickedName.toLowerCase()));
              if (picked?.rxcui) {
                setRxRows((x: any[]) => x.map((y, j) => j === i ? { ...y, notes: y.notes || `RxCUI:${picked.rxcui}` } : y));
              }
            }}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
          />
          <div className="grid md:grid-cols-6 gap-2">
            <input className="border rounded px-2 py-1" placeholder="Dose" value={r.dose} onChange={(e)=>setRxRows((x:any[])=>x.map((y,j)=>j===i?{...y, dose:e.target.value}:y))} />
            <input className="border rounded px-2 py-1" placeholder="Route" value={r.route} onChange={(e)=>setRxRows((x:any[])=>x.map((y,j)=>j===i?{...y, route:e.target.value}:y))} />
            <input className="border rounded px-2 py-1" placeholder="Frequency" value={r.freq} onChange={(e)=>setRxRows((x:any[])=>x.map((y,j)=>j===i?{...y, freq:e.target.value}:y))} />
            <input className="border rounded px-2 py-1" placeholder="Duration" value={r.duration} onChange={(e)=>setRxRows((x:any[])=>x.map((y,j)=>j===i?{...y, duration:e.target.value}:y))} />
            <input className="border rounded px-2 py-1" placeholder="Qty" value={r.qty} onChange={(e)=>setRxRows((x:any[])=>x.map((y,j)=>j===i?{...y, qty:e.target.value}:y))} />
            <input className="border rounded px-2 py-1" type="number" placeholder="Refills" value={r.refills} onChange={(e)=>setRxRows((x:any[])=>x.map((y,j)=>j===i?{...y, refills:Number(e.target.value)||0}:y))} />
          </div>
          <div className="grid grid-cols-12 gap-2 items-center">
            <input className="border rounded px-2 py-1 col-span-10" placeholder="Notes (optional)" value={r.notes || ''} onChange={(e) => setRxRows((x:any[]) => x.map((y, j) => j === i ? { ...y, notes: e.target.value } : y))} />
            <div className="col-span-2 flex justify-end">
              <button className="px-2 py-1 border rounded text-xs" onClick={() => removeRxRow(i)}>Remove</button>
            </div>
          </div>
        </div>
      ))}

      <div className="pt-2 flex flex-wrap gap-2">
        <button className="px-2 py-1 border rounded text-xs" onClick={addRxRow}>Add drug</button>
        <button className="px-2 py-1 border rounded text-xs" onClick={() => pushOrder('CarePort')}>Push to CarePort</button>
        <button className="px-2 py-1 border rounded text-xs" onClick={() => pushOrder('MedReach')}>Push to MedReach</button>
      </div>

      {erxResult && (
        <div className="mt-3 border rounded p-3 bg-white text-sm">
          {erxResult.error ? <div className="text-red-600">{erxResult.error}</div> : (
            <>
              <div>eRx ID: <b>{erxResult.id}</b></div>
              <div>Status: <b>{erxResult.status}</b></div>
              <div>Dispense Code: <b>{erxResult.dispenseCode}</b></div>
            </>
          )}
        </div>
      )}

      {/* Laboratory (simple inline) */}
      <div className="text-sm font-semibold mt-4">Laboratory</div>
      <div className="text-xs text-gray-500 mb-1">Add tests and related clinical info as needed.</div>
      <input className="border rounded px-2 py-1 w-full" placeholder="Test name (e.g., CBC, CMP, SARS-CoV-2 PCR)" />
      <input className="border rounded px-2 py-1 w-full mt-2" placeholder="Instructions / clinical info (optional)" />
    </Card>
  );
}
