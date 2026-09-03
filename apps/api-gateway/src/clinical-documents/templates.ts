import { createHash } from 'node:crypto';
import { ClinicalPdf, hexToRgb, type Rgb, wrapText } from './pdf';
import {
  DEFAULT_CLINICAL_DOCUMENT_BRANDING,
  normalizeClinicalDocumentBranding,
  type ClinicalDocumentBranding,
} from './branding';

type Person = {
  name?: string | null;
  idNumber?: string | null;
  dob?: string | Date | null;
  mrn?: string | null;
  email?: string | null;
  phone?: string | null;
};

type Prescriber = {
  name?: string | null;
  regulator?: string | null;
  regulatorRegistration?: string | null;
  practiceNumber?: string | null;
  specialty?: string | null;
  email?: string | null;
  phone?: string | null;
};

type Medication = {
  name?: string | null;
  strength?: string | null;
  form?: string | null;
  directions?: string | null;
  quantity?: string | null;
  repeats?: number | string | null;
  duration?: string | null;
  code?: string | null;
  codeSystem?: string | null;
  note?: string | null;
};

type LabTest = {
  code?: string | null;
  name?: string | null;
  specimen?: string | null;
  priority?: string | null;
  fasting?: boolean | null;
  note?: string | null;
};

function clean(value: unknown, fallback = '', max = 2000) {
  const text = String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
  return text || fallback;
}

function displayDate(value: unknown, includeTime = false) {
  if (!value) return 'Not recorded';
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return clean(value, 'Not recorded', 80);
  try {
    return new Intl.DateTimeFormat('en-ZA', includeTime
      ? { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Johannesburg' }
      : { dateStyle: 'medium', timeZone: 'Africa/Johannesburg' }).format(d);
  } catch {
    return d.toISOString();
  }
}

function soft(accent: Rgb): Rgb {
  return accent.map((v) => 0.92 + v * 0.08) as Rgb;
}

function dark(accent: Rgb): Rgb {
  return accent.map((v) => Math.max(0, v * 0.72)) as Rgb;
}

function drawHeader(pdf: ClinicalPdf, brandInput: unknown, title: string, subtitle?: string) {
  const brand = normalizeClinicalDocumentBranding(brandInput || DEFAULT_CLINICAL_DOCUMENT_BRANDING);
  const accent = hexToRgb(brand.accentColor);
  pdf.logo(48, 26, 150, 56.25);
  pdf.text(title, 48, 96, { font: 'bold', size: 19, color: [0.06, 0.11, 0.18], maxWidth: 380 });
  if (subtitle) pdf.text(subtitle, 48, 121, { size: 9.5, color: [0.33, 0.39, 0.46], maxWidth: 430 });
  pdf.fillRect(48, 145, 499, 3, accent);
  return { brand, accent, top: 166 };
}

function drawFooter(pdf: ClinicalPdf, brand: ClinicalDocumentBranding, footer: string, pageLabel?: string) {
  const top = 748;
  pdf.line(48, top, 547, top, [0.82, 0.86, 0.89], 0.7);
  const contact = [brand.address, `Phone: ${brand.phone}`, `Email: ${brand.email}`].filter(Boolean).join('  |  ');
  pdf.text(contact, 48, top + 12, { size: 7.3, color: [0.30, 0.36, 0.42], maxWidth: 490, lineHeight: 9 });
  pdf.text(footer, 48, top + 31, { size: 7.3, color: [0.34, 0.40, 0.47], maxWidth: 490, lineHeight: 9 });
  if (pageLabel) pdf.text(pageLabel, 506, 817, { size: 7, color: [0.45, 0.48, 0.52], maxWidth: 40 });
}

function panel(pdf: ClinicalPdf, x: number, top: number, width: number, title: string, rows: Array<[string, unknown]>, accent: Rgb) {
  const visible = rows.filter(([, value]) => clean(value));
  const height = 36 + visible.length * 16;
  pdf.rect(x, top, width, height, [0.82, 0.87, 0.89], [0.99, 1, 1]);
  pdf.fillRect(x, top, width, 28, soft(accent));
  pdf.text(title, x + 12, top + 9, { font: 'bold', size: 10.5, color: dark(accent), maxWidth: width - 24 });
  let y = top + 38;
  for (const [label, value] of visible) {
    pdf.text(label, x + 12, y, { font: 'bold', size: 7.7, color: [0.38, 0.43, 0.49], maxWidth: 78 });
    pdf.text(clean(value), x + 92, y, { size: 8.7, color: [0.08, 0.12, 0.18], maxWidth: width - 104 });
    y += 16;
  }
  return top + height;
}

function ensureRoom(pdf: ClinicalPdf, top: number, needed: number, brand: ClinicalDocumentBranding, footer: string, title: string) {
  if (top + needed < 735) return top;
  drawFooter(pdf, brand, footer, `Page ${pdf.pageCount()}`);
  pdf.addPage();
  const accent = hexToRgb(brand.accentColor);
  pdf.logo(48, 28, 112, 42);
  pdf.text(title, 182, 38, { font: 'bold', size: 12, color: [0.08, 0.12, 0.18], maxWidth: 300 });
  pdf.fillRect(48, 84, 499, 2, accent);
  return 105;
}

export function renderPrescriptionPdf(input: {
  branding?: unknown;
  prescriptionId: string;
  status?: string | null;
  rxNumber?: string | null;
  issuedAt?: string | Date | null;
  patient?: Person | null;
  prescriber?: Prescriber | null;
  medications: Medication[];
  severeAllergyAlert?: string | null;
  signatureHash?: string | null;
  simulation?: boolean;
}) {
  const pdf = new ClinicalPdf();
  const { brand, accent, top: headerTop } = drawHeader(pdf, input.branding, 'Electronic prescription', 'Clinician-authored prescription generated from the encounter-linked Ambulant+ record.');
  const footer = brand.prescriptionFooter;
  let y = headerTop;

  pdf.rect(48, y, 499, 42, [0.80, 0.86, 0.88], [0.985, 0.997, 0.997]);
  const status = clean(input.status, 'Issued', 80);
  pdf.text(`Prescription ${clean(input.rxNumber || input.prescriptionId, input.prescriptionId, 100)}`, 60, y + 11, { font: 'bold', size: 10.5, color: [0.07, 0.12, 0.19], maxWidth: 205 });
  pdf.text(`Issued: ${displayDate(input.issuedAt, true)}`, 270, y + 11, { size: 8.7, color: [0.28, 0.34, 0.40], maxWidth: 150 });
  pdf.text(status, 440, y + 11, { font: 'bold', size: 8.7, color: dark(accent), maxWidth: 90 });
  if (input.simulation) pdf.text('SIMULATION - NOT VALID FOR DISPENSING', 60, y + 29, { font: 'bold', size: 8.2, color: [0.75, 0.10, 0.10], maxWidth: 350 });
  y += 54;

  const patient = input.patient || {};
  const prescriber = input.prescriber || {};
  const patientBottom = panel(pdf, 48, y, 242, 'Patient', [
    ['Full name', patient.name],
    ['ID number', patient.idNumber],
    ['Date of birth', patient.dob ? displayDate(patient.dob) : ''],
    ['MRN', patient.mrn],
  ], accent);
  const prescriberBottom = panel(pdf, 305, y, 242, 'Prescriber', [
    ['Name', prescriber.name],
    ['HPCSA no.', prescriber.regulatorRegistration],
    ['Practice no.', prescriber.practiceNumber],
    ['Specialty', prescriber.specialty],
    ['Contact', prescriber.phone],
  ], accent);
  y = Math.max(patientBottom, prescriberBottom) + 14;

  if (clean(input.severeAllergyAlert)) {
    const lines = wrapText(clean(input.severeAllergyAlert), 455, 8.8);
    const h = 24 + lines.length * 9;
    pdf.rect(48, y, 499, h, [0.90, 0.22, 0.22], [1, 0.975, 0.975], 0.9);
    pdf.text('Allergy alert', 60, y + 10, { font: 'bold', size: 9.2, color: [0.72, 0.08, 0.08], maxWidth: 90 });
    pdf.text(clean(input.severeAllergyAlert), 134, y + 10, { size: 8.7, color: [0.48, 0.07, 0.07], maxWidth: 400, lineHeight: 10 });
    y += h + 14;
  }

  pdf.text('Prescribed items', 48, y, { font: 'bold', size: 12.5, color: [0.07, 0.12, 0.19], maxWidth: 300 });
  y += 20;

  const meds = Array.isArray(input.medications) ? input.medications : [];
  for (let i = 0; i < meds.length; i += 1) {
    const med = meds[i] || {};
    const directions = clean(med.directions, 'Use as directed', 900);
    const medNote = clean(med.note, '', 600);
    const directionLines = wrapText(directions, 200, 8.3).length;
    const noteLines = medNote ? wrapText(medNote, 450, 7.7).length : 0;
    const height = Math.max(66, 52 + directionLines * 10 + (medNote ? 12 + noteLines * 9 : 0));
    y = ensureRoom(pdf, y, height + 10, brand, footer, 'Electronic prescription');
    pdf.rect(48, y, 499, height, [0.83, 0.88, 0.90], [1, 1, 1]);
    pdf.fillRect(48, y, 5, height, accent);
    pdf.text(`${i + 1}. ${clean(med.name, 'Medication', 240)}`, 65, y + 12, { font: 'bold', size: 10.3, color: [0.06, 0.11, 0.18], maxWidth: 250 });
    const sub = [clean(med.strength), clean(med.form), med.code ? `${clean(med.codeSystem, 'Code')}: ${clean(med.code)}` : ''].filter(Boolean).join('  |  ');
    if (sub) pdf.text(sub, 65, y + 30, { size: 7.7, color: [0.38, 0.43, 0.49], maxWidth: 250 });
    pdf.text('Directions', 330, y + 12, { font: 'bold', size: 7.8, color: dark(accent), maxWidth: 75 });
    pdf.text(directions, 330, y + 27, { size: 8.3, color: [0.10, 0.14, 0.20], maxWidth: 200, lineHeight: 10 });
    pdf.text(`Quantity: ${clean(med.quantity, 'Not recorded', 100)}`, 65, y + height - 24, { size: 7.8, color: [0.24, 0.29, 0.34], maxWidth: 150 });
    pdf.text(`Repeats: ${clean(med.repeats ?? 0, '0', 40)}`, 220, y + height - 24, { size: 7.8, color: [0.24, 0.29, 0.34], maxWidth: 110 });
    if (clean(med.duration)) pdf.text(`Duration: ${clean(med.duration)}`, 330, y + height - 24, { size: 7.8, color: [0.24, 0.29, 0.34], maxWidth: 190 });
    if (medNote) pdf.text(`Note: ${medNote}`, 65, y + height - 11, { size: 7.2, color: [0.35, 0.39, 0.44], maxWidth: 460 });
    y += height + 8;
  }

  y = ensureRoom(pdf, y, 68, brand, footer, 'Electronic prescription');
  const integrity = clean(input.signatureHash) || createHash('sha256').update(JSON.stringify({ id: input.prescriptionId, issuedAt: input.issuedAt, meds })).digest('hex');
  pdf.rect(48, y, 499, 54, [0.80, 0.86, 0.88], soft(accent));
  pdf.text('Digitally issued via Ambulant+', 62, y + 10, { font: 'bold', size: 9.2, color: dark(accent), maxWidth: 220 });
  pdf.text(`Clinical signature reference: SHA-256 ${integrity.slice(0, 12)}...${integrity.slice(-8)}`, 62, y + 27, { size: 7.3, color: [0.27, 0.32, 0.38], maxWidth: 300 });
  pdf.text(`Document reference: ${brand.verificationUrl}`, 62, y + 42, { size: 7.3, color: [0.27, 0.32, 0.38], maxWidth: 300 });
  if (prescriber.regulatorRegistration) pdf.text(`HPCSA: ${clean(prescriber.regulatorRegistration)}`, 380, y + 13, { font: 'bold', size: 7.7, color: [0.16, 0.28, 0.28], maxWidth: 145 });
  pdf.text('Ambulant+', 380, y + 31, { font: 'bold', size: 12.5, color: dark(accent), maxWidth: 145 });
  pdf.text(brand.serviceLine, 380, y + 44, { size: 6.8, color: [0.30, 0.36, 0.42], maxWidth: 145 });

  drawFooter(pdf, brand, footer, `Page ${pdf.pageCount()}`);
  return pdf.build();
}

export function renderLabRequisitionPdf(input: {
  branding?: unknown;
  orderId?: string | null;
  issuedAt?: string | Date | null;
  patient?: Person | null;
  prescriber?: Prescriber | null;
  tests: LabTest[];
  clinicalContext?: string | null;
  simulation?: boolean;
}) {
  const pdf = new ClinicalPdf();
  const { brand, accent, top: headerTop } = drawHeader(pdf, input.branding, 'Laboratory requisition', 'Investigation request issued through Ambulant+ Contactless Medicine.');
  const footer = brand.labFooter;
  let y = headerTop;
  const patient = input.patient || {};
  const prescriber = input.prescriber || {};

  pdf.rect(48, y, 499, 42, [0.82, 0.87, 0.89], [0.985, 0.997, 0.997]);
  pdf.text(`Order: ${clean(input.orderId, 'Preview')}`, 60, y + 10, { font: 'bold', size: 9, maxWidth: 210 });
  pdf.text(`Issued: ${displayDate(input.issuedAt || new Date(), true)}`, 300, y + 10, { size: 8.2, color: [0.31, 0.36, 0.42], maxWidth: 200 });
  if (input.simulation) pdf.text('SIMULATION - NOT FOR CLINICAL FULFILMENT', 60, y + 26, { font: 'bold', size: 7.8, color: [0.75, 0.10, 0.10], maxWidth: 300 });
  y += 56;

  const pb = panel(pdf, 48, y, 242, 'Patient', [
    ['Full name', patient.name],
    ['ID number', patient.idNumber],
    ['Date of birth', patient.dob ? displayDate(patient.dob) : ''],
    ['MRN', patient.mrn],
  ], accent);
  const cb = panel(pdf, 305, y, 242, 'Requesting clinician', [
    ['Name', prescriber.name],
    ['HPCSA no.', prescriber.regulatorRegistration],
    ['Practice no.', prescriber.practiceNumber],
    ['Contact', prescriber.phone],
  ], accent);
  y = Math.max(pb, cb) + 16;

  if (clean(input.clinicalContext)) {
    pdf.rect(48, y, 499, 54, [0.84, 0.88, 0.90], [0.99, 0.99, 0.995]);
    pdf.text('Relevant clinical context', 60, y + 10, { font: 'bold', size: 8.5, color: [0.20, 0.25, 0.31], maxWidth: 130 });
    pdf.text(clean(input.clinicalContext), 60, y + 27, { size: 8, color: [0.20, 0.25, 0.31], maxWidth: 470, lineHeight: 9.8 });
    y += 68;
  }

  pdf.text('Requested investigations', 48, y, { font: 'bold', size: 12.5, maxWidth: 250 });
  y += 25;
  const tests = Array.isArray(input.tests) ? input.tests : [];
  for (let i = 0; i < tests.length; i += 1) {
    const test = tests[i] || {};
    const height = clean(test.note) ? 64 : 50;
    y = ensureRoom(pdf, y, height + 12, brand, footer, 'Laboratory requisition');
    pdf.rect(48, y, 499, height, [0.84, 0.88, 0.90], [1, 1, 1]);
    pdf.fillRect(48, y, 5, height, accent);
    pdf.text(`${i + 1}. ${clean(test.name, 'Investigation')}`, 64, y + 11, { font: 'bold', size: 9.5, maxWidth: 280 });
    const details = [test.code ? `Code: ${clean(test.code)}` : '', `Specimen: ${clean(test.specimen, 'As required')}`, `Priority: ${clean(test.priority, 'Routine')}`, test.fasting ? 'Fasting: Yes' : 'Fasting: No'].filter(Boolean).join('  |  ');
    pdf.text(details, 64, y + 29, { size: 7.5, color: [0.34, 0.39, 0.44], maxWidth: 455 });
    if (clean(test.note)) pdf.text(`Clinical note: ${clean(test.note)}`, 64, y + 44, { size: 7.4, color: [0.30, 0.35, 0.40], maxWidth: 455 });
    y += height + 10;
  }

  y = ensureRoom(pdf, y, 76, brand, footer, 'Laboratory requisition');
  pdf.rect(48, y, 499, 58, [0.83, 0.88, 0.90], soft(accent));
  pdf.text('Clinical authority', 60, y + 11, { font: 'bold', size: 8.5, color: dark(accent), maxWidth: 100 });
  pdf.text(`Issued by ${clean(prescriber.name, 'Ambulant+ clinician')} through Ambulant+ Contactless Medicine.`, 60, y + 29, { size: 7.8, color: [0.28, 0.33, 0.39], maxWidth: 455 });
  drawFooter(pdf, brand, footer, `Page ${pdf.pageCount()}`);
  return pdf.build();
}

export function renderMedicalCertificatePdf(input: {
  branding?: unknown;
  certificateType: 'sick' | 'fitness';
  issuedAt?: string | Date | null;
  patient?: Person | null;
  prescriber?: Prescriber | null;
  durationDays?: number | null;
  notes?: string | null;
  plan?: string | null;
  simulation?: boolean;
}) {
  const title = input.certificateType === 'sick' ? 'Medical certificate / sick note' : 'Fitness for work certificate';
  const subtitle = input.certificateType === 'sick'
    ? 'Clinical certificate of temporary incapacity following consultation.'
    : 'Clinical fitness statement following consultation.';
  const pdf = new ClinicalPdf();
  const { brand, accent, top: headerTop } = drawHeader(pdf, input.branding, title, subtitle);
  const footer = brand.certificateFooter;
  let y = headerTop;
  const patient = input.patient || {};
  const prescriber = input.prescriber || {};

  if (input.simulation) {
    pdf.rect(48, y, 499, 34, [0.90, 0.22, 0.22], [1, 0.975, 0.975]);
    pdf.text('SIMULATION - NOT A VALID CLINICAL CERTIFICATE', 60, y + 10, { font: 'bold', size: 8.5, color: [0.72, 0.08, 0.08], maxWidth: 380 });
    y += 48;
  }

  const pb = panel(pdf, 48, y, 242, 'Patient', [
    ['Full name', patient.name],
    ['ID number', patient.idNumber],
    ['Date of birth', patient.dob ? displayDate(patient.dob) : ''],
  ], accent);
  const cb = panel(pdf, 305, y, 242, 'Clinician', [
    ['Name', prescriber.name],
    ['HPCSA no.', prescriber.regulatorRegistration],
    ['Practice no.', prescriber.practiceNumber],
    ['Contact', prescriber.phone],
  ], accent);
  y = Math.max(pb, cb) + 24;

  pdf.text('Certification', 48, y, { font: 'bold', size: 12, maxWidth: 180 });
  y += 23;
  const duration = Math.max(0, Math.round(Number(input.durationDays || 0)));
  const statement = input.certificateType === 'sick'
    ? `This is to certify that ${clean(patient.name, 'the patient')} was assessed during a clinical consultation and is medically unfit for work for ${duration} day${duration === 1 ? '' : 's'}.`
    : `This is to certify that ${clean(patient.name, 'the patient')} was assessed during a clinical consultation. The fitness statement below reflects the clinician's assessment at the time of review.`;
  y = pdf.text(statement, 48, y, { size: 10, color: [0.12, 0.16, 0.22], maxWidth: 499, lineHeight: 14 });

  if (clean(input.plan)) {
    y += 12;
    pdf.text('Recommendations', 48, y, { font: 'bold', size: 10, maxWidth: 180 });
    y += 18;
    y = pdf.text(clean(input.plan), 48, y, { size: 9, maxWidth: 499, lineHeight: 12 });
  }
  if (clean(input.notes)) {
    y += 12;
    pdf.text('Additional clinical note', 48, y, { font: 'bold', size: 10, maxWidth: 180 });
    y += 18;
    y = pdf.text(clean(input.notes), 48, y, { size: 9, maxWidth: 499, lineHeight: 12 });
  }

  y = Math.max(y + 32, 610);
  pdf.line(48, y, 300, y, [0.55, 0.60, 0.64], 0.8);
  pdf.text(clean(prescriber.name, 'Clinician'), 48, y + 12, { font: 'bold', size: 9, maxWidth: 250 });
  if (clean(prescriber.regulatorRegistration)) pdf.text(`HPCSA: ${clean(prescriber.regulatorRegistration)}`, 48, y + 29, { size: 8, color: [0.34, 0.39, 0.44], maxWidth: 250 });
  pdf.text(`Issued: ${displayDate(input.issuedAt || new Date(), true)}`, 340, y + 12, { size: 8, color: [0.34, 0.39, 0.44], maxWidth: 190 });
  drawFooter(pdf, brand, footer, `Page ${pdf.pageCount()}`);
  return pdf.build();
}
