'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Sparkline from '@/components/charts/Sparkline';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { connectBle, subscribe } from '@/src/devices/ble'; // <— listen for blood sample
import { Collapse } from '@/components/Collapse';
import { CollapseBtn } from '@/components/CollapseBtn';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

/** Types */
export type GlucoseRecord = {
  id: string;
  timestamp: string;             // ISO
  glucose: number;               // numeric value in record.unit
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

const uid = (p = '') => p + Math.random().toString(36).slice(2, 9);
const nowISO = () => new Date().toISOString();
const mmolToMgdl = (mmol: number) => Math.round(mmol * 18);
const mgdlToMmol = (mgdl: number) => +(mgdl / 18).toFixed(1);

const DEFAULTS = {
  mgdl: { fastingHigh: 126, nonFastingHigh: 200, low: 70 },
  mmol: { fastingHigh: mgdlToMmol(126), nonFastingHigh: mgdlToMmol(200), low: mgdlToMmol(70) },
};

// Accept plausible glucose ranges
const within = (v: number, lo: number, hi: number) => v >= lo && v <= hi;

export default function Glucose({ onSave, initialHistory = [], defaultUnit = 'mmol_l' }: Props) {
  const [history, setHistory] = useState<GlucoseRecord[]>(initialHistory);

  // UI state
  const [strip, setStrip] = useState<string>('');
  const [testType, setTestType] = useState<string>('');
  const [unit, setUnit] = useState<'mmol_l' | 'mg_dl'>(defaultUnit);
  const [view, setView] = useState<'list' | 'chart'>('chart');
  const [fasting, setFasting] = useState<boolean>(false);

  // collapsibles
  const [openTargets, setOpenTargets] = useState(true);
  const [openTodStats, setOpenTodStats] = useState(true);

  // measurement phase: idle → armed (waiting blood) → reading → done/error
  const [phase, setPhase] = useState<'idle' | 'armed' | 'reading' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState<string | null>(null);

  // thresholds (editable, unit-aware)
  const [fastingHigh, setFastingHigh] = useState<number>(() =>
    defaultUnit === 'mg_dl' ? DEFAULTS.mgdl.fastingHigh : DEFAULTS.mmol.fastingHigh
  );
  const [nonFastingHigh, setNonFastingHigh] = useState<number>(() =>
    defaultUnit === 'mg_dl' ? DEFAULTS.mgdl.nonFastingHigh : DEFAULTS.mmol.nonFastingHigh
  );
  const [lowTarget, setLowTarget] = useState<number>(() =>
    defaultUnit === 'mg_dl' ? DEFAULTS.mgdl.low : DEFAULTS.mmol.low
  );

  // alert rule: X flagged readings within Y days
  const [alertCountThreshold, setAlertCountThreshold] = useState<number>(3);
  const [alertWindowDays, setAlertWindowDays] = useState<number>(7);
  const [lastAlertAt, setLastAlertAt] = useState<string | null>(null);
  const [alertBanner, setAlertBanner] = useState<string | null>(null);
  const alertTimer = useRef<any>(null);

  // report range + filter + export options
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [filterMode, setFilterMode] = useState<'all' | 'normal' | 'flagged'>('all'); // UI filter
  const [exportMode, setExportMode] = useState<'all' | 'normal' | 'flagged'>('all'); // export intent

  // pagination for long lists
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  // optional plugins
  const boxplotCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [boxplotAvailable, setBoxplotAvailable] = useState<boolean>(false);

  // BLE lifecyle refs
  const connRef = useRef<any | null>(null);
  const unsubRef = useRef<null | (() => void)>(null);
  const timers = useRef<{ connect?: any; read?: any }>({});

  // ingest updates from parent
  useEffect(() => setHistory(initialHistory), [initialHistory]);

  // convert thresholds when unit changes
  useEffect(() => {
    if (unit === 'mg_dl') {
      setFastingHigh((t) => (t <= 20 ? mmolToMgdl(t) : t));
      setNonFastingHigh((t) => (t <= 20 ? mmolToMgdl(t) : t));
      setLowTarget((t) => (t <= 20 ? mmolToMgdl(t) : t));
    } else {
      setFastingHigh((t) => (t > 20 ? mgdlToMmol(t) : t));
      setNonFastingHigh((t) => (t > 20 ? mgdlToMmol(t) : t));
      setLowTarget((t) => (t > 20 ? mgdlToMmol(t) : t));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit]);

  // persist settings (best effort)
  useEffect(() => {
    const payload = {
      fastingHigh, nonFastingHigh, lowTarget,
      alertCountThreshold, alertWindowDays, unit,
      updatedAt: new Date().toISOString(),
    };
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch((e) => console.warn('save settings failed', e));
  }, [fastingHigh, nonFastingHigh, lowTarget, alertCountThreshold, alertWindowDays, unit]);

  // select lists
  const stripOptions = useMemo(
    () => Array.from({ length: 31 }, (_, i) => `C${String(i).padStart(2, '0')}`),
    []
  );

  // helpers
  const normalizeToUnit = (value: number, fromUnit: 'mmol_l' | 'mg_dl', toUnit: 'mmol_l' | 'mg_dl') =>
    fromUnit === toUnit ? value : fromUnit === 'mg_dl' ? mgdlToMmol(value) : mmolToMgdl(value);

  const inCurrentUnit = (r: GlucoseRecord) =>
    r.unit === unit ? r.glucose : normalizeToUnit(r.glucose, r.unit, unit);

  const isFlagged = (r: GlucoseRecord) => {
    const thrHigh = r.fasting ? fastingHigh : nonFastingHigh;
    const v = inCurrentUnit(r);
    return v >= thrHigh || v < lowTarget;
  };

  /** ---------- Device reading flow ---------- */

  // Parse device payload into { value, srcUnit }
  function parseGlucoseDV(dv: DataView): { value: number; srcUnit: 'mg_dl'|'mmol_l'; fmt: string } | null {
    try {
      const len = dv.byteLength;

      // float32 (often mmol/L)
      if (len >= 4) {
        const f = dv.getFloat32(0, true);
        if (within(f, 1, 40)) return { value: +f.toFixed(1), srcUnit: 'mmol_l', fmt: 'f32' };
      }

      // uint16 (often mg/dL)
      if (len >= 2) {
        const n = dv.getUint16(0, true);
        if (within(n, 40, 600)) return { value: n, srcUnit: 'mg_dl', fmt: 'u16' };
      }

      // ASCII: "105", "5.6", "105 mg/dL", "5.6 mmol/L"
      try {
        const txt = new TextDecoder().decode(new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength)).trim();
        if (txt) {
          const mgdl = /(\d{2,3})(?:\s*mg\/?dL)?/i.exec(txt)?.[1];
          const mmol = /(\d+(?:[\.,]\d+)?)(?:\s*mmol\/?L)?/i.exec(txt)?.[1];
          if (mmol) {
            const v = Number(mmol.replace(',', '.'));
            if (within(v, 1, 40)) return { value: +v.toFixed(1), srcUnit: 'mmol_l', fmt: 'ascii' };
          }
          if (mgdl) {
            const v = Number(mgdl.replace(',', '.'));
            if (within(v, 40, 600)) return { value: Math.round(v), srcUnit: 'mg_dl', fmt: 'ascii' };
          }
        }
      } catch {}
    } catch (e) {
      console.warn('glucose parse error', e);
    }
    return null;
  }

  // Start waiting for blood: connect and subscribe
  async function armForBlood() {
    if (!strip || !testType) return; // button already guards, but double-safe

    setPhase('armed');
    setMsg('Waiting for blood sample… Insert strip and apply a drop.');
    clearTimeout(timers.current.connect); clearTimeout(timers.current.read);

    // If BLE not available, still allow the UI to wait (device adapter may call into this component externally)
    if (!('bluetooth' in navigator)) {
      setMsg('Waiting for blood sample… (Bluetooth not supported in this browser)');
      return;
    }

    try {
      // connect
      timers.current.connect = setTimeout(() => {
        setMsg('Connection timeout — still waiting for strip signal…');
      }, 10_000);

      const conn = await connectBle('duecare.health-monitor' as any);
      clearTimeout(timers.current.connect);
      connRef.current = conn;

      // subscribe to vendor glucose channel (try common keys)
      const tryKeys = ['glucose', 'glu', 'bg'];
      let unsub: null | (() => void) = null;
      let subscribed = false;

      for (const key of tryKeys) {
        try {
          unsub = await subscribe(conn as any, key as any, onDV);
          subscribed = true;
          break;
        } catch {/* try next */}
      }

      if (!subscribed) {
        // some meters send ASCII over a generic characteristic; re-use any stream key you expose app-side
        try {
          unsub = await subscribe(conn as any, 'uart' as any, onDV);
          subscribed = true;
        } catch {}
      }

      if (!subscribed) {
        setMsg('Device stream unavailable — still armed; please try again.');
        return;
      }

      unsubRef.current = unsub;

      // watchdog while armed
      timers.current.read = setTimeout(() => {
        if (phase === 'armed') setMsg('Still waiting for blood… ensure strip is fully inserted.');
      }, 25_000);
    } catch (err: any) {
      clearTimeout(timers.current.connect);
      setMsg(`BLE error: ${err?.message || String(err)}`);
      setPhase('error');
    }

    // handler closure
    async function onDV(dv: DataView) {
      if (phase !== 'armed' && phase !== 'reading') return;
      const parsed = parseGlucoseDV(dv);
      if (!parsed) return; // keep listening until a valid sample

      setPhase('reading');
      setMsg('Reading…');

      // normalize to UI unit for storage
      const value = parsed.srcUnit === unit
        ? parsed.value
        : (unit === 'mg_dl' ? mmolToMgdl(parsed.value) : mgdlToMmol(parsed.value));

      const rec: GlucoseRecord = {
        id: uid('g-'),
        timestamp: nowISO(),
        glucose: value,
        unit,
        stripCode: strip,
        testType: fasting ? 'fasting' : testType,
        fasting,
        shared: false,
        note: '',
      };

      setHistory((h) => [rec, ...h].slice(0, 3000));
      try { await onSave?.(rec); } catch (e) { console.warn('save failed', e); }

      // cleanup
      try { unsubRef.current?.(); } catch {}
      try { connRef.current?.stopAll?.(); } catch {}
      unsubRef.current = null; connRef.current = null;
      clearTimeout(timers.current.read);
      setPhase('done');
      setMsg('Reading complete');

      // alert flow
      if (alertTimer.current) clearTimeout(alertTimer.current);
      alertTimer.current = setTimeout(() => evaluateAlerts(), 250);
    }
  }

  async function cancelArming() {
    try { unsubRef.current?.(); } catch {}
    try { connRef.current?.stopAll?.(); } catch {}
    unsubRef.current = null; connRef.current = null;
    clearTimeout(timers.current.connect); clearTimeout(timers.current.read);
    setPhase('idle');
    setMsg('Cancelled');
  }

  // Simulation (separate control)
  async function doSimulateGlucose(stripCode = 'C19', tType = 'before_breakfast', isFasting = false) {
    setPhase('reading');
    setMsg('Simulating…');
    await new Promise((r) => setTimeout(r, 600));
    const glucose =
      unit === 'mmol_l'
        ? +(4 + Math.random() * 3).toFixed(1)
        : +(72 + Math.random() * 70).toFixed(0);

    // de-dupe immediate duplicates
    const sameRecent = history[0] && inCurrentUnit(history[0]) === glucose &&
      Date.now() - new Date(history[0].timestamp).getTime() < 3000;
    if (sameRecent) {
      setPhase('done');
      setMsg('Duplicate ignored');
      return;
    }

    const rec: GlucoseRecord = {
      id: uid('g-'),
      timestamp: nowISO(),
      glucose,
      unit,
      stripCode,
      testType: isFasting ? 'fasting' : tType,
      fasting: isFasting,
      shared: false,
      note: '',
    };
    setHistory((h) => [rec, ...h].slice(0, 3000));
    try { await onSave?.(rec); } catch (e) { console.warn('save failed', e); }
    setPhase('done');
    setMsg(`Simulated ${glucose} ${unit === 'mg_dl' ? 'mg/dL' : 'mmol/L'}`);

    if (alertTimer.current) clearTimeout(alertTimer.current);
    alertTimer.current = setTimeout(() => evaluateAlerts(), 250);
  }

  // audit trail (best effort)
  function audit(event: any) {
    try {
      fetch('/api/audit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...event, at: new Date().toISOString() }),
      }).catch((e) => console.warn('audit post failed', e));
    } catch (e) { /* noop */ }
  }

  // Alerts: X flagged readings within Y days (idempotent per hour)
  function evaluateAlerts() {
    const now = new Date();
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - alertWindowDays);
    const flaggedRecent = history.filter(h => {
      const t = new Date(h.timestamp);
      return t >= windowStart && isFlagged(h);
    });

    if (flaggedRecent.length >= alertCountThreshold) {
      const lastTime = lastAlertAt ? new Date(lastAlertAt) : null;
      if (!lastTime || now.getTime() - lastTime.getTime() > 1000 * 60 * 60) {
        const msg = `Glucose alert: ${flaggedRecent.length} flagged readings in last ${alertWindowDays} day(s).`;
        setLastAlertAt(now.toISOString());
        setAlertBanner(msg);
        if (typeof window !== 'undefined' && 'Notification' in window) {
          try {
            if (Notification.permission === 'granted') new Notification('Glucose Alert', { body: msg });
            else if (Notification.permission !== 'denied') Notification.requestPermission().then(p => { if (p === 'granted') new Notification('Glucose Alert', { body: msg }); });
          } catch {}
        }
        const payload = {
          type: 'glucose_alert',
          message: msg,
          thresholds: { fastingHigh, nonFastingHigh, lowTarget, unit },
          rule: { alertCountThreshold, alertWindowDays },
          samples: flaggedRecent.slice(0, 20),
        };
        fetch('/api/notify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => {});
        fetch('/api/alerts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => {});
        audit({ type: 'alert_fired', payload });
      }
    }
  }

  // Derived analytics (range → then optional filter)
  const ranged = useMemo(() => filterByDate(history, fromDate, toDate), [history, fromDate, toDate]);
  const inRangeRecords = useMemo(() => {
    if (filterMode === 'flagged') return ranged.filter(isFlagged);
    if (filterMode === 'normal') return ranged.filter(r => !isFlagged(r));
    return ranged;
  }, [ranged, filterMode]);

  const avg7 = useMemo(() => rollingAverage(history, unit, 7), [history, unit]);
  const avg30 = useMemo(() => rollingAverage(history, unit, 30), [history, unit]);

  const tir = useMemo(() => calcTIR(inRangeRecords, unit, lowTarget, fastingHigh, nonFastingHigh), [
    inRangeRecords, unit, lowTarget, fastingHigh, nonFastingHigh,
  ]);

  const trend = useMemo(() => {
    const slopePerDay = linearSlope(inRangeRecords, unit);
    const label = slopePerDay > 0.05 ? 'Upward trend' : slopePerDay < -0.05 ? 'Downward trend' : 'Stable';
    return { slopePerDay, label };
  }, [inRangeRecords, unit]);

  // GMI / eA1c (informational, not diagnostic)
  const meanForA1c = useMemo(() => {
    if (!inRangeRecords.length) return null;
    const vals = inRangeRecords.map(inCurrentUnit);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const mgdl = unit === 'mg_dl' ? mean : mmolToMgdl(mean);
    const eA1c = +(((mgdl + 46.7) / 28.7)).toFixed(2); // DCCT % formula
    const gmi = +(3.31 + 0.02392 * mgdl).toFixed(2);  // GMI %
    return { mean, mgdl, eA1c, gmi };
  }, [inRangeRecords, unit]);

  // Stats for bar chart (use full history to keep context)
  const stats = useMemo(() => {
    const total = history.length;
    let outTotal = 0, outF = 0, outNF = 0, sumF = 0, cF = 0, sumNF = 0, cNF = 0;
    for (const r of history) {
      const val = r.unit === unit ? r.glucose : (unit === 'mg_dl' ? mmolToMgdl(r.glucose) : mgdlToMmol(r.glucose));
      const out = val >= (r.fasting ? fastingHigh : nonFastingHigh) || val < lowTarget;
      if (out) outTotal++;
      if (r.fasting) { cF++; sumF += val; if (out) outF++; }
      else { cNF++; sumNF += val; if (out) outNF++; }
    }
    return {
      total, outTotal, outF, outNF,
      avgF: cF ? +(sumF / cF).toFixed(1) : null,
      avgNF: cNF ? +(sumNF / cNF).toFixed(1) : null,
    };
  }, [history, fastingHigh, nonFastingHigh, lowTarget, unit]);

  const barData = useMemo(() => ({
    labels: ['Fasting', 'Non-fasting'],
    datasets: [{
      label: 'Out-of-range count',
      data: [stats.outF || 0, stats.outNF || 0],
      backgroundColor: ['rgba(59,130,246,0.8)', 'rgba(99,102,241,0.8)'],
    }],
  }), [stats.outF, stats.outNF]);

  const barOptions = { plugins: { legend: { display: false } }, responsive: true, scales: { y: { beginAtZero: true, precision: 0 } } };

  // Sparkline (last 20) — filtered by range/filter
  const sparkHistory = inRangeRecords.slice(0, 20).reverse();
  const sparkValues = sparkHistory.map(inCurrentUnit);
  const sparkLabels = sparkHistory.map(h => `${new Date(h.timestamp).toLocaleDateString()} ${new Date(h.timestamp).toLocaleTimeString()}`);

  // Time-of-day grids
  const heat = useMemo(() => heatmapSummary(inRangeRecords, unit), [inRangeRecords, unit]);
  const box = useMemo(() => boxStatsByBucket(inRangeRecords, unit), [inRangeRecords, unit]);

  // optional box/violin plugin
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const mod = await import('chartjs-chart-box-and-violin-plot').catch(() => null);
        if (mod && mounted) setBoxplotAvailable(true);
      } catch { setBoxplotAvailable(false); }
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!boxplotAvailable || !boxplotCanvasRef.current) return;
    try {
      // @ts-ignore (type comes from dynamic plugin)
      const chart = new (ChartJS as any)(boxplotCanvasRef.current, {
        type: 'boxplot',
        data: {
          labels: [''],
          datasets: [
            { label: 'Morning', data: box.morning ? [[box.morning.min, box.morning.q1, box.morning.med, box.morning.q3, box.morning.max]] : [[]] },
            { label: 'Midday', data: box.midday ? [[box.midday.min, box.midday.q1, box.midday.med, box.midday.q3, box.midday.max]] : [[]] },
            { label: 'Evening', data: box.evening ? [[box.evening.min, box.evening.q1, box.evening.med, box.evening.q3, box.evening.max]] : [[]] },
            { label: 'Night', data: box.night ? [[box.night.min, box.night.q1, box.night.med, box.night.q3, box.night.max]] : [[]] },
          ],
        },
        options: { responsive: true, plugins: { legend: { display: false } } },
      });
      return () => { chart.destroy(); };
    } catch (e) {
      console.warn('boxplot render failed', e);
    }
  }, [boxplotAvailable, box]);

  const armed = phase === 'armed' || phase === 'reading';
  const canApply = !!strip && !!testType && !armed;

  // CSV export
  function exportCsv() {
    const rows = filterByDate(history, fromDate, toDate);
    let filtered = rows;
    if (exportMode === 'flagged') filtered = filtered.filter(isFlagged);
    if (exportMode === 'normal') filtered = filtered.filter(r => !isFlagged(r));

    const header = ['id', 'timestamp', 'glucose', 'unit', 'stripCode', 'testType', 'fasting', 'shared', 'flagged', 'note'];
    const body = filtered.map(r => {
      const flagged = isFlagged(r) ? '1' : '0';
      return [
        r.id, r.timestamp, inCurrentUnit(r), unit, r.stripCode ?? '', r.testType ?? '', r.fasting ? '1' : '0', r.shared ? '1' : '0', flagged, (r.note || ''),
      ].map(String).map(csvEscape).join(',');
    });
    const csv = [header.join(','), ...body].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `glucose_${fromDate}_${toDate}_${exportMode}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  // PDF export (module-level) — keep your existing jsPDF/HTML fallback
  async function exportPdf(mode: 'all' | 'normal' | 'flagged') {
    const records = filterByDate(history, fromDate, toDate);
    let rows = records;
    if (mode === 'normal') rows = rows.filter(r => !isFlagged(r));
    else if (mode === 'flagged') rows = rows.filter(isFlagged);

    // Try jsPDF if available
    try {
      const mod = await import('jspdf').catch(() => null);
      if (mod?.jsPDF) {
        const { jsPDF } = mod as any;
        const doc = new jsPDF({ unit: 'pt', format: 'a4' });
        doc.setFontSize(14); doc.text('Ambulant+ Glucose Report', 40, 60);
        doc.setFontSize(10); doc.text(`Period: ${fromDate} → ${toDate} • Filter: ${mode}`, 40, 80);
        const table = (doc as any).autoTable;
        table?.({
          startY: 110,
          head: [['When', `Value (${unit === 'mg_dl' ? 'mg/dL' : 'mmol/L'})`, 'Type', 'Strip', 'Flag', 'Note']],
          body: rows.map(r => [
            new Date(r.timestamp).toLocaleString(),
            String(inCurrentUnit(r)),
            `${r.testType || ''}${r.fasting ? ' • fasting' : ''}`,
            r.stripCode || '',
            isFlagged(r) ? 'FLAG' : '',
            r.note || '',
          ]),
          styles: { fontSize: 8 },
          theme: 'grid',
        });
        doc.save(`glucose_report_${mode}_${new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')}.pdf`);
        return;
      }
    } catch (e) {
      console.warn('jspdf export failed/unavailable', e);
    }

    // fallback printable HTML
    const title = `Glucose Report (${mode})`;
    const rowsHtml = rows.map(r => `
      <tr>
        <td>${new Date(r.timestamp).toLocaleString()}</td>
        <td>${inCurrentUnit(r)} ${unit === 'mg_dl' ? 'mg/dL' : 'mmol/L'}</td>
        <td>${r.testType || ''}${r.fasting ? ' • fasting' : ''}</td>
        <td>${r.stripCode || ''}</td>
        <td>${isFlagged(r) ? 'FLAGGED' : ''}</td>
        <td>${(r.note || '').replace(/</g, '&lt;')}</td>
      </tr>
    `).join('');

    const html = `
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial; padding: 20px; color: #111; }
            h1 { font-size: 20px; margin-bottom: 8px; }
            .meta { font-size: 12px; color: #444; margin-bottom: 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
          </style>
        </head>
        <body>
          <h1>${title}</h1>
          <div class="meta">Period: ${fromDate} → ${toDate} • Generated: ${new Date().toLocaleString()}</div>
          <table>
            <thead><tr><th>When</th><th>Value</th><th>Type</th><th>Strip</th><th>Flag</th><th>Note</th></tr></thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </body>
      </html>`;
    const w = typeof window !== 'undefined' ? window.open('', '_blank', 'noopener,noreferrer') : null;
    if (!w) { alert('Please allow popups to export PDF.'); return; }
    w.document.open(); w.document.write(html); w.document.close();
    setTimeout(() => w.print(), 500);
  }

  // UI derived
  const canExport = history.length > 0;

  // list pagination
  const paged = useMemo(() => {
    if (view !== 'list') return [];
    const start = (page - 1) * PAGE_SIZE;
    return inRangeRecords.slice(start, start + PAGE_SIZE);
  }, [inRangeRecords, page, view]);

  const statusText =
    alertBanner ? alertBanner :
    phase === 'armed' ? 'Waiting for blood sample…' :
    phase === 'reading' ? 'Reading…' :
    `Loaded ${history.length} glucose samples.`;

  const unitLabel = unit === 'mg_dl' ? 'mg/dL' : 'mmol/L';
  const cn = (...a: Array<string | false | undefined>) => a.filter(Boolean).join(' ');

  return (
    <div className="space-y-3" aria-live="polite">
      {/* Status / Alerts */}
      {alertBanner && (
        <div role="status" className="p-2 bg-red-50 border-l-4 border-red-400 text-sm text-red-900">
          {alertBanner}
          <button onClick={() => setAlertBanner(null)} className="ml-4 underline">Dismiss</button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold">Blood Glucose</h3>
          <div className="text-xs text-gray-500">
            Select strip/test type, <span className="font-medium">Apply Sample</span>, then place a drop on the inserted strip.
          </div>
        </div>

        {/* view toggle */}
        <div className="flex items-center gap-2">
          <button aria-pressed={view === 'list'} className={cn('px-2 py-1 border rounded text-sm', view==='list' && 'bg-gray-100')} onClick={() => setView('list')}>List</button>
          <button aria-pressed={view === 'chart'} className={cn('px-2 py-1 border rounded text-sm', view==='chart' && 'bg-gray-100')} onClick={() => setView('chart')}>Chart</button>
        </div>
      </div>

      {/* Selector Row — stacked selects (left), unit/fasting + action (middle), targets (right) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Left: Strip above Test Type */}
        <div className="p-3 border rounded bg-white">
          <label className="text-xs text-gray-600" htmlFor="strip-select">Strip Type</label>
          <select
            id="strip-select"
            className="w-full mt-1 p-2 border rounded bg-white text-sm"
            value={strip}
            onChange={(e)=>setStrip(e.target.value)}
          >
            <option value="">Select strip…</option>
            {stripOptions.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <label className="text-xs text-gray-600 mt-3 block" htmlFor="testtype-select">Test Type</label>
          <select
            id="testtype-select"
            className="w-full mt-1 p-2 border rounded bg-white text-sm"
            value={testType}
            onChange={(e)=>setTestType(e.target.value)}
          >
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

        {/* Middle: Unit + Fasting + Actions */}
        <div className="p-3 border rounded bg-white flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <button
              aria-label="Toggle unit"
              onClick={() => setUnit(u => u === 'mmol_l' ? 'mg_dl' : 'mmol_l')}
              className="px-3 py-2 border rounded text-sm bg-white hover:bg-slate-50"
              disabled={armed}
              title={armed ? 'Cannot change unit while armed' : 'Toggle unit'}
            >
              Unit: <span className="ml-1 font-medium">{unitLabel}</span>
            </button>

            <label className="flex items-center gap-2">
              <input id="fasting-top" type="checkbox" checked={fasting} onChange={(e) => setFasting(e.target.checked)} className="h-4 w-4" disabled={armed}/>
              <span className="text-sm text-gray-700">Fasting</span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {!armed ? (
              <button
                aria-disabled={!canApply}
                disabled={!canApply}
                className={cn(
                  'px-4 py-2 rounded transition',
                  canApply ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                )}
                onClick={armForBlood}
              >
                Apply Sample
              </button>
            ) : (
              <>
                <button
                  className="px-4 py-2 rounded bg-yellow-500 text-white"
                  disabled
                >
                  Waiting for Blood Sample…
                </button>
                <button
                  className="px-3 py-2 rounded bg-red-600 text-white hover:bg-red-700"
                  onClick={cancelArming}
                >
                  Cancel
                </button>
              </>
            )}

            <button
              className="ml-auto px-3 py-2 border rounded text-sm bg-white hover:bg-slate-50"
              onClick={() => doSimulateGlucose(strip || 'C19', testType || 'before_breakfast', fasting)}
              disabled={armed}
              title={armed ? 'Simulation disabled while waiting for sample' : 'Generate a simulated reading'}
            >
              Simulate
            </button>
          </div>

          <div className="text-xs text-gray-500">{msg || 'After you tap Apply Sample, insert strip and place a drop to auto-read.'}</div>
        </div>

        {/* Right: Targets (collapsible) */}
        <div className="p-3 border rounded bg-white" role="group" aria-label="Targets">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">Targets ({unitLabel})</div>
            <CollapseBtn
              open={openTargets}
              onClick={() => setOpenTargets(o => !o)}
              titleOpen="Hide"
              titleClosed="Show"
            />
          </div>

          <Collapse open={openTargets}>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <div className="flex flex-col">
                <label className="text-xxs text-gray-500">Low</label>
                <input type="number" className="w-full p-1 border rounded text-sm" value={String(lowTarget)} onChange={(e)=>setLowTarget(Number(e.target.value || 0))} disabled={armed}/>
              </div>
              <div className="flex flex-col">
                <label className="text-xxs text-gray-500">Fasting high</label>
                <input type="number" className="w-full p-1 border rounded text-sm" value={String(fastingHigh)} onChange={(e)=>setFastingHigh(Number(e.target.value || 0))} disabled={armed}/>
              </div>
              <div className="flex flex-col">
                <label className="text-xxs text-gray-500">Non-fasting high</label>
                <input type="number" className="w-full p-1 border rounded text-sm" value={String(nonFastingHigh)} onChange={(e)=>setNonFastingHigh(Number(e.target.value || 0))} disabled={armed}/>
              </div>
            </div>
            <div className="text-xxs text-gray-500 mt-2">Used for flagging & time-in-range.</div>
          </Collapse>
        </div>
      </div>

      {/* KPIs */}
      <div className="flex flex-wrap gap-3 text-xs items-stretch">
        <div className="p-2 border rounded bg-white min-w-[130px]">
          <div className="font-medium text-sm">Samples</div>
          <div className="text-base">{history.length}</div>
        </div>
        <div className="p-2 border rounded bg-white min-w-[170px]">
          <div className="font-medium text-sm">Out of range</div>
          <div>{stats.outTotal} total</div>
          <div className="text-ss text-gray-500">{stats.outF} fasting • {stats.outNF} non-fasting</div>
        </div>
        <div className="p-2 border rounded bg-white min-w-[210px]">
          <div className="font-medium text-sm">Averages ({unitLabel})</div>
          <div className="text-xs">7d: {avg7 ?? '—'} • 30d: {avg30 ?? '—'}</div>
        </div>
        <div className="p-2 border rounded bg-white min-w-[170px]">
          <div className="font-medium">Trend</div>
          <div className="text-xs">{trend.label} ({trend.slopePerDay === 0 ? '—' : trend.slopePerDay.toFixed(2)} / day)</div>
        </div>
        {meanForA1c && (
          <div className="p-2 border rounded bg-white min-w-[220px]">
            <div className="font-medium text-sm">GMI / eA1c</div>
            <div className="text-xs">Mean: {meanForA1c.mean.toFixed(1)} {unitLabel}</div>
            <div className="text-xs">GMI: {meanForA1c.gmi}% • eA1c: {meanForA1c.eA1c}%</div>
            <div className="text-xxs text-gray-500">Informational only, not diagnostic.</div>
          </div>
        )}
      </div>

      {/* Toolbar Line: Range + Filter + Export */}
      <div className="flex flex-wrap items-center gap-2 p-2 border rounded bg-white">
        <div className="text-xxs text-gray-500 mr-1">Range</div>
        <input aria-label="From date" type="date" className="p-1 border rounded text-sm" value={fromDate} onChange={(e)=>{ setFromDate(e.target.value); setPage(1); }} />
        <input aria-label="To date" type="date" className="p-1 border rounded text-sm" value={toDate} onChange={(e)=>{ setToDate(e.target.value); setPage(1); }} />
        <div className="mx-2 h-5 w-px bg-gray-200" />
        <label className="text-xs text-gray-600">Filter</label>
        <select aria-label="Filter mode" className="p-1 border rounded text-sm" value={filterMode} onChange={(e)=>{ setFilterMode(e.target.value as any); setPage(1); }}>
          <option value="all">All</option>
          <option value="normal">Normal</option>
          <option value="flagged">Flagged</option>
        </select>
        <div className="mx-2 h-5 w-px bg-gray-200" />
        <label className="text-xs text-gray-600">Export</label>
        <select aria-label="Export mode" className="p-1 border rounded text-sm" value={exportMode} onChange={(e)=>setExportMode(e.target.value as any)}>
          <option value="all">All</option>
          <option value="normal">Normal</option>
          <option value="flagged">Flagged</option>
        </select>
        <button disabled={!canExport} onClick={()=>exportPdf(exportMode)} className="px-3 py-1 border rounded text-sm bg-white disabled:opacity-60 hover:bg-slate-50">Export PDF</button>
        <button disabled={!canExport} onClick={exportCsv} className="px-3 py-1 border rounded text-sm bg-white disabled:opacity-60 hover:bg-slate-50">CSV</button>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="col-span-2 p-3 border rounded bg-white">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">Trend (last {Math.min(inRangeRecords.length, 20)} in view)</div>
            <div className="text-xs text-gray-500">Sparkline</div>
          </div>
          <div className="flex items-center gap-3">
            <div style={{ width: 240 }}>
              <Sparkline labels={sparkLabels} values={sparkValues} color="#3b82f6" height={64} />
            </div>
            <div className="text-xs text-gray-500">
              {inRangeRecords[0] ? `${inCurrentUnit(inRangeRecords[0])} ${unitLabel}` : '—'}
              <div className="mt-1">{inRangeRecords[0] ? new Date(inRangeRecords[0].timestamp).toLocaleString() : ''}</div>
            </div>
          </div>

          {/* TIR mini */}
          <div className="mt-3 text-xs">
            <div className="font-medium">Time-in-range (selected period + filter)</div>
            <div className="flex gap-2 items-center mt-1">
              <div className="p-2 border rounded bg-green-50">In-range: {tir.total ? Math.round((tir.inRange / tir.total) * 100) : 0}%</div>
              <div className="p-2 border rounded bg-yellow-50">Above: {tir.total ? Math.round((tir.above / tir.total) * 100) : 0}%</div>
              <div className="p-2 border rounded bg-blue-50">Below: {tir.total ? Math.round((tir.below / tir.total) * 100) : 0}%</div>
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

      {/* Heatmap + Box */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="col-span-3 p-3 border rounded bg-white">
          <div className="text-sm font-medium mb-2">Daily heatmap (avg {unitLabel})</div>

          {/* 2-row layout: Sun–Wed, then Thu–Sat */}
          <div className="text-xxs text-gray-500 mb-2">Each cell is avg of ~4-hour block.</div>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[0,1,2,3].map((dow) => (
                <HeatDay key={dow} dow={dow} row={heat[dow]} unit={unit} />
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[4,5,6].map((dow) => (
                <HeatDay key={dow} dow={dow} row={heat[dow]} unit={unit} />
              ))}
            </div>
          </div>
        </div>

        {/* Time-of-day stats (collapsible) */}
        <div className="col-span-1 p-3 border rounded bg-white text-xs">
          <div className="flex items-center justify-between">
            <div className="font-medium">Time-of-day stats</div>
            <CollapseBtn
              open={openTodStats}
              onClick={() => setOpenTodStats(o => !o)}
              titleOpen="Hide"
              titleClosed="Show"
              className="ml-2"
            />
          </div>

          <Collapse open={openTodStats}>
            {boxplotAvailable ? (
              <>
                <canvas ref={boxplotCanvasRef} aria-label="Boxplot" />
                <div className="text-xxs text-gray-500 mt-2">Boxplot by time-of-day (plugin installed).</div>
              </>
            ) : (
              <>
                {(['morning','midday','evening','night'] as const).map((bucket) => {
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
          </Collapse>
        </div>
      </div>

      {/* LIST (with notes + pagination) */}
      {view === 'list' ? (
        <div className="space-y-2">
          {inRangeRecords.length === 0 && <div className="text-xs text-gray-400">No glucose readings in selected range/filter.</div>}
          {paged.map((h) => {
            const flagged = isFlagged(h);
            return (
              <div key={h.id} className={cn('flex justify-between items-center p-2 border rounded bg-white', flagged && 'border-red-300 shadow-sm')}>
                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium">{inCurrentUnit(h)} {unitLabel}</div>
                    {flagged && <div className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">FLAG</div>}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(h.timestamp).toLocaleString()} • {h.testType}{h.fasting ? ' • Fasting' : ''} • strip {h.stripCode}
                  </div>
                  <RecordNote id={h.id} note={h.note} onSave={(id, note) => {
                    setHistory((list) => list.map(r => r.id === id ? { ...r, note } : r));
                    audit({ type: 'note_saved', id, note });
                  }}/>
                </div>

                <div className="text-xs text-gray-400 text-right">
                  <div>{h.shared ? 'Shared' : 'Private'}</div>
                  <div className="mt-2">
                    <button onClick={() => exportPdf('flagged')} className="px-2 py-1 border rounded text-xxs bg-white hover:bg-slate-50">Share PDF</button>
                  </div>
                </div>
              </div>
            );
          })}

          {inRangeRecords.length > PAGE_SIZE && (
            <div className="flex items-center justify-end gap-2 pt-2">
              <button disabled={page===1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="px-2 py-1 border rounded text-xs bg-white disabled:opacity-50">Prev</button>
              <div className="text-xs">Page {page} / {Math.ceil(inRangeRecords.length / PAGE_SIZE)}</div>
              <button disabled={page >= Math.ceil(inRangeRecords.length / PAGE_SIZE)} onClick={()=>setPage(p=>p+1)} className="px-2 py-1 border rounded text-xs bg-white disabled:opacity-50">Next</button>
            </div>
          )}
        </div>
      ) : null}

      {/* SR-only status text */}
      <div className="sr-only" aria-live="polite">{statusText}</div>
    </div>
  );
}

/* ---------- Small subcomponents & helpers ---------- */

function HeatDay({ dow, row, unit }:{ dow:number; row:(number|null)[]; unit:'mmol_l'|'mg_dl' }) {
  const label = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dow];
  const red = unit === 'mg_dl' ? 200 : mgdlToMmol(200);
  const amber = unit === 'mg_dl' ? 140 : mgdlToMmol(140);

  return (
    <div className="text-xxs">
      <div className="mb-1 font-medium">{label}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap:4 }}>
        {row.map((cell, bi) => {
          const v = cell;
          const color = v == null ? '#e5e7eb' : v > red ? '#ef4444' : v > amber ? '#f59e0b' : '#10b981';
          return (
            <div key={bi} title={v==null ? 'No data' : String(v)}
              style={{ background: color }}
              className="text-white text-xxs rounded p-1 text-center">
              {v==null? '—' : v}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecordNote({ id, note, onSave }:{ id:string; note?:string; onSave:(id:string, note:string)=>void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(note || '');

  useEffect(() => setDraft(note || ''), [note]);

  return (
    <>
      <div className="text-xs mt-1">
        {note
          ? <span className="italic text-gray-600">Note: {note}</span>
          : <button onClick={() => setOpen(true)} className="text-xxs underline">Add note</button>}
      </div>
      {open && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50" role="dialog" aria-modal="true">
          <div className="bg-white p-4 rounded shadow w-[420px]">
            <h4 className="font-medium">Edit note</h4>
            <textarea aria-label="Note" className="w-full p-2 border rounded h-32 mt-2" value={draft} onChange={(e)=>setDraft(e.target.value)} />
            <div className="flex justify-end gap-2 mt-3">
              <button onClick={()=>{ setOpen(false); setDraft(note || ''); }} className="px-3 py-1 border rounded text-sm">Cancel</button>
              <button onClick={()=>{ onSave(id, draft); setOpen(false); }} className="px-3 py-1 bg-indigo-600 text-white rounded">Save</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// CSV escaping
function csvEscape(cell: string) {
  return cell.includes(',') || cell.includes('"') || cell.includes('\n')
    ? `"${cell.replace(/"/g, '""')}"` : cell;
}

// Filter by dates (inclusive)
function filterByDate(records: GlucoseRecord[], from?: string, to?: string) {
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

// Linear regression slope (value/day)
function linearSlope(records: GlucoseRecord[], unit: 'mmol_l' | 'mg_dl') {
  if (!records.length) return 0;
  const xs = records.map(r => new Date(r.timestamp).getTime());
  const ys = records.map(r => r.unit === unit ? r.glucose : (unit === 'mg_dl' ? mmolToMgdl(r.glucose) : mgdlToMmol(r.glucose)));
  const n = xs.length;
  const xMean = xs.reduce((a,b)=>a+b,0)/n;
  const yMean = ys.reduce((a,b)=>a+b,0)/n;
  let num = 0, den = 0;
  for (let i=0; i<n; i++) { num += (xs[i]-xMean)*(ys[i]-yMean); den += (xs[i]-xMean)*(xs[i]-xMean); }
  const slope = den === 0 ? 0 : num/den; // per ms
  return slope * 1000 * 60 * 60 * 24;     // per day
}

// Rolling average over N days
function rollingAverage(records: GlucoseRecord[], unit: 'mmol_l' | 'mg_dl', days = 7) {
  if (!records.length) return null;
  const now = Date.now();
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  const inWindow = records.filter(r => new Date(r.timestamp).getTime() >= cutoff);
  if (!inWindow.length) return null;
  const vals = inWindow.map(r => r.unit === unit ? r.glucose : (unit === 'mg_dl' ? mmolToMgdl(r.glucose) : mgdlToMmol(r.glucose)));
  const avg = vals.reduce((a,b)=>a+b,0)/vals.length;
  return +avg.toFixed(1);
}

// Time-in-range
function calcTIR(records: GlucoseRecord[], unit: 'mmol_l' | 'mg_dl', low: number, fastHigh: number, nonFastHigh: number) {
  if (!records.length) return { inRange:0, above:0, below:0, total:0 };
  let inRangeVal = 0, above = 0, below = 0;
  for (const r of records) {
    const v = r.unit === unit ? r.glucose : (unit === 'mg_dl' ? mmolToMgdl(r.glucose) : mgdlToMmol(r.glucose));
    const high = r.fasting ? fastHigh : nonFastHigh;
    if (v < low) below++;
    else if (v >= high) above++;
    else inRangeVal++;
  }
  const total = records.length;
  return { inRange: inRangeVal, above, below, total };
}

// Heatmap summary: avg by day-of-week x 4h blocks
function heatmapSummary(records: GlucoseRecord[], unit: 'mmol_l' | 'mg_dl') {
  const buckets = Array.from({ length: 7 }, () => Array.from({ length: 6 }, () => [] as number[]));
  records.forEach(r => {
    const d = new Date(r.timestamp);
    const dow = d.getDay();
    const block = Math.floor(d.getHours() / 4);
    const val = r.unit === unit ? r.glucose : (unit === 'mg_dl' ? mmolToMgdl(r.glucose) : mgdlToMmol(r.glucose));
    buckets[dow][block].push(val);
  });
  return buckets.map(row => row.map(col => {
    if (!col.length) return null as number | null;
    const sum = col.reduce((a,b)=>a+b,0);
    return +(sum/col.length).toFixed(1);
  }));
}

// Box-like stats for time-of-day ranges
function boxStatsByBucket(records: GlucoseRecord[], unit: 'mmol_l' | 'mg_dl') {
  const buckets: Record<string, number[]> = { morning: [], midday: [], evening: [], night: [] };
  records.forEach(r => {
    const h = new Date(r.timestamp).getHours();
    const val = r.unit === unit ? r.glucose : (unit === 'mg_dl' ? mmolToMgdl(r.glucose) : mgdlToMmol(r.glucose));
    if (h >= 5 && h < 11) buckets.morning.push(val);
    else if (h >= 11 && h < 15) buckets.midday.push(val);
    else if (h >= 15 && h < 21) buckets.evening.push(val);
    else buckets.night.push(val);
  });
  function summary(arr: number[]) {
    if (!arr.length) return null as any;
    const sorted = arr.slice().sort((a,b)=>a-b);
    const n = sorted.length;
    const q1 = sorted[Math.floor((n - 1) * 0.25)];
    const med = sorted[Math.floor((n - 1) * 0.5)];
    const q3 = sorted[Math.floor((n - 1) * 0.75)];
    const min = sorted[0], max = sorted[sorted.length - 1];
    return { min, q1, med, q3, max };
  }
  return {
    morning: summary(buckets.morning),
    midday: summary(buckets.midday),
    evening: summary(buckets.evening),
    night: summary(buckets.night),
  };
}
