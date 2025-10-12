// ============================================================================
// apps/patient-app/src/analytics/report.ts  (augment: add antenatalHandoff flag)
// ============================================================================
import { jsPDF } from 'jspdf';
import { renderHealthMonitorReport } from './reports/healthMonitorReport';
import { renderSleepReport } from './reports/sleepReport';
import { renderFertilityReport } from './reports/fertilityReport';
import { renderStressReport } from './reports/stressReport';
import { renderAntenatalReport } from './reports/antenatalReport';
import { renderAntenatalHandoff } from './reports/antenatalHandoff';

export async function generateHealthReport(
  userId: string,
  sections: { bp?: boolean; sleep?: boolean; fertility?: boolean; stress?: boolean; antenatal?: boolean; antenatalHandoff?: boolean } = {}
): Promise<{ blob: Blob; filename: string }> {
  const doc = new jsPDF();
  doc.setFontSize(18); doc.text(`Health Report for ${userId}`, 14, 20);
  doc.setFontSize(11); doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);

  const wantsAll = !sections || Object.keys(sections).length === 0 || !Object.values(sections).some(Boolean);

  if (wantsAll || sections.bp) await renderHealthMonitorReport(doc);
  if (wantsAll || sections.sleep) await renderSleepReport(doc);
  if (wantsAll || sections.fertility) await renderFertilityReport(doc);
  if (wantsAll || sections.stress) await renderStressReport(doc);
  if (wantsAll || sections.antenatal) await renderAntenatalReport(doc);
  if (sections.antenatalHandoff) await renderAntenatalHandoff(doc);

  const blob = doc.output('blob');
  return { blob, filename: `health_report_${userId}_${Date.now()}.pdf` };
}
