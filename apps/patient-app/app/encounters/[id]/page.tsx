// apps/patient-app/app/encounters/[id]/page.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR, { mutate as globalMutate } from 'swr';
import { toast } from '@/components/ToastMount';

type RatingAgg = {
  ratingSum: number;
  ratingCount: number;
  ratingAvg: number;
};

type VitalsPoint = {
  t: number;
  hr?: number;
  spo2?: number;
  temp?: number;
  glucose_mg_dl?: number;
};

type CoverageInfo = {
  type?: 'Card' | 'Medical Aid' | 'Voucher' | 'Cash' | string;
  name?: string;
  scheme?: string;
  last4?: string;
  reference?: string;
};

type BillingInfo = {
  currency?: string;
  totalAmount?: number;
  coveredAmount?: number;
  patientAmount?: number;
  status?: 'Pending' | 'Paid' | 'Refunded' | 'Failed' | string;
  invoiceId?: string;
};

type Encounter = {
  id: string;

  status?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  startedAt?: string | number | null;
  endedAt?: string | number | null;

  // sometimes you have case/caseId naming differences
  caseId?: string | null;
  case?: string | null;

  summary?: string | null;
  notes?: string | null;

  // richer notes list
  notesLog?: Array<{ id: string; ts: string; text: string; source?: string }> | null;

  // vitals
  vitals?: VitalsPoint[] | null;

  // billing/coverage
  coverage?: CoverageInfo | null;
  billing?: BillingInfo | null;

  patientId?: string | null;
  clinicianId?: string | null;

  clinician?: {
    id: string;
    name?: string | null;
    specialty?: string | null;
    ratingSum?: number | null;
    ratingCount?: number | null;
    ratingAvg?: number | null;
  } | null;

  // rating stored on encounter
  patientRating?: number | null;
  patientRatingComment?: string | null;

  // sometimes backend returns aggregates on encounter too
  ratingSum?: number | null;
  ratingCount?: number | null;
  ratingAvg?: number | null;
};

/* ------------------- helpers ------------------- */

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function getUid() {
  if (typeof window === 'undefined') return 'server-user';
  const key = 'ambulant_uid';
  let v = localStorage.getItem(key);
  if (!v) {
    v = ((globalThis as any)?.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) + '-u';
    localStorage.setItem(key, v);
  }
  return v;
}

function apiUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_APIGW_BASE ?? '';
  if (!base) return path;
  if (path.startsWith('http')) return path;
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function authHeaders(role: 'patient' | 'clinician' | 'admin' = 'patient') {
  return { 'x-role': role, 'x-uid': getUid() };
}

async function readJsonSafe(r: Response) {
  return r.json().catch(() => null);
}

async function fetcher(url: string) {
  const r = await fetch(url, {
    cache: 'no-store',
    headers: authHeaders('patient'),
  });
  const j = await readJsonSafe(r);
  if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
  return j;
}

function extractAgg(payload: any): RatingAgg {
  const fromClinician = payload?.clinician || payload?.provider || payload?.doctor || payload?.profile || null;

  const sumRaw = payload?.ratingSum ?? payload?.ratingsSum ?? fromClinician?.ratingSum ?? fromClinician?.ratingsSum ?? 0;

  const cntRaw =
    payload?.ratingCount ??
    payload?.ratingsCount ??
    payload?.reviewCount ??
    fromClinician?.ratingCount ??
    fromClinician?.ratingsCount ??
    fromClinician?.reviewCount ??
    0;

  const avgRaw = payload?.ratingAvg ?? payload?.ratingsAvg ?? fromClinician?.ratingAvg ?? fromClinician?.ratingsAvg ?? null;

  const ratingSum = Number.isFinite(Number(sumRaw)) ? Number(sumRaw) : 0;
  const ratingCount = Number.isFinite(Number(cntRaw)) ? Number(cntRaw) : 0;

  const computedAvg = ratingCount > 0 ? ratingSum / ratingCount : 0;
  const ratingAvg = Number.isFinite(Number(avgRaw)) ? Number(avgRaw) : computedAvg;

  return { ratingSum, ratingCount, ratingAvg: clamp(ratingAvg, 0, 5) };
}

function broadcastRatingUpdate(evt: { encounterId: string; clinicianId?: string | null; agg?: RatingAgg }) {
  try {
    localStorage.setItem('ambulant.ratings.bump', String(Date.now()));
  } catch {}

  try {
    window.dispatchEvent(new CustomEvent('ambulant:ratings-updated', { detail: evt }));
  } catch {}

  try {
    const ch = new BroadcastChannel('ambulant_ratings');
    ch.postMessage({ type: 'rating.updated', ...evt });
    ch.close();
  } catch {}
}

function formatDateTime(isoOrNum?: string | number | null) {
  if (isoOrNum == null) return '—';
  const t = typeof isoOrNum === 'number' ? isoOrNum : Date.parse(String(isoOrNum));
  if (!Number.isFinite(t)) return String(isoOrNum);
  return new Date(t).toLocaleString();
}

function initials(name?: string | null) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function colorForId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h << 5) - h + id.charCodeAt(i);
  const hue = Math.abs(h) % 360;
  return `hsl(${hue} 60% 70%)`;
}

// Status normalization (handles patient-app + clinician-app vocab)
type CanonStatus = 'Scheduled' | 'InProgress' | 'Completed' | 'Unknown';

function normalizeEncounterStatus(raw?: string | null): CanonStatus {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!s) return 'Unknown';

  if (s === 'scheduled' || s === 'booked' || s === 'pending') return 'Scheduled';
  if (s === 'inprogress' || s === 'in_progress' || s === 'active' || s === 'open' || s === 'ongoing') return 'InProgress';
  if (s === 'completed' || s === 'complete' || s === 'closed' || s === 'ended' || s === 'done') return 'Completed';

  // tolerate title-case variants
  if (s === 'in progress') return 'InProgress';
  return 'Unknown';
}

/* ------------------- clinical status coloring for sparkline ------------------- */

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
function statusForTemp(temp?: number) {
  if (temp == null) return 'unknown';
  if (temp >= 40 || temp < 34) return 'critical';
  if (temp >= 38 || temp < 36) return 'warning';
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

function SparklineClinical({
  points,
  metric = 'hr',
  width = 800,
  height = 120,
}: {
  points: VitalsPoint[];
  metric?: 'hr' | 'spo2' | 'temp' | 'glucose';
  width?: number;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const tip = tipRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 2, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = '100%';
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    if (!points || points.length < 2) {
      ctx.strokeStyle = '#e6e7eb';
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      return;
    }

    const vals = points.map((p) => {
      if (metric === 'hr') return p.hr ?? NaN;
      if (metric === 'spo2') return p.spo2 ?? NaN;
      if (metric === 'temp') return p.temp ?? NaN;
      if (metric === 'glucose') return p.glucose_mg_dl ?? NaN;
      return NaN;
    });

    for (let i = 0; i < vals.length; i++) {
      if (!Number.isFinite(vals[i])) {
        vals[i] = i > 0 && Number.isFinite(vals[i - 1]) ? vals[i - 1] : 0;
      }
    }

    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max === min ? 1 : max - min;

    ctx.strokeStyle = 'rgba(15,23,42,0.06)';
    ctx.lineWidth = 1;
    for (let y = 0; y < height; y += Math.round(height / 4)) {
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(width, y + 0.5);
      ctx.stroke();
    }

    for (let i = 0; i < vals.length - 1; i++) {
      const x1 = (i / (vals.length - 1)) * width;
      const x2 = ((i + 1) / (vals.length - 1)) * width;
      const y1 = height - ((vals[i] - min) / range) * height;
      const y2 = height - ((vals[i + 1] - min) / range) * height;

      const v = points[i];
      let s = 'unknown';
      if (metric === 'hr') s = statusForHr(v.hr);
      if (metric === 'spo2') s = statusForSpo2(v.spo2);
      if (metric === 'temp') s = statusForTemp(v.temp);
      if (metric === 'glucose') s = statusForGlucose(v.glucose_mg_dl);

      const stroke = STATUS_COLOR[s] || '#94a3b8';

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
      const idx = Math.round((x / rect.width) * (vals.length - 1));
      if (idx < 0 || idx >= vals.length) {
        if (tip) tip.style.display = 'none';
        return;
      }
      const p = points[idx];
      if (!tip) return;

      tip.style.display = 'block';
      tip.style.left = `${ev.clientX + 8}px`;
      tip.style.top = `${ev.clientY + 8}px`;

      let html = `<div class="text-xs font-medium">${new Date(p.t).toLocaleString()}</div>`;
      if (metric === 'hr')
        html += `<div class="text-xs">HR: ${p.hr ?? '—'} bpm</div><div class="text-xs">Status: ${statusForHr(p.hr)}</div>`;
      if (metric === 'spo2')
        html += `<div class="text-xs">SpO₂: ${p.spo2 ?? '—'}%</div><div class="text-xs">Status: ${statusForSpo2(p.spo2)}</div>`;
      if (metric === 'temp')
        html += `<div class="text-xs">Temp: ${p.temp ?? '—'} °C</div><div class="text-xs">Status: ${statusForTemp(p.temp)}</div>`;
      if (metric === 'glucose')
        html += `<div class="text-xs">Glucose: ${p.glucose_mg_dl ?? '—'} mg/dL</div><div class="text-xs">Status: ${statusForGlucose(
          p.glucose_mg_dl,
        )}</div>`;
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
  }, [points, metric, width, height]);

  return (
    <div className="relative w-full">
      <canvas ref={canvasRef} className="rounded w-full" />
      <div ref={tipRef} className="pointer-events-none fixed bg-white border rounded shadow p-2 text-xs" style={{ display: 'none', zIndex: 2000 }} />
    </div>
  );
}

function SparklineAndTable({ vitals, metric }: { vitals: VitalsPoint[]; metric: 'hr' | 'spo2' | 'temp' | 'glucose' }) {
  const points = (vitals ?? []).slice().sort((a, b) => a.t - b.t);

  return (
    <div className="space-y-3">
      <div className="w-full bg-white p-2 rounded border">
        <SparklineClinical points={points} metric={metric} />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-neutral-600">
              <th className="py-2 pr-4">Time</th>
              <th className="py-2 pr-4">HR</th>
              <th className="py-2 pr-4">SpO₂</th>
              <th className="py-2 pr-4">Temp (°C)</th>
              <th className="py-2 pr-4">Glucose (mg/dL)</th>
            </tr>
          </thead>
          <tbody>
            {points.length ? (
              points
                .slice(-40)
                .reverse()
                .map((p) => (
                  <tr key={p.t} className="border-t">
                    <td className="py-2 pr-4 font-mono">{new Date(p.t).toLocaleString()}</td>
                    <td className="py-2 pr-4">
                      {p.hr ?? '—'}
                      {p.hr != null && (
                        <span className="ml-2 text-xs px-1 rounded" style={{ background: STATUS_COLOR[statusForHr(p.hr)] + '20' }}>
                          {statusForHr(p.hr)}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {p.spo2 ?? '—'}
                      {p.spo2 != null && (
                        <span className="ml-2 text-xs px-1 rounded" style={{ background: STATUS_COLOR[statusForSpo2(p.spo2)] + '20' }}>
                          {statusForSpo2(p.spo2)}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {p.temp != null ? p.temp.toFixed(1) : '—'}
                      {p.temp != null && (
                        <span className="ml-2 text-xs px-1 rounded" style={{ background: STATUS_COLOR[statusForTemp(p.temp)] + '20' }}>
                          {statusForTemp(p.temp)}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {p.glucose_mg_dl ?? '—'}
                      {p.glucose_mg_dl != null && (
                        <span
                          className="ml-2 text-xs px-1 rounded"
                          style={{ background: STATUS_COLOR[statusForGlucose(p.glucose_mg_dl)] + '20' }}
                        >
                          {statusForGlucose(p.glucose_mg_dl)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
            ) : (
              <tr>
                <td className="py-2 text-neutral-600">No vitals available.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------- rating UI ------------------- */

const StarButton: React.FC<{ active: boolean; onClick: () => void; label: string }> = ({ active, onClick, label }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    className={`h-10 w-10 grid place-items-center rounded-lg border transition ${active ? 'bg-amber-50 border-amber-300' : 'bg-white hover:bg-slate-50'}`}
  >
    <svg viewBox="0 0 24 24" className={`h-5 w-5 ${active ? 'text-amber-500' : 'text-slate-300'}`}>
      <path fill="currentColor" d="M12 17.3l-6.18 3.4 1.18-6.87L2 9.1l6.9-1L12 1.8l3.1 6.3 6.9 1-5 4.73 1.18 6.87z" />
    </svg>
  </button>
);

/* ------------------- Page ------------------- */

export default function EncounterPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id;

  const exportRef = useRef<HTMLDivElement | null>(null);
  const rateRef = useRef<HTMLDivElement | null>(null);

  const encounterKey = useMemo(() => apiUrl(`/api/encounters/${encodeURIComponent(id)}`), [id]);
  const { data, error, isValidating, mutate } = useSWR(encounterKey, fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });

  const encounter: Encounter | null = useMemo(() => {
    if (!data) return null;
    const e = (data?.encounter ?? data?.item ?? data) as any;
    return e && typeof e === 'object' ? (e as Encounter) : null;
  }, [data]);

  const clinicianId = encounter?.clinicianId ?? encounter?.clinician?.id ?? (data?.clinicianId as string | undefined) ?? null;

  const clinicianName = encounter?.clinician?.name ?? 'Clinician';
  const specialty = encounter?.clinician?.specialty ?? '';

  const currentAgg = useMemo<RatingAgg>(() => {
    if (!encounter) return { ratingSum: 0, ratingCount: 0, ratingAvg: 0 };
    const src = encounter?.clinician ?? encounter;
    return extractAgg(src);
  }, [encounter]);

  const existingRating = useMemo(() => {
    const v = encounter?.patientRating;
    return typeof v === 'number' && Number.isFinite(v) ? clamp(v, 1, 5) : null;
  }, [encounter]);

  const [draftRating, setDraftRating] = useState<number>(existingRating ?? 0);
  const [comment, setComment] = useState<string>(encounter?.patientRatingComment ?? '');
  const [savingRating, setSavingRating] = useState(false);

  const [noteText, setNoteText] = useState('');

  // CarePort marketplace (start/resume) + eRx refills panel
  const [startingCareport, setStartingCareport] = useState(false);
  const [careportOrderId, setCareportOrderId] = useState<string | null>(null);

  const erxLatestKey = useMemo(() => `/api/erx/latest?encId=${encodeURIComponent(id)}`, [id]);
  const { data: erxLatest } = useSWR(
    erxLatestKey,
    (u: string) => fetch(u, { cache: 'no-store', headers: authHeaders('patient') }).then((r) => r.json()),
    { revalidateOnFocus: false },
  );

  useEffect(() => {
    let alive = true;
    fetch(`/api/careport/orders/lookup?encId=${encodeURIComponent(id)}`, { cache: 'no-store', headers: authHeaders('patient') })
      .then((r) => r.json().then((j) => ({ r, j })))
      .then(({ r, j }) => {
        if (!alive) return;
        if (!r.ok || !j?.ok) {
          setCareportOrderId(null);
          return;
        }
        setCareportOrderId(j?.order?.id ? String(j.order.id) : null);
      })
      .catch(() => alive && setCareportOrderId(null));
    return () => {
      alive = false;
    };
  }, [id]);

  async function startCarePortFromEncounter() {
    setStartingCareport(true);
    try {
      const r = await fetch('/api/careport/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders('patient') },
        body: JSON.stringify({ encId: id, fulfillment: 'DELIVERY' }),
      });
      const j = await r.json().catch(() => ({} as any));
      if (!r.ok || !j?.ok) {
        toast(j?.error || `Failed to start CarePort (HTTP ${r.status})`, 'error');
        return;
      }
      if (j?.orderId) setCareportOrderId(String(j.orderId));
      const href = String(j.redirectUrl || '');
      router.push(href || `/careport/marketplace/${encodeURIComponent(String(j.orderId || ''))}`);
    } catch (e: any) {
      toast(e?.message || 'Failed to start CarePort', 'error');
    } finally {
      setStartingCareport(false);
    }
  }

  const selectedDefault = useMemo(() => {
    const vitals = encounter?.vitals ?? [];
    if (vitals.some((v) => v.hr != null)) return 'hr';
    if (vitals.some((v) => v.glucose_mg_dl != null)) return 'glucose';
    if (vitals.some((v) => v.spo2 != null)) return 'spo2';
    if (vitals.some((v) => v.temp != null)) return 'temp';
    return 'hr';
  }, [encounter?.vitals]);

  const [selectedMetric, setSelectedMetric] = useState<'hr' | 'spo2' | 'temp' | 'glucose'>('hr');

  useEffect(() => {
    setSelectedMetric(selectedDefault as any);
  }, [selectedDefault]);

  // keep draft in sync if encounter loads/updates
  useEffect(() => {
    if (existingRating != null) setDraftRating(existingRating);
    setComment(encounter?.patientRatingComment ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encounter?.id, encounter?.patientRating, encounter?.patientRatingComment]);

  const canonStatus = normalizeEncounterStatus(encounter?.status);
  const canRate = canonStatus === 'Completed';

  // auto-scroll to rating when routed with ?rate=1
  const shouldPromptRating = searchParams?.get('rate') === '1';
  const autoScrolledRef = useRef(false);
  useEffect(() => {
    if (!shouldPromptRating) return;
    if (!encounter) return;
    if (autoScrolledRef.current) return;
    if (!canRate) return;
    if (existingRating != null) return;
    autoScrolledRef.current = true;
    setTimeout(() => rateRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
  }, [shouldPromptRating, encounter, canRate, existingRating]);

  const postRating = useCallback(
    async (payload: any) => {
      const attempts: Array<{ url: string; method: string }> = [
        { url: apiUrl(`/api/encounters/${encodeURIComponent(id)}/rate`), method: 'POST' },
        { url: apiUrl(`/api/encounters/${encodeURIComponent(id)}/rating`), method: 'POST' },
        { url: apiUrl(`/api/encounters/${encodeURIComponent(id)}/ratings`), method: 'POST' },
        { url: apiUrl(`/api/ratings`), method: 'POST' },
      ];

      let lastErr: any = null;

      for (const a of attempts) {
        try {
          const body = a.url.endsWith('/api/ratings') ? { encounterId: id, clinicianId, ...payload } : payload;

          const r = await fetch(a.url, {
            method: a.method,
            cache: 'no-store',
            headers: {
              'content-type': 'application/json',
              ...authHeaders('patient'),
            },
            body: JSON.stringify(body),
          });

          const j = await readJsonSafe(r);
          if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`);
          return j;
        } catch (e) {
          lastErr = e;
        }
      }

      throw lastErr || new Error('Failed to submit rating');
    },
    [id, clinicianId],
  );

  const onSaveRating = useCallback(async () => {
    if (!encounter) return;

    const stars = clamp(Number(draftRating || 0), 1, 5);
    if (!stars || !Number.isFinite(stars)) {
      toast('Please select a rating (1–5).', 'error');
      return;
    }
    if (!canRate) {
      toast('Rating is available after the session is completed.', 'info');
      return;
    }

    try {
      setSavingRating(true);

      const res = await postRating({
        rating: stars,
        stars,
        value: stars,
        comment: comment?.trim() ? comment.trim() : null,
        source: 'patient.encounter',
      });

      const nextAgg = extractAgg(res?.clinician ?? res?.provider ?? res?.profile ?? res) ?? currentAgg;

      // Optimistic update
      await mutate(
        (prev: any) => {
          const prevEnc = (prev?.encounter ?? prev?.item ?? prev) as any;
          if (!prevEnc || typeof prevEnc !== 'object') return prev;

          const updated = {
            ...prevEnc,
            patientRating: stars,
            patientRatingComment: comment?.trim() ? comment.trim() : null,
            ratingSum: nextAgg.ratingSum,
            ratingCount: nextAgg.ratingCount,
            ratingAvg: nextAgg.ratingAvg,
          };

          if (updated.clinician && typeof updated.clinician === 'object') {
            updated.clinician = {
              ...updated.clinician,
              ratingSum: nextAgg.ratingSum,
              ratingCount: nextAgg.ratingCount,
              ratingAvg: nextAgg.ratingAvg,
            };
          }

          if (prev?.encounter) return { ...prev, encounter: updated };
          if (prev?.item) return { ...prev, item: updated };
          return updated;
        },
        false,
      );

      // server truth
      await mutate();

      // refresh any clinician SWR keys (with or without APIGW base)
      globalMutate((key) => typeof key === 'string' && key.includes('/api/clinicians'));

      broadcastRatingUpdate({ encounterId: id, clinicianId, agg: nextAgg });

      toast('Thanks — your rating was saved.', 'success');

      // if came from call-ended flow (?rate=1), bounce back
      if (shouldPromptRating) router.push('/encounters');
    } catch (e: any) {
      toast(e?.message || 'Failed to save rating', 'error');
    } finally {
      setSavingRating(false);
    }
  }, [encounter, draftRating, comment, postRating, mutate, currentAgg, id, clinicianId, canRate, router, shouldPromptRating]);

  const busy = isValidating && !encounter;

  // Coverage/billing helpers (safe)
  const coverage = encounter?.coverage ?? null;
  const billing = encounter?.billing ?? null;

  const coverageText = useMemo(() => {
    if (!coverage) return null;
    const label = coverage.name || coverage.type || 'payment method';
    const bits: string[] = [];
    if (coverage.scheme) bits.push(coverage.scheme);
    if (coverage.last4) bits.push(`•••• ${coverage.last4}`);
    if (coverage.reference) bits.push(coverage.reference);
    const details = bits.join(' · ');
    return details ? `${label}: ${details}` : label;
  }, [coverage]);

  const formatAmount = (amount?: number | null, currency?: string | null) => {
    if (amount == null || Number.isNaN(Number(amount))) return '—';
    const cur = currency ?? '';
    return `${cur ? cur + ' ' : ''}${Number(amount).toFixed(2)}`;
  };

  async function submitNote() {
    if (!encounter) return;
    const txt = noteText.trim();
    if (!txt) {
      toast('Note is empty', 'error');
      return;
    }

    try {
      const r = await fetch(apiUrl(`/api/encounters/${encodeURIComponent(encounter.id)}/notes`), {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...authHeaders('patient') },
        body: JSON.stringify({ text: txt, source: 'patient-ui' }),
      });

      const out = await readJsonSafe(r);
      if (!r.ok) throw new Error(out?.error || `HTTP ${r.status}`);

      // optimistic local append (supports notesLog)
      await mutate(
        (prev: any) => {
          const prevEnc = (prev?.encounter ?? prev?.item ?? prev) as any;
          if (!prevEnc || typeof prevEnc !== 'object') return prev;

          const newItem = {
            id: out?.note?.id ?? 'local-' + Date.now(),
            ts: new Date().toISOString(),
            text: txt,
            source: 'patient-ui',
          };

          const existing = Array.isArray(prevEnc.notesLog) ? prevEnc.notesLog : [];
          const updated = {
            ...prevEnc,
            notesLog: [newItem, ...existing],
          };

          if (prev?.encounter) return { ...prev, encounter: updated };
          if (prev?.item) return { ...prev, item: updated };
          return updated;
        },
        false,
      );

      setNoteText('');
      toast('Note added', 'success');
      await mutate();
    } catch (e: any) {
      toast(e?.message || 'Failed to add note', 'error');
    }
  }

  function routeFollowUp() {
    if (!encounter) return;
    const cid = clinicianId;
    if (!cid) {
      toast('Clinician is missing for this encounter — cannot book follow-up.', 'error');
      return;
    }

    const caseId = encounter.caseId ?? (typeof encounter.case === 'string' && encounter.case.trim() ? encounter.case : undefined) ?? encounter.id;

    const href = `/clinicians/${encodeURIComponent(cid)}/calendar?type=followup&caseId=${encodeURIComponent(caseId)}`;
    router.push(href);
  }

  async function exportEncounterPdf() {
    if (!encounter) return;

    try {
      const el = exportRef.current;
      if (!el) {
        toast('Nothing to export', 'error');
        return;
      }

      const html2canvas = (await import('html2canvas')).default;

      const clone = el.cloneNode(true) as HTMLElement;
      const wrapper = document.createElement('div');
      wrapper.style.background = '#ffffff';
      wrapper.style.padding = '20px';
      wrapper.style.width = '900px';
      wrapper.appendChild(clone);
      document.body.appendChild(wrapper);

      const canvas = await html2canvas(wrapper, { scale: 2, backgroundColor: '#ffffff' });
      document.body.removeChild(wrapper);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

      try {
        const { jsPDF } = await import('jspdf');
        const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();

        pdf.setFontSize(14);
        pdf.text('Ambulant+ Center', 40, 30);
        pdf.setFontSize(10);
        pdf.text('0b Meadowbrook Ln, Bryanston 2152', 40, 46);

        const margin = 40;
        const imgW = pageW - margin * 2;
        const imgH = (canvas.height / canvas.width) * imgW;
        const yStart = 70;
        pdf.addImage(dataUrl, 'JPEG', margin, yStart, imgW, imgH);

        pdf.setFontSize(9);
        pdf.text('Ambulant+ Contactless Medicine - Powered by Cloven Technology Impilo', 40, pageH - 30);

        pdf.save(`encounter-${encounter.id}.pdf`);
        toast('Exported PDF', 'success');
      } catch {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `encounter-${encounter.id}.jpg`;
        a.click();
        toast('Exported as image (pdf lib not found)', 'info');
      }
    } catch (err) {
      console.error('export err', err);
      toast('Export failed', 'error');
    }
  }

  if (busy) {
    return (
      <main className="p-6 max-w-5xl mx-auto">
        <div className="rounded-2xl border bg-white p-5 text-sm text-slate-600">Loading encounter…</div>
      </main>
    );
  }

  if (!encounter) {
    return (
      <main className="p-6 max-w-5xl mx-auto space-y-3">
        <div className="text-rose-600 text-sm">{error?.message ?? 'Encounter not found.'}</div>
        <div className="flex items-center gap-3 text-sm">
          <button onClick={() => router.back()} className="text-teal-700 hover:underline" type="button">
            ← Back
          </button>
          <Link href="/encounters" className="text-teal-700 hover:underline">
            All cases
          </Link>
        </div>
      </main>
    );
  }

  const agg = currentAgg;
  const avgLabel = agg.ratingCount > 0 ? agg.ratingAvg.toFixed(1) : '—';

  const vitals = encounter.vitals ?? [];
  const notesLog = Array.isArray((encounter as any).notesLog) ? ((encounter as any).notesLog as any[]) : [];

  return (
    <main className="p-6 max-w-5xl mx-auto space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-sm text-teal-700 hover:underline" type="button">
            ← Back
          </button>
          <Link href="/encounters" className="text-sm text-teal-700 hover:underline">
            All cases
          </Link>
        </div>

        <div className="text-right">
          <div className="text-xs text-slate-500">Encounter</div>
          <div className="text-sm font-semibold text-slate-900">{encounter.id}</div>
        </div>
      </header>

      <section className="rounded-2xl border bg-white p-5" ref={exportRef}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div style={{ background: clinicianId ? colorForId(clinicianId) : '#e5e7eb' }} className="w-10 h-10 rounded-full flex items-center justify-center font-semibold">
                {initials(clinicianName)}
              </div>
              <div className="min-w-0">
                <div className="text-lg font-semibold text-slate-900 truncate">{clinicianName}</div>
                <div className="text-xs text-slate-500">{specialty}</div>
              </div>
            </div>

            <div className="text-sm text-slate-600 mt-3">
              Status:{' '}
              <span className="font-medium text-slate-900">{canonStatus === 'Unknown' ? encounter.status ?? '—' : canonStatus}</span>
            </div>

            <div className="text-xs text-slate-500 mt-1">
              Created: {formatDateTime(encounter.createdAt)} · Updated: {formatDateTime(encounter.updatedAt)}
              {encounter.startedAt != null ? ` · Started: ${formatDateTime(encounter.startedAt)}` : ''}
              {encounter.endedAt != null ? ` · Ended: ${formatDateTime(encounter.endedAt)}` : ''}
            </div>

            {(encounter.summary || encounter.notes) && (
              <div className="mt-4 grid md:grid-cols-2 gap-3">
                {encounter.summary ? (
                  <div className="rounded-xl border p-3">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Summary</div>
                    <div className="text-sm text-slate-700 mt-1 whitespace-pre-line">{encounter.summary}</div>
                  </div>
                ) : null}
                {encounter.notes ? (
                  <div className="rounded-xl border p-3">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Notes</div>
                    <div className="text-sm text-slate-700 mt-1 whitespace-pre-line">{encounter.notes}</div>
                  </div>
                ) : null}
              </div>
            )}

            {coverageText && (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                <div className="font-medium text-[13px]">Coverage</div>
                <div className="mt-0.5">This visit was covered by {coverageText}.</div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border bg-slate-50 px-4 py-3">
              <div className="text-xs text-slate-600">Clinician rating</div>
              <div className="text-2xl font-semibold text-slate-900 leading-tight">
                {avgLabel}
                <span className="text-sm text-slate-500 font-medium ml-2">/ 5</span>
              </div>
              <div className="text-xs text-slate-500">{agg.ratingCount ? `${agg.ratingCount.toLocaleString()} rated` : 'No ratings yet'}</div>
            </div>

            <div className="flex flex-col gap-2">
              <button className="px-3 py-2 border rounded text-sm hover:bg-slate-50 disabled:opacity-60" onClick={startCarePortFromEncounter} disabled={startingCareport}>
                {careportOrderId
                  ? startingCareport
                    ? 'Opening…'
                    : 'Resume CarePort Marketplace'
                  : startingCareport
                  ? 'Starting…'
                  : 'Start CarePort Marketplace'}
              </button>

              {careportOrderId ? (
                <Link
                  href={`/careport/marketplace/${encodeURIComponent(careportOrderId)}`}
                  className="px-3 py-2 border rounded text-sm hover:bg-slate-50 text-center"
                >
                  View Marketplace →
                </Link>
              ) : null}

              <button className="px-3 py-2 border rounded text-sm hover:bg-slate-50" onClick={exportEncounterPdf}>
                Export PDF
              </button>
              <button className="px-3 py-2 border rounded text-sm hover:bg-slate-50" onClick={routeFollowUp}>
                Schedule follow-up
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5">
        <h3 className="font-semibold text-slate-900">Prescription & Refills</h3>
        {!erxLatest?.ok ? (
          <div className="mt-2 text-sm text-slate-500">No eRx found for this encounter.</div>
        ) : (
          <div className="mt-2 space-y-2">
            <div className="text-xs text-slate-500">
              Latest eRx: <span className="font-mono">{erxLatest.erxOrderId}</span>
              {erxLatest.createdAt ? <> · {new Date(erxLatest.createdAt).toLocaleString()}</> : null}
            </div>
            <ul className="mt-2 space-y-2">
              {(erxLatest.meds || []).map((m: any, idx: number) => (
                <li key={idx} className="border rounded-lg p-3 bg-slate-50">
                  <div className="text-sm font-medium text-slate-900">{m.drug}</div>
                  <div className="text-xs text-slate-600 mt-1">
                    {m.qty ? <>Qty: {m.qty} · </> : null}
                    Refills: <b>{Number.isFinite(Number(m.refills)) ? m.refills : '—'}</b>
                  </div>
                  {m.sig ? <div className="text-xs text-slate-500 mt-1">{m.sig}</div> : null}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Rating */}
      <section className="rounded-2xl border bg-white p-5" ref={rateRef}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Rate this encounter</h2>
            <div className="text-xs text-slate-600 mt-1">
              Your rating updates the clinician’s <b>ratingSum / ratingCount / ratingAvg</b>.
            </div>
          </div>

          {existingRating != null ? (
            <div className="text-xs text-slate-600">
              Saved rating: <b className="text-slate-900">{existingRating}</b> / 5
            </div>
          ) : null}
        </div>

        {!canRate && (
          <div className="mt-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
            Rating is available only after the consultation is properly ended.
          </div>
        )}

        <div className="mt-4 flex items-center gap-2">
          {Array.from({ length: 5 }).map((_, i) => {
            const v = i + 1;
            return <StarButton key={v} active={draftRating >= v} onClick={() => setDraftRating(v)} label={`Rate ${v} star${v === 1 ? '' : 's'}`} />;
          })}
        </div>

        <div className="mt-4">
          <label className="text-xs text-slate-600 block mb-1">Optional comment</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            className="w-full rounded-xl border px-3 py-2 text-sm"
            placeholder="What went well? What could be improved?"
            disabled={!canRate}
          />
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            className="px-3 py-2 rounded-lg border text-sm hover:bg-slate-50"
            onClick={() => {
              setDraftRating(existingRating ?? 0);
              setComment(encounter.patientRatingComment ?? '');
            }}
            disabled={savingRating}
          >
            Reset
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-60"
            onClick={onSaveRating}
            disabled={savingRating || !draftRating || !canRate}
          >
            {savingRating ? 'Saving…' : 'Save rating'}
          </button>
        </div>
      </section>

      {/* Vitals */}
      <section className="rounded-2xl border bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Recent vitals</h2>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">Color by</label>
            <select value={selectedMetric} onChange={(e) => setSelectedMetric(e.target.value as any)} className="text-xs border rounded px-2 py-1">
              <option value="hr">HR</option>
              <option value="spo2">SpO₂</option>
              <option value="temp">Temp</option>
              <option value="glucose">Glucose</option>
            </select>
          </div>
        </div>

        <div className="mt-3">
          <SparklineAndTable vitals={vitals} metric={selectedMetric} />
        </div>
      </section>

      {/* Notes */}
      <section className="rounded-2xl border bg-white p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Notes</h3>
          <div className="text-xs text-slate-500">
            {notesLog.length} note{notesLog.length === 1 ? '' : 's'}
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <textarea className="w-full border rounded p-2 text-sm" rows={3} placeholder="Add a note..." value={noteText} onChange={(e) => setNoteText(e.target.value)} />
          <div className="flex gap-2">
            <button className="px-3 py-2 rounded bg-blue-600 text-white text-sm" onClick={submitNote}>
              Add Note
            </button>
            <button className="px-3 py-2 rounded border text-sm" onClick={() => setNoteText('')}>
              Clear
            </button>
          </div>

          <div className="space-y-2 pt-2">
            {notesLog.map((n: any) => (
              <div key={n.id} className="border rounded p-2 bg-gray-50 text-sm">
                <div className="text-xs text-neutral-500">{new Date(n.ts).toLocaleString()}</div>
                <div className="mt-1">{n.text}</div>
              </div>
            ))}
            {notesLog.length === 0 && <div className="text-sm text-slate-500">No notes yet.</div>}
          </div>
        </div>
      </section>

      {/* Billing */}
      <section className="rounded-2xl border bg-white p-5">
        <h3 className="font-semibold text-slate-900 text-sm mb-2">Billing</h3>
        {billing ? (
          <div className="text-sm text-neutral-700 space-y-1">
            <div>
              <span className="opacity-60">Total:</span> {formatAmount(billing.totalAmount, billing.currency)}
            </div>
            {billing.coveredAmount != null && (
              <div>
                <span className="opacity-60">Covered:</span> {formatAmount(billing.coveredAmount, billing.currency)}
              </div>
            )}
            {billing.patientAmount != null && (
              <div>
                <span className="opacity-60">Your share:</span> {formatAmount(billing.patientAmount, billing.currency)}
              </div>
            )}
            {billing.status && (
              <div>
                <span className="opacity-60">Payment status:</span>{' '}
                <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs">{billing.status}</span>
              </div>
            )}
            {billing.invoiceId && <div className="text-xs text-neutral-500">Invoice ID: {billing.invoiceId}</div>}
          </div>
        ) : coverageText ? (
          <div className="text-sm text-neutral-600">This visit was covered by {coverageText}. Detailed billing amounts are not available.</div>
        ) : (
          <div className="text-sm text-neutral-500">Billing details are not available for this visit.</div>
        )}
      </section>
    </main>
  );
}