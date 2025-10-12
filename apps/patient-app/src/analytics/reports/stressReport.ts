// apps/patient-app/src/analytics/reports/stressReport.ts
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import Chart from 'chart.js/auto';
import { loadHistory } from '../history';
import { stressIndex } from '../stress';

/**
 * Render Stress & HRV Report (ASCII-only labels for PDF text)
 */
export async function renderStressReport(doc: jsPDF) {
  const stressHistory =
    (await loadHistory('duecare.nexring', 'stress').catch(() => [])) as Array<
      { data: { value: number }; timestamp: string }
    >;

  doc.addPage();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Stress and HRV', 14, 20);

  if (!stressHistory.length) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.text('No recent stress data available.', 14, 30);
    return;
  }

  const scores = stressHistory.map((r) => r.data.value).filter((n) => Number.isFinite(n));
  const idx = scores.length ? stressIndex(scores) : undefined;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`Average Stress Index${typeof idx === 'number' ? `: ${idx}` : ''}`, 14, 30);

  // Recent scores table
  autoTable(doc, {
    startY: 36,
    head: [['Date', 'Stress Score']],
    body: stressHistory
      .slice(-10)
      .map((r) => [new Date(r.timestamp).toISOString().slice(0, 10), String(r.data.value)]),
    styles: { fontSize: 10 },
  });

  const after = (doc as any).lastAutoTable?.finalY ?? 46;

  // Line chart of last 30 days
  const last30 = stressHistory.slice(-30);
  const labels = last30.map((r) => new Date(r.timestamp).toISOString().slice(5, 10)); // MM-DD
  const values = last30.map((r) => r.data.value);

  const canvas = document.createElement('canvas');
  new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Stress Score',
          data: values,
          borderColor: '#e67e22',
          backgroundColor: 'rgba(230, 126, 34, 0.2)',
          fill: true,
          tension: 0.3,
        },
      ],
    },
    options: {
      responsive: false,
      animation: false,
      plugins: { legend: { display: true } },
      scales: {
        y: { title: { display: true, text: 'Stress Index' } },
        x: { title: { display: true, text: 'Date' } },
      },
    },
  });

  const imgData = canvas.toDataURL('image/png');
  doc.addImage(imgData, 'PNG', 14, after + 10, 180, 80);
}
