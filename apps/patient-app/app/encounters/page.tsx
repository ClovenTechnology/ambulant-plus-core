// apps/patient-app/app/encounters/page.tsx
'use client';
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { FiVideo, FiMessageCircle, FiDownload, FiShare2, FiPlus } from 'react-icons/fi';

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
  mode?: 'Video' | 'Chat' | 'Audio' | 'InPerson';
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

/* ----------------- Small helpers & visuals ----------------- */

const statusColor = (status: Case['status'] | string) => {
  switch (status) {
    case 'Open':
      return 'bg-green-100 text-green-700';
    case 'Closed':
      return 'bg-zinc-100 text-zinc-700';
    case 'Referred':
      return 'bg-amber-100 text-amber-800';
    default:
      return 'bg-zinc-100 text-zinc-700';
  }
};

const modeIcon = (mode?: Encounter['mode']) => {
  switch (mode) {
    case 'Video':
      return <FiVideo className="inline mr-1 text-purple-600" />;
    case 'Chat':
      return <FiMessageCircle className="inline mr-1 text-blue-600" />;
    default:
      return null;
  }
};

function initials(name?: string) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function colorForId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h << 5) - h + id.charCodeAt(i);
  const hue = Math.abs(h) % 360;
  return `hsl(${hue} 60% 75%)`;
}

/* ---------- Clinical status helpers (for vitals coloring) ---------- */

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

/* ---------- Tiny Timeline / Sparkline component (inline, supports clinical coloring) ---------- */
function TimelineSparkline({
  values,
  width = 240,
  height = 36,
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

    for (let i = 0; i < values.length - 1; i++) {
      const x1 = (i / (values.length - 1)) * width;
      const x2 = ((i + 1) / (values.length - 1)) * width;
      const y1 = height - ((values[i] - min) / range) * height;
      const y2 = height - ((values[i + 1] - min) / range) * height;

      let stroke = '#10b981';
      const delta = Math.abs(values[i + 1] - values[i]);
      if (delta > range * 0.25) stroke = '#ef4444';
      else if (delta > range * 0.12) stroke = '#f59e0b';

      if (vitalsSeries && metric && metric !== 'auto') {
        const v = vitalsSeries[i];
        let s = 'unknown';
        if (metric === 'hr') s = statusForHr(v?.hr);
        else if (metric === 'spo2') s = statusForSpo2(v?.spo2);
        else if (metric === 'temp') s = statusForTemp(v?.temp_c);
        else if (metric === 'glucose') s = statusForGlucose(v?.glucose_mg_dl);
        stroke = STATUS_COLOR[s] || stroke;
      } else if (vitalsSeries && metric === 'auto') {
        const v = vitalsSeries[i];
        let chosen: 'hr' | 'glucose' | 'spo2' | 'temp' | null = null;
        if (v?.hr != null) chosen = 'hr';
        else if (v?.glucose_mg_dl != null) chosen = 'glucose';
        else if (v?.spo2 != null) chosen = 'spo2';
        else if (v?.temp_c != null) chosen = 'temp';
        if (chosen) {
          let s = 'unknown';
          if (chosen === 'hr') s = statusForHr(v?.hr);
          else if (chosen === 'spo2') s = statusForSpo2(v?.spo2);
          else if (chosen === 'temp') s = statusForTemp(v?.temp_c);
          else if (chosen === 'glucose') s = statusForGlucose(v?.glucose_mg_dl);
          stroke = STATUS_COLOR[s] || stroke;
        }
      }

      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    const handleMove = (ev: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const idx = Math.round((x / width) * (values.length - 1));
      if (idx < 0 || idx >= values.length) {
        if (tip) tip.style.display = 'none';
        return;
      }
      const pointVal = values[idx];
      const ts = timestamps?.[idx];
      const vit = vitalsSeries?.[idx];
      if (tip) {
        tip.style.display = 'block';
        tip.style.left = `${ev.clientX + 10}px`;
        tip.style.top = `${ev.clientY + 10}px`;
        let html = `<div class="text-xs">#${idx + 1}: ${pointVal}</div>`;
        if (vit) {
          if (vit.hr != null) html += `<div class="text-xs">HR: ${vit.hr} bpm</div>`;
          if (vit.spo2 != null) html += `<div class="text-xs">SpO₂: ${vit.spo2}%</div>`;
          if (vit.temp_c != null) html += `<div class="text-xs">Temp: ${vit.temp_c} °C</div>`;
          if (vit.glucose_mg_dl != null) html += `<div class="text-xs">Glucose: ${vit.glucose_mg_dl} mg/dL</div>`;
          if (metric && metric !== 'auto') {
            let s = 'unknown';
            if (metric === 'hr') s = statusForHr(vit.hr);
            else if (metric === 'spo2') s = statusForSpo2(vit.spo2);
            else if (metric === 'temp') s = statusForTemp(vit.temp_c);
            else if (metric === 'glucose') s = statusForGlucose(vit.glucose_mg_dl);
            html += `<div class="text-xs">Status: ${s}</div>`;
          }
        }
        if (ts) html += `<div class="text-xs text-gray-500">${new Date(ts).toLocaleString()}</div>`;
        tip.innerHTML = html;
      }
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
      <canvas ref={ref} className="rounded" />
      <div
        ref={tipRef}
        className="pointer-events-none absolute bg-white border rounded shadow p-1 text-xs"
        style={{ display: 'none', zIndex: 60 }}
      />
    </div>
  );
}

/* ----------------- Helpers ----------------- */

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
        mode: 'Video',
        clinician: { id: 'CL-3', name: 'Dr. Jacobs Naidoo' },
        devices: ['Health Monitor'],
        vitals: { sys: 142, dia: 92 },
      },
      encounters: [
        {
          id: 'E-4000',
          caseId: 'C-1001',
          start: new Date(now - 7205000 * 1000).toISOString(),
          mode: 'Video',
          clinician: { id: 'CL-3', name: 'Dr. Jacobs Naidoo' },
          devices: ['Health Monitor'],
          vitals: { sys: 142, dia: 92 },
        },
      ],
    },
  ];
}

/* ----------------- Small toast system (local, no deps) ----------------- */

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
    <div style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 1200 }} aria-live="polite">
      <div className="flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-3 py-2 rounded shadow text-sm ${
              t.tone === 'success'
                ? 'bg-green-50 text-green-800'
                : t.tone === 'error'
                ? 'bg-red-50 text-red-800'
                : 'bg-white text-gray-800'
            }`}
          >
            {t.text}
            <button onClick={() => remove(t.id)} className="ml-3 text-xs text-gray-500">
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
  return { push, Toasts };
}

/* ----------------- Page Component ----------------- */

export default function EncountersPage() {
  const router = useRouter();

  const [items, setItems] = useState<Case[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Open' | 'Closed' | 'Referred'>('All');
  const [loading, setLoading] = useState(true);

  const caseRefs = useRef<Record<string, HTMLElement | null>>({});

  const [metricByCase, setMetricByCase] = useState<Record<string, 'auto' | 'hr' | 'spo2' | 'temp' | 'glucose'>>({});

  const { push, Toasts } = useToasts();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (!cancelled) setLoading(true);
        const res = await fetch('/api/encounters?mode=cases', { cache: 'no-store' });
        const data = await res.json();
        let cases: Case[] = [];
        if (Array.isArray(data.cases)) {
          cases = data.cases;
        } else if (Array.isArray(data.encounters)) {
          cases = groupEncountersIntoCases(data.encounters);
        }
        if (!cancelled) setItems(cases.length ? cases : makeMockCases());
      } catch (err) {
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

  const toggle = (id: string) =>
    setExpanded((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));

  const filtered = items.filter((c) => {
    const okStatus = filterStatus === 'All' || c.status === filterStatus;
    const okSearch =
      c.title?.toLowerCase().includes(search.toLowerCase()) ||
      c.id.toLowerCase().includes(search.toLowerCase());
    return okStatus && okSearch;
  });

  /* ---------------- export to PDF (header/footer + canvas) ---------------- */
  const CLINIC_HEADER = {
    title: 'Ambulant+ Center',
    address: '0b Meadowbrook Ln, Bryanston 2152',
  };
  const CLINIC_FOOTER = 'Ambulant+ Contactless Medicine - Powered by Cloven Technology Impilo';

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
      wrap.style.width = '800px';
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
        pdf.text(CLINIC_HEADER.title, 40, 30);
        pdf.setFontSize(10);
        pdf.text(CLINIC_HEADER.address, 40, 46);

        const margin = 40;
        const imgW = pageWidth - margin * 2;
        const imgH = (canvas.height / canvas.width) * imgW;
        const y = 60;
        pdf.addImage(dataUrl, 'JPEG', margin, y, imgW, imgH);

        pdf.setFontSize(9);
        pdf.text(CLINIC_FOOTER, 40, pageHeight - 30);

        pdf.save(`case-${caseId}.pdf`);
        push('Exported PDF successfully', 'success');
        return;
      } catch (jspdfErr) {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `case-${caseId}.jpg`;
        a.click();
        push('Exported as image (jspdf not available)', 'info');
        return;
      }
    } catch (err) {
      console.error('export error', err);
      push('Export failed — see console.', 'error');
    }
  }

  /* ---------------- follow-up routing (case-context only) ---------------- */

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

    const href =
      `/clinicians/${encodeURIComponent(clinicianId)}/calendar` +
      `?type=followup&caseId=${encodeURIComponent(caseItem.id)}`;

    router.push(href);
  }

  return (
    <main className="space-y-4 p-4">
      <Toasts />
      <h1 className="text-2xl font-bold">My Cases</h1>

      {/* Info strip about upcoming bookings */}
      <div className="rounded-lg border border-dashed border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900 flex flex-wrap items-center gap-2">
        <span>Looking for upcoming bookings?</span>
        <Link href="/appointments" className="font-medium underline underline-offset-2">
          Go to Upcoming visits
        </Link>
      </div>

      {/* Search + filter */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="search"
          placeholder="Search cases or case ID..."
          className="border rounded px-3 py-1 flex-1 min-w-[220px]"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="border rounded px-2 py-1"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
        >
          <option value="All">All Status</option>
          <option value="Open">Open</option>
          <option value="Closed">Closed</option>
          <option value="Referred">Referred</option>
        </select>
      </div>

      {loading && items.length === 0 && (
        <div className="rounded-lg border bg-white p-4 text-sm text-zinc-500">
          Loading your cases…
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="mt-2 rounded-xl border border-dashed bg-white p-6 text-sm text-gray-700 max-w-xl">
          <div className="font-semibold text-gray-900">No cases yet</div>
          <p className="mt-1">
            After your first consultation, we&apos;ll group your visits into <b>cases</b> so you can track your
            care over time.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/auto-triage"
              className="px-3 py-1.5 rounded-full text-xs bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Start a quick triage
            </Link>
            <Link href="/clinicians" className="px-3 py-1.5 rounded-full text-xs border bg-white hover:bg-gray-50">
              Find a clinician
            </Link>
            <Link
              href="/appointments"
              className="px-3 py-1.5 rounded-full text-xs border bg-white hover:bg-gray-50"
            >
              View appointments
            </Link>
          </div>
        </div>
      )}

      <ul className="space-y-3">
        {filtered.map((c) => {
          const encs = (c.encounters ?? [])
            .slice()
            .sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());

          const series = encs.length ? encs.map((e) => Math.floor(new Date(e.start).getTime() / 60000)) : [0, 0];
          const humanSeries = encs.map((e) => e.start);
          const vitalsSeries = encs.map((e) => e.vitals);

          const clinician = c.latestEncounter?.clinician ?? encs[0]?.clinician;
          const metric = metricByCase[c.id] ?? 'auto';

          const followUpDisabled = c.status === 'Closed';

          return (
            <li
              key={c.id}
              ref={(el) => (caseRefs.current[c.id] = el)}
              className="border rounded-lg p-4 shadow hover:shadow-md transition-all bg-white dark:bg-zinc-800"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  {/* clinician avatar */}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold"
                    style={{ background: clinician ? colorForId(clinician.id) : '#eee' }}
                    title={clinician ? clinician.name : 'No clinician'}
                  >
                    <span>{initials(clinician?.name ?? c.title)}</span>
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <div className="font-medium text-lg">{c.title ?? `Case #${c.id}`}</div>
                      <span className={`text-xs px-2 py-0.5 rounded ${statusColor(c.status)}`}>{c.status}</span>
                    </div>
                    <div className="text-sm text-zinc-500 mt-1">
                      Updated {formatDistanceToNow(new Date(c.updatedAt), { addSuffix: true })}
                      <span className="ml-1 text-[11px]" title={new Date(c.updatedAt).toLocaleString()}>
                        (exact)
                      </span>
                    </div>

                    {c.latestEncounter && (
                      <div className="text-[13px] mt-1 text-zinc-600 flex items-center gap-2">
                        <div className="inline-flex items-center gap-1">
                          {modeIcon(c.latestEncounter.mode)}{' '}
                          {formatDistanceToNow(new Date(c.latestEncounter.start), {
                            addSuffix: true,
                          })}
                        </div>
                        {clinician && (
                          <div className="ml-2 text-sm text-zinc-500">
                            • {clinician.name}
                            {clinician.specialty ? ` — ${clinician.specialty}` : ''}
                          </div>
                        )}
                      </div>
                    )}

                    {/* devices */}
                    {encs.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {Array.from(new Set(encs.flatMap((e) => e.devices ?? []))).map((d) => (
                          <span key={d} className="text-[12px] px-2 py-0.5 border rounded bg-gray-50">
                            {d}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* right actions */}
                <div className="flex flex-col items-end gap-2">
                  <div className="text-sm text-zinc-500">
                    {encs.length} encounter{encs.length === 1 ? '' : 's'}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => toggle(c.id)} className="text-blue-600 text-sm">
                      {expanded[c.id] ? 'Hide Details ▲' : 'View Details ▼'}
                    </button>

                    <button
                      className={`flex items-center gap-1 text-sm px-2 py-1 border rounded ${
                        followUpDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-100'
                      }`}
                      onClick={() => !followUpDisabled && routeFollowUp(c)}
                      title={
                        followUpDisabled
                          ? 'Case is closed — follow-up not allowed'
                          : 'Schedule a follow-up (case-context only)'
                      }
                      disabled={followUpDisabled}
                    >
                      <FiPlus /> Follow-up
                    </button>

                    <button
                      className="flex items-center gap-1 text-sm px-2 py-1 border rounded hover:bg-gray-100"
                      onClick={() => exportCaseAsPdf(c.id)}
                      title="Export case as PDF"
                    >
                      <FiDownload /> Export
                    </button>

                    <button
                      className="flex items-center gap-1 text-sm px-2 py-1 border rounded hover:bg-gray-100"
                      onClick={() => push('Share not implemented yet', 'info')}
                    >
                      <FiShare2 /> Share
                    </button>
                  </div>
                </div>
              </div>

              {/* sparkline + small summary */}
              <div className="mt-3 flex items-center justify-between">
                <div className="text-xs text-gray-500">Timeline</div>
                <div className="text-xs text-gray-500">
                  {encs.length ? `Last: ${new Date(encs[0].start).toLocaleString()}` : ''}
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between">
                <div>
                  {/* metric selector */}
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-xs text-gray-500">Color by</label>
                    <select
                      className="text-xs border rounded px-2 py-1"
                      value={metric}
                      onChange={(e) =>
                        setMetricByCase((prev) => ({
                          ...prev,
                          [c.id]: e.target.value as any,
                        }))
                      }
                    >
                      <option value="auto">Auto</option>
                      <option value="hr">HR</option>
                      <option value="spo2">SpO₂</option>
                      <option value="temp">Temp</option>
                      <option value="glucose">Glucose</option>
                    </select>
                  </div>

                  <TimelineSparkline
                    values={series}
                    timestamps={humanSeries}
                    vitalsSeries={vitalsSeries}
                    metric={metric}
                    width={360}
                    height={48}
                  />
                </div>

                <div className="ml-4 text-right text-xs text-zinc-500">
                  {encs.slice(0, 3).map((e) => (
                    <div key={e.id} className="mb-1">
                      <div className="font-medium text-[13px]">
                        {modeIcon(e.mode)}{' '}
                        {formatDistanceToNow(new Date(e.start), { addSuffix: true })}
                      </div>
                      <div className="text-[12px] text-zinc-400">{e.clinician?.name ?? '—'}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* expanded details */}
              {expanded[c.id] && (
                <div className="mt-3 border-t pt-3 space-y-2 text-sm">
                  {encs.length === 0 ? (
                    <div className="text-xs text-zinc-500">
                      No encounters have been recorded for this case yet.
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {encs.map((enc) => {
                        const isCompleted = enc.status === 'Completed' || enc.status === 'Closed';
                        const needsRating = isCompleted && !enc.rating?.score;

                        return (
                          <li key={enc.id} className="flex justify-between items-start gap-3">
                            <div>
                              <div className="font-medium">
                                {modeIcon(enc.mode)} {new Date(enc.start).toLocaleString()}
                              </div>
                              <div className="text-xs text-zinc-500">
                                {enc.clinician
                                  ? `${enc.clinician.name}${
                                      enc.clinician.specialty ? ` — ${enc.clinician.specialty}` : ''
                                    }`
                                  : 'No clinician'}
                                {enc.devices && enc.devices.length > 0
                                  ? ` • ${enc.devices.join(', ')}`
                                  : ''}
                              </div>
                              {enc.notes && (
                                <div className="mt-1 text-[13px] text-zinc-700">{enc.notes}</div>
                              )}
                              {enc.vitals && (
                                <div className="mt-1 text-[13px] text-zinc-700">
                                  Vitals: {enc.vitals.hr ? `HR ${enc.vitals.hr} bpm • ` : ''}
                                  {enc.vitals.spo2 ? `SpO₂ ${enc.vitals.spo2}% • ` : ''}
                                  {enc.vitals.temp_c ? `Temp ${enc.vitals.temp_c}°C • ` : ''}
                                  {enc.vitals.glucose_mg_dl
                                    ? `Glucose ${enc.vitals.glucose_mg_dl} mg/dL`
                                    : ''}
                                </div>
                              )}

                              <button
                                className="mt-2 text-xs text-blue-600 hover:underline"
                                onClick={() =>
                                  router.push(`/encounters/${encodeURIComponent(enc.id)}`)
                                }
                              >
                                View visit →
                              </button>

                              {needsRating && (
                                <button
                                  className="mt-1 block text-xs text-amber-600 hover:underline"
                                  onClick={() =>
                                    router.push(
                                      `/encounters/${encodeURIComponent(enc.id)}?rate=1`,
                                    )
                                  }
                                >
                                  Rate this visit
                                </button>
                              )}
                            </div>
                            <div className="text-xs text-zinc-400">{enc.status ?? ''}</div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
