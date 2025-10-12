// ============================================================================
// apps/patient-app/src/analytics/reports/antenatalReport.ts
// Extends with Labs & Vaccines checklist section.
// ============================================================================
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  loadAntenatalPrefs, loadAntenatalLogs, buildVisitSchedule, gestationalAge, trimester,
} from '@/src/analytics/antenatal';
import { buildChecklist, loadChecklistDone, statusFor } from '@/src/analytics/antenatal';

export async function renderAntenatalReport(doc: jsPDF) {
  const prefs = loadAntenatalPrefs();
  const logs = loadAntenatalLogs();

  doc.addPage();
  doc.setFontSize(16); doc.text('Antenatal Summary', 14, 20);
  doc.setFontSize(10); doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 27);

  if (!prefs?.edd) { doc.setFontSize(11); doc.text('No EDD set. Open Antenatal Center → Setup to configure.', 14, 40); return; }

  const edd = prefs.edd;
  const ga = gestationalAge(new Date().toISOString().slice(0,10), edd);
  const tri = trimester(ga.weeks);
  let y = 40;

  doc.setFontSize(12); doc.text('Overview', 14, y);
  doc.setFontSize(10);
  doc.text(`EDD: ${edd}`, 14, y += 7);
  doc.text(`Gestational age: ${ga.weeks}w ${ga.days}d (Trimester ${tri})`, 14, y += 6);
  if (prefs.gravida != null || prefs.para != null) doc.text(`Gravida/Para: ${prefs.gravida ?? '-'} / ${prefs.para ?? '-'}`, 14, y += 6);

  const last = logs.slice(-5);
  if (last.length) {
    y += 8; doc.setFontSize(12); doc.text('Recent Vitals', 14, y); doc.setFontSize(10);
    autoTable(doc, {
      startY: y + 4,
      head: [['Date', 'BP (mmHg)', 'Weight (kg)', 'Fetal Movements', 'Notes']],
      body: last.map(l => [l.date, l.bpSys && l.bpDia ? `${l.bpSys}/${l.bpDia}` : '—', l.weightKg != null ? l.weightKg.toFixed(1) : '—', l.fetalMovements ?? '—', l.notes ? (l.notes.length > 40 ? l.notes.slice(0, 37) + '…' : l.notes) : '' ]),
      styles: { fontSize: 8 },
    });
    y = (doc as any).lastAutoTable.finalY;
  }

  const schedule = buildVisitSchedule(edd);
  y += 10; doc.setFontSize(12); doc.text('Planned Visits', 14, y); doc.setFontSize(10);
  autoTable(doc, { startY: y + 4, head: [['Date', 'Visit', 'Purpose']], body: schedule.map(v => [v.date, v.label, v.purpose]), styles: { fontSize: 8 }, columnStyles: { 2: { cellWidth: 120 } } });
  y = (doc as any).lastAutoTable.finalY;

  // Labs & Vaccines
  const done = loadChecklistDone();
  const checklist = buildChecklist(edd);
  y += 10; doc.setFontSize(12); doc.text('Labs & Vaccines', 14, y); doc.setFontSize(10);
  autoTable(doc, {
    startY: y + 4,
    head: [['Type', 'Name', 'Window', 'Due', 'Status']],
    body: checklist.map(it => {
      const st = statusFor(it, done, new Date().toISOString().slice(0,10));
      const window = `${it.startDate.slice(5)}–${it.endDate.slice(5)}`;
      return [it.kind, it.name, window, it.dueDate, st.toUpperCase()];
    }),
    styles: { fontSize: 8 },
  });
  y = (doc as any).lastAutoTable.finalY;

  // Disclaimer
  doc.setFontSize(9); doc.setTextColor(180, 0, 0);
  doc.text('Informational only. Follow local protocols and clinician judgment.', 14, y + 10);
  doc.setTextColor(0, 0, 0);
}
