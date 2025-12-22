// apps/patient-app/app/encounters/[id]/page.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

let toast: ((msg: string, kind?: 'success' | 'error' | 'info') => void) | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  toast = require('@/components/ToastMount').toast as typeof toast;
} catch {}

type VitalsPoint = {
  t: number;
  hr?: number;
  spo2?: number;
  temp?: number;
  glucose_mg_dl?: number;
};

type PatientRating = {
  score: number;
  comment?: string | null;
  createdAt?: string | number;
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
  caseId?: string;
  case: string;
  startedAt: string | number;
  status: 'Open' | 'Closed' | 'In Review' | string;
  summary: string;
  patientName: string;
  clinician?: { id: string; name: string; specialty?: string };
  devices?: string[];
  notes?: Array<{ id: string; ts: string; text: string; source?: string }>;
  vitals?: VitalsPoint[];

  rating?: PatientRating | null;

  coverage?: CoverageInfo | null;
  billing?: BillingInfo | null;
};

/* ------------------- small helpers ------------------- */

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
  return `hsl(${hue} 60% 70%)`;
}

/* clinical status helpers */
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

/* ----------------- Sparkline with clinical coloring & tooltip ----------------- */

function SparklineClinical({
  points,
  metric = 'hr',
  width = 520,
  height = 96,
}: {
  points: VitalsPoint[];
  metric?: 'hr' | 'spo2' | 'temp' | 'glucose';
  width?: number;
  height?: number;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const tipRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
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
      const idx = Math.round((x / width) * (vals.length - 1));
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
        html += `<div class="text-xs">HR: ${
          p.hr ?? '—'
        } bpm</div><div class="text-xs">Status: ${statusForHr(p.hr)}</div>`;
      if (metric === 'spo2')
        html += `<div class="text-xs">SpO₂: ${
          p.spo2 ?? '—'
        }%</div><div class="text-xs">Status: ${statusForSpo2(p.spo2)}</div>`;
      if (metric === 'temp')
        html += `<div class="text-xs">Temp: ${
          p.temp ?? '—'
        } °C</div><div class="text-xs">Status: ${statusForTemp(p.temp)}</div>`;
      if (metric === 'glucose')
        html += `<div class="text-xs">Glucose: ${
          p.glucose_mg_dl ?? '—'
        } mg/dL</div><div class="text-xs">Status: ${statusForGlucose(p.glucose_mg_dl)}</div>`;
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
    <div className="relative inline-block w-full">
      <canvas ref={canvasRef} className="rounded w-full" />
      <div
        ref={tipRef}
        className="pointer-events-none absolute bg-white border rounded shadow p-2 text-xs"
        style={{ display: 'none', zIndex: 2000 }}
      />
    </div>
  );
}

/* ----------------- Rating helpers ----------------- */

function lsKeyForEncounter(encounterId: string) {
  return `ambulant_rating_encounter_${encounterId}`;
}

function readLocalRating(encounterId: string): PatientRating | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(lsKeyForEncounter(encounterId));
    if (!raw) return null;
    const j = JSON.parse(raw);
    if (!j || typeof j.score !== 'number') return null;
    return j;
  } catch {
    return null;
  }
}

function writeLocalRating(encounterId: string, r: PatientRating) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(lsKeyForEncounter(encounterId), JSON.stringify(r));
  } catch {}
}

async function submitRatingToApi(encounterId: string, rating: PatientRating) {
  const payload = { encounterId, ...rating };

  const attempts: Array<{ url: string; method: 'POST' }> = [
    { url: `/api/encounters/${encodeURIComponent(encounterId)}/rating`, method: 'POST' },
    { url: `/api/ratings`, method: 'POST' },
  ];

  let lastErr: any = null;
  for (const a of attempts) {
    try {
      const res = await fetch(a.url, {
        method: a.method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) return true;
      lastErr = await res.json().catch(() => ({ error: res.statusText }));
    } catch (e) {
      lastErr = e;
    }
  }
  console.warn('[rating] submit failed', lastErr);
  return false;
}

/* ----------------- EncounterDetailPage (client) ----------------- */

export default function EncounterDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { id } = params;

  const [enc, setEnc] = useState<Encounter | null | 'notfound'>(null);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState('');
  const [selectedMetric, setSelectedMetric] = useState<'hr' | 'spo2' | 'temp' | 'glucose'>('hr');
  const exportRef = useRef<HTMLDivElement | null>(null);

  const [ratingOpen, setRatingOpen] = useState(false);
  const [ratingScore, setRatingScore] = useState<number>(0);
  const [ratingComment, setRatingComment] = useState<string>('');
  const [ratingSaving, setRatingSaving] = useState(false);

  const autoOpenedRateRef = useRef(false);
  const shouldPromptRating = searchParams?.get('rate') === '1';
  const cameFromSfu = shouldPromptRating;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/encounters/${encodeURIComponent(id)}`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          if (!cancelled) setEnc('notfound');
          return;
        }
        const data = await res.json();
        if (!cancelled) setEnc(data);
      } catch (err) {
        console.error('enc fetch error', err);
        if (!cancelled) setEnc('notfound');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!enc || enc === 'notfound') return;
    const local = readLocalRating(enc.id);
    const apiR = (enc as any).rating as PatientRating | null | undefined;
    const r = local ?? (apiR ?? null);
    if (r?.score) {
      setRatingScore(r.score);
      setRatingComment(r.comment ?? '');
    }
  }, [enc]);

  // Auto-open rating modal when routed with ?rate=1 and not yet rated
  useEffect(() => {
    if (!shouldPromptRating) return;
    if (!enc || enc === 'notfound') return;
    if (autoOpenedRateRef.current) return;

    const status = String((enc as any).status ?? '');
    const canRateNow = status !== 'Open' && status !== 'InProgress' && status !== 'Scheduled';
    const apiR = (enc as any).rating as PatientRating | null | undefined;
    const alreadyRated = (ratingScore ?? 0) > 0 || ((apiR?.score ?? 0) > 0);

    if (canRateNow && !alreadyRated) {
      autoOpenedRateRef.current = true;
      setRatingOpen(true);
    }
  }, [shouldPromptRating, enc, ratingScore]);

  if (loading) {
    return (
      <main className="p-6">
        <div className="rounded-xl border p-4 bg-white">Loading encounter…</div>
      </main>
    );
  }
  if (enc === 'notfound' || enc === null) {
    return (
      <main className="p-6">
        <div className="rounded-xl border p-4 bg-white">Encounter not found.</div>
      </main>
    );
  }

  const vitals = enc.vitals ?? [];
  const coverage = enc.coverage ?? undefined;
  const billing = enc.billing ?? undefined;

  const formatAmount = (amount?: number | null, currency?: string | null) => {
    if (amount == null || Number.isNaN(Number(amount))) return '—';
    const cur = currency ?? '';
    return `${cur ? cur + ' ' : ''}${Number(amount).toFixed(2)}`;
  };

  const coverageText = (() => {
    if (!coverage) return null;
    const label = coverage.name || coverage.type || 'payment method';
    const bits: string[] = [];
    if (coverage.scheme) bits.push(coverage.scheme);
    if (coverage.last4) bits.push(`•••• ${coverage.last4}`);
    if (coverage.reference) bits.push(coverage.reference);
    const details = bits.join(' · ');
    return details ? `${label}: ${details}` : label;
  })();

  const CLINIC_HEADER = {
    title: 'Ambulant+ Center',
    address: '0b Meadowbrook Ln, Bryanston 2152',
  };
  const CLINIC_FOOTER = 'Ambulant+ Contactless Medicine - Powered by Cloven Technology Impilo';

  async function exportEncounterPdf() {
    try {
      const el = exportRef.current;
      if (!el) {
        toast?.('Nothing to export', 'error');
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
        pdf.text(CLINIC_HEADER.title, 40, 30);
        pdf.setFontSize(10);
        pdf.text(CLINIC_HEADER.address, 40, 46);

        const margin = 40;
        const imgW = pageW - margin * 2;
        const imgH = (canvas.height / canvas.width) * imgW;
        const yStart = 70;
        pdf.addImage(dataUrl, 'JPEG', margin, yStart, imgW, imgH);

        pdf.setFontSize(9);
        pdf.text(CLINIC_FOOTER, 40, pageH - 30);

        pdf.save(`encounter-${enc.id}.pdf`);
        toast?.('Exported PDF', 'success');
      } catch {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `encounter-${enc.id}.jpg`;
        a.click();
        toast?.('Exported as image (pdf lib not found)', 'info');
      }
    } catch (err) {
      console.error('export err', err);
      toast?.('Export failed', 'error');
    }
  }

  async function submitNote() {
    const txt = noteText.trim();
    if (!txt) {
      toast?.('Note is empty', 'error');
      return;
    }
    try {
      const res = await fetch(`/api/encounters/${encodeURIComponent(enc.id)}/notes`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: txt, source: 'patient-ui' }),
      });
      const out = await res.json().catch(() => ({}));
      if (res.ok) {
        setNoteText('');
        setEnc((prev) =>
          prev && prev !== 'notfound'
            ? {
                ...prev,
                notes: [
                  {
                    id: out?.note?.id ?? 'local-' + Date.now(),
                    ts: new Date().toISOString(),
                    text: txt,
                    source: 'patient-ui',
                  },
                  ...(prev.notes ?? []),
                ],
              }
            : prev,
        );
        toast?.('Note added', 'success');
      } else {
        console.error('note error', out);
        toast?.(`Failed to add note: ${out?.error ?? res.statusText}`, 'error');
      }
    } catch (err) {
      console.error('note post error', err);
      toast?.('Failed to add note', 'error');
    }
  }

  function routeFollowUp() {
    const clinicianId = enc.clinician?.id;
    if (!clinicianId) {
      toast?.('Clinician is missing for this encounter — cannot book follow-up.', 'error');
      return;
    }
    const caseId =
      enc.caseId ??
      ((typeof (enc as any).case === 'string' && (enc as any).case.trim()
        ? (enc as any).case
        : undefined) ?? enc.id);

    const href = `/clinicians/${encodeURIComponent(
      clinicianId,
    )}/calendar?type=followup&caseId=${encodeURIComponent(caseId)}`;
    router.push(href);
  }

  const suggestedMetric = (() => {
    if (vitals.some((v) => v.hr != null)) return 'hr';
    if (vitals.some((v) => v.glucose_mg_dl != null)) return 'glucose';
    if (vitals.some((v) => v.spo2 != null)) return 'spo2';
    if (vitals.some((v) => v.temp != null)) return 'temp';
    return 'hr';
  })();

  useEffect(() => {
    if (!selectedMetric && suggestedMetric) setSelectedMetric(suggestedMetric as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enc]);

  const canRate =
    String(enc.status) !== 'Open' &&
    String(enc.status) !== 'InProgress' &&
    String(enc.status) !== 'Scheduled';

  const hasRating = ratingScore > 0;

  const submitRating = async () => {
    if (!canRate) {
      toast?.('Rating is available after the session is completed.', 'info');
      return;
    }
    if (!ratingScore) {
      toast?.('Please select a rating.', 'error');
      return;
    }
    setRatingSaving(true);
    const payload: PatientRating = {
      score: ratingScore,
      comment: ratingComment.trim() ? ratingComment.trim() : null,
      createdAt: new Date().toISOString(),
    };
    try {
      // Always keep a local copy
      writeLocalRating(enc.id, payload);
      const ok = await submitRatingToApi(enc.id, payload);
      if (ok) {
        toast?.('Thanks for your feedback ❤️', 'success');
      } else {
        toast?.('Rating saved locally (server unavailable)', 'info');
      }
      setRatingOpen(false);

      // If this encounter page was reached from the SFU "call ended → /encounters/[id]?rate=1",
      // bounce the patient back to the encounters list after rating.
      if (cameFromSfu) {
        router.push('/encounters');
      }
    } finally {
      setRatingSaving(false);
    }
  };

  return (
    <main className="p-6">
      <div className="rounded-2xl border p-6 bg-white max-w-5xl mx-auto" ref={exportRef}>
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-sm text-neutral-500">{enc.patientName}</div>
            <h1 className="text-2xl font-semibold">{enc.case}</h1>
            <div className="text-sm text-neutral-600 mt-2">{enc.summary}</div>

            <div className="mt-3 flex items-center gap-3">
              {enc.clinician ? (
                <div className="flex items-center gap-3">
                  <div
                    style={{ background: colorForId(enc.clinician.id) }}
                    className="w-10 h-10 rounded-full flex items-center justify-center font-semibold"
                  >
                    {initials(enc.clinician.name)}
                  </div>
                  <div className="text-sm">
                    <div className="font-medium">{enc.clinician.name}</div>
                    <div className="text-xs text-neutral-500">
                      {enc.clinician.specialty ?? ''}
                    </div>
                  </div>
                </div>
              ) : null}

              {enc.devices && enc.devices.length > 0 && (
                <div className="ml-4 flex gap-2 items-center">
                  {enc.devices.map((d) => (
                    <span key={d} className="text-xs px-2 py-0.5 border rounded bg-gray-50">
                      {d}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {coverageText && (
              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                <div className="font-medium text-[13px]">Coverage</div>
                <div className="mt-0.5">This visit was covered by {coverageText}.</div>
              </div>
            )}

            <div className="mt-3 flex items-center gap-3">
              <Link href="/encounters" className="text-sm text-blue-700 hover:underline">
                ← Back to encounters
              </Link>
            </div>
          </div>

          <div className="text-right text-sm text-neutral-600">
            <div>Started: {new Date(enc.startedAt).toLocaleString()}</div>
            <div className="mt-2">
              Status: <span className="font-medium">{enc.status}</span>
            </div>

            <div className="mt-3 flex flex-col gap-2">
              <button className="px-3 py-1 border rounded text-sm" onClick={() => exportEncounterPdf()}>
                Export PDF
              </button>
              <button className="px-3 py-1 border rounded text-sm" onClick={() => routeFollowUp()}>
                Schedule follow-up
              </button>

              <button
                className={`px-3 py-1 border rounded text-sm ${
                  canRate ? 'hover:bg-gray-50' : 'opacity-50'
                }`}
                onClick={() => setRatingOpen(true)}
                disabled={!canRate}
                title={canRate ? 'Rate this visit' : 'Rating available after completion'}
              >
                {hasRating
                  ? `Your rating: ${'★'.repeat(ratingScore)}${'☆'.repeat(5 - ratingScore)}`
                  : 'Rate this visit'}
              </button>
            </div>
          </div>
        </div>

        {/* Rating Modal */}
        {ratingOpen && (
          <div
            className="fixed inset-0 z-[70] bg-black/40 grid place-items-center p-4"
            onClick={() => {
              if (cameFromSfu) router.push('/encounters');
              else setRatingOpen(false);
            }}
          >
            <div
              className="bg-white rounded-xl max-w-lg w-full p-5 space-y-3"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-lg font-semibold">Rate this visit</div>
              {!canRate && (
                <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
                  Rating is available only after the consultation is properly ended.
                </div>
              )}

              <div className="flex items-center gap-2">
                {Array.from({ length: 5 }).map((_, i) => {
                  const v = i + 1;
                  const on = ratingScore >= v;
                  return (
                    <button
                      key={v}
                      onClick={() => setRatingScore(v)}
                      className={`text-2xl leading-none ${on ? 'text-amber-500' : 'text-gray-300'}`}
                      aria-label={`Set rating ${v}`}
                      disabled={!canRate}
                    >
                      ★
                    </button>
                  );
                })}
                <span className="ml-2 text-sm text-gray-600">
                  {ratingScore ? `${ratingScore}/5` : 'Select'}
                </span>
              </div>

              <textarea
                className="w-full border rounded p-2 text-sm"
                rows={4}
                placeholder="Optional comment…"
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                disabled={!canRate}
              />

              <div className="flex justify-end gap-2">
                <button
                  className="px-3 py-1.5 rounded border bg-white hover:bg-gray-50"
                  onClick={() => {
                    if (cameFromSfu) router.push('/encounters');
                    else setRatingOpen(false);
                  }}
                >
                  {cameFromSfu ? 'Skip rating' : 'Cancel'}
                </button>
                <button
                  className="px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                  onClick={submitRating}
                  disabled={!canRate || !ratingScore || ratingSaving}
                >
                  {ratingSaving ? 'Saving…' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* vitals + sparkline */}
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">Recent vitals</h2>
            <div className="flex items-center gap-2">
              <label className="text-xs text-neutral-500">Color by</label>
              <select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value as any)}
                className="text-xs border rounded px-2 py-1"
              >
                <option value="hr">HR</option>
                <option value="spo2">SpO₂</option>
                <option value="temp">Temp</option>
                <option value="glucose">Glucose</option>
              </select>
            </div>
          </div>

          <div className="mt-3">
            <SparklineAndTable vitals={vitals} metric={selectedMetric || suggestedMetric} />
          </div>
        </div>

        {/* notes */}
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Notes</h3>
            <div className="text-xs text-neutral-500">
              {(enc.notes ?? []).length} note{(enc.notes ?? []).length === 1 ? '' : 's'}
            </div>
          </div>
          <div className="mt-3 space-y-2">
            <div>
              <textarea
                className="w-full border rounded p-2 text-sm"
                rows={3}
                placeholder="Add a note..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
              />
              <div className="mt-2 flex gap-2">
                <button
                  className="px-3 py-1 rounded bg-blue-600 text-white"
                  onClick={() => submitNote()}
                >
                  Add Note
                </button>
                <button className="px-3 py-1 rounded border" onClick={() => setNoteText('')}>
                  Clear
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {(enc.notes ?? []).map((n) => (
                <div key={n.id} className="border rounded p-2 bg-gray-50 text-sm">
                  <div className="text-xs text-neutral-500">
                    {new Date(n.ts).toLocaleString()}
                  </div>
                  <div className="mt-1">{n.text}</div>
                </div>
              ))}
              {(enc.notes ?? []).length === 0 && (
                <div className="text-sm text-neutral-500">No notes yet.</div>
              )}
            </div>
          </div>
        </div>

        {/* Billing section */}
        <div className="mt-6 border-t pt-4">
          <h3 className="font-medium text-sm mb-2">Billing</h3>
          {billing ? (
            <div className="text-sm text-neutral-700 space-y-1">
              <div>
                <span className="opacity-60">Total:</span>{' '}
                {formatAmount(billing.totalAmount, billing.currency)}
              </div>
              {billing.coveredAmount != null && (
                <div>
                  <span className="opacity-60">Covered:</span>{' '}
                  {formatAmount(billing.coveredAmount, billing.currency)}
                </div>
              )}
              {billing.patientAmount != null && (
                <div>
                  <span className="opacity-60">Your share:</span>{' '}
                  {formatAmount(billing.patientAmount, billing.currency)}
                </div>
              )}
              {billing.status && (
                <div>
                  <span className="opacity-60">Payment status:</span>{' '}
                  <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs">
                    {billing.status}
                  </span>
                </div>
              )}
              {billing.invoiceId && (
                <div className="text-xs text-neutral-500">Invoice ID: {billing.invoiceId}</div>
              )}
            </div>
          ) : coverageText ? (
            <div className="text-sm text-neutral-600">
              This visit was covered by {coverageText}. Detailed billing amounts are not available.
            </div>
          ) : (
            <div className="text-sm text-neutral-500">
              Billing details are not available for this visit.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

/* ----------------- composed component for sparkline + table ----------------- */

function SparklineAndTable({
  vitals,
  metric,
}: {
  vitals: VitalsPoint[];
  metric: 'hr' | 'spo2' | 'temp' | 'glucose';
}) {
  const sorted = (vitals ?? []).slice().sort((a, b) => a.t - b.t);
  const points = sorted;

  return (
    <div className="space-y-3">
      <div className="w-full bg-white p-2 rounded border">
        <SparklineClinical points={points} metric={metric} width={800} height={120} />
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
                        <span
                          className="ml-2 text-xs px-1 rounded"
                          style={{
                            background: STATUS_COLOR[statusForHr(p.hr)] + '20',
                          }}
                        >
                          {statusForHr(p.hr)}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {p.spo2 ?? '—'}
                      {p.spo2 != null && (
                        <span
                          className="ml-2 text-xs px-1 rounded"
                          style={{
                            background: STATUS_COLOR[statusForSpo2(p.spo2)] + '20',
                          }}
                        >
                          {statusForSpo2(p.spo2)}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {p.temp != null ? p.temp.toFixed(1) : '—'}
                      {p.temp != null && (
                        <span
                          className="ml-2 text-xs px-1 rounded"
                          style={{
                            background: STATUS_COLOR[statusForTemp(p.temp)] + '20',
                          }}
                        >
                          {statusForTemp(p.temp)}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4">
                      {p.glucose_mg_dl ?? '—'}
                      {p.glucose_mg_dl != null && (
                        <span
                          className="ml-2 text-xs px-1 rounded"
                          style={{
                            background: STATUS_COLOR[statusForGlucose(p.glucose_mg_dl)] + '20',
                          }}
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
