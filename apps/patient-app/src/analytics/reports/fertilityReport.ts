import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadHistory } from '../history';
import { getFertilityStatus } from '../fertility';
import { loadUserFertilityPrefs } from '../../screens/FertilitySetup';

/**
 * Enhanced Fertility Report
 * Integrates IoMT analytics + manual event logs
 */
export async function renderFertilityReport(doc: jsPDF) {
  const prefs = loadUserFertilityPrefs();

  // --- Load IoMT histories -------------------------------------------------
  const tempHistory =
    (await loadHistory('duecare.nexring', 'finger_temp_var').catch(() => [])) as Array<{
      data: { value: number };
      timestamp: string;
    }>;

  const hrvHistory =
    (await loadHistory('duecare.nexring', 'hrv').catch(() => [])) as Array<{
      data: { value: number };
      timestamp: string;
    }>;

  const rhrHistory =
    (await loadHistory('duecare.nexring', 'rhr').catch(() => [])) as Array<{
      data: { value: number };
      timestamp: string;
    }>;

  // --- Load manual logs ----------------------------------------------------
  let dayLogs: Record<
    string,
    { date: string; period?: boolean; ovulation?: boolean; meds?: string; notes?: string }
  > = {};

  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('fertilityDayLogs');
    if (saved) dayLogs = JSON.parse(saved);
  }

  doc.addPage();
  doc.setFontSize(14);
  doc.text('Fertility Prediction', 14, 20);

  if (!tempHistory.length) {
    doc.setFontSize(11);
    doc.text('No temperature variation data available.', 14, 30);
    return;
  }

  // --- Prepare analytics data ----------------------------------------------
  const baseline = 36.5;
  const last30 = tempHistory.slice(-30);
  const temps = last30.map((r) => r.data.value);

  const hrvs = hrvHistory.slice(-30).map((r) => r.data.value);
  const rhrs = rhrHistory.slice(-30).map((r) => r.data.value);

  const days = last30.map((r, i) => {
    const date = new Date(r.timestamp).toISOString().slice(0, 10);
    const delta = r.data.value - baseline;

    const log = dayLogs[date];
    const status = getFertilityStatus(temps.slice(0, i + 1), hrvs.slice(0, i + 1), rhrs.slice(0, i + 1), baseline, log);

    return {
      date,
      deltaTemp: delta,
      phase: log?.period
        ? 'period'
        : log?.ovulation
        ? 'ovulation'
        : status?.phase ?? 'follicular',
      fertileWindow: false,
      confidence: status?.confidence ?? 0,
      manual: !!log,
    };
  });

  // --- Determine fertile window (±5 days before ovulation) -----------------
  const ovIdx = days.findIndex((d) => d.phase === 'ovulation');
  if (ovIdx !== -1) {
    for (let i = Math.max(0, ovIdx - 5); i <= ovIdx; i++) {
      if (days[i]) days[i].fertileWindow = true;
    }
  }

  // --- Chart: temp variation -----------------------------------------------
  const chartX = 14,
    chartY = 40,
    chartW = 180,
    chartH = 50;
  const minVal = Math.min(...temps, baseline - 0.3);
  const maxVal = Math.max(...temps, baseline + 0.6);

  doc.setDrawColor(0);
  doc.line(chartX, chartY, chartX, chartY + chartH);
  doc.line(chartX, chartY + chartH, chartX + chartW, chartY + chartH);

  // Baseline line
  const baseY = chartY + chartH - ((baseline - minVal) / (maxVal - minVal)) * chartH;
  doc.setDrawColor(200, 0, 0);
  doc.setLineDash([1, 2], 0);
  doc.line(chartX, baseY, chartX + chartW, baseY);
  doc.setLineDash([], 0);
  doc.setFontSize(8);
  doc.text('Baseline', chartX + chartW - 20, baseY - 2);

  // Temp line
  doc.setDrawColor(0, 0, 200);
  doc.setLineWidth(0.5);
  temps.forEach((t, i) => {
    if (i === 0) return;
    const x1 = chartX + ((i - 1) / (temps.length - 1)) * chartW;
    const x2 = chartX + (i / (temps.length - 1)) * chartW;
    const y1 = chartY + chartH - ((temps[i - 1] - minVal) / (maxVal - minVal)) * chartH;
    const y2 = chartY + chartH - ((t - minVal) / (maxVal - minVal)) * chartH;
    doc.line(x1, y1, x2, y2);
  });

  // Ovulation marker (⭐ manual or auto)
  if (ovIdx !== -1) {
    const ovX = chartX + (ovIdx / (temps.length - 1)) * chartW;
    const ovY = chartY + chartH - ((temps[ovIdx] - minVal) / (maxVal - minVal)) * chartH;
    doc.setFontSize(12);
    doc.setTextColor(255, 140, 0);
    doc.text('★', ovX, ovY - 2);
    doc.setTextColor(0, 0, 0);
  }

  // --- Calendar grid -------------------------------------------------------
  const rows: string[][] = [];
  let week: string[] = [];
  days.forEach((d, idx) => {
    let cell = `${d.date.slice(5)}`;

    if (d.manual) {
      if (d.phase === 'period') cell = `💧 ${d.date.slice(5)}`;
      if (d.phase === 'ovulation') cell = `⭐ ${d.date.slice(5)}`;
    } else {
      if (d.fertileWindow) cell = `🌿 ${d.date.slice(5)}`;
      else if (d.phase === 'period') cell = `💧 ${d.date.slice(5)}`;
      else if (d.phase === 'luteal') cell = `🔴 ${d.date.slice(5)}`;
      else if (d.phase === 'follicular') cell = `🟦 ${d.date.slice(5)}`;
    }

    week.push(cell);
    if ((idx + 1) % 7 === 0) {
      rows.push(week);
      week = [];
    }
  });
  if (week.length) rows.push(week);

  autoTable(doc, {
    startY: chartY + chartH + 20,
    head: [['Cycle Calendar (last 30 days)']],
    body: rows,
    styles: { fontSize: 8, halign: 'center', cellPadding: 2 },
  });

  // --- Disclaimer ----------------------------------------------------------
  const after = (doc as any).lastAutoTable?.finalY ?? chartY + chartH + 40;
  doc.setFontSize(9);
  doc.setTextColor(180, 0, 0);
  doc.text(
    '⚠ Predictions improve after 14 days of continuous wear and confirmed events (period, ovulation).',
    14,
    after + 10
  );

  if (prefs?.lmp && prefs?.cycleDays) {
    doc.text(`User baseline: LMP=${prefs.lmp}, cycle=${prefs.cycleDays} days`, 14, after + 18);
  }

  doc.setTextColor(0, 0, 0);
}
