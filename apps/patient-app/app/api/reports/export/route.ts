import { NextRequest } from 'next/server';
import React from 'react';
import { Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';

import {
  patientGatewayHeaders,
  readPatientGatewayIdentity,
  type PatientGatewayIdentity,
} from '@/src/lib/gateway-identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 11, fontFamily: 'Helvetica', color: '#0f172a' },
  h1: { fontSize: 18, marginBottom: 4, fontWeight: 700 },
  meta: { color: '#475569', marginBottom: 8 },
  card: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  sectionTitle: { fontSize: 13, marginBottom: 6, fontWeight: 700 },
  line: { marginTop: 3, lineHeight: 1.35 },
  footer: {
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    color: '#475569',
  },
});

type Body = {
  kind?: string;
};

function safeText(value: unknown, fallback = '—', max = 1000) {
  const text = String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
  return text || fallback;
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

function listSection(
  key: string,
  title: string,
  items: any[],
  render: (item: any, index: number) => React.ReactNode,
) {
  return section(key, title, items.length ? items.slice(0, 40).map(render) : []);
}

async function fetchAuthenticatedRecordsBundle(
  req: NextRequest,
  identity: PatientGatewayIdentity,
) {
  const res = await fetch(`${req.nextUrl.origin}/api/medical-records`, {
    method: 'GET',
    cache: 'no-store',
    headers: patientGatewayHeaders({ req, identity }),
  });

  const payload = await res.json().catch(() => null);
  if (!res.ok || !payload?.ok) {
    throw new Error(payload?.error || 'medical_records_unavailable');
  }

  return payload;
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
        `Generated: ${new Date().toLocaleString()} • Source: authenticated patient medical records`,
      ),
    ),
    section('patient', 'Patient', [
      infoLine('Name', patient.displayName || patient.name, 'name'),
      infoLine('Date of birth', patient.dob, 'dob'),
      infoLine('Sex', patient.sex, 'sex'),
      infoLine('Last updated', bundle?.updatedAt, 'updated'),
    ]),
    listSection('encounters', 'Encounters', encounters, (item, index) =>
      textLine(
        `${index + 1}. ${safeText(item.reason, 'Encounter')} — ${safeText(item.clinicianName, 'Clinician')} — ${safeText(item.date)}${item.summary ? ` — ${safeText(item.summary, '', 240)}` : ''}`,
        `enc_${index}`,
      ),
    ),
    listSection('medications', 'Medications', medications, (item, index) =>
      textLine(
        `${index + 1}. ${safeText(item.name)} — ${safeText(item.dose, '')} ${safeText(item.frequency, '')} — Status: ${safeText(item.status)}`,
        `med_${index}`,
      ),
    ),
    listSection('allergies', 'Allergies', allergies, (item, index) =>
      textLine(
        `${index + 1}. ${safeText(item.allergen)} — Reaction: ${safeText(item.reaction)} — Severity: ${safeText(item.severity)}`,
        `alg_${index}`,
      ),
    ),
    listSection('laboratory', 'Laboratory results and orders', labs, (item, index) =>
      textLine(
        `${index + 1}. ${safeText(item.test)} — ${safeText(item.value)} ${safeText(item.unit, '')} — ${safeText(item.date)}`,
        `lab_${index}`,
      ),
    ),
    listSection('documents', 'Documents', docs, (item, index) =>
      textLine(
        `${index + 1}. ${safeText(item.title)} — ${safeText(item.type)} — ${safeText(item.date)}`,
        `doc_${index}`,
      ),
    ),
    React.createElement(
      View,
      { key: 'footer', style: styles.footer },
      textLine('Privacy notice', 'footer_title'),
      textLine(
        'This pack is generated from the authenticated patient record. Internal patient, user and record identifiers are intentionally omitted from the shareable projection.',
        'footer_body',
      ),
    ),
  ];

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
      'Content-Disposition': `attachment; filename="ambulant-health-records-${Date.now()}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
}

export async function POST(req: NextRequest) {
  const identity = await readPatientGatewayIdentity(req);
  if (!identity) {
    return new Response('Authentication required', { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response('Bad JSON', { status: 400 });
  }

  try {
    if (body?.kind === 'medical-records') {
      const bundle = await fetchAuthenticatedRecordsBundle(req, identity);
      return renderMedicalRecordsPdf(bundle);
    }

    return new Response(
      JSON.stringify({
        ok: false,
        error: 'legacy_report_export_route_retired',
        canonical: '/api/reports/sleep',
      }),
      {
        status: 410,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (error: any) {
    console.error('[patient-app][reports/export] failed', error);
    return new Response(error?.message || 'report_export_failed', { status: 500 });
  }
}
