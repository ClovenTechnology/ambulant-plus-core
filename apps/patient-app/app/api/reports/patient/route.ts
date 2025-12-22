import { NextRequest } from 'next/server';
import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, pdf } from '@react-pdf/renderer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Optional font registration (safe to ignore if blocked in your env)
try {
  Font.register({
    family: 'Inter',
    fonts: [
      { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHu.woff', fontWeight: 400 },
      { src: 'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHh.woff', fontWeight: 600 },
    ],
  });
} catch { /* ignore font failures */ }

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 11, fontFamily: 'Inter' },
  h1: { fontSize: 18, marginBottom: 4, fontWeight: 600 },
  meta: { color: '#475569', marginBottom: 8 },
  card: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 10, marginTop: 10 },
  chipWrap: { flexDirection: 'row', marginTop: 6 } as any,
  chip: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 999,
    paddingHorizontal: 6, paddingVertical: 2, fontSize: 10, marginRight: 6,
  },
  sectionTitle: { fontSize: 13, fontWeight: 600, marginBottom: 6 },
  sign: { marginTop: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#cbd5e1', color: '#475569' },
});

type Body = {
  fromDate?: string;
  toDate?: string;
  sections?: Record<string, boolean>;
  signOff?: boolean;
  clinicianName?: string;
  clinicianSignatureDataUrl?: string;
  patientId?: string;
};

export async function POST(req: NextRequest) {
  let body: Body | null = null;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  const {
    fromDate = '',
    toDate = '',
    sections = {},
    signOff = true,
    clinicianName = '',
    patientId = '—',
  } = body || {};

  const chips: string[] = [];
  if (sections.glucose) chips.push('Glucose');
  if (sections.bp) chips.push('Blood Pressure');
  if (sections.spo2) chips.push('SpO₂');
  if (sections.temp) chips.push('Temperature');
  if (sections.hr) chips.push('Heart Rate');
  if (sections.ecg) chips.push('ECG');

  // Build PDF using React.createElement (no JSX)
  const chipNodes = chips.map((c) =>
    React.createElement(Text, { key: c, style: styles.chip }, c),
  );

  const nodes: React.ReactNode[] = [];

  // Header
  nodes.push(
    React.createElement(
      View,
      { key: 'header' },
      React.createElement(Text, { style: styles.h1 }, 'Ambulant+ Patient Report'),
      React.createElement(
        Text,
        { style: styles.meta },
        `Period: ${fromDate || '—'} → ${toDate || '—'} • Generated: ${new Date().toLocaleString()}`
      ),
      React.createElement(View, { style: styles.chipWrap }, ...chipNodes),
    )
  );

  // Patient card
  nodes.push(
    React.createElement(
      View,
      { key: 'patient', style: styles.card },
      React.createElement(Text, { style: styles.sectionTitle }, 'Patient'),
      React.createElement(Text, null, `ID: ${patientId}`),
    )
  );

  // Sections (conditionally)
  if (sections.demographics) {
    nodes.push(
      React.createElement(
        View,
        { key: 'demo', style: styles.card },
        React.createElement(Text, { style: styles.sectionTitle }, 'Demographics'),
        React.createElement(Text, null, 'Address: —'),
        React.createElement(Text, null, 'Phone: —'),
      )
    );
  }

  if (sections.glucose) {
    nodes.push(
      React.createElement(
        View,
        { key: 'glu', style: styles.card },
        React.createElement(Text, { style: styles.sectionTitle }, 'Glucose'),
        React.createElement(Text, null, 'See Glucose module export for detail.'),
      )
    );
  }

  if (sections.bp) {
    nodes.push(
      React.createElement(
        View,
        { key: 'bp', style: styles.card },
        React.createElement(Text, { style: styles.sectionTitle }, 'Blood Pressure'),
        React.createElement(Text, null, 'Systolic/Diastolic trends summary.'),
      )
    );
  }

  if (sections.spo2) {
    nodes.push(
      React.createElement(
        View,
        { key: 'spo2', style: styles.card },
        React.createElement(Text, { style: styles.sectionTitle }, 'SpO₂'),
        React.createElement(Text, null, 'Resting saturation and pulse.'),
      )
    );
  }

  if (sections.temp) {
    nodes.push(
      React.createElement(
        View,
        { key: 'temp', style: styles.card },
        React.createElement(Text, { style: styles.sectionTitle }, 'Temperature'),
        React.createElement(Text, null, 'Recent body temperature readings.'),
      )
    );
  }

  if (sections.hr) {
    nodes.push(
      React.createElement(
        View,
        { key: 'hr', style: styles.card },
        React.createElement(Text, { style: styles.sectionTitle }, 'Heart Rate'),
        React.createElement(Text, null, 'Resting HR and variability (if available).'),
      )
    );
  }

  if (sections.ecg) {
    nodes.push(
      React.createElement(
        View,
        { key: 'ecg', style: styles.card },
        React.createElement(Text, { style: styles.sectionTitle }, 'ECG'),
        React.createElement(Text, null, 'Session summaries and flags.'),
      )
    );
  }

  if (signOff) {
    nodes.push(
      React.createElement(
        View,
        { key: 'sign', style: styles.sign },
        React.createElement(Text, { style: { fontWeight: 600 } as any }, 'Clinician Sign-off'),
        React.createElement(Text, null, `Clinician: ${clinicianName || '_________________________'}`),
        React.createElement(Text, null, 'Date: _______________________'),
        React.createElement(Text, null, 'Signature: ___________________'),
      )
    );
  }

  const doc = React.createElement(
    Document,
    null,
    React.createElement(Page, { size: 'A4', style: styles.page }, ...nodes),
  );

  const buf = await pdf(doc).toBuffer();
  return new Response(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="ambulant-patient-report.pdf"',
      'Cache-Control': 'no-store',
    },
  });
}
