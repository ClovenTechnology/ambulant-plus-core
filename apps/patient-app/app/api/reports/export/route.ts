import { NextRequest } from 'next/server';
import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, pdf } from '@react-pdf/renderer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

try {
  Font.register({
    family: 'Inter',
    fonts: [
      { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHu.woff', fontWeight: 400 },
      { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHh.woff', fontWeight: 600 },
    ],
  });
} catch {
  // ignore font failures
}

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 11, fontFamily: 'Inter', color: '#0f172a' },
  h1: { fontSize: 18, marginBottom: 4, fontWeight: 600 },
  meta: { color: '#475569', marginBottom: 8 },
  card: { border: '1 solid #e2e8f0', borderRadius: 10, padding: 12, marginTop: 10 },
  sectionTitle: { fontSize: 13, marginBottom: 6, fontWeight: 600 },
  line: { marginTop: 3, lineHeight: 1.35 },
  footer: { marginTop: 14, paddingTop: 10, borderTop: '1 solid #e2e8f0', color: '#475569' },
});

type Body = {
  kind?: string;
  fromDate?: string;
  toDate?: string;
  sections?: Record<string, boolean>;
  signOff?: boolean;
  clinicianName?: string;
  clinicianSignatureDataUrl?: string;
  patientId?: string;
  medicalRecordsBundle?: any;
};

function safeText(value: unknown, fallback = '—', max = 1000) {
  const s = String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
  return s || fallback;
}

function sameOriginBase(req: NextRequest) {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

function forwardHeaders(req: NextRequest) {
  const headers = new Headers();
  const cookie = req.headers.get('cookie');
  if (cookie) headers.set('cookie', cookie);
  headers.set('accept', 'application/json');
  return headers;
}

async function fetchMedicalRecordsBundle(req: NextRequest) {
  const res = await fetch(`${sameOriginBase(req)}/api/medical-records`, {
    method: 'GET',
    cache: 'no-store',
    headers: forwardHeaders(req),
  });

  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload?.ok) {
    throw new Error(payload?.error || 'medical_records_unavailable');
  }

  return payload;
}

function textLine(value: string, key?: string) {
  return React.createElement(Text, { key, style: styles.line }, value);
}

function infoLine(label: string, value: unknown, key?: string) {
  return textLine(`${label}: ${safeText(value)}`, key);
}

function section(key: string, title: string, rows: React.ReactNode[]) {
  return React.createElement(
    View,
    { key, style: styles.card },
    React.createElement(Text, { style: styles.sectionTitle }, title),
    ...(rows.length ? rows : [textLine('No records available.', 'empty')]),
  );
}

function listSection(key: string, title: string, items: any[], render: (item: any, index: number) => React.ReactNode) {
  return section(key, title, items.length ? items.slice(0, 40).map(render) : []);
}

async function renderMedicalRecordsPdf(bundle: any) {
  const patient = bundle?.patient || {};
  const encounters = Array.isArray(bundle?.encounters) ? bundle.encounters : [];
  const medications = Array.isArray(bundle?.medications) ? bundle.medications : [];
  const allergies = Array.isArray(bundle?.allergies) ? bundle.allergies : [];
  const docs = Array.isArray(bundle?.docs) ? bundle.docs : [];
  const labs = Array.isArray(bundle?.labs) ? bundle.labs : [];

  const nodes: React.ReactNode[] = [
    React.createElement(
      View,
      { key: 'header' },
      React.createElement(Text, { style: styles.h1 }, 'Ambulant+ Health Records Pack'),
      React.createElement(
        Text,
        { style: styles.meta },
        `Generated: ${new Date().toLocaleString()} • Source: live patient medical records`,
      ),
    ),
    section('patient', 'Patient', [
      infoLine('Name', patient.displayName || patient.name, 'name'),
      infoLine('Patient ID', patient.id, 'id'),
      infoLine('MRN', patient.mrn, 'mrn'),
      infoLine('Date of birth', patient.dob, 'dob'),
      infoLine('Sex', patient.sex, 'sex'),
      infoLine('Last updated', bundle?.updatedAt, 'updated'),
    ]),
    listSection('encounters', 'Encounters', encounters, (item, index) =>
      textLine(
        `${index + 1}. ${safeText(item.reason, 'Encounter')} — ${safeText(item.clinicianName, 'Clinician')} ${item.specialty ? `(${safeText(item.specialty)})` : ''} — ${safeText(item.date)}${item.summary ? ` — ${safeText(item.summary, '', 240)}` : ''}`,
        `enc_${item.id || index}`,
      ),
    ),
    listSection('medications', 'Medications', medications, (item, index) =>
      textLine(
        `${index + 1}. ${safeText(item.name)} — ${safeText(item.dose, '')} ${safeText(item.frequency, '')} — Status: ${safeText(item.status)}`,
        `med_${item.id || index}`,
      ),
    ),
    listSection('allergies', 'Allergies', allergies, (item, index) =>
      textLine(
        `${index + 1}. ${safeText(item.allergen)} — Reaction: ${safeText(item.reaction)} — Severity: ${safeText(item.severity)}`,
        `alg_${item.id || index}`,
      ),
    ),
    listSection('laboratory', 'Laboratory results and orders', labs, (item, index) =>
      textLine(
        `${index + 1}. ${safeText(item.test)} — ${safeText(item.value)} ${safeText(item.unit, '')} — ${safeText(item.panel, 'Lab')} — ${safeText(item.date)}${item.flag ? ` — Flag: ${safeText(item.flag)}` : ''}`,
        `lab_${item.id || index}`,
      ),
    ),
    listSection('documents', 'Documents', docs, (item, index) =>
      textLine(
        `${index + 1}. ${safeText(item.title)} — ${safeText(item.type)} — ${safeText(item.source)} — ${safeText(item.date)}${item.fileName ? ` — ${safeText(item.fileName)}` : ''}`,
        `doc_${item.id || index}`,
      ),
    ),
    React.createElement(
      View,
      { key: 'footer', style: styles.footer },
      textLine('Privacy notice', 'footer_title'),
      textLine('This pack is generated from the patient’s Ambulant+ record. Share only with trusted recipients. Source documents may require separate download from the Documents section.', 'footer_body'),
    ),
  ];

  const doc = React.createElement(
    Document,
    null,
    React.createElement(Page, { size: 'A4', style: styles.page }, ...nodes),
  );

  const blob = await pdf(doc).toBlob();
  const patientId = safeText(patient.id, 'patient').replace(/[^a-zA-Z0-9_-]/g, '_');

  return new Response(blob, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="ambulant-health-records-${patientId}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}

async function renderLegacyPatientReport(body: Body) {
  const {
    fromDate = '',
    toDate = '',
    sections = {},
    signOff = true,
    clinicianName = '',
    patientId = '—',
  } = body || {};

  const chips: string[] = [];
  if (sections.bp) chips.push('Blood Pressure');
  if (sections.spo2) chips.push('SpO2');
  if (sections.temp) chips.push('Temperature');
  if (sections.hr) chips.push('Heart Rate');
  if (sections.ecg) chips.push('ECG');

  const nodes: React.ReactNode[] = [
    React.createElement(Text, { key: 'title', style: styles.h1 }, 'Ambulant+ Patient Report'),
    React.createElement(Text, { key: 'meta', style: styles.meta }, `Generated ${new Date().toLocaleString()}`),
    section('summary', 'Summary', [
      infoLine('Patient ID', patientId, 'patient'),
      infoLine('From', fromDate || 'Not specified', 'from'),
      infoLine('To', toDate || 'Not specified', 'to'),
      infoLine('Sections', chips.length ? chips.join(', ') : 'No sections selected', 'sections'),
    ]),
  ];

  if (signOff) {
    nodes.push(
      section('signoff', 'Clinical sign-off', [
        infoLine('Clinician', clinicianName || '_________________________', 'clinician'),
        infoLine('Date', new Date().toLocaleDateString(), 'date'),
      ]),
    );
  }

  const doc = React.createElement(
    Document,
    null,
    React.createElement(Page, { size: 'A4', style: styles.page }, ...nodes),
  );

  const blob = await pdf(doc).toBlob();

  return new Response(blob, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="ambulant-patient-report.pdf"',
      'Cache-Control': 'no-store',
    },
  });
}

export async function POST(req: NextRequest) {
  let body: Body | null = null;

  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  try {
    if (body?.kind === 'medical-records' || body?.medicalRecordsBundle?.ok) {
      const bundle = body?.medicalRecordsBundle?.ok ? body.medicalRecordsBundle : await fetchMedicalRecordsBundle(req);
      return renderMedicalRecordsPdf(bundle);
    }

    return renderLegacyPatientReport(body || {});
  } catch (error: any) {
    console.error('[patient-app][reports/export] failed', error);
    return new Response(error?.message || 'report_export_failed', { status: 500 });
  }
}
