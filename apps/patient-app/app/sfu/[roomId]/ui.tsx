// apps/patient-app/app/sfu/[roomId]/ui.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import type { Toast } from './useLiveKitRoom';
import MeterDonut from '../../../components/charts/MeterDonut';
import Sparkline from '../../../components/charts/Sparkline';

/* ------------------------------
   Minimal local UI helpers
--------------------------------*/
export function Card({
  title,
  toolbar,
  children,
  dense,
}: {
  title?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  dense?: boolean;
}) {
  return (
    <section className={`rounded-2xl border border-gray-200 bg-white shadow-sm`}>
      {(title || toolbar) && (
        <header className="flex items-center justify-between px-3 py-2 border-b bg-gradient-to-r from-gray-50 to-white rounded-t-2xl">
          <div className="text-sm font-semibold">{title}</div>
          <div className="flex items-center gap-2">{toolbar}</div>
        </header>
      )}
      <div className={dense ? 'p-2' : 'p-3'}>{children}</div>
    </section>
  );
}

export function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  if (!open) return null;
  return <>{children}</>;
}

export function Badge({
  label,
  active,
  color = 'emerald',
}: {
  label: string;
  active?: boolean;
  color?: 'emerald' | 'indigo' | 'sky' | 'red' | 'gray' | 'amber';
}) {
  const map: Record<string, string> = {
    emerald: 'bg-emerald-600',
    indigo: 'bg-indigo-600',
    sky: 'bg-sky-600',
    red: 'bg-red-600',
    gray: 'bg-gray-600',
    amber: 'bg-amber-600',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full text-white ${active ? map[color] : 'bg-gray-400'}`}>
      {label}
    </span>
  );
}

export function IconBtn(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { children, ...rest } = props;
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/90 backdrop-blur shadow ring-1 ring-black/10 hover:bg-white disabled:opacity-50 ${props.className || ''}`}
    >
      {children}
    </button>
  );
}

export function CollapseBtn({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-xs px-2 py-1 rounded border bg-white hover:bg-gray-50"
      aria-pressed={open}
      aria-label={open ? 'Collapse' : 'Expand'}
    >
      {open ? 'Collapse' : 'Expand'}
    </button>
  );
}

export function Tabs<T extends string>({
  items,
  active,
  onChange,
}: {
  items: { key: T; label: string }[];
  active: T;
  onChange: (k: T) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-full border bg-white p-0.5">
      {items.map((it) => (
        <button
          key={it.key}
          onClick={() => onChange(it.key)}
          className={`px-3 py-1.5 text-xs rounded-full ${
            active === it.key ? 'bg-gray-900 text-white' : 'hover:bg-gray-100'
          }`}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function Icon({ name, toggledName, toggled }: { name: string; toggledName?: string; toggled?: boolean }) {
  const n = toggled ? toggledName || name : name;
  if (n === 'mic')
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
        <path d="M12 1a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V4a3 3 0 0 1 3-3z" />
        <path d="M5 11a7 7 0 0 0 14 0h-2a5 5 0 0 1-10 0H5z" />
        <path d="M11 19h2v3h-2z" />
      </svg>
    );
  if (n === 'mic-off')
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
        <path d="M15 10V4a3 3 0 0 0-5.23-1.94l8.17 8.17A2.99 2.99 0 0 0 15 10z" />
        <path d="M5 11a7 7 0 0 0 11.31 5.31l1.42 1.42A8.97 9.97 0 0 1 12 20a9 9 0 0 1-9-9h2z" />
        <path d="M3.28 4.22 4.7 2.8l16.5 16.5-1.42 1.42z" />
      </svg>
    );
  if (n === 'video')
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
        <path d="M15 10.25V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-3.25L21 17V7l-6 3.25z" />
      </svg>
    );
  if (n === 'video-off')
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
        <path d="M2.81 2.81 1.39 4.22 19.78 22.6l1.41-1.41L2.81 2.81z" />
        <path d="M15 10.25V7a2 2 0 0 0-2-2H7.27L15 12.73z" />
        <path d="M3 6v10a2 2 0 0 0 2 2h10.73L3 6z" />
        <path d="M21 7l-6 3.25V9l6-3z" />
      </svg>
    );
  if (n === 'heart')
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5 text-rose-600" fill="currentColor">
        <path d="M12 21s-8.5-6.36-8.5-11.5A4.5 4.5 0 0 1 8 5a5.64 5.64 0 0 1 4 2 5.64 5.64 0 0 1 4-2 a4.5 4.5 0 0 1 4.5 4.5C20.5 14.64 12 21 12 21z" />
      </svg>
    );
  if (n === 'cc')
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
        <path d="M3 5h18a2 2 0 012 2v10a2 2 0 01-2 2H3a2 2 0 01-2-2V7a2 2 0 012-2zm3 6a3 3 0 003 3h1v-2H9a1 1 0 010-2h1V8H9a3 3 0 00-3 3zm7 0a3 3 0 003 3h1v-2h-1a1 1 0 010-2h1V8h-1a3 3 0 00-3 3z" />
      </svg>
    );
  if (n === 'layers')
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
        <path d="M12 2l10 6-10 6L2 8l10-6zm0 8l10 6-10 6-10-6 10-6z" />
      </svg>
    );
  if (n === 'rec')
    return (
      <svg viewBox="0 0 24 24" className="w-5 h-5 text-red-600" fill="currentColor">
        <circle cx="12" cy="12" r="6" />
      </svg>
    );
  if (n === 'collapse' || n === 'expand')
    return <span className="inline-block w-4 h-4">{n === 'collapse' ? '▾' : '▸'}</span>;
  return <span className="inline-block w-4 h-4">•</span>;
}

/* ------------------------------
   Hydration-safe date
--------------------------------*/
export function SafeDate({ iso }: { iso: string | null }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return <span suppressHydrationWarning>{mounted && iso ? new Date(iso).toLocaleString() : '—'}</span>;
}

/* ------------------------------
   top bar
--------------------------------*/
export function TopBar(props: {
  roomId: string;
  stateLabel: string;
  qosLabel: string;
  netLabel: string;

  dense: boolean;
  setDense: (v: boolean) => void;

  leftCollapsed: boolean;
  setLeftCollapsed: (v: boolean) => void;

  rightCollapsed: boolean;
  setRightCollapsed: (v: boolean) => void;

  presentation: boolean;
  onTogglePresentation: () => void;

  consentGiven: boolean;
  setConsentGiven: (v: boolean) => void;

  policyUrl: string;

  connected: boolean;
  onJoin: () => void;
  onLeave: () => void;

  onToggleHelp: () => void;
}) {
  const {
    roomId,
    stateLabel,
    qosLabel,
    netLabel,
    dense,
    setDense,
    leftCollapsed,
    setLeftCollapsed,
    rightCollapsed,
    setRightCollapsed,
    presentation,
    onTogglePresentation,
    consentGiven,
    setConsentGiven,
    policyUrl,
    connected,
    onJoin,
    onLeave,
    onToggleHelp,
  } = props;

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between p-4 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 shadow-sm">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Patient Console — Room {roomId}</h1>
        <span className="text-xs inline-flex items-center gap-1 px-2 py-0.5 rounded-full border">
          <span
            className={`h-2 w-2 rounded-full ${
              stateLabel === 'connected' ? 'bg-emerald-500' : stateLabel === 'connecting' ? 'bg-amber-500' : 'bg-slate-400'
            }`}
          />
          {stateLabel}
        </span>
        <span className="text-xs text-gray-600">QoS: {qosLabel}</span>
        <span className={`text-xs inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${netLabel.includes('Poor') ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-gray-200 bg-white text-gray-700'}`}>
          Net: {netLabel}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setLeftCollapsed(!leftCollapsed)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-gray-200 bg-white shadow-sm hover:bg-gray-50 text-xs"
          aria-pressed={leftCollapsed}
        >
          <Icon name={leftCollapsed ? 'expand' : 'collapse'} /> {leftCollapsed ? 'Show Left' : 'Hide Left'}
        </button>

        <button
          onClick={() => setDense(!dense)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-gray-200 bg-white shadow-sm hover:bg-gray-50 text-xs"
          aria-pressed={dense}
        >
          {dense ? 'Comfort' : 'Compact'}
        </button>

        <button
          onClick={onTogglePresentation}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-gray-200 bg-white shadow-sm hover:bg-gray-50 text-xs"
          aria-pressed={presentation}
        >
          <Icon name={presentation ? 'collapse' : 'expand'} /> {presentation ? 'Exit Full Screen' : 'Full Screen'}
        </button>

        <button
          onClick={() => setRightCollapsed(!rightCollapsed)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-gray-200 bg-white shadow-sm hover:bg-gray-50 text-xs"
          aria-pressed={rightCollapsed}
        >
          <Icon name={rightCollapsed ? 'expand' : 'collapse'} /> {rightCollapsed ? 'Show Right' : 'Hide Right'}
        </button>

        <button
          onClick={onToggleHelp}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border border-gray-200 bg-white shadow-sm hover:bg-gray-50 text-xs"
          title="Help (?)"
        >
          ?
        </button>

        <div className="hidden md:flex items-center gap-2 mr-2 text-xs">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={consentGiven} onChange={(e) => setConsentGiven(e.target.checked)} />
            <span>I consent to this Televisit and recording (if enabled).</span>
          </label>
          <a href={policyUrl} target="_blank" className="text-blue-700 underline">
            Policy (PDF)
          </a>
        </div>

        {!connected ? (
          <button
            onClick={onJoin}
            disabled={!consentGiven}
            className="px-3 py-1.5 rounded-full border border-blue-200 bg-blue-50 shadow-sm hover:bg-blue-100 text-sm disabled:opacity-50"
          >
            Join
          </button>
        ) : (
          <button
            onClick={onLeave}
            className="px-3 py-1.5 rounded-full border border-red-200 bg-red-50 shadow-sm hover:bg-red-100 text-sm"
          >
            Leave
          </button>
        )}

        <Link href="/appointments" className="text-sm text-blue-600 hover:underline">
          Back
        </Link>
      </div>
    </header>
  );
}

/* ------------------------------
   toasts / banners / modals
--------------------------------*/
export function ToastStack({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed top-16 right-4 z-[80] space-y-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`px-3 py-2 rounded shadow text-sm ${
            t.kind === 'error'
              ? 'bg-rose-600 text-white'
              : t.kind === 'warning'
                ? 'bg-amber-600 text-white'
                : t.kind === 'success'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-900 text-white'
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function ReconnectingBanner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <div className="sticky top-14 z-40 mx-4 my-2 rounded border bg-amber-50 text-amber-900 px-3 py-2 flex items-center gap-2">
      <span className="h-3 w-3 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
      Reconnecting…
    </div>
  );
}

export function RecordingToast({ text }: { text: string }) {
  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-full bg-red-600 text-white shadow">
      {text}
    </div>
  );
}

export function HelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] bg-black/40 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-md w-full p-4" onClick={(e) => e.stopPropagation()}>
        <div className="text-lg font-semibold mb-2">Shortcuts & Help</div>
        <ul className="text-sm space-y-1">
          <li>
            <b>m</b> — Mute/Unmute
          </li>
          <li>
            <b>v</b> — Video On/Off
          </li>
          <li>
            <b>j</b> — Join/Leave
          </li>
          <li>
            <b>?</b> — Toggle this help
          </li>
        </ul>
        <div className="mt-3 text-xs text-gray-500">XR is disabled on the patient SFU page.</div>
        <div className="mt-3 text-right">
          <button className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50 text-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export function WrapUpModal({
  show,
  seconds,
  onClose,
}: {
  show: boolean;
  seconds: number;
  onClose: () => void;
}) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[70] bg-black/40 grid place-items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl max-w-lg w-full p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="text-lg font-semibold">Thanks for your Televisit</div>
        <div className="text-sm text-gray-700">
          Time in call: <b>{Math.floor(seconds / 60)}m {seconds % 60}s</b>
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          <a href="/myCare" className="px-3 py-2 rounded border bg-white hover:bg-gray-50 text-sm text-center">
            Go to myCare
          </a>
          <a href="/appointments" className="px-3 py-2 rounded bg-indigo-600 text-white text-sm text-center">
            Book follow-up
          </a>
        </div>
        <div className="text-xs text-gray-500">You can download chat/captions/notes later from your visit summary.</div>
      </div>
    </div>
  );
}

/* ------------------------------
   Left sidebar (Session + Allergies + Meds)
--------------------------------*/
export type Allergy = {
  name?: string;
  status: 'Active' | 'Resolved';
  note?: string;
  severity?: 'mild' | 'moderate' | 'severe';
};

export function LeftSidebar(props: {
  dense: boolean;
  roomId: string;
  appt: any;
  showVitals: boolean;

  hasRoom: boolean;
  sendChat: (text: string) => Promise<void>;
  publishControl: (type: string, value: any) => Promise<void> | void;

  renderBedside: ReactNode;
}) {
  const { dense, roomId, appt, showVitals, hasRoom, sendChat, publishControl, renderBedside } = props;

  // collapses
  const [infoOpen, setInfoOpen] = useState(true);
  const [allergiesOpen, setAllergiesOpen] = useState(true);

  // Allergies
  const [allergies, setAllergies] = useState<Allergy[]>([]);
  const [allergyLoading, setAllergyLoading] = useState(false);

  async function loadAllergies() {
    setAllergyLoading(true);
    try {
      const r = await fetch('/api/allergies', { cache: 'no-store' });
      const d: Allergy[] = await r.json().catch(() => []);
      setAllergies(Array.isArray(d) ? d : []);
    } catch {
      setAllergies([]);
    } finally {
      setAllergyLoading(false);
    }
  }

  useEffect(() => {
    loadAllergies();
    const t = setInterval(loadAllergies, 20000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportAllergiesToClinician = async () => {
    if (!hasRoom) return alert('Join the room first');
    const active = allergies.filter((a) => a.status === 'Active');
    const lines = active.length
      ? active
          .map((a) => `• ${a.name || 'Allergy'}${a.severity ? ` (${a.severity})` : ''}${a.note ? ` — ${a.note}` : ''}`)
          .join('\n')
      : 'No active allergies.';
    const text = `Allergies (Patient → SOAP, read-only):\n${lines}`;

    try {
      await sendChat(text);
      await publishControl('allergies_export', { lines: active, at: Date.now() });
      await fetch('/api/events/emit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'patient.allergies.export', roomId, payload: active }),
      }).catch(() => {});
      alert('Allergies sent.');
    } catch {
      alert('Failed to send allergies');
    }
  };

  // Meds demo
  const [currentMeds] = useState<string[]>(['Metformin 500 mg PO BID', 'Atorvastatin 20 mg PO QHS']);
  const [adherencePct, setAdherencePct] = useState<number>(88);
  const [adherenceSeries, setAdherenceSeries] = useState<Array<{ t: number; y: number }>>(() => {
    const now = Date.now();
    return Array.from({ length: 30 }).map((_, i) => ({ t: now - (30 - i) * 86400000, y: 70 + Math.random() * 30 }));
  });

  useEffect(() => {
    const t = setInterval(() => {
      setAdherenceSeries((old) => {
        const now = Date.now();
        const next = [
          ...old,
          { t: now, y: Math.max(50, Math.min(100, (old.at(-1)?.y ?? 85) + (Math.random() - 0.5) * 8)) },
        ];
        if (next.length > 60) next.shift();
        setAdherencePct(Math.round(next.at(-1)!.y));
        return next;
      });
    }, 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const exportMedsToClinician = async () => {
    if (!hasRoom) return alert('Join the room first');
    const lines = currentMeds.length ? currentMeds.map((m) => `• ${m}`).join('\n') : 'No current medications.';
    const text = `Current Medication (Patient):\n${lines}\nAdherence: ${adherencePct}%`;

    try {
      await sendChat(text);
      await publishControl('meds_export', { meds: currentMeds, adherencePct, series: adherenceSeries, at: Date.now() });
      await fetch('/api/events/emit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'patient.meds.export', roomId, payload: { meds: currentMeds, adherencePct } }),
      }).catch(() => {});
      alert('Medication shared.');
    } catch {
      alert('Failed to share meds');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card
        title="Session Information"
        toolbar={<CollapseBtn open={infoOpen} onClick={() => setInfoOpen((v) => !v)} />}
        dense={dense}
      >
        <Collapse open={infoOpen}>
          <SessionInfo appt={appt} />
        </Collapse>
      </Card>

      {renderBedside}

      <Card
        title="Allergies"
        toolbar={<CollapseBtn open={allergiesOpen} onClick={() => setAllergiesOpen((v) => !v)} />}
        dense={dense}
      >
        <Collapse open={allergiesOpen}>
          <AllergiesBlock
            allergies={allergies}
            loading={allergyLoading}
            onRefresh={loadAllergies}
            onExport={exportAllergiesToClinician}
          />
        </Collapse>
      </Card>

      <Card
        title="Current Medication"
        dense={dense}
        toolbar={
          <button
            className="px-2 py-1 text-xs border rounded bg-blue-600 text-white hover:bg-blue-700"
            onClick={exportMedsToClinician}
          >
            Export to Clinician
          </button>
        }
      >
        <ul className="list-disc pl-5 text-sm text-gray-800">
          {currentMeds.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ul>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <MeterDonut value={adherencePct} max={100} label="Adherence" color="#10B981" unit="%" />
          <div className="col-span-2 rounded-xl border bg-white p-2">
            <div className="text-xs text-slate-500 mb-1">Adherence trend</div>
            <Sparkline data={adherenceSeries} height={64} />
          </div>
        </div>
      </Card>
    </div>
  );
}

function SessionInfo({ appt }: { appt: any }) {
  const Field = ({ label, value, bold = false }: { label: string; value: ReactNode; bold?: boolean }) => (
    <div className="flex items-center justify-between border rounded px-2 py-1 bg-white">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className={`text-sm ${bold ? 'font-semibold' : ''}`}>{value}</div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-2">
      <Field label="Patient Name" value={appt.patientName} />
      <Field label="Patient ID" value={appt.patientId} />
      <Field label="Case Name" value={appt.reason} bold />
      <Field label="Session ID" value={<span className="font-mono">{appt.id}</span>} />
      <Field label="Session Date" value={<SafeDate iso={appt.when} />} />
      <Field label="Clinician" value={appt.clinicianName} />
      <Field label="Status" value={appt.status} />
    </div>
  );
}

function AllergiesBlock({
  allergies,
  loading,
  onRefresh,
  onExport,
}: {
  allergies: Allergy[];
  loading: boolean;
  onRefresh: () => void;
  onExport: () => void;
}) {
  const activeCount = allergies.filter((a) => a.status === 'Active').length;
  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-gray-600">
          Active: <b>{activeCount}</b> / Total: <b>{allergies.length}</b>
        </div>
        <div className="flex gap-2">
          <button className="px-2 py-1 text-xs border rounded bg-white hover:bg-gray-50 disabled:opacity-50" onClick={onRefresh} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button className="px-2 py-1 text-xs border rounded bg-blue-600 text-white hover:bg-blue-700" onClick={onExport}>
            Export to Clinician SOAP
          </button>
        </div>
      </div>

      {allergies.length === 0 ? (
        <div className="text-sm text-gray-500">No allergies found.</div>
      ) : (
        <ul className="divide-y bg-white border rounded">
          {allergies.map((a, i) => (
            <li key={i} className="p-2 text-sm flex items-start justify-between">
              <div>
                <div className="font-medium">{a.name || 'Allergy'}</div>
                <div className="text-xs text-gray-500">
                  {a.severity ? `Severity: ${a.severity}` : ''} {a.note ? ` · ${a.note}` : ''}
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${a.status === 'Active' ? 'bg-amber-600 text-white' : 'bg-gray-200'}`}>
                {a.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
