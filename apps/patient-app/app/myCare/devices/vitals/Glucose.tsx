'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Sparkline from '@/components/charts/Sparkline';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

/** Types */
export type GlucoseRecord = {
  id: string;
  timestamp: string;
  glucose: number;
  unit: 'mmol_l' | 'mg_dl';
  stripCode?: string;
  testType?: string;
  fasting?: boolean;
  shared?: boolean;
  note?: string;
};

type Props = {
  onSave?: (rec: GlucoseRecord) => Promise<void> | void;
  initialHistory?: GlucoseRecord[];
  defaultUnit?: 'mmol_l' | 'mg_dl';
};

/** Defaults and helpers */
const DEFAULT_FASTING_MG_DL = 126;
const DEFAULT_NONFASTING_MG_DL = 200;
const uid = (p = '') => p + Math.random().toString(36).slice(2, 9);
const nowISO = () => new Date().toISOString();
const mmolToMgdl = (mmol: number) => Math.round(mmol * 18);
const mgdlToMmol = (mgdl: number) => +(mgdl / 18).toFixed(1);

export default function Glucose({ onSave, initialHistory = [], defaultUnit = 'mmol_l' }: Props) {
  const [history, setHistory] = useState<GlucoseRecord[]>(initialHistory);

  // selections & UI state
  const [strip, setStrip] = useState<string>('');
  const [testType, setTestType] = useState<string>('');
  const [measuring, setMeasuring] = useState(false);
  const [unit, setUnit] = useState<'mmol_l' | 'mg_dl'>(defaultUnit);
  const [view, setView] = useState<'list' | 'chart'>('chart');
  const [fasting, setFasting] = useState<boolean>(false);

  // thresholds (editable in current unit)
  const [fastingThreshold, setFastingThreshold] = useState<number>(() => defaultUnit === 'mg_dl' ? DEFAULT_FASTING_MG_DL : mgdlToMmol(DEFAULT_FASTING_MG_DL));
  const [nonFastingThreshold, setNonFastingThreshold] = useState<number>(() => defaultUnit === 'mg_dl' ? DEFAULT_NONFASTING_MG_DL : mgdlToMmol(DEFAULT_NONFASTING_MG_DL));

  // Alert rule settings: X flagged readings within Y days
  const [alertCountThreshold, setAlertCountThreshold] = useState<number>(3); // X
  const [alertWindowDays, setAlertWindowDays] = useState<number>(7); // Y
  const [lastAlertAt, setLastAlertAt] = useState<string | null>(null);
  const [alertBanner, setAlertBanner] = useState<string | null>(null);

  // report / pdf range selection
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0,10);
  });
  const [toDate, setToDate] = useState<string>(() => new Date().toISOString().slice(0,10));

  // UI and export state
  const [exportMode, setExportMode] = useState<'all'|'normal'|'flagged'>('all');
  const [noteEditId, setNoteEditId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>('');
  const boxplotCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [boxplotAvailable, setBoxplotAvailable] = useState<boolean>(false);

  useEffect(() => setHistory(initialHistory), [initialHistory]);

  // convert thresholds on unit toggle
  useEffect(() => {
    if (unit === 'mg_dl') {
      setFastingThreshold((t) => (typeof t === 'number' && t <= 20 ? mmolToMgdl(t) : t));
      setNonFastingThreshold((t) => (typeof t === 'number' && t <= 20 ? mmolToMgdl(t) : t));
    } else {
      setFastingThreshold((t) => (typeof t === 'number' && t > 20 ? mgdlToMmol(t) : t));
      setNonFastingThreshold((t) => (typeof t === 'number' && t > 20 ? mgdlToMmol(t) : t));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit]);

  // When thresholds or alert rules change, persist settings server-side (best-effort)
  useEffect(() => {
    const payload = {
      fastingThreshold,
      nonFastingThreshold,
      alertCountThreshold,
      alertWindowDays,
      unit,
      updatedAt: new Date().toISOString(),
    };
    // fire-and-forget save to server API; server should persist per-user
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch((e) => console.warn('save settings failed', e));
  }, [fastingThreshold, nonFastingThreshold, alertCountThreshold, alertWindowDays, unit]);

  // strips
  const stripOptions = Array.from({ length: 31 }, (_, i) => `C${String(i).padStart(2, '0')}`);

  // helpers
  function normalizeToUnit(value: number, fromUnit: 'mmol_l' | 'mg_dl', toUnit: 'mmol_l' | 'mg_dl') {
    if (fromUnit === toUnit) return value;
    return fromUnit === 'mg_dl' ? mgdlToMmol(value) : mmolToMgdl(value);
  }

  function isOutOfRange(rec: GlucoseRecord, fastingThr?: number, nonFastingThr?: number) {
    const fThr = fastingThr ?? fastingThreshold;
    const nfThr = nonFastingThr ?? nonFastingThreshold;
    const thr = rec.fasting ? fThr : nfThr;
    const val = rec.unit === unit ? rec.glucose : normalizeToUnit(rec.glucose, rec.unit, unit);
    return val >= thr;
  }

  // simulate reading
  async function doSimulateGlucose(stripCode = 'C19', tType = 'before_breakfast', isFasting = false) {
    setMeasuring(true);
    await new Promise(r => setTimeout(r, 600));
    const glucose = +( (unit === 'mmol_l') ? (4 + Math.random() * 3).toFixed(1) : (72 + Math.random() * 70).toFixed(0) );
    const rec: GlucoseRecord = {
      id: uid('g-'),
      timestamp: nowISO(),
      glucose,
      unit,
      stripCode,
      testType: isFasting ? 'fasting' : tType,
      fasting: isFasting,
      shared: false,
      note: ''
    };
    setHistory(h => [rec, ...h].slice(0, 1000));
    try { await onSave?.(rec); } catch (e) { console.warn('save failed', e); }
    setMeasuring(false);

    // audit event for new reading
    sendAudit({ type: 'reading_created', record: rec });

    // After adding, evaluate alerts
    setTimeout(() => evaluateAlerts(), 200);
  }

  // audit trail writer (best-effort)
  function sendAudit(event: any) {
    try {
      fetch('/api/audit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...event, at: new Date().toISOString() }),
      }).catch(e => console.warn('audit post failed', e));
    } catch (e) { console.warn('audit error', e); }
  }

  // alert evaluation: X flagged readings within Y days
  async function evaluateAlerts() {
    const now = new Date();
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - alertWindowDays);
    const flaggedRecent = history.filter(h => {
      const t = new Date(h.timestamp);
      return t >= windowStart && isOutOfRange(h);
    });

    if (flaggedRecent.length >= alertCountThreshold) {
      const lastAlertTime = lastAlertAt ? new Date(lastAlertAt) : null;
      if (!lastAlertTime || ((now.getTime() - lastAlertTime.getTime()) > 1000 * 60 * 60)) {
        setLastAlertAt(now.toISOString());
        const message = `Alert: ${flaggedRecent.length} flagged glucose readings in last ${alertWindowDays} days.`;
        setAlertBanner(message);
        triggerNotification('Glucose Alert', message);

        // send to /api/notify (existing) and /api/alerts (server should forward to FCM/APNs)
        const payload = {
          type: 'glucose_alert',
          message,
          threshold: { fastingThreshold, nonFastingThreshold },
          rule: { alertCountThreshold, alertWindowDays },
          samples: flaggedRecent,
          generatedAt: new Date().toISOString(),
        };

        // notify local server endpoint (present in repo)
        fetch('/api/notify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
          .catch((e) => console.warn('notify endpoint failed', e));

        // forward to alerts endpoint (server should implement FCM/APNs forwarding)
        fetch('/api/alerts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
          .catch((e) => console.warn('alerts endpoint failed', e));

        // audit the alert
        sendAudit({ type: 'alert_fired', payload });
      }
    }
  }

  // Browser Notification (requires permission)
  async function triggerNotification(title: string, body: string) {
    try {
      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          new Notification(title, { body });
        } else if (Notification.permission !== 'denied') {
          const p = await Notification.requestPermission();
          if (p === 'granted') new Notification(title, { body });
        }
      }
    } catch (e) {
      console.warn('notify failed', e);
    }
  }

  // Trend analytics: linear regression on numeric series (y over time -> slope)
  function linearSlope(records: GlucoseRecord[]) {
    if (!records.length) return 0;
    const xs = records.map(r => new Date(r.timestamp).getTime());
    const ys = records.map(r => r.unit === unit ? r.glucose : normalizeToUnit(r.glucose, r.unit, unit));
    const n = xs.length;
    const xMean = xs.reduce((a,b)=>a+b,0)/n;
    const yMean = ys.reduce((a,b)=>a+b,0)/n;
    let num = 0, den = 0;
    for (let i=0; i<n; i++) {
      num += (xs[i]-xMean)*(ys[i]-yMean);
      den += (xs[i]-xMean)*(xs[i]-xMean);
    }
    const slope = den === 0 ? 0 : num/den; // units: value per ms
    // scale slope to value per day for readability
    return slope * 1000 * 60 * 60 * 24;
  }

  // rolling average (days -> window in ms)
  function rollingAverage(records: GlucoseRecord[], days = 7) {
    if (!records.length) return null;
    const now = Date.now();
    const windowMs = days * 24 * 60 * 60 * 1000;
    const cutoff = now - windowMs;
    const inWindow = records.filter(r => (new Date(r.timestamp).getTime() >= cutoff));
    if (!inWindow.length) return null;
    const vals = inWindow.map(r => r.unit === unit ? r.glucose : normalizeToUnit(r.glucose, r.unit, unit));
    const avg = vals.reduce((a,b)=>a+b,0)/vals.length;
    return +avg.toFixed(1);
  }

  // Annotated timeline: edit note for a reading
  function saveNoteFor(id: string, note: string) {
    setHistory(h => h.map(r => r.id === id ? { ...r, note } : r));
    sendAudit({ type: 'note_saved', id, note });
    // optionally send note to server via onSave? integration point left to implement
  }

  // Time-in-range calculation (range based on thresholds)
  function calcTIR(records: GlucoseRecord[]) {
    if (!records.length) return { inRange:0, above:0, below:0, total:0 };
    const inRangeVal = records.filter(r => {
      const thr = r.fasting ? fastingThreshold : nonFastingThreshold;
      const val = r.unit === unit ? r.glucose : normalizeToUnit(r.glucose, r.unit, unit);
      const low = unit === 'mg_dl' ? 70 : mgdlToMmol(70);
      if (val < low) return false;
      if (val >= thr) return false;
      return true;
    }).length;
    const above = records.filter(r => {
      const thr = r.fasting ? fastingThreshold : nonFastingThreshold;
      const val = r.unit === unit ? r.glucose : normalizeToUnit(r.glucose, r.unit, unit);
      return val >= thr;
    }).length;
    const below = records.filter(r => {
      const val = r.unit === unit ? r.glucose : normalizeToUnit(r.glucose, r.unit, unit);
      const low = unit === 'mg_dl' ? 70 : mgdlToMmol(70);
      return val < low;
    }).length;
    const total = records.length;
    return { inRange: inRangeVal, above, below, total };
  }

  // Heatmap summary: average by day-of-week x time-block (6 blocks/day)
  function heatmapSummary(records: GlucoseRecord[]) {
    const buckets = Array.from({ length: 7 }, () => Array.from({ length: 6 }, () => [] as number[]));
    records.forEach(r => {
      const d = new Date(r.timestamp);
      const dow = d.getDay(); // 0 Sun .. 6 Sat
      const hour = d.getHours();
      const block = Math.floor(hour / 4);
      const val = r.unit === unit ? r.glucose : normalizeToUnit(r.glucose, r.unit, unit);
      buckets[dow][block].push(val);
    });
    return buckets.map(row => row.map(col => {
      if (!col.length) return null;
      const sum = col.reduce((a,b)=>a+b,0);
      return +(sum/col.length).toFixed(1);
    }));
  }

  // Box-like stats per time-of-day buckets (morning / midday / evening / night)
  function boxStatsByBucket(records: GlucoseRecord[]) {
    const buckets: Record<string, number[]> = { morning: [], midday: [], evening: [], night: [] };
    records.forEach(r => {
      const h = new Date(r.timestamp).getHours();
      const val = r.unit === unit ? r.glucose : normalizeToUnit(r.glucose, r.unit, unit);
      if (h >= 5 && h < 11) buckets.morning.push(val);
      else if (h >= 11 && h < 15) buckets.midday.push(val);
      else if (h >= 15 && h < 21) buckets.evening.push(val);
      else buckets.night.push(val);
    });
    function summary(arr: number[]) {
      if (!arr.length) return null;
      const sorted = arr.slice().sort((a,b)=>a-b);
      const n = sorted.length;
      const q1 = sorted[Math.floor((n - 1) * 0.25)];
      const med = sorted[Math.floor((n - 1) * 0.5)];
      const q3 = sorted[Math.floor((n - 1) * 0.75)];
      const min = sorted[0], max = sorted[sorted.length-1];
      return { min, q1, med, q3, max };
    }
    return {
      morning: summary(buckets.morning),
      midday: summary(buckets.midday),
      evening: summary(buckets.evening),
      night: summary(buckets.night),
    };
  }

  // Filters for export/report based on date range and mode
  function filterRecordsForRange(records: GlucoseRecord[], from?: string, to?: string) {
    let out = records.slice();
    if (from) {
      const f = new Date(from + 'T00:00:00').getTime();
      out = out.filter(r => new Date(r.timestamp).getTime() >= f);
    }
    if (to) {
      const t = new Date(to + 'T23:59:59').getTime();
      out = out.filter(r => new Date(r.timestamp).getTime() <= t);
    }
    return out;
  }

  // PDF export with jsPDF if available; otherwise fallback to printable html
  async function exportPdf(mode: 'all' | 'normal' | 'flagged') {
    const records = filterRecordsForRange(history, fromDate, toDate);
    let rows = records;
    if (mode === 'normal') rows = rows.filter(r => !isOutOfRange(r));
    else if (mode === 'flagged') rows = rows.filter(r => isOutOfRange(r));

    // Try jspdf if installed
    try {
      const mod = await import('jspdf').catch(() => null);
      if (mod && mod.jsPDF) {
        const { jsPDF } = mod as any;
        const doc = new jsPDF({ unit: 'pt', format: 'a4' });
        // Simple branded header
        doc.setFontSize(14);
        doc.text('Ambulant+ Glucose Report', 40, 60);
        doc.setFontSize(10);
        doc.text(`Period: ${fromDate} → ${toDate}`, 40, 80);
        doc.setFontSize(9);
        // table header
        const startY = 110;
        doc.autoTable?.({
          startY,
          head: [['When','Value','Type','Strip','Flag','Note']],
          body: rows.map(r => [
            new Date(r.timestamp).toLocaleString(),
            `${r.glucose} ${r.unit}`,
            `${r.testType || ''}${r.fasting ? ' • fasting' : ''}`,
            r.stripCode || '',
            isOutOfRange(r) ? 'FLAG' : '',
            r.note || ''
          ]),
          styles: { fontSize: 8 },
          theme: 'grid',
        });
        doc.save(`glucose_report_${mode}_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.pdf`);
        return;
      }
    } catch (e) {
      console.warn('jspdf export failed or unavailable', e);
    }

    // fallback: printable HTML (browser print -> user can save as PDF)
    const title = `Glucose Report (${mode})`;
    const dateRangeText = `${fromDate} → ${toDate}`;
    const rowsHtml = rows.map(r => `
      <tr>
        <td>${new Date(r.timestamp).toLocaleString()}</td>
        <td>${r.glucose} ${r.unit}</td>
        <td>${r.testType||''}${r.fasting ? ' • fasting' : ''}</td>
        <td>${r.stripCode||''}</td>
        <td>${isOutOfRange(r) ? 'FLAGGED' : ''}</td>
        <td>${(r.note||'').replace(/</g,'&lt;')}</td>
      </tr>
    `).join('\n');

    const html = `
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial; padding: 20px; color: #111; }
            h1 { font-size: 20px; margin-bottom: 8px; }
            .meta { font-size: 12px; color: #444; margin-bottom: 12px;}
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <div class="meta">Period: ${dateRangeText} • Generated: ${new Date().toLocaleString()}</div>
          <table>
            <thead><tr><th>When</th><th>Value</th><th>Type</th><th>Strip</th><th>Flag</th><th>Note</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </body>
      </html>
    `;
    const w = window.open('', '_blank', 'noopener,noreferrer');
    if (!w) { alert('Please allow popups to export PDF.'); return; }
    w.document.open();
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 600);
  }

  // CSV builder (retained)
  function buildCsvRows(rows: GlucoseRecord[]) {
    const header = ['id','timestamp','glucose','unit','stripCode','testType','fasting','shared','outOfRange','note'];
    const body = rows.map(r => {
      const out = isOutOfRange(r) ? '1' : '0';
      const fields = [
        r.id, r.timestamp, r.glucose, r.unit, r.stripCode ?? '', r.testType ?? '', r.fasting ? '1' : '0', r.shared ? '1' : '0', out, (r.note||'')
      ];
      return fields.map(String).map(cell => cell.includes(',')||cell.includes('"') ? `"${cell.replace(/"/g,'""')}"` : cell).join(',');
    });
    return [header.join(','), ...body].join('\n');
  }

  // Bar chart stats derived
  const stats = useMemo(() => {
    const total = history.length;
    let outTotal = 0, outF = 0, outNF = 0;
    let sumF=0,cF=0,sumNF=0,cNF=0;
    for (const r of history) {
      const val = r.unit === unit ? r.glucose : normalizeToUnit(r.glucose, r.unit, unit);
      const out = isOutOfRange(r);
      if (out) outTotal++;
      if (r.fasting) { cF++; sumF += val; if (out) outF++; }
      else { cNF++; sumNF += val; if (out) outNF++; }
    }
    return {
      total, outTotal, outF, outNF,
      avgF: cF? +(sumF/cF).toFixed(1):null, avgNF: cNF? +(sumNF/cNF).toFixed(1):null,
    };
  }, [history, unit, fastingThreshold, nonFastingThreshold]);

  const barData = useMemo(() => ({
    labels: ['Fasting','Non-fasting'],
    datasets: [{ label: 'Out-of-range count', data: [stats.outF || 0, stats.outNF || 0], backgroundColor: ['rgba(59,130,246,0.8)','rgba(99,102,241,0.8)'] }]
  }), [stats.outF, stats.outNF]);

  const barOptions = { plugins: { legend: { display:false } }, responsive:true, scales: { y: { beginAtZero:true, precision:0 } } };

  // sparkline
  const sparkHistory = history.slice(0,20).reverse();
  const sparkValues = sparkHistory.map(h => h.unit === unit ? h.glucose : normalizeToUnit(h.glucose, h.unit, unit));
  const sparkLabels = sparkHistory.map(h => `${new Date(h.timestamp).toLocaleDateString()} ${new Date(h.timestamp).toLocaleTimeString()}`);

  // derived analytics for selected date range
  const recordsInRange = useMemo(() => filterRecordsForRange(history, fromDate, toDate), [history, fromDate, toDate]);
  const slopePerDay = linearSlope(recordsInRange);
  const trendLabel = slopePerDay > 0.05 ? 'Upward trend' : slopePerDay < -0.05 ? 'Downward trend' : 'Stable';
  const avg7 = rollingAverage(history, 7);
  const avg30 = rollingAverage(history, 30);
  const tir = calcTIR(recordsInRange);
  const heat = heatmapSummary(recordsInRange);
  const box = boxStatsByBucket(recordsInRange);

  // attempt to dynamically load boxplot plugin (non-blocking)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // plugin name commonly: 'chartjs-chart-box-and-violin-plot'
        const mod = await import('chartjs-chart-box-and-violin-plot').catch(() => null);
        if (mod && mounted) {
          try {
            // plugin registers itself on import — we flag availability
            setBoxplotAvailable(true);
            // render boxplot via canvas in separate effect
          } catch (e) {
            console.warn('boxplot plugin register failed', e);
            setBoxplotAvailable(false);
          }
        } else {
          setBoxplotAvailable(false);
        }
      } catch (e) {
        console.warn('boxplot dynamic import failed', e);
        setBoxplotAvailable(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // render boxplot if plugin available (non-blocking)
  useEffect(() => {
    if (!boxplotAvailable || !boxplotCanvasRef.current) return;
    // build data series from bucket summaries
    try {
      // @ts-ignore dynamic Chart reference (plugin registers new dataset types)
      const Chart = (ChartJS as any).getChart ? ChartJS : (ChartJS as any);
      const dataset = [
        {
          label: 'Morning',
          data: [box?.morning ? [box.morning.min, box.morning.q1, box.morning.med, box.morning.q3, box.morning.max] : []],
        },
        {
          label: 'Midday',
          data: [box?.midday ? [box.midday.min, box.midday.q1, box.midday.med, box.midday.q3, box.midday.max] : []],
        },
        {
          label: 'Evening',
          data: [box?.evening ? [box.evening.min, box.evening.q1, box.evening.med, box.evening.q3, box.evening.max] : []],
        },
        {
          label: 'Night',
          data: [box?.night ? [box.night.min, box.night.q1, box.night.med, box.night.q3, box.night.max] : []],
        },
      ];
      // destroy previous if exists
      const ctx = boxplotCanvasRef.current.getContext('2d');
      // create Chart instance
      // @ts-ignore
      const chart = new (ChartJS as any)(ctx, {
        type: 'boxplot',
        data: {
          labels: [''],
          datasets: dataset
        },
        options: { responsive: true, plugins: { legend: { display: false } } }
      });
      return () => { chart.destroy(); };
    } catch (e) {
      console.warn('boxplot render failed', e);
    }
  }, [boxplotAvailable, box]);

  // enable Apply when strip & testType set
  const canApply = !!strip && !!testType && !measuring;

  return (
    <div className="space-y-3" aria-live="polite">
      {/* Alert banner */}
      {alertBanner && (
        <div role="status" className="p-2 bg-red-50 border-l-4 border-red-400 text-sm text-red-900">
          {alertBanner}
          <button onClick={() => setAlertBanner(null)} className="ml-4 underline">Dismiss</button>
        </div>
      )}

      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold">Blood Glucose</h3>
          <div className="text-xs text-gray-500">Select strip/test type, apply sample, and analyze trends. Use report range to export PDF.</div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button aria-label="Toggle unit" onClick={() => setUnit(u => u==='mmol_l'?'mg_dl':'mmol_l')} className="px-2 py-1 border rounded text-sm bg-white">{unit === 'mmol_l' ? 'mmol/L' : 'mg/dL'}</button>
            <div className="text-xs text-gray-400">Unit</div>
          </div>

          <div className="flex items-center gap-2">
            <input aria-label="Fasting" id="fasting-top" type="checkbox" checked={fasting} onChange={(e)=>setFasting(e.target.checked)} className="h-4 w-4" />
            <label htmlFor="fasting-top" className="text-sm text-gray-700">Fasting</label>
          </div>

          <div className="p-2 border rounded bg-white text-xs" role="group" aria-label="Thresholds">
            <div className="font-medium">Thresholds ({unit})</div>
            <div className="flex gap-2 mt-1">
              <div className="flex flex-col">
                <label className="text-xxs text-gray-500">Fasting</label>
                <input aria-label="Fasting threshold" type="number" className="w-20 p-1 border rounded text-sm" value={String(fastingThreshold)} onChange={(e)=>setFastingThreshold(Number(e.target.value||0))} />
              </div>
              <div className="flex flex-col">
                <label className="text-xxs text-gray-500">Non-fasting</label>
                <input aria-label="Non-fasting threshold" type="number" className="w-20 p-1 border rounded text-sm" value={String(nonFastingThreshold)} onChange={(e)=>setNonFastingThreshold(Number(e.target.value||0))} />
              </div>
            </div>
            <div className="text-xs text-gray-400 mt-1">Adjust thresholds for flagging.</div>
          </div>
        </div>
      </div>

      {/* selection */}
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2 md:col-span-1">
          <label className="text-xs text-gray-600" htmlFor="strip-select">Strip Type</label>
          <select id="strip-select" aria-label="Strip Type" className="w-full mt-1 p-2 border rounded bg-white text-sm" value={strip} onChange={(e)=>setStrip(e.target.value)}>
            <option value="">Select strip…</option>
            {stripOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs text-gray-600" htmlFor="testtype-select">Test Type</label>
          <select id="testtype-select" aria-label="Test Type" className="w-full mt-1 p-2 border rounded bg-white text-sm" value={testType} onChange={(e)=>setTestType(e.target.value)}>
            <option value="">Select test type…</option>
            <option value="before_breakfast">Before Breakfast</option>
            <option value="after_breakfast">After Breakfast</option>
            <option value="before_lunch">Before Lunch</option>
            <option value="after_lunch">After Lunch</option>
            <option value="before_supper">Before Supper</option>
            <option value="after_supper">After Supper</option>
            <option value="fasting">Fasting</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      {/* actions */}
      <div className="flex items-center gap-3">
        <button aria-disabled={!canApply} disabled={!canApply} className={`px-4 py-2 rounded ${measuring ? 'bg-red-500 text-white' : canApply ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`} onClick={() => { if(!canApply) return; doSimulateGlucose(strip, testType, fasting); }}>
          {measuring ? 'Measuring…' : 'Apply Sample'}
        </button>

        <div className="text-xs text-gray-500">After applying blood the strip reads instantly.</div>

        <div className="ml-auto flex items-center gap-2">
          <button aria-pressed={view==='list'} className={`px-2 py-1 border rounded text-sm ${view==='list'?'bg-gray-100':''}`} onClick={()=>setView('list')}>List</button>
          <button aria-pressed={view==='chart'} className={`px-2 py-1 border rounded text-sm ${view==='chart'?'bg-gray-100':''}`} onClick={()=>setView('chart')}>Chart</button>
        </div>
      </div>

      {/* analytics & export */}
      <div className="flex gap-4 text-xs items-center">
        <div className="p-2 border rounded bg-white">
          <div className="font-medium text-sm">Samples</div>
          <div>{stats.total}</div>
        </div>

        <div className="p-2 border rounded bg-white">
          <div className="font-medium text-sm">Out of range</div>
          <div>{stats.outTotal} total</div>
          <div className="text-ss text-gray-500">{stats.outF} fasting • {stats.outNF} non-fasting</div>
        </div>

        <div className="p-2 border rounded bg-white">
          <div className="font-medium text-sm">Averages ({unit})</div>
          <div className="text-xs">7d: {avg7 ?? '—'} • 30d: {avg30 ?? '—'}</div>
        </div>

        <div className="p-2 border rounded bg-white">
          <div className="font-medium">Trend</div>
          <div className="text-xs">{trendLabel} ({slopePerDay === 0 ? '—' : slopePerDay.toFixed(2)} / day)</div>
        </div>

        {/* alert rule controls */}
        <div className="p-2 border rounded bg-white text-xs">
          <div className="font-medium">Alert rule</div>
          <div className="flex gap-1 mt-1 items-center">
            <input aria-label="Alert count X" type="number" className="w-12 p-1 border rounded text-sm" value={String(alertCountThreshold)} onChange={(e)=>setAlertCountThreshold(Number(e.target.value||1))} />
            <div> flagged in </div>
            <input aria-label="Alert window days Y" type="number" className="w-12 p-1 border rounded text-sm" value={String(alertWindowDays)} onChange={(e)=>setAlertWindowDays(Number(e.target.value||1))} />
            <div> days</div>
          </div>
          <div className="text-xxs text-gray-500 mt-1">Triggers local notification and server relay when rule matches.</div>
        </div>

        {/* export controls */}
        <div className="ml-auto flex items-center gap-2">
          <div className="text-xxs text-gray-500">Report range</div>
          <input aria-label="From date" type="date" className="p-1 border rounded text-sm" value={fromDate} onChange={(e)=>setFromDate(e.target.value)} />
          <input aria-label="To date" type="date" className="p-1 border rounded text-sm" value={toDate} onChange={(e)=>setToDate(e.target.value)} />
          <select aria-label="Export mode" className="p-1 border rounded text-sm" value={exportMode} onChange={(e)=>setExportMode(e.target.value as any)}>
            <option value="all">All</option>
            <option value="normal">Normal</option>
            <option value="flagged">Flagged</option>
          </select>
          <button onClick={()=>exportPdf(exportMode)} className="px-3 py-1 border rounded text-sm bg-white">Export PDF</button>
        </div>
      </div>

      {/* charts: sparkline + bar + TIR + heatmap */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="col-span-2 p-3 border rounded bg-white">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">Trend (last {Math.min(history.length, 20)} samples)</div>
            <div className="text-xs text-gray-500">Sparkline</div>
          </div>
          <div className="flex items-center gap-3">
            <div style={{ width: 240 }}>
              <Sparkline labels={sparkLabels} values={sparkValues} color="#3b82f6" height={64} />
            </div>
            <div className="text-xs text-gray-500">
              {history[0] ? `${history[0].glucose} ${history[0].unit}` : '—'}
              <div className="mt-1">{history[0] ? new Date(history[0].timestamp).toLocaleString() : ''}</div>
            </div>
          </div>

          {/* time-in-range mini */}
          <div className="mt-3 text-xs">
            <div className="font-medium">Time-in-range (selected period)</div>
            <div className="flex gap-2 items-center mt-1">
              <div className="p-2 border rounded bg-green-50">In-range: {tir.total? Math.round((tir.inRange/tir.total)*100) : 0}%</div>
              <div className="p-2 border rounded bg-yellow-50">Above: {tir.total? Math.round((tir.above/tir.total)*100) : 0}%</div>
              <div className="p-2 border rounded bg-blue-50">Below: {tir.total? Math.round((tir.below/tir.total)*100) : 0}%</div>
            </div>
          </div>
        </div>

        <div className="col-span-1 p-3 border rounded bg-white">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">Out-of-range (breakdown)</div>
            <div className="text-xs text-gray-500">Fasting vs Non-fasting</div>
          </div>
          <Bar data={barData} options={barOptions} />
        </div>
      </div>

      {/* heatmap + box stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="col-span-3 p-3 border rounded bg-white">
          <div className="text-sm font-medium mb-2">Daily heatmap (avg {unit})</div>
          <div className="grid grid-cols-7 gap-2 text-xs">
            <div className="col-span-7 text-xxs text-gray-500 mb-1">Each cell is avg of ~4-hour block (Sun → Sat)</div>
            <div className="col-span-7">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                {heat.map((row, dow) => (
                  <div key={dow} className="text-xxs">
                    <div className="mb-1 font-medium">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dow]}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap:4 }}>
                      {row.map((cell, bi) => {
                        const v = cell;
                        const color = v == null ? '#e5e7eb' : v > (unit === 'mg_dl' ? 200 : mgdlToMmol(200)) ? '#ef4444' : v > (unit === 'mg_dl' ? 140 : mgdlToMmol(140)) ? '#f59e0b' : '#10b981';
                        return <div key={bi} style={{ background: color }} className="text-white text-xxs rounded p-1 text-center">{v==null? '—' : v}</div>;
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-1 p-3 border rounded bg-white text-xs">
          <div className="font-medium mb-2">Time-of-day stats</div>

          {/* If boxplot plugin available render canvas */}
          {boxplotAvailable ? (
            <>
              <canvas ref={boxplotCanvasRef} aria-label="Boxplot" />
              <div className="text-xxs text-gray-500 mt-2">Boxplot by time-of-day (requires chartjs plugin installed).</div>
            </>
          ) : (
            <>
              {(['morning','midday','evening','night'] as const).map(bucket => {
                const s = (box as any)[bucket];
                return (
                  <div key={bucket} className="mb-2">
                    <div className="font-medium">{bucket}</div>
                    {s ? (
                      <div className="text-xxs">
                        min {s.min} • q1 {s.q1} • med {s.med} • q3 {s.q3} • max {s.max}
                      </div>
                    ) : <div className="text-xxs text-gray-400">no data</div>}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* LIST (with note editing) */}
      {view === 'list' ? (
        <div className="space-y-2">
          {history.length===0 && <div className="text-xs text-gray-400">No glucose readings yet.</div>}
          {history.map(h => {
            const out = isOutOfRange(h);
            return (
              <div key={h.id} className={`flex justify-between items-center p-2 border rounded bg-white ${out ? 'border-red-300 shadow-sm' : ''}`}>
                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium">{h.glucose} {h.unit === 'mmol_l' ? 'mmol/L' : 'mg/dL'}</div>
                    {out && <div className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">OUT OF RANGE</div>}
                  </div>
                  <div className="text-xs text-gray-500">{new Date(h.timestamp).toLocaleString()} • {h.testType}{h.fasting ? ' • Fasting' : ''} • strip {h.stripCode}</div>
                  <div className="text-xs mt-1">{h.note ? <span className="italic text-gray-600">Note: {h.note}</span> : <button onClick={() => { setNoteEditId(h.id); setNoteDraft(h.note||''); }} className="text-xxs underline">Add note</button>}</div>
                </div>

                <div className="text-xs text-gray-400">
                  <div>{h.shared ? 'Shared' : 'Private'}</div>
                  <div className="mt-2">
                    <button onClick={() => { /* quick share single reading as PDF */ exportPdf('flagged'); }} className="px-2 py-1 border rounded text-xxs bg-white">Share PDF</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div /> // chart view handled above
      )}

      {/* note editor modal (simple) */}
      {noteEditId && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50" role="dialog" aria-modal="true">
          <div className="bg-white p-4 rounded shadow w-[420px]">
            <h4 className="font-medium">Edit note</h4>
            <textarea aria-label="Note" className="w-full p-2 border rounded h-32 mt-2" value={noteDraft} onChange={(e)=>setNoteDraft(e.target.value)} />
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={()=>{ setNoteEditId(null); setNoteDraft(''); }} className="px-3 py-1 border rounded text-sm">Cancel</button>
              <button onClick={()=>{ if(noteEditId){ saveNoteFor(noteEditId,noteDraft); setNoteEditId(null); setNoteDraft(''); } }} className="px-3 py-1 bg-indigo-600 text-white rounded">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** helper: filter by dates */
function filterRecordsForRange(records: GlucoseRecord[], from?: string, to?: string) {
  let out = records.slice();
  if (from) {
    const f = new Date(from + 'T00:00:00').getTime();
    out = out.filter(r => new Date(r.timestamp).getTime() >= f);
  }
  if (to) {
    const t = new Date(to + 'T23:59:59').getTime();
    out = out.filter(r => new Date(r.timestamp).getTime() <= t);
  }
  return out;
}
