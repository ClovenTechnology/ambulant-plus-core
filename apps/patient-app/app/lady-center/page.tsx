// ===================================================================================
// apps/patient-app/app/lady-center/page.tsx
// Adds pregnancy banner + positive-test toggle, keeps all prior features.
// ===================================================================================
'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevronRightIcon,
  Download, FileText, Settings, X, Eye, EyeOff, Check, Baby
} from 'lucide-react';
import { FertilitySetup } from '@/src/screens/FertilitySetup';
import { generateHealthReport } from '@/src/analytics/report';
import { getFertilityStatus } from '@/src/analytics/fertility';
import {
  predictCycleDates, type FertilityPrefs, type WearablePoint, detectPregnancy
} from '@/src/analytics/prediction';
import { buildFertilityICSUrlFromPrefs } from '@/src/analytics/ics';
import { track } from '@/src/lib/analytics';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

type CycleDay = {
  date: string;
  phase: 'follicular' | 'luteal' | 'ovulation' | 'period';
  fertileWindow?: boolean;
  deltaTemp: number;
  rhr?: number;
  hrv?: number;
  respRate?: number;
  spo2?: number;
  sleepScore?: number;
  predicted?: boolean;
};

type DayLog = {
  date: string;
  period?: boolean;
  ovulation?: boolean;
  pregnancyTestPositive?: boolean; // why: enables confirmed state
  meds?: string;
  notes?: string;
  symptoms?: string[];
};

const SYMPTOM_CHOICES = ['cramps','headache','fatigue','mood','acne','bloating','nausea','tenderness'];

function useMounted() { const [m, set] = useState(false); useEffect(() => set(true), []); return m; }
function loadPrefsClient(): FertilityPrefs | null {
  try { const raw = localStorage.getItem('fertilityPrefs'); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

const LS_PRIV = 'ladyCenter:privacy';
const LS_SERIES = 'ladyCenter:series';
const LS_WIN = 'ladyCenter:windowDays';
const LS_PREG_DISMISS = 'ladyCenter:pregnancy:dismissedAt';

export default function LadyCenter() {
  const mounted = useMounted();

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const pdfObjectUrlRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [privacy, setPrivacy] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [showBaseline, setShowBaseline] = useState(false);
  const [showChart, setShowChart] = useState(true);
  const [showCalendar, setShowCalendar] = useState(true);
  const [showReport, setShowReport] = useState(true);

  const [history, setHistory] = useState<CycleDay[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const [dayLogs, setDayLogs] = useState<Record<string, DayLog>>({});
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const [windowDays, setWindowDays] = useState<14 | 28 | 90>(28);
  const [visibleSeries, setVisibleSeries] = useState<Record<string, boolean>>({
    deltaTemp: true, rhr: true, hrv: false, respRate: false, spo2: false, sleepScore: false,
  });

  // Subscribe toast
  const [toastOpen, setToastOpen] = useState(false);
  const [toastCopied, setToastCopied] = useState(false);
  const [toastMsg, setToastMsg] = useState<string>('');

  // Pregnancy banner dismiss
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);

  const todayISO = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const prefs: FertilityPrefs | null = useMemo(() => (mounted ? loadPrefsClient() : null), [mounted]);
  const prediction = useMemo(
    () => (mounted ? predictCycleDates(prefs, todayISO, { useLogs: true }) : null),
    [mounted, prefs, todayISO]
  );

  useEffect(() => {
    if (!mounted) return;
    const ds = localStorage.getItem(LS_PREG_DISMISS);
    if (ds) setDismissedAt(Number(ds));
  }, [mounted]);

  // sticky prefs
  useEffect(() => {
    if (!mounted) return;
    try {
      const p = localStorage.getItem(LS_PRIV); if (p != null) setPrivacy(p === '1');
      const s = localStorage.getItem(LS_SERIES); if (s) setVisibleSeries((prev) => ({ ...prev, ...JSON.parse(s) }));
      const w = localStorage.getItem(LS_WIN); if (w && ['14','28','90'].includes(w)) setWindowDays(Number(w) as 14|28|90);
    } catch {}
  }, [mounted]);
  useEffect(() => { if (mounted) localStorage.setItem(LS_PRIV, privacy ? '1' : '0'); }, [privacy, mounted]);
  useEffect(() => { if (mounted) localStorage.setItem(LS_SERIES, JSON.stringify(visibleSeries)); }, [visibleSeries, mounted]);
  useEffect(() => { if (mounted) localStorage.setItem(LS_WIN, String(windowDays)); }, [windowDays, mounted]);

  const reportRef = useRef<HTMLDivElement | null>(null);
  const scrollToReport = useCallback(() => {
    setShowReport(true);
    setTimeout(() => reportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }, []);

  // Safe PDF loader with cancellation & single-run on mount
  async function loadPdfOnce(signal?: { cancelled: boolean }) {
    if (!mounted) return;
    // avoid reloading unnecessarily
    setLoading(true);
    try {
      const { blob } = await generateHealthReport('current-user', { fertility: true });
      if (signal?.cancelled) return;
      // Revoke previous URL if present
      if (pdfObjectUrlRef.current) {
        try { URL.revokeObjectURL(pdfObjectUrlRef.current); } catch {}
      }
      const url = URL.createObjectURL(blob);
      pdfObjectUrlRef.current = url;
      setPdfUrl(url);
    } catch (err) {
      console.error('Failed to generate fertility PDF', err);
    } finally {
      if (!signal?.cancelled) setLoading(false);
    }
  }

  // Run only once on mount (do not depend on dayLogs — that caused a loop)
  useEffect(() => {
    if (!mounted) return;
    const signal = { cancelled: false };
    loadPdfOnce(signal);

    // Load saved day logs once (no re-run)
    try {
      const saved = localStorage.getItem('fertilityDayLogs');
      if (saved) setDayLogs(JSON.parse(saved));
    } catch {}

    // mock stream (kept to avoid regression)
    const baseline = 36.5;
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - 27);

    const mock: CycleDay[] = Array.from({ length: 28 }).map((_, i) => {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const temps = Array.from({ length: i + 1 }).map((__, j) => baseline + (j > 14 ? 0.4 : 0.1));
      const hrvs  = Array.from({ length: i + 1 }).map((__, j) => 70 - (j === 14 ? 10 : 0));
      const rhrs  = Array.from({ length: i + 1 }).map((__, j) => 60 + (j > 14 ? 5 : 0));
      const status = getFertilityStatus(temps, hrvs, rhrs, baseline, (dayLogs as any)[d.toISOString().slice(0, 10)]);
      return {
        date: d.toISOString().slice(0, 10),
        deltaTemp: temps[i] - baseline, rhr: rhrs[i], hrv: hrvs[i],
        respRate: 16 + (status?.phase === 'luteal' ? 1 : 0),
        spo2: 98 - (status?.phase === 'luteal' ? 1 : 0),
        sleepScore: 85 - (status?.phase === 'ovulation' ? 5 : 0),
        phase: status?.phase ?? 'follicular',
        fertileWindow: status?.phase === 'ovulation',
      };
    });

    const ovIdx = mock.findIndex((d) => d.phase === 'ovulation');
    if (ovIdx !== -1) for (let i = Math.max(0, ovIdx - 5); i <= ovIdx; i++) mock[i].fertileWindow = true;
    for (let i = 0; i < 5; i++) mock[i].phase = 'period';

    if (prediction) {
      mock.forEach((d) => { if (d.date >= prediction.fertileStart && d.date <= prediction.fertileEnd) d.predicted = true; });
    }

    setHistory(mock);

    return () => {
      // cancellation and cleanup
      signal.cancelled = true;
      if (pdfObjectUrlRef.current) {
        try { URL.revokeObjectURL(pdfObjectUrlRef.current); } catch {}
        pdfObjectUrlRef.current = null;
      }
    };
    // intentionally only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  const handleDownload = useCallback(() => {
    if (!pdfUrl) return;
    track('report_download');
    const link = document.createElement('a');
    link.href = pdfUrl; link.download = 'fertility_report.pdf'; link.click();
  }, [pdfUrl]);

  function saveLog(log: DayLog) {
    const updated = { ...dayLogs, [log.date]: log };
    setDayLogs(updated);
    try { localStorage.setItem('fertilityDayLogs', JSON.stringify(updated)); } catch {}
  }

  // Build WearablePoint[] from history (client-only mock/wearables merged)
  const series: WearablePoint[] = useMemo(() => {
    return history.map(h => ({
      date: h.date, deltaTemp: h.deltaTemp, rhr: h.rhr, hrv: h.hrv, spo2: h.spo2
    }));
  }, [history]);

  // Pregnancy signal
  const preg = useMemo(() => detectPregnancy(prefs, series), [prefs, series]);

  // chart data
  const trimmedHistory = useMemo(() => history.slice(-windowDays), [history, windowDays]);
  const chartData = useMemo(
    () => ({
      labels: trimmedHistory.map((h) => h.date.slice(5)),
      datasets: [
        visibleSeries.deltaTemp && { label: 'ΔTemp (°C)', data: trimmedHistory.map(h => h.deltaTemp), borderColor: '#e91e63', yAxisID: 'y' },
        visibleSeries.rhr       && { label: 'Resting HR (bpm)', data: trimmedHistory.map(h => h.rhr), borderColor: '#ef4444', yAxisID: 'y1' },
        visibleSeries.hrv       && { label: 'HRV (ms)', data: trimmedHistory.map(h => h.hrv), borderColor: '#3b82f6', yAxisID: 'y1' },
        visibleSeries.respRate  && { label: 'Resp Rate', data: trimmedHistory.map(h => h.respRate), borderColor: '#22c55e', yAxisID: 'y1' },
        visibleSeries.spo2      && { label: 'SpO₂ (%)', data: trimmedHistory.map(h => h.spo2), borderColor: '#8b5cf6', yAxisID: 'y1' },
        visibleSeries.sleepScore&& { label: 'Sleep Score', data: trimmedHistory.map(h => h.sleepScore), borderColor: '#f97316', yAxisID: 'y1' },
      ].filter(Boolean) as any[],
    }),
    [trimmedHistory, visibleSeries]
  );
  const chartOptions = useMemo(
    () => ({
      responsive: true,
      plugins: { legend: { position: 'top' as const } },
      scales: {
        y: { type: 'linear', position: 'left', title: { display: true, text: 'ΔTemp (°C)' } },
        y1: { type: 'linear', position: 'right', grid: { drawOnChartArea: false } },
      },
    }),
    []
  );

  // calendar
  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const lastDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startWeekday = firstDay.getDay();
  const weekdayLabels = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  const calendarCells = [];
  for (let pad = 0; pad < startWeekday; pad++) calendarCells.push(<div key={`pad-${pad}`} className="h-16 sm:h-20 rounded-xl" />);
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i);
    const iso = d.toISOString().slice(0, 10);
    const cd = history.find((h) => h.date === iso);
    const log = dayLogs[iso];

    // Build symbol array so we don't overwrite icons — show meaningful combinations
    const symbols: string[] = [];
    let ring = '';

    if (log?.period) {
      // explicit user-marked period takes precedence in symbols
      symbols.push('💧');
    } else if (cd) {
      // show phase marker
      if (cd.phase === 'period')     symbols.push('💧');
      if (cd.phase === 'follicular') symbols.push('🟦');
      if (cd.phase === 'luteal')     symbols.push('🔴');
      if (cd.phase === 'ovulation')  symbols.push('⭐');
      // fertile window is a distinct marker
      if (cd.fertileWindow) symbols.push('🌿');
    }

    // If user confirmed ovulation explicitly, show star
    if (log?.ovulation && !symbols.includes('⭐')) symbols.push('⭐');

    // predicted—show dashed ring visually
    if (cd?.predicted) ring = 'ring-1 ring-dashed ring-green-500';

    // derive background color based on most important flag (period > fertile > ovulation > phase)
    let bg = 'bg-gray-50';
    if (log?.period) bg = 'bg-red-100';
    else if (cd?.fertileWindow) bg = 'bg-green-100';
    else if (cd?.phase === 'ovulation') bg = 'bg-green-200';
    else if (cd?.phase === 'follicular') bg = 'bg-blue-100';
    else if (cd?.phase === 'luteal') bg = 'bg-yellow-100';

    const isToday = iso === new Date().toISOString().slice(0, 10) ? 'outline outline-1 outline-pink-500/60' : '';

    calendarCells.push(
      <button
        key={iso}
        className={`h-16 sm:h-20 rounded-xl border border-gray-200 p-2 text-xs cursor-pointer transition hover:scale-[1.01] ${bg} ${ring} ${isToday} ${privacy ? 'blur-sm' : ''}`}
        onClick={() => setSelectedDay(iso)}
        aria-label={`Open log for ${iso}`}
      >
        <div className="flex items-center justify-between">
          <div className="font-semibold">{i}</div>
          <div className="flex gap-1">{symbols.length ? symbols.map((s, idx) => <span key={idx}>{s}</span>) : <span className="text-gray-400">◌</span>}</div>
        </div>
        {log?.notes ? <div className="mt-1 line-clamp-2 text-[10px] opacity-70">📝 {log.notes}</div> : null}
      </button>
    );
  }

  const selectedLog = selectedDay ? dayLogs[selectedDay] ?? { date: selectedDay } : null;

  // heatmap
  const symptomIntensity = useMemo(() => {
    const last = history.slice(-28);
    return last.map((d) => (dayLogs[d.date]?.symptoms?.length ?? 0));
  }, [history, dayLogs]);
  const allZeroSymptoms = symptomIntensity.every((n) => n === 0);

  // bottom-sheet drag
  const startY = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { startY.current = e.touches[0].clientY; };
  const onTouchMove  = (e: React.TouchEvent) => {
    if (startY.current == null) return;
    const dy = e.touches[0].clientY - startY.current;
    const sheet = document.getElementById('daylog-sheet');
    if (sheet && dy > 0) sheet.style.transform = `translateY(${Math.min(dy, 300)}px)`;
  };
  const onTouchEnd = () => {
    const sheet = document.getElementById('daylog-sheet');
    if (!sheet) return;
    const y = parseInt(sheet.style.transform.replace(/[^\d.-]/g, ''), 10) || 0;
    sheet.style.transform = '';
    if (y > 120) { setSelectedDay(null); navigator.vibrate?.(10); }
  };

  // ICS URL
  const icsUrl = useMemo(
    () => (mounted ? buildFertilityICSUrlFromPrefs(prefs, window.location.origin) : null),
    [mounted, prefs]
  );
  const openSubscribeToast = () => {
    const enabled = !!icsUrl;
    setToastMsg(enabled ? icsUrl! : 'Set LMP and cycle length first (Setup Preferences).');
    setToastOpen(true); setToastCopied(false);
    track('ics_subscribe_toast', { enabled });
  };
  useEffect(() => { if (!toastOpen) return; const t = setTimeout(() => setToastOpen(false), 5000); return () => clearTimeout(t); }, [toastOpen]);
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); } catch {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta);
      ta.select(); document.execCommand('copy'); ta.remove();
    }
    setToastCopied(true); track('ics_copy');
  };

  // quick symptoms target
  const quickDate = selectedDay || todayISO;
  const quickSymptoms: string[] = dayLogs[quickDate]?.symptoms ?? [];
  const toggleSymptom = (name: string) => {
    const has = quickSymptoms.includes(name);
    const next = has ? quickSymptoms.filter(s => s !== name) : [...quickSymptoms, name];
    const base = dayLogs[quickDate] ?? { date: quickDate };
    saveLog({ ...base, symptoms: next });
    track('symptom_toggle', { name, active: !has, date: quickDate });
  };

  // pregnancy banner visibility (7-day snooze)
  const showPregnancyBanner = useMemo(() => {
    if (!mounted) return false;
    if (preg.status === 'unlikely') return false;
    if (!dismissedAt) return true;
    const daysSince = (Date.now() - dismissedAt) / 86400000;
    return daysSince > 7; // show again after a week
  }, [mounted, preg.status, dismissedAt]);

  const dismissPregnancyBanner = () => {
    const now = Date.now(); setDismissedAt(now);
    localStorage.setItem(LS_PREG_DISMISS, String(now));
    track('pregnancy_dismiss', { status: preg.status });
  };

  return (
    <main>
      <div className="max-w-7xl mx-auto p-6 sm:p-8 space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between rounded-2xl bg-white/70 backdrop-blur px-5 py-4 border border-gray-200 shadow-sm">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold">🌸 Lady Center</h1>
            <p className="text-gray-600 mt-1">Period & ovulation insights powered by NexRing temperature, HRV, RHR, and more.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setPrivacy((v) => !v); track('privacy_toggle'); }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50"
              title="Quick Hide sensitive data"
            >
              {privacy ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              <span className="hidden sm:inline">{privacy ? 'Show' : 'Quick Hide'}</span>
            </button>
            <button onClick={handleDownload} disabled={loading} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-pink-600 text-white hover:bg-pink-700 disabled:opacity-50 shadow-sm">
              <Download className="w-4 h-4" /> {loading ? 'Preparing…' : 'Download Report'}
            </button>
          </div>
        </header>

        {/* Pregnancy Banner */}
        {mounted && showPregnancyBanner && (
          <section className={`p-4 rounded-2xl border shadow-sm ${preg.status==='confirmed' ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-xl ${preg.status==='confirmed' ? 'bg-green-100' : 'bg-amber-100'}`}><Baby className="w-5 h-5" /></div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold">
                  {preg.status==='confirmed' ? '🎉 Congratulations!' : preg.status==='likely' ? 'Possible pregnancy' : 'Maybe pregnant'}
                  {preg.confidence ? <span className="ml-2 text-xs text-gray-500">({Math.round(preg.confidence*100)}%)</span> : null}
                </div>
                <div className="text-sm text-gray-700 mt-1">
                  {preg.reasons.length ? preg.reasons.join(' • ') : 'Keep wearing your device and logging symptoms.'}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {preg.status==='confirmed' ? (
                    <a href="/antenatal-center" className="px-3 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700" onClick={()=>track('pregnancy_cta_click',{cta:'start_antenatal'})}>
                      Start antenatal journey →
                    </a>
                  ) : (
                    <>
                      <a href="https://www.google.com/search?q=pregnancy+test" target="_blank" className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-100" onClick={()=>track('pregnancy_cta_click',{cta:'take_test'})}>
                        Take a pregnancy test
                      </a>
                      <button onClick={()=>{ setSelectedDay(todayISO); }} className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-100">
                        Log period / test result
                      </button>
                    </>
                  )}
                  <button onClick={dismissPregnancyBanner} className="px-3 py-2 rounded-lg border border-transparent hover:bg-gray-100">
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Quick Actions */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => setShowSetup((v) => !v)}
            className="flex items-center gap-3 p-5 border rounded-2xl shadow-sm hover:shadow-md transition bg-white/70 border-gray-200 text-left"
            aria-expanded={showSetup} aria-controls="setup-collapsible" id="setup"
          >
            {showSetup ? <ChevronDown className="w-6 h-6 text-pink-500" /> : <ChevronRightIcon className="w-6 h-6 text-pink-500" />}
            <div>
              <h2 className="font-semibold flex items-center gap-2"><Settings className="w-5 h-5 text-pink-500" />Setup Preferences</h2>
              <p className="text-sm text-gray-500">Log LMP and cycle length</p>
            </div>
          </button>

          <button
            onClick={scrollToReport}
            className="flex items-center gap-3 p-5 border rounded-2xl shadow-sm hover:shadow-md transition bg-white/70 border-gray-200 text-left"
          >
            <FileText className="w-6 h-6 text-pink-500" />
            <div>
              <h2 className="font-semibold">View Fertility Report</h2>
              <p className="text-sm text-gray-500">Calendar + ovulation markers</p>
            </div>
          </button>
        </section>

        {/* Collapsible Setup */}
        {showSetup && (
          <section id="setup-collapsible" className="p-5 border rounded-2xl bg-white/70 shadow-sm border-gray-200">
            <FertilitySetup />
          </section>
        )}

        {/* Smart Insights */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <InsightChip label="Cycle Day" value={prediction ? `${prediction.cycleDay}/${prediction.cycleLength}` : '—'} mounted={mounted} />
          <InsightChip label="Next Period" value={prediction ? new Date(prediction.nextPeriodStart).toLocaleDateString() : '—'} mounted={mounted} />
          <InsightChip label="Fertile Window" value={prediction ? `${new Date(prediction.fertileStart).toLocaleDateString()} – ${new Date(prediction.fertileEnd).toLocaleDateString()}` : '—'} mounted={mounted} compact />
          <InsightChip label="Est. Ovulation" value={prediction ? new Date(prediction.ovulation).toLocaleDateString() : '—'} mounted={mounted} />
        </section>

        {/* Baseline */}
        <button onClick={() => setShowBaseline((v) => !v)} className="flex items-center gap-3 p-3 border rounded-2xl shadow-sm hover:bg-gray-50 transition w-full text-left bg-white/70 border-gray-200">
          {showBaseline ? <ChevronDown /> : <ChevronRightIcon />} <span className="font-semibold">Baseline</span>
        </button>
        {showBaseline && (
          <section className="p-5 border rounded-2xl bg-white/70 shadow-sm border-gray-200">
            <p className="text-gray-700">
              {history.length < 14 ? `Baseline not yet established. Wear device ${Math.max(0, 14 - history.length)} more days.` : 'Baseline established ✅'}
            </p>
          </section>
        )}

        {/* Cycle History */}
        <button onClick={() => setShowChart((v) => !v)} className="flex items-center gap-3 p-3 border rounded-2xl shadow-sm hover:bg-gray-50 transition w-full text-left bg-white/70 border-gray-200">
          {showChart ? <ChevronDown /> : <ChevronRightIcon />} <span className="font-semibold">📊 Cycle History</span>
        </button>
        {showChart && (
          <section className={`p-5 border rounded-2xl bg-white/70 shadow-sm border-gray-200 space-y-4 ${privacy ? 'blur-sm' : ''}`}>
            <div className="flex flex-wrap items-center gap-2">
              {[14,28,90].map((d) => (
                <TimeframeButton key={d} active={windowDays === d} onClick={() => { setWindowDays(d as any); track('chart_timeframe', { days: d }); }} label={`${d}d`} />
              ))}
              <span className="mx-2 h-5 w-px bg-gray-300" />
              {[
                ['ΔTemp', 'deltaTemp'], ['RHR', 'rhr'], ['HRV', 'hrv'],
                ['Resp', 'respRate'], ['SpO₂', 'spo2'], ['Sleep', 'sleepScore'],
              ].map(([label, key]) => (
                <label key={key} className="inline-flex items-center gap-1 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-pink-600"
                    checked={visibleSeries[key]}
                    onChange={() => { setVisibleSeries((s) => ({ ...s, [key]: !s[key] })); track('chart_dataset_toggle', { key, enabled: !visibleSeries[key] }); }}
                  /> {label}
                </label>
              ))}
            </div>
            <Line data={chartData} options={chartOptions} />
          </section>
        )}

        {/* Calendar */}
        <button onClick={() => setShowCalendar((v) => !v)} className="flex items-center gap-3 p-3 border rounded-2xl shadow-sm hover:bg-gray-50 transition w-full text-left bg-white/70 border-gray-200">
          {showCalendar ? <ChevronDown /> : <ChevronRightIcon />} <span className="font-semibold">🗓 Period, Fertility, and Ovulation Tracker</span>
        </button>
        {showCalendar && (
          <section className={`p-5 border rounded-2xl bg-white/70 shadow-sm border-gray-200 ${privacy ? 'blur-sm' : ''}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} aria-label="Previous month" className="p-2 rounded-lg hover:bg-gray-100"><ChevronLeft /></button>
                <h2 className="text-xl font-semibold">{currentMonth.toLocaleString('default', { month: 'long' })} {currentMonth.getFullYear()}</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (!prediction) return;
                    track('ics_export');
                    const a = document.createElement('a');
                    const toDT = (iso: string) => {
                      const d = new Date(iso);
                      const pad = (v: number) => String(v).padStart(2, '0');
                      const y = d.getUTCFullYear(), m = pad(d.getUTCMonth() + 1), da = pad(d.getUTCDate());
                      return `${y}${m}${da}T090000Z`;
                    };
                    const lines = [
                      'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//DueCare//Fertility//EN','CALSCALE:GREGORIAN',
                      'BEGIN:VEVENT',`UID:period-${prediction.nextPeriodStart}@duecare`,`DTSTAMP:${toDT(prediction.nextPeriodStart)}`,
                      `DTSTART:${toDT(prediction.nextPeriodStart)}`,`DTEND:${toDT(new Date(new Date(prediction.nextPeriodStart).getTime()+5*86400000).toISOString().slice(0,10))}`,
                      'SUMMARY:Next Period (predicted)','END:VEVENT',
                      'END:VCALENDAR',
                    ].join('\r\n');
                    const blob = new Blob([lines], { type: 'text/calendar;charset=utf-8' });
                    a.href = URL.createObjectURL(blob); a.download = 'fertility_predictions.ics'; a.click();
                  }}
                  className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-100"
                  disabled={!prediction}
                  title="Export predicted windows as .ics"
                >
                  Export .ics
                </button>
                <button onClick={openSubscribeToast} className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-100" disabled={!mounted} title="Open ICS subscribe URL">
                  Subscribe in Calendar
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-2 text-xs text-gray-500 mb-2">
              {weekdayLabels.map((w) => <div key={w} className="text-center">{w}</div>)}
            </div>

            <div className="grid grid-cols-7 gap-2">{calendarCells}</div>

            <div className="flex gap-3 text-xs mt-3 flex-wrap items-center">
              <LegendBadge symbol="💧" text="Period" />
              <LegendBadge symbol="🟦" text="Follicular" />
              <LegendBadge symbol="🔴" text="Luteal" />
              <LegendBadge symbol="⭐" text="Ovulation" />
              <LegendBadge symbol="🌿" text="Fertile Window" />
              <LegendBadge symbol="◌" text="Predicted (tinted ring)" />
            </div>

            {/* Quick symptoms */}
            <div className="mt-4 space-y-2">
              <div className="text-sm font-medium">
                Quick Log Symptoms <span className="text-gray-500">(for {selectedDay ? selectedDay : 'today'})</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {SYMPTOM_CHOICES.map((s) => {
                  const active = (dayLogs[quickDate]?.symptoms ?? []).includes(s);
                  return (
                    <button
                      key={s}
                      onClick={() => toggleSymptom(s)}
                      aria-pressed={active}
                      className={`px-3 py-1.5 rounded-full border text-sm transition ${
                        active ? 'bg-pink-600 text-white border-pink-600' : 'bg-white/70 text-gray-700 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {active && <Check className="inline-block w-4 h-4 mr-1" />} {s}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Symptom heatmap */}
            <div className="mt-4">
              <div className="mb-1 text-sm font-medium">Symptom Heatmap (last 28 days)</div>
              {allZeroSymptoms ? (
                <div className="border border-dashed rounded-xl p-4 text-xs text-gray-500">
                  No symptoms logged yet. Add symptoms from quick log or day log to unlock richer insights.
                </div>
              ) : (
                <div className="grid gap-1 overflow-x-auto" style={{ gridTemplateColumns: 'repeat(28, 12px)' }}>
                  {symptomIntensity.map((n, idx) => (
                    <div
                      key={idx}
                      title={`Day ${idx + 1}: ${n} symptom${n === 1 ? '' : 's'}`}
                      className={`h-3 w-3 rounded ${n === 0 ? 'bg-gray-200' : n === 1 ? 'bg-pink-200' : n === 2 ? 'bg-pink-400' : 'bg-pink-600'}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Report Preview */}
        <div ref={reportRef} />
        <button onClick={() => setShowReport((v) => !v)} className="flex items-center gap-3 p-3 border rounded-2xl shadow-sm hover:bg-gray-50 transition w-full text-left bg-white/70 border-gray-200">
          {showReport ? <ChevronDown /> : <ChevronRightIcon />} <span className="font-semibold">📄 Report Preview</span>
        </button>
        {showReport && (
          <section className={`p-5 border rounded-2xl bg-white/70 shadow-sm border-gray-200 ${privacy ? 'blur-sm' : ''}`}>
            {loading && <p className="text-gray-500">Generating report…</p>}
            {pdfUrl && (<iframe src={pdfUrl} className="w-full h-[65vh] border rounded-xl" title="Fertility Report" />)}
          </section>
        )}

        {/* Day Log Bottom Sheet / Modal */}
        {selectedLog && (
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setSelectedDay(null)} role="dialog" aria-modal="true">
            <div
              id="daylog-sheet"
              className="absolute inset-x-0 bottom-0 sm:inset-0 sm:m-auto sm:h-auto sm:max-w-md sm:rounded-2xl bg-white border border-gray-200 shadow-2xl rounded-t-2xl p-6 w-full sm:w-[32rem]"
              onClick={(e) => e.stopPropagation()}
              onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
            >
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-gray-300 sm:hidden" />
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Day Log – {selectedLog.date}</h3>
                <button onClick={() => setSelectedDay(null)} aria-label="Close"><X className="w-5 h-5 text-gray-500" /></button>
              </div>
              <div className="mt-3 space-y-3">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={!!selectedLog.period} onChange={(e) => saveLog({ ...selectedLog, period: e.target.checked })} /> Period Started
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={!!selectedLog.ovulation} onChange={(e) => saveLog({ ...selectedLog, ovulation: e.target.checked })} /> Ovulation Confirmed
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={!!selectedLog.pregnancyTestPositive} onChange={(e) => saveLog({ ...selectedLog, pregnancyTestPositive: e.target.checked })} /> Positive Pregnancy Test
                </label>
                <label className="block">
                  <span className="text-sm">Medication / Contraceptives</span>
                  <input type="text" value={selectedLog.meds ?? ''} onChange={(e) => saveLog({ ...selectedLog, meds: e.target.value })} className="border p-2 rounded-xl w-full" />
                </label>
                <label className="block">
                  <span className="text-sm">Notes</span>
                  <textarea value={selectedLog.notes ?? ''} onChange={(e) => saveLog({ ...selectedLog, notes: e.target.value })} className="border p-2 rounded-xl w-full" rows={3} />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Subscribe Toast */}
        {toastOpen && (
          <div className="fixed right-6 bottom-6 z-50 w-[min(100%,32rem)]">
            <div className="rounded-2xl border border-gray-200 bg-white shadow-xl p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold mb-1">Subscribe in Calendar</div>
                  <div className="text-xs text-gray-600 break-all">
                    {icsUrl ? toastMsg : 'Set preferences to enable: LMP + cycle length.'}
                  </div>
                </div>
                <button className="p-1 rounded hover:bg-gray-100" onClick={() => setToastOpen(false)} aria-label="Close"><X className="w-4 h-4 text-gray-500" /></button>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  disabled={!icsUrl}
                  onClick={() => icsUrl && copy(icsUrl)}
                  className={`px-3 py-1.5 rounded-xl border text-sm ${toastCopied ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-800 border-gray-200 hover:bg-gray-50'}`}
                >
                  {toastCopied ? 'Copied' : 'Copy URL'}
                </button>
                <a
                  href={icsUrl ?? '#'}
                  target="_blank"
                  onClick={() => track('ics_open')}
                  className="px-3 py-1.5 rounded-xl border text-sm bg-white text-gray-800 border-gray-200 hover:bg-gray-50 aria-disabled:opacity-50"
                  aria-disabled={!icsUrl}
                >
                  Open
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Footer CTA */}
        <div className="text-sm text-gray-600 text-center">
          Don’t have a wearable? <a href="https://nexring.cloventechnology.com/" target="_blank" className="underline decoration-pink-400 hover:text-pink-700">Get NexRing for better insights →</a>
        </div>

        {/* Disclaimer */}
        <section className="p-4 border rounded-2xl bg-yellow-50 text-sm text-gray-700">
          ⚠ Predictions are estimates, not medical advice. For contraception or clinical use, consult a healthcare provider. Accuracy improves with continuous nightly wear and confirmed logs (period dates, ovulation, meds, symptoms).
        </section>
      </div>
    </main>
  );
}

function InsightChip({ label, value, mounted, compact }: { label: string; value: string; mounted: boolean; compact?: boolean }) {
  const safe = mounted ? value : '—';
  return (
    <div className="rounded-2xl border border-gray-200 bg-white/70 px-4 py-3 shadow-sm flex flex-col">
      <span className="text-[11px] uppercase tracking-wide text-gray-500">{label}</span>
      <span suppressHydrationWarning className={`${compact ? 'text-sm font-medium' : 'text-base font-semibold'} tabular-nums leading-tight`}>{safe}</span>
    </div>
  );
}
function LegendBadge({ symbol, text }: { symbol: string; text: string }) {
  return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-gray-200 bg-white/60"><span>{symbol}</span><span>{text}</span></span>;
}
function TimeframeButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return <button onClick={onClick} className={`px-3 py-1.5 rounded-xl border text-sm ${active ? 'bg-pink-600 text-white border-pink-600' : 'bg-white/70 text-gray-700 border-gray-200 hover:bg-gray-50'}`}>{label}</button>;
}
