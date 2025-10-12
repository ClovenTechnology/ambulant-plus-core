// apps/clinician-app/components/MedicalDocs.tsx
'use client';

import React from 'react';
import {
  Page,
  Text,
  View,
  Document,
  StyleSheet,
  Image,
  Svg,
  Path,
  pdf,
  Font,
} from '@react-pdf/renderer';
import QRCode from 'qrcode';

// Register a pleasant readable font (best-effort; remote may fail — fall back to Helvetica)
try {
  Font.register({
    family: 'Inter',
    fonts: [
      { src: 'https://rsms.me/inter/font-files/Inter-Regular.woff2', fontWeight: 'normal' },
      { src: 'https://rsms.me/inter/font-files/Inter-SemiBold.woff2', fontWeight: '600' },
    ],
  });
} catch (e) {
  // ignore if network restricted — renderer will fall back
  // console.warn('[MedicalDocs] Font.register failed', e);
}

// ---------------- Styles ----------------
const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 11, fontFamily: 'Inter' },
  header: { textAlign: 'center', marginBottom: 10 },
  logo: { width: 64, height: 64, marginBottom: 8, alignSelf: 'center' },
  clinicName: { fontSize: 16, fontWeight: '600', color: '#0f172a' },
  docTitle: { fontSize: 13, fontWeight: '600', marginTop: 6, color: '#0f172a' },
  section: { marginBottom: 12 },
  label: { fontSize: 10, color: '#374151' },
  text: { marginBottom: 4, fontSize: 11, color: '#111827' },
  signature: { marginTop: 20, textAlign: 'right' },
  sigLine: { borderTopWidth: 1, borderColor: '#111827', width: 220, alignSelf: 'flex-end', marginBottom: 6 },
  footer: { fontSize: 9, textAlign: 'center', marginTop: 18, color: '#6b7280' },

  // table / vitals
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingBottom: 6, marginBottom: 6 },
  tableCell: { flex: 1, fontSize: 10, color: '#374151' },
  row: { flexDirection: 'row', marginBottom: 3 },

  // chart
  chartWrap: { marginTop: 8, marginBottom: 6 },
  chartLegend: { flexDirection: 'row', gap: 8, marginTop: 6, marginBottom: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendSwatch: { width: 10, height: 8, borderRadius: 1 },

  qrWrap: { marginTop: 14, alignItems: 'center' },
  qrImage: { width: 96, height: 96, marginBottom: 6 },
  metaRow: { flexDirection: 'row', gap: 12, marginTop: 6 },
  smallMuted: { fontSize: 9, color: '#6b7280' },
});

// ---------------- Types ----------------
export type DocType = 'sick' | 'fitness';

export interface FitnessVitals {
  date: string; // ISO
  bp?: string;
  pulse?: number;
  temp?: number;
}

export interface MedicalDocProps {
  type: DocType;
  patientName: string;
  patientId?: string;
  clinicianName: string;
  clinicianReg?: string; // clinician registration / practice number
  clinicName?: string;
  clinicLogoUrl?: string;
  clinicAddress?: string;
  date?: string; // ISO or human
  notes?: string;
  plan?: string;
  durationDays?: number; // For Sick Note
  testsPerformed?: { test: string; priority?: string; specimen?: string; icd?: string; instructions?: string }[]; // lab rows
  vitals?: FitnessVitals[]; // fitness certificate
  consultations?: number;
  signatureDataUrl?: string; // optional clinician signature image data URL
  verificationDataUrl?: string; // optional provided QR data URL (overrides auto gen)
}

// ---------------- Helpers ----------------
function prettyDate(d?: string) {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    return dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return d;
  }
}

/**
 * Smooth Catmull-Rom -> Bezier converter for nicer curves.
 * Returns an SVG path string given numeric values.
 */
function smoothPath(values: number[], w: number, h: number, pad = 6) {
  if (!values || values.length === 0) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const len = values.length;
  const step = len > 1 ? (w - pad * 2) / (len - 1) : 0;

  const pts = values.map((v, i) => {
    const x = pad + i * step;
    const y = pad + (1 - (v - min) / range) * (h - pad * 2);
    return [x, y];
  });

  if (pts.length === 1) return `M ${pts[0][0]} ${pts[0][1]}`;

  const d: string[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1] || pts[i];
    const p3 = pts[i + 2] || p2;

    if (i === 0) {
      d.push(`M ${p1[0].toFixed(2)} ${p1[1].toFixed(2)}`);
    }

    // control points (Catmull-Rom to Bezier)
    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;

    d.push(`C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`);
    // continue — the loop builds all segments
  }
  return d.join(' ');
}

function numericArray(arr: (number | undefined | null)[]) {
  return arr.map((v) => (typeof v === 'number' ? v : NaN)).filter(Number.isFinite);
}

// ---------------- Document component ----------------
export const MedicalDocPDF: React.FC<MedicalDocProps> = (props) => {
  const {
    type,
    patientName,
    patientId,
    clinicianName,
    clinicianReg,
    clinicName = 'Ambulant+ Center',
    clinicLogoUrl,
    clinicAddress,
    date,
    notes,
    plan,
    durationDays = 0,
    testsPerformed = [],
    vitals = [],
    consultations = 0,
    signatureDataUrl,
    verificationDataUrl,
  } = props;

  const printedDate = date ?? new Date().toISOString();

  // sort ascending
  const sortedVitals = (vitals || []).slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const pulseVals = numericArray(sortedVitals.map((v) => v.pulse));
  const tempVals = numericArray(sortedVitals.map((v) => v.temp));
  const chartW = 320;
  const chartH = 72;
  const pulsePath = pulseVals.length ? smoothPath(pulseVals, chartW, chartH) : '';
  const tempPath = tempVals.length ? smoothPath(tempVals, chartW, chartH) : '';

  // Provide small legend color choices
  const pulseColor = '#2563eb'; // blue
  const tempColor = '#ef4444'; // red

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          {clinicLogoUrl && <Image src={clinicLogoUrl} style={styles.logo} />}
          <Text style={styles.clinicName}>{clinicName}</Text>
          {clinicAddress ? <Text style={styles.smallMuted as any}>{clinicAddress}</Text> : null}
          <Text style={styles.docTitle}>{type === 'sick' ? 'Medical Sick Note' : 'Fitness for Work Certificate'}</Text>
        </View>

        {/* Patient / meta */}
        <View style={styles.section}>
          <Text style={styles.label}>Patient</Text>
          <Text style={styles.text}><Text style={{ fontWeight: '600' }}>{patientName}</Text>{patientId ? (<Text style={{ fontSize: 10 }}> / {patientId}</Text>) : null}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.text}><Text style={{ fontWeight: '600' }}>Date:</Text> {prettyDate(printedDate)}</Text>
            <Text style={styles.text}><Text style={{ fontWeight: '600' }}>Clinician:</Text> {clinicianName}{clinicianReg ? ` (Reg: ${clinicianReg})` : ''}</Text>
          </View>
        </View>

        {/* Core sections */}
        <View style={styles.section}>
          {type === 'sick' ? (
            <>
              <Text style={{ fontSize: 12, fontWeight: '600', marginBottom: 6 }}>Sick Note</Text>
              <Text style={styles.text}>
                This is to certify that <Text style={{ fontWeight: '600' }}>{patientName}</Text> was assessed by the clinician and is medically unfit for work for a period of <Text style={{ fontWeight: '600' }}>{durationDays} day{durationDays !== 1 ? 's' : ''}</Text>.
              </Text>

              {plan && <Text style={{ fontWeight: '600', marginTop: 6 }}>Treatment Plan / Recommendations</Text>}
              {plan && <Text style={styles.text}>{plan}</Text>}
              {notes && <Text style={{ fontWeight: '600', marginTop: 6 }}>Additional Notes</Text>}
              {notes && <Text style={styles.text}>{notes}</Text>}
            </>
          ) : (
            <>
              <Text style={{ fontSize: 12, fontWeight: '600', marginBottom: 6 }}>Fitness for Work</Text>
              <Text style={styles.text}>Patient assessed and deemed fit with the findings summarized below.</Text>

              {/* tests */}
              {testsPerformed && testsPerformed.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  <Text style={{ fontSize: 11, fontWeight: '600' }}>Tests Performed / Ordered</Text>
                  {testsPerformed.map((t, i) => (
                    <Text key={i} style={styles.text}>• {typeof t === 'string' ? t : (t.test || '')}{/* if passed as objects, adapt accordingly */}</Text>
                  ))}
                </View>
              )}

              <Text style={{ fontSize: 11, fontWeight: '600', marginTop: 8 }}>Consultations</Text>
              <Text style={styles.text}>{consultations ?? 0} session(s)</Text>

              {/* vitals table */}
              {sortedVitals.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  <Text style={{ fontSize: 11, fontWeight: '600' }}>Vitals (recent)</Text>
                  <View style={styles.tableHeader}>
                    <Text style={styles.tableCell}>Date</Text>
                    <Text style={styles.tableCell}>BP</Text>
                    <Text style={styles.tableCell}>Pulse</Text>
                    <Text style={styles.tableCell}>Temp</Text>
                  </View>
                  {sortedVitals.slice().reverse().map((v, i) => (
                    <View key={i} style={styles.row}>
                      <Text style={styles.tableCell}>{prettyDate(v.date)}</Text>
                      <Text style={styles.tableCell}>{v.bp ?? '—'}</Text>
                      <Text style={styles.tableCell}>{v.pulse != null ? String(v.pulse) : '—'}</Text>
                      <Text style={styles.tableCell}>{v.temp != null ? String(v.temp) : '—'}</Text>
                    </View>
                  ))}

                  {/* legend */}
                  <View style={styles.chartLegend}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendSwatch, { backgroundColor: pulseColor }]} />
                      <Text style={{ fontSize: 10 }}>Pulse (bpm)</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendSwatch, { backgroundColor: tempColor }]} />
                      <Text style={{ fontSize: 10 }}>Temperature (°C)</Text>
                    </View>
                  </View>

                  {/* chart with smooth curves (overlay) */}
                  <View style={styles.chartWrap}>
                    <Svg width={chartW} height={chartH}>
                      {/* baseline */}
                      <Path d={`M0 ${chartH - 1} L ${chartW} ${chartH - 1}`} stroke="#e5e7eb" strokeWidth={1} />
                      {/* temp (red) beneath with slight opacity */}
                      {tempPath ? <Path d={tempPath} stroke={tempColor} strokeWidth={2} fill="none" /> : null}
                      {/* pulse (blue) overlaid */}
                      {pulsePath ? <Path d={pulsePath} stroke={pulseColor} strokeWidth={2} fill="none" /> : null}
                    </Svg>
                  </View>
                </View>
              )}

              {plan && <Text style={{ fontWeight: '600', marginTop: 6 }}>Treatment Plan / Recommendations</Text>}
              {plan && <Text style={styles.text}>{plan}</Text>}
              {notes && <Text style={{ fontWeight: '600', marginTop: 6 }}>Additional Notes</Text>}
              {notes && <Text style={styles.text}>{notes}</Text>}
            </>
          )}
        </View>

        {/* Signature / stamp */}
        <View style={styles.signature}>
          {signatureDataUrl ? <Image src={signatureDataUrl} style={{ width: 160, height: 48, alignSelf: 'flex-end', marginBottom: 6 }} /> : null}
          <Text>{clinicianName}</Text>
          {clinicianReg && <Text style={{ fontSize: 9, color: '#6b7280' }}>Reg No: {clinicianReg}</Text>}
          <View style={styles.sigLine} />
          <Text style={{ fontSize: 10 }}>Clinician</Text>
        </View>

        {/* QR */}
        {verificationDataUrl ? (
          <View style={styles.qrWrap}>
            <Image style={styles.qrImage} src={verificationDataUrl} />
            <Text style={{ fontSize: 9, color: '#6b7280' }}>Scan to verify</Text>
          </View>
        ) : null}

        <Text style={styles.footer}>Report generated from Ambulant+ Center</Text>
      </Page>
    </Document>
  );
};

// ---------------- Programmatic PDF Generation ----------------
/**
 * generatePdfBlob:
 * - accepts MedicalDocProps
 * - attempts to generate a QR (data URL) using 'qrcode' package
 * - creates the react-pdf Document and returns a Blob
 */
export const generatePdfBlob = async (props: MedicalDocProps): Promise<Blob> => {
  // try to create a verification payload (JSON) and convert to data url
  const payload = {
    clinic: props.clinicName || 'Ambulant+ Center',
    patient: props.patientName,
    patientId: props.patientId,
    date: props.date || new Date().toISOString(),
    type: props.type,
    clinician: props.clinicianName,
  };

  let verificationDataUrl = props.verificationDataUrl || '';
  try {
    // prefer qrcode.toDataURL (no DOM dependency)
    verificationDataUrl = await QRCode.toDataURL(JSON.stringify(payload));
    // console.debug('[MedicalDocs] QR generated length', verificationDataUrl.length);
  } catch (err) {
    // fallback to Google Charts QR if qrcode fails
    try {
      const short = encodeURIComponent(JSON.stringify(payload));
      verificationDataUrl = `https://chart.googleapis.com/chart?cht=qr&chs=200x200&chl=${short}&chld=L|1`;
    } catch (e) {
      verificationDataUrl = '';
    }
  }

  // attach computed verificationDataUrl into props passed to the Document
  const doc = <MedicalDocPDF {...props} verificationDataUrl={verificationDataUrl} />;

  const asPdf = pdf([]); // create pdf instance
  try {
    asPdf.updateContainer(doc);
  } catch (e) {
    console.error('[MedicalDocs] updateContainer failed', e);
    throw e;
  }

  try {
    const blob = await asPdf.toBlob();
    // console.debug('[MedicalDocs] toBlob success, size:', blob.size);
    return blob;
  } catch (e) {
    console.error('[MedicalDocs] toBlob failed — runtime may be missing browser APIs or react-pdf incompatible version', e);
    throw e;
  }
};

export default MedicalDocPDF;
