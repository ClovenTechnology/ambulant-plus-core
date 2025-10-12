// apps/patient-app/src/analytics/reports/sleepReport.ts
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import Chart from 'chart.js/auto';
import { loadHistory } from '../history';

/**
 * Render Sleep Report
 * Based on NexRing data: Awake, REM, Light, Deep
 */
export async function renderSleepReport(doc: jsPDF) {
  const sleepHistory =
    (await loadHistory('duecare.nexring', 'sleep').catch(() => [])) as Array<
      { data: { awake: number; rem: number; light: number; deep: number; efficiency?: number }; timestamp: string }
    >;

  doc.addPage();
  doc.setFontSize(14);
  doc.text('Sleep Summary', 14, 20);

  if (!sleepHistory.length) {
    doc.setFontSize(11);
    doc.text('No recent sleep data available.', 14, 30);
    return;
  }

  // --- Summary Table --------------------------------------------------------
  const rows = sleepHistory
    .slice(-7)
    .map((r) => [
      new Date(r.timestamp).toISOString().slice(0, 10),
      `${(r.data.awake / 60).toFixed(1)}h`,
      `${(r.data.rem / 60).toFixed(1)}h`,
      `${(r.data.light / 60).toFixed(1)}h`,
      `${(r.data.deep / 60).toFixed(1)}h`,
      `${r.data.efficiency ?? ''}%`,
    ]);

  autoTable(doc, {
    startY: 30,
    head: [['Date', 'Awake', 'REM', 'Light', 'Deep', 'Efficiency']],
    body: rows,
    styles: { fontSize: 10 },
  });

  const after = (doc as any).lastAutoTable?.finalY ?? 46;

  // --- Stacked Bar Chart ----------------------------------------------------
  const last7 = sleepHistory.slice(-7);
  const labels = last7.map((r) => new Date(r.timestamp).toISOString().slice(5, 10));

  const datasets = [
    {
      label: 'Awake',
      data: last7.map((r) => r.data.awake),
      backgroundColor: '#bdc3c7',
    },
    {
      label: 'REM',
      data: last7.map((r) => r.data.rem),
      backgroundColor: '#1abc9c',
    },
    {
      label: 'Light',
      data: last7.map((r) => r.data.light),
      backgroundColor: '#3498db',
    },
    {
      label: 'Deep',
      data: last7.map((r) => r.data.deep),
      backgroundColor: '#2c3e50',
    },
  ];

  const canvas = document.createElement('canvas');
  new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: false,
      animation: false,
      plugins: { legend: { position: 'top' } },
      scales: {
        x: { stacked: true, title: { display: true, text: 'Date' } },
        y: { stacked: true, title: { display: true, text: 'Minutes' } },
      },
    },
  });

  const imgData = canvas.toDataURL('image/png');
  doc.addImage(imgData, 'PNG', 14, after + 10, 180, 80);
}
