// apps/patient-app/app/encounters/page.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { FiChevronDown, FiChevronUp, FiDownload, FiPlus, FiShare2 } from 'react-icons/fi';

import EncountersHero from '@/components/encounters/EncountersHero';
import CaseStatusBadge from '@/components/encounters/CaseStatusBadge';
import EncounterModeBadge from '@/components/encounters/EncounterModeBadge';
import {
  normalizeEncounterStatus,
  encounterStatusClasses,
  initials,
  colorForId,
  labelForEncounterStatus,
} from '@/lib/encounters/display';

type Vitals = {
  hr?: number;
  sys?: number;
  dia?: number;
  spo2?: number;
  temp_c?: number;
  glucose_mg_dl?: number;
};

type EncounterRating = {
  score: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  createdAt: string;
};

type Encounter = {
  id: string;
  caseId: string;
  start: string;
  stop?: string;
  mode?: 'Video' | 'Chat' | 'Audio' | 'InPerson' | string;
  status?: 'Completed' | 'InProgress' | 'Scheduled' | string;
  clinician?: { id: string; name: string; specialty?: string };
  devices?: string[];
  notes?: string;
  vitals?: Vitals;
  rating?: EncounterRating | null;
};

type Case = {
  id: string;
  title?: string;
  status: 'Open' | 'Closed' | 'Referred';
  updatedAt: string;
  latestEncounter?: Encounter | null;
  encounters?: Encounter[];
};

function statusForHr(hr?: number) {
  if (hr == null) return 'unknown';
  if (hr < 50 || hr > 120) return 'critical';
  if (hr < 60 || hr > 100) return 'warning';
  return 'normal';
}
function statusForSpo2(spo2?: number) {
  if (spo2 == null) return 'unknown';
  if (spo2 < 90) return 'critical';
  if (spo2 < 94) return 'warning';
  return 'normal';
}
function statusForTemp(temp_c?: number) {
  if (temp_c == null) return 'unknown';
  if (temp_c >= 40 || temp_c < 34) return 'critical';
  if (temp_c >= 38 || temp_c < 36) return 'warning';
  return 'normal';
}
function statusForGlucose(gl?: number) {
  if (gl == null) return 'unknown';
  if (gl < 70 || gl > 180) return 'critical';
  if (gl < 90 || gl > 140) return 'warning';
  return 'normal';
}

const STATUS_COLOR: Record<string, string> = {
  normal: '#10b981',
  warning: '#f59e0b',
  critical: '#ef4444',
  unknown: '#94a3b8',
};

function pickMetricValue(v?: Vitals, metric: 'auto' | 'hr' | 'spo2' | 'temp' | 'glucose' = 'auto') {
  if (!v) return null;
  if (metric === 'hr') return v.hr ?? null;
  if (metric === 'spo2') return v.spo2 ?? null;
  if (metric === 'temp') return v.temp_c ?? null;
  if (metric === 'glucose') return v.glucose_mg_dl ?? null;

  if (v.hr != null) return v.hr;
  if (v.glucose_mg_dl != null) return v.glucose_mg_dl;
  if (v.spo2 != null) return v.spo2;
  if (v.temp_c != null) return v.temp_c;
  if (v.sys != null) return v.sys;
  if (v.dia != null) return v.dia;
  return null;
}

function metricLabel(metric: 'auto' | 'hr' | 'spo2' | 'temp' | 'glucose', v?: Vitals) {
  if (metric === 'hr') return 'Heart rate';
  if (metric === 'spo2') return 'SpO₂';
  if (metric === 'temp') return 'Temperature';
  if (metric === 'glucose') return 'Glucose';

  if (v?.hr != null) return 'Heart rate';
  if (v?.glucose_mg_dl != null) return 'Glucose';
  if (v?.spo2 != null) return 'SpO₂';
  if (v?.temp_c != null) return 'Temperature';
  if (v?.sys != null || v?.dia != null) return 'Blood pressure';
  return 'Vitals';
}

function formatMetricValue(metric: 'auto' | 'hr' | 'spo2' | 'temp' | 'glucose', v?: Vitals) {
  if (!v) return '—';
  if (metric === 'hr') return v.hr != null ? `${v.hr} bpm` : '—';
  if (metric === 'spo2') return v.spo2 != null ? `${v.spo2}%` : '—';
  if (metric === 'temp') return v.temp_c != null ? `${v.temp_c.toFixed(1)} °C` : '—';
  if (metric === 'glucose') return v.glucose_mg_dl != null ? `${v.glucose_mg_dl} mg/dL` : '—';

  if (v.hr != null) return `${v.hr} bpm`;
  if (v.glucose_mg_dl != null) return `${v.glucose_mg_dl} mg/dL`;
  if (v.spo2 != null) return `${v.spo2}%`;
  if (v.temp_c != null) return `${v.temp_c.toFixed(1)} °C`;
  if (v.sys != null || v.dia != null) return `${v.sys ?? '—'}/${v.dia ?? '—'} mmHg`;
  return '—';
}

function clinicalStatusForMetric(metric: 'auto' | 'hr' | 'spo2' | 'temp' | 'glucose', v?: Vitals) {
  if (!v) return 'unknown';
  if (metric === 'hr') return statusForHr(v.hr);
  if (metric === 'spo2') return statusForSpo2(v.spo2);
  if (metric === 'temp') return statusForTemp(v.temp_c);
  if (metric === 'glucose') return statusForGlucose(v.glucose_mg_dl);

  if (v.hr != null) return statusForHr(v.hr);
  if (v.glucose_mg_dl != null) return statusForGlucose(v.glucose_mg_dl);
  if (v.spo2 != null) return statusForSpo2(v.spo2);
  if (v.temp_c != null) return statusForTemp(v.temp_c);
  return 'unknown';
}

function TimelineSparkline({
  values,
  width = 260,
  height = 48,
  timestamps,
  vitalsSeries,
  metric,
}: {
  values: number[];
  timestamps?: string[];
  width?: number;
  height?: number;
  vitalsSeries?: (Vitals | undefined)[];
  metric?: 'auto' | 'hr' | 'spo2' | 'temp' | 'glucose';
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    const tip = tipRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 2, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    if (!values || values.length < 2) {
      ctx.strokeStyle = '#e6e7eb';
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      return;
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max === min ? 1 : max - min;

    ctx.strokeStyle = 'rgba(15,23,42,0.06)';
    ctx.lineWidth = 1;
    for (let y = 0; y < height; y += Math.max(10, Math.round(height / 3))) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(width, y + 0.5);
      ctx.stroke();
    }

    for (let i = 0; i < values.length - 1; i += 1) {
      const x1 = (i / (values.length - 1)) * width;
      const x2 = ((i + 1) / (values.length - 1)) * width;
      const y1 = height - ((values[i] - min) / range) * height;
      const y2 = height - ((values[i + 1] - min) / range) * height;

      let stroke = '#10b981';
      if (vitalsSeries) {
        const v = vitalsSeries[i];
        const s = clinicalStatusForMetric(metric ?? 'auto', v);
        stroke = STATUS_COLOR[s] || stroke;
      }

      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    const handleMove = (ev: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const idx = Math.round((x / rect.width) * (values.length - 1));
      if (idx < 0 || idx >= values.length) {
        if (tip) tip.style.display = 'none';
        return;
      }

      const ts = timestamps?.[idx];
      const vit = vitalsSeries?.[idx];

      if (!tip) return;
      tip.style.display = 'block';
      tip.style.left = `${ev.clientX + 10}px`;
      tip.style.top = `${ev.clientY + 10}px`;

      let html = `<div class="text-[11px] font-medium">${metricLabel(metric ?? 'auto', vit)}</div>`;
      html += `<div class="text-[11px]">${formatMetricValue(metric ?? 'auto', vit)}</div>`;
      if (vit?.sys != null || vit?.dia != null) {
        html += `<div class="text-[11px]">BP: ${vit?.sys ?? '—'}/${vit?.dia ?? '—'} mmHg</div>`;
      }
      if (ts) html += `<div class="text-[11px] text-slate-500">${new Date(ts).toLocaleString()}</div>`;
      tip.innerHTML = html;
    };

    const handleLeave = () => {
      if (tip) tip.style.display = 'none';
    };

    canvas.addEventListener('mousemove', handleMove);
    canvas.addEventListener('mouseleave', handleLeave);

    return () => {
      canvas.removeEventListener('mousemove', handleMove);
      canvas.removeEventListener('mouseleave', handleLeave);
    };
  }, [values, width, height, timestamps, vitalsSeries, metric]);

  return (
    <div className="relative inline-block">
      <canvas ref={ref} className="rounded-2xl" />
      <div
        ref={tipRef}
        className="pointer-events-none fixed rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs shadow-lg"
        style={{ display: 'none', zIndex: 60 }}
      />
    </div>
  );
}

function groupEncountersIntoCases(encs: Encounter[]): Case[] {
  const map: Record<string, Case> = {};
  for (const e of encs) {
    const c = map[e.caseId] ?? { id: e.caseId, status: 'Open', updatedAt: e.start, encounters: [] };
    c.encounters!.push(e);
    if (!c.latestEncounter || new Date(e.start) > new Date(c.latestEncounter.start)) {
      c.latestEncounter = e;
      c.updatedAt = e.start;
    }
    map[e.caseId] = c;
  }
  return Object.values(map).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function makeMockCases(): Case[] {
  const now = Date.now();
  return [
    {
      id: 'C-1000',
      title: 'Headache & Fever',
      status: 'Open',
      updatedAt: new Date(now - 3600 * 1000).toISOString(),
      latestEncounter: {
        id: 'E-2000',
        caseId: 'C-1000',
        start: new Date(now - 3600 * 1000).toISOString(),
        mode: 'Video',
        status: 'InProgress',
        clinician: { id: 'CL-1', name: 'Dr. Sandile Moyo' },
        devices: ['NexRing'],
        vitals: { hr: 82, spo2: 98, temp_c: 37.1, glucose_mg_dl: 98, sys: 120, dia: 82 },
      },
      encounters: [
        {
          id: 'E-2000',
          caseId: 'C-1000',
          start: new Date(now - 3600 * 1000).toISOString(),
          mode: 'Video',
          status: 'InProgress',
          clinician: { id: 'CL-1', name: 'Dr. Sandile Moyo' },
          devices: ['NexRing'],
          vitals: { hr: 88, spo2: 94, temp_c: 36.7, glucose_mg_dl: 102, sys: 138, dia: 87 },
        },
      ],
    },
    {
      id: 'C-1071',
      title: 'Acute Bronchitis & Fever',
      status: 'Referred',
      updatedAt: new Date(now - 96000 * 1000).toISOString(),
      latestEncounter: {
        id: 'E-3000',
        caseId: 'C-1071',
        start: new Date(now - 96000 * 1000).toISOString(),
        mode: 'Video',
        status: 'Completed',
        clinician: { id: 'CL-9', name: 'Dr. Florence Moloyi' },
        devices: ['Health Monitor', 'Digital Stethoscope', 'NexRing'],
        vitals: { hr: 101, spo2: 94, temp_c: 39.1 },
      },
      encounters: [
        {
          id: 'E-3000',
          caseId: 'C-1071',
          start: new Date(now - 96000 * 1000).toISOString(),
          mode: 'Video',
          status: 'Completed',
          clinician: { id: 'CL-9', name: 'Dr. Florence Moloyi' },
          devices: ['Health Monitor', 'Digital Stethoscope', 'NexRing'],
          vitals: { hr: 101, spo2: 94, temp_c: 37.4, glucose_mg_dl: 105, sys: 132, dia: 88 },
        },
      ],
    },
    {
      id: 'C-1001',
      title: 'Follow-up: Hypertension',
      status: 'Closed',
      updatedAt: new Date(now - 7205000 * 1000).toISOString(),
      latestEncounter: {
        id: 'E-4000',
        caseId: 'C-1001',
        start: new Date(now - 7205000 * 1000).toISOString(),
        mode: 'InPerson',
        status: 'Completed',
        clinician: { id: 'CL-3', name: 'Dr. Jacobs Naidoo' },
        devices: ['Health Monitor'],
        vitals: { sys: 142, dia: 92 },
      },
      encounters: [
        {
          id: 'E-4000',
          caseId: 'C-1001',
          start: new Date(now - 7205000 * 1000).toISOString(),
          mode: 'InPerson',
          status: 'Completed',
          clinician: { id: 'CL-3', name: 'Dr. Jacobs Naidoo' },
          devices: ['Health Monitor'],
          vitals: { sys: 142, dia: 92 },
        },
      ],
    },
  ];
}

type Toast = { id: string; text: string; tone?: 'info' | 'success' | 'error' };

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  function push(text: string, tone: Toast['tone'] = 'info', ttl = 5000) {
    const id = String(Date.now()) + Math.random().toString(36).slice(2, 6);
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ttl);
  }

  function remove(id: string) {
    setToasts((t) => t.filter((x) => x.id !== id));
  }

  const Toasts = () => (
    <div className="fixed bottom-4 right-4 z-[1200]" aria-live="polite">
      <div className="flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-2xl px-3 py-2 text-sm shadow-lg ring-1 ${
              t.tone === 'success'
                ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
                : t.tone === 'error'
                ? 'bg-rose-50 text-rose-800 ring-rose-200'
                : 'bg-white text-slate-800 ring-slate-200'
            }`}
          >
            {t.text}
            <button onClick={() => remove(t.id)} className="ml-3 text-xs text-slate-500">
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  return { push, Toasts };
}

export default function EncountersPage() {
  const router = useRouter();

  const [items, setItems] = useState<Case[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Open' | 'Closed' | 'Referred'>('All');
  const [loading, setLoading] = useState(true);
  const [metricByCase, setMetricByCase] = useState<Record<string, 'auto' | 'hr' | 'spo2' | 'temp' | 'glucose'>>({});
  const [startingCareportEncId, setStartingCareportEncId] = useState<string | null>(null);

  const caseRefs = useRef<Record<string, HTMLElement | null>>({});
  const { push, Toasts } = useToasts();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (!cancelled) setLoading(true);
        const res = await fetch('/api/encounters?mode=cases', { cache: 'no-store' });
        const data = await res.json();
        let cases: Case[] = [];

        if (Array.isArray(data?.cases)) {
          cases = data.cases;
        } else if (Array.isArray(data?.encounters)) {
          cases = groupEncountersIntoCases(data.encounters);
        }

        if (!cancelled) setItems(cases.length ? cases : makeMockCases());
      } catch {
        if (!cancelled) setItems(makeMockCases());
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function startCarePort(encId: string) {
    if (!encId) return;

    setStartingCareportEncId(encId);
    try {
      const r = await fetch('/api/careport/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ encId, fulfillment: 'DELIVERY' }),
      });
      const j = await r.json().catch(() => ({} as any));
      if (!r.ok || !j?.ok) {
        push(j?.error || `Failed to start CarePort (HTTP ${r.status})`, 'error');
        return;
      }

      const href = String(j.redirectUrl || '');
      router.push(href || `/careport/marketplace/${encodeURIComponent(String(j.orderId || ''))}`);
    } catch (e: any) {
      push(e?.message || 'Failed to start CarePort', 'error');
    } finally {
      setStartingCareportEncId(null);
    }
  }

  function toggle(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function routeFollowUp(caseItem: Case) {
    if (caseItem.status === 'Closed') {
      push('This case is closed — follow-up not allowed.', 'error');
      return;
    }

    const encs = (caseItem.encounters ?? [])
      .slice()
      .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());

    const clinicianId = caseItem.latestEncounter?.clinician?.id ?? encs[0]?.clinician?.id;

    if (!clinicianId) {
      push('No clinician found for this case — cannot book follow-up.', 'error');
      return;
    }

    const href = `/clinicians/${encodeURIComponent(clinicianId)}/calendar?type=followup&caseId=${encodeURIComponent(caseItem.id)}`;
    router.push(href);
  }

  async function exportCaseAsPdf(caseId: string) {
    try {
      const el = caseRefs.current[caseId];
      if (!el) {
        push('Case element not found for export.', 'error');
        return;
      }

      const html2canvas = (await import('html2canvas')).default;
      const clone = el.cloneNode(true) as HTMLElement;
      const wrap = document.createElement('div');
      wrap.style.padding = '20px';
      wrap.style.background = '#ffffff';
      wrap.style.width = '900px';
      wrap.appendChild(clone);
      document.body.appendChild(wrap);

      const canvas = await html2canvas(wrap, { scale: 2, backgroundColor: '#ffffff' });
      document.body.removeChild(wrap);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

      try {
        const { jsPDF } = await import('jspdf');
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        pdf.setFontSize(14);
        pdf.text('Ambulant+ Center', 40, 30);
        pdf.setFontSize(10);
        pdf.text('0b Meadowbrook Ln, Bryanston 2152', 40, 46);

        const margin = 40;
        const imgW = pageWidth - margin * 2;
        const imgH = (canvas.height / canvas.width) * imgW;
        pdf.addImage(dataUrl, 'JPEG', margin, 68, imgW, imgH);

        pdf.setFontSize(9);
        pdf.text('Ambulant+ Contactless Medicine - Powered by Cloven Technology Impilo', 40, pageHeight - 30);
        pdf.save(`case-${caseId}.pdf`);
        push('Exported PDF successfully', 'success');
      } catch {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `case-${caseId}.jpg`;
        a.click();
        push('Exported as image (jspdf not available)', 'info');
      }
    } catch (err) {
      console.error('export error', err);
      push('Export failed — see console.', 'error');
    }
  }

  async function shareCase(caseItem: Case) {
    const latest = caseItem.latestEncounter;
    const text = [
      caseItem.title ?? `Case ${caseItem.id}`,
      `Status: ${caseItem.status}`,
      latest?.clinician?.name ? `Clinician: ${latest.clinician.name}` : null,
      latest?.start ? `Last encounter: ${new Date(latest.start).toLocaleString()}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      if (navigator.share) {
        await navigator.share({
          title: caseItem.title ?? `Case ${caseItem.id}`,
          text,
        });
        push('Case shared', 'success');
        return;
      }
      await navigator.clipboard.writeText(text);
      push('Case summary copied to clipboard', 'success');
    } catch {
      push('Share cancelled', 'info');
    }
  }

  const filtered = useMemo(() => {
    return items.filter((c) => {
      const q = search.trim().toLowerCase();
      const okStatus = filterStatus === 'All' || c.status === filterStatus;
      const okSearch =
        !q ||
        c.title?.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.latestEncounter?.clinician?.name?.toLowerCase().includes(q);
      return Boolean(okStatus && okSearch);
    });
  }, [items, filterStatus, search]);

  const totalCases = items.length;
  const openCases = items.filter((c) => c.status === 'Open').length;
  const referredCases = items.filter((c) => c.status === 'Referred').length;
  const completedEncounters = items.reduce((sum, c) => {
    return sum + (c.encounters?.filter((e) => normalizeEncounterStatus(e.status) === 'completed').length ?? 0);
  }, 0);

  return (
    <main className="min-h-screen bg-slate-50/70 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <Toasts />

        <EncountersHero
          totalCases={totalCases}
          openCases={openCases}
          referredCases={referredCases}
          completedEncounters={completedEncounters}
        />

        <div className="rounded-[24px] border border-cyan-200/70 bg-cyan-50/80 px-4 py-3 text-sm text-cyan-950 shadow-sm">
          Looking for upcoming bookings?{' '}
          <Link href="/appointments" className="font-medium underline underline-offset-2">
            Go to upcoming visits
          </Link>
        </div>

        <section className="rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <input
              type="search"
              placeholder="Search cases, case IDs, or clinicians..."
              className="h-11 min-w-[220px] flex-1 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-sm outline-none ring-0 placeholder:text-slate-400 focus:border-cyan-300 focus:bg-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              className="h-11 rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-sm outline-none focus:border-cyan-300 focus:bg-white"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
            >
              <option value="All">All status</option>
              <option value="Open">Open</option>
              <option value="Closed">Closed</option>
              <option value="Referred">Referred</option>
            </select>
          </div>
        </section>

        {loading && items.length === 0 ? (
          <div className="rounded-[24px] border border-slate-200/80 bg-white p-6 text-sm text-slate-500 shadow-sm">
            Loading your cases…
          </div>
        ) : null}

        {!loading && filtered.length === 0 ? (
          <div className="max-w-2xl rounded-[28px] border border-dashed border-slate-300 bg-white p-8 shadow-sm">
            <div className="text-lg font-semibold tracking-tight text-slate-950">No cases yet</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              After your first consultation, your visits will be grouped into cases so you can track care over time.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/auto-triage" className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
                Start a quick triage
              </Link>
              <Link href="/clinicians" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50">
                Find a clinician
              </Link>
              <Link href="/appointments" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm hover:bg-slate-50">
                View appointments
              </Link>
            </div>
          </div>
        ) : null}

        <ul className="space-y-4">
          {filtered.map((c) => {
            const encs = (c.encounters ?? [])
              .slice()
              .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());

            const clinician = c.latestEncounter?.clinician ?? encs[0]?.clinician;
            const latestEnc = c.latestEncounter ?? encs[0];
            const latestEncId = latestEnc?.id ?? '';
            const metric = metricByCase[c.id] ?? 'auto';

            const points = encs
              .slice()
              .reverse()
              .map((e) => pickMetricValue(e.vitals, metric))
              .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

            const timestamps = encs.slice().reverse().map((e) => e.start);
            const vitalsSeries = encs.slice().reverse().map((e) => e.vitals);
            const latestVitals = latestEnc?.vitals;
            const currentStatus = clinicalStatusForMetric(metric, latestVitals);
            const followUpDisabled = c.status === 'Closed';

            return (
              <li
                key={c.id}
                ref={(el) => {
  caseRefs.current[c.id] = el;
}}
                className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="h-2 bg-gradient-to-r from-cyan-500/20 via-violet-500/20 to-emerald-500/20" />

                <div className="p-5 sm:p-6">
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-3">
                        <div
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold text-slate-900 shadow-inner"
                          style={{ background: clinician ? colorForId(clinician.id) : '#e5e7eb' }}
                          title={clinician?.name || 'No clinician'}
                        >
                          {initials(clinician?.name ?? c.title)}
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="truncate text-xl font-semibold tracking-tight text-slate-950">
                              {c.title ?? `Case #${c.id}`}
                            </h2>
                            <CaseStatusBadge status={c.status} />
                          </div>

                          <div className="mt-1 text-sm text-slate-500">
                            Updated {formatDistanceToNow(new Date(c.updatedAt), { addSuffix: true })}
                          </div>

                          {latestEnc ? (
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <EncounterModeBadge mode={latestEnc.mode} />
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide ${encounterStatusClasses(
                                  latestEnc.status,
                                )}`}
                              >
                                {labelForEncounterStatus(latestEnc.status)}
                              </span>
                              {clinician?.name ? (
                                <span className="text-sm text-slate-600">
                                  with <span className="font-medium text-slate-900">{clinician.name}</span>
                                  {clinician.specialty ? <span className="text-slate-500"> · {clinician.specialty}</span> : null}
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
                        <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/70 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                Latest signal
                              </div>
                              <div className="mt-1 text-lg font-semibold tracking-tight text-slate-950">
                                {formatMetricValue(metric, latestVitals)}
                              </div>
                              <div className="mt-1 text-sm text-slate-600">{metricLabel(metric, latestVitals)}</div>
                            </div>

                            <div className="flex items-center gap-2">
                              <select
                                className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs outline-none focus:border-cyan-300"
                                value={metric}
                                onChange={(e) =>
                                  setMetricByCase((prev) => ({
                                    ...prev,
                                    [c.id]: e.target.value as 'auto' | 'hr' | 'spo2' | 'temp' | 'glucose',
                                  }))
                                }
                              >
                                <option value="auto">Auto</option>
                                <option value="hr">Heart rate</option>
                                <option value="spo2">SpO₂</option>
                                <option value="temp">Temperature</option>
                                <option value="glucose">Glucose</option>
                              </select>

                              <span
                                className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize"
                                style={{
                                  backgroundColor: `${STATUS_COLOR[currentStatus]}20`,
                                  color: STATUS_COLOR[currentStatus],
                                }}
                              >
                                {currentStatus}
                              </span>
                            </div>
                          </div>

                          <div className="mt-4 min-h-[52px]">
                            <TimelineSparkline
                              values={points.length > 1 ? points : [0, 0]}
                              timestamps={timestamps}
                              vitalsSeries={vitalsSeries}
                              metric={metric}
                            />
                          </div>

                          {latestVitals ? (
                            <div className="mt-4 flex flex-wrap gap-2">
                              {latestVitals.hr != null ? <MiniVital label="HR" value={`${latestVitals.hr} bpm`} /> : null}
                              {latestVitals.spo2 != null ? <MiniVital label="SpO₂" value={`${latestVitals.spo2}%`} /> : null}
                              {latestVitals.temp_c != null ? (
                                <MiniVital label="Temp" value={`${latestVitals.temp_c.toFixed(1)} °C`} />
                              ) : null}
                              {latestVitals.glucose_mg_dl != null ? (
                                <MiniVital label="Glucose" value={`${latestVitals.glucose_mg_dl} mg/dL`} />
                              ) : null}
                              {latestVitals.sys != null || latestVitals.dia != null ? (
                                <MiniVital label="BP" value={`${latestVitals.sys ?? '—'}/${latestVitals.dia ?? '—'} mmHg`} />
                              ) : null}
                            </div>
                          ) : null}
                        </div>

                        <div className="rounded-[22px] border border-slate-200/80 bg-white p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Actions
                          </div>

                          <div className="mt-3 flex flex-col gap-2">
                            <button
                              type="button"
                              onClick={() => latestEncId && startCarePort(latestEncId)}
                              disabled={!latestEncId || startingCareportEncId === latestEncId}
                              className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {startingCareportEncId === latestEncId ? 'Starting…' : 'Start CarePort'}
                            </button>

                            <button
                              type="button"
                              onClick={() => routeFollowUp(c)}
                              disabled={followUpDisabled}
                              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <FiPlus className="h-4 w-4" />
                              Book follow-up
                            </button>

                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => exportCaseAsPdf(c.id)}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 transition hover:bg-slate-50"
                              >
                                <FiDownload className="h-4 w-4" />
                                Export
                              </button>

                              <button
                                type="button"
                                onClick={() => shareCase(c)}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 transition hover:bg-slate-50"
                              >
                                <FiShare2 className="h-4 w-4" />
                                Share
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 border-t border-slate-200/80 pt-4">
                    <button
                      type="button"
                      onClick={() => toggle(c.id)}
                      className="inline-flex items-center gap-2 rounded-full bg-slate-900/5 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-900/10"
                    >
                      {expanded[c.id] ? <FiChevronUp className="h-4 w-4" /> : <FiChevronDown className="h-4 w-4" />}
                      {expanded[c.id] ? 'Hide encounter timeline' : `Show encounter timeline (${encs.length})`}
                    </button>

                    {expanded[c.id] ? (
                      <div className="mt-4 space-y-3">
                        {encs.map((enc, idx) => {
                          const encVitals = enc.vitals;
                          return (
                            <div
                              key={enc.id}
                              className="rounded-[22px] border border-slate-200/80 bg-slate-50/60 p-4"
                            >
                              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="text-sm font-semibold text-slate-950">
                                      Encounter {enc.id}
                                    </div>
                                    <EncounterModeBadge mode={enc.mode} />
                                    <span
                                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${encounterStatusClasses(
                                        enc.status,
                                      )}`}
                                    >
                                      {labelForEncounterStatus(enc.status)}
                                    </span>
                                  </div>

                                  <div className="mt-1 text-sm text-slate-600">
                                    {new Date(enc.start).toLocaleString()}
                                    {enc.clinician?.name ? (
                                      <>
                                        {' '}
                                        · <span className="font-medium text-slate-900">{enc.clinician.name}</span>
                                      </>
                                    ) : null}
                                  </div>

                                  {enc.notes ? (
                                    <p className="mt-2 max-w-3xl whitespace-pre-line text-sm leading-6 text-slate-600">
                                      {enc.notes}
                                    </p>
                                  ) : null}

                                  {enc.devices?.length ? (
                                    <div className="mt-3 flex flex-wrap gap-2">
                                      {enc.devices.map((d) => (
                                        <span
                                          key={`${enc.id}-${d}`}
                                          className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200"
                                        >
                                          {d}
                                        </span>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>

                                <div className="shrink-0 text-right">
                                  <Link
                                    href={`/encounters/${encodeURIComponent(enc.id)}`}
                                    className="inline-flex rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
                                  >
                                    Open details
                                  </Link>
                                  <div className="mt-2 text-xs text-slate-500">#{idx + 1} in this case</div>
                                </div>
                              </div>

                              {encVitals ? (
                                <div className="mt-4 flex flex-wrap gap-2">
                                  {encVitals.hr != null ? <MiniVital label="HR" value={`${encVitals.hr} bpm`} /> : null}
                                  {encVitals.spo2 != null ? <MiniVital label="SpO₂" value={`${encVitals.spo2}%`} /> : null}
                                  {encVitals.temp_c != null ? (
                                    <MiniVital label="Temp" value={`${encVitals.temp_c.toFixed(1)} °C`} />
                                  ) : null}
                                  {encVitals.glucose_mg_dl != null ? (
                                    <MiniVital label="Glucose" value={`${encVitals.glucose_mg_dl} mg/dL`} />
                                  ) : null}
                                  {encVitals.sys != null || encVitals.dia != null ? (
                                    <MiniVital label="BP" value={`${encVitals.sys ?? '—'}/${encVitals.dia ?? '—'} mmHg`} />
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </main>
  );
}

function MiniVital({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
      <span className="text-slate-500">{label}:</span> {value}
    </div>
  );
}