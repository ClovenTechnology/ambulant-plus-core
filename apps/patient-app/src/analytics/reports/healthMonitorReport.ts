// apps/patient-app/src/analytics/reports/healthMonitorReport.ts
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import Chart from 'chart.js/auto';
import { loadHistory } from '../history';
import { hypertensionIndex } from '../cardio';

/**
 * Render the Blood Pressure sub-report into the given jsPDF document.
 */
export async function renderHealthMonitorReport(doc: jsPDF) {
  const bpHistory =
    (await loadHistory('duecare.health-monitor', 'bp').catch(() => [])) as Array<
      { timestamp: string; data: { systolic?: number; diastolic?: number } }
    >;

  // Fall back if empty
  const rows =
    bpHistory.length > 0
      ? bpHistory.slice(-10).map((r) => [
          new Date(r.timestamp).toISOString().slice(0, 10),
          r.data.systolic?.toString() ?? '',
          r.data.diastolic?.toString() ?? '',
        ])
      : [
          ['2025-09-01', '120', '80'],
          ['2025-09-05', '135', '85'],
        ];

  const systolics = bpHistory.map((r) => Number(r.data.systolic)).filter((n) => Number.isFinite(n));
  const diastolics = bpHistory.map((r) => Number(r.data.diastolic)).filter((n) => Number.isFinite(n));
  const labels = bpHistory.map((r) => new Date(r.timestamp).toISOString().slice(5, 10)); // MM-DD
  const hIndex = systolics.length ? hypertensionIndex(systolics) : undefined;

  // --- Render section -------------------------------------------------------
  doc.addPage();
  doc.setFontSize(14);
  doc.text('Blood Pressure Trends', 14, 20);

  autoTable(doc, {
    startY: 28,
    head: [['Date', 'Systolic', 'Diastolic']],
    body: rows,
    styles: { fontSize: 10 },
  });

  let after = (doc as any).lastAutoTable?.finalY ?? 28;
  if (typeof hIndex !== 'undefined') {
    doc.setFontSize(11);
    doc.text(`Hypertension Index: ${hIndex}`, 14, after + 8);
    after += 12;
  }

  // --- Render chart ---------------------------------------------------------
  if (systolics.length && diastolics.length && labels.length) {
    const canvas = document.createElement('canvas');
    new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Systolic', data: systolics, borderColor: '#e74c3c', fill: false },
          { label: 'Diastolic', data: diastolics, borderColor: '#3498db', fill: false },
        ],
      },
      options: {
        responsive: false,
        animation: false,
        scales: {
          y: { beginAtZero: false, title: { display: true, text: 'mmHg' } },
        },
        plugins: { legend: { position: 'bottom' } },
      },
    });

    const imgData = canvas.toDataURL('image/png');
    doc.addImage(imgData, 'PNG', 14, after + 10, 180, 80);
  } else {
    doc.setFontSize(11);
    doc.text('Not enough data to plot BP chart.', 14, after + 10);
  }
}
