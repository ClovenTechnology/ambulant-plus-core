// ============================================================================
// apps/patient-app/src/analytics/reports/antenatalHandoff.ts
// One-page provider handoff PDF.
// ============================================================================
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { loadAntenatalPrefs, loadAntenatalLogs, gestationalAge, trimester } from '@/src/analytics/antenatal';
import { loadChecklistDone, buildChecklist, statusFor } from '@/src/analytics/antenatal';

export async function renderAntenatalHandoff(doc: jsPDF) {
  const prefs = loadAntenatalPrefs();
  const logs = loadAntenatalLogs();

  doc.addPage();
  doc.setFontSize(16); doc.text('Antenatal Handoff (Provider Summary)', 14, 20);
  doc.setFontSize(10); doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 27);

  if (!prefs?.edd) { doc.setFontSize(11); doc.text('EDD missing.', 14, 40); return; }

  // Overview
  const edd = prefs.edd;
  const ga = gestationalAge(new Date().toISOString().slice(0,10), edd);
  const tri = trimester(ga.weeks);
  doc.setFontSize(11);
  doc.text(`EDD: ${edd} | GA: ${ga.weeks}w ${ga.days}d (T${tri}) | G/P: ${prefs.gravida ?? '-'} / ${prefs.para ?? '-'}`, 14, 42);

  // Last vitals
  const last = logs.slice(-1)[0];
  let bp = '—'; if (last?.bpSys && last?.bpDia) bp = `${last.bpSys}/${last.bpDia} mmHg`;
  const wt = (last?.weightKg != null) ? `${last.weightKg.toFixed(1)} kg` : '—';
  const fm = (last?.fetalMovements != null) ? String(last.fetalMovements) : '—';
  doc.text(`Last vitals: BP ${bp} | Weight ${wt} | Fetal movement ${fm}`, 14, 52);
  if (last?.notes) doc.text(`Notes: ${last.notes.slice(0, 90)}`, 14, 58);

  // Labs/Vaccines snapshot
  const done = loadChecklistDone();
  const list = buildChecklist(edd).map(it => {
    const st = statusFor(it, done, new Date().toISOString().slice(0,10));
    return [it.name, `${it.startDate}–${it.endDate}`, st.toUpperCase()];
  });
  autoTable(doc, { startY: 64, head: [['Item', 'Window', 'Status']], body: list, styles: { fontSize: 8 } });

  // Actionables
  let y = (doc as any).lastAutoTable?.finalY ?? 110;
  doc.setFontSize(11); doc.text('Actionables', 14, (y += 10));
  doc.setFontSize(10);
  const actions = [
    'Confirm upcoming visits and outstanding labs/vaccines.',
    'Review BP trend; evaluate if ≥ 140/90.',
    'Reinforce kick counting and warning signs.',
  ];
  actions.forEach((a, i)=> doc.text(`• ${a}`, 14, (y += 6)));
  doc.setFontSize(9); doc.setTextColor(180,0,0);
  doc.text('This summary is patient-reported + device-derived; verify in clinical record.', 14, y + 10);
  doc.setTextColor(0,0,0);
}
