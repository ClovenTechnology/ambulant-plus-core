// apps/clinician-app/app/api/training/certificate/route.ts
import React from 'react';
import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'stream';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToStream,
} from '@react-pdf/renderer';


export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type JsonObj = Record<string, any>;

const CERTIFICATE_ISSUER =
  process.env.CERTIFICATE_ISSUER ||
  'Cloven Technology Impilo';

const CERTIFICATE_PROGRAMME =
  process.env.CERTIFICATE_PROGRAMME ||
  'Ambulant+ Contactless Medicine - Clinician Onboarding & Practice Readiness Programme';

const CERTIFICATE_INSTITUTION =
  process.env.CERTIFICATE_INSTITUTION ||
  'Cloven Technology Impilo';

const FRAMEWORK_SUPPORT =
  process.env.CERTIFICATE_FRAMEWORK_SUPPORT ||
  'Executive College, SA';

const E = React.createElement;

function gatewayBase() {
  return String(
    process.env.API_GATEWAY_URL ||
      process.env.API_GATEWAY_BASE_URL ||
      process.env.NEXT_PUBLIC_API_GATEWAY_URL ||
      process.env.APIGW_BASE ||
      process.env.GATEWAY_URL ||
      'https://api-gateway.ambulantplus.co.za',
  ).replace(/\/+$/, '');
}

function apiHeaders(req: NextRequest) {
  const cookie = req.headers.get('cookie') || '';
  const headers: Record<string, string> = {
    accept: 'application/json',
  };

  if (cookie) headers.cookie = cookie;

  return headers;
}

function cleanStr(v: unknown, max = 500): string {
  const s = String(v ?? '').trim();
  if (!s) return '';
  return s.length > max ? s.slice(0, max) : s;
}

function safeObject(value: unknown): JsonObj {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as JsonObj;

  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function formatDate(value?: unknown) {
  if (!value) return '-';

  const d = new Date(String(value));
  if (!Number.isFinite(d.getTime())) return '-';

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

function formatDateRange(start?: unknown, end?: unknown) {
  const a = formatDate(start);
  const b = formatDate(end);

  if (a === '-' && b === '-') return '-';
  if (a === b || b === '-') return a;
  return `${a} - ${b}`;
}

function trainingRoomIdForSlot(slotId?: string | null) {
  const clean = cleanStr(slotId, 200);
  if (!clean) return '';
  return clean.startsWith('training-slot-') ? clean : `training-slot-${clean}`;
}

function baseUrl(req: NextRequest) {
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host =
    req.headers.get('x-forwarded-host') ||
    req.headers.get('host') ||
    'clinician.ambulantplus.co.za';

  return `${proto}://${host}`;
}

function certificateVerifyUrl(req: NextRequest, certificateNumber: string) {
  return `${baseUrl(req)}/certificates/verify/${encodeURIComponent(certificateNumber)}`;
}

function extractCertificate(rawProfile: JsonObj, clinician: any) {
  const training = safeObject(rawProfile.training);
  const trainingCertificate = safeObject(rawProfile.trainingCertificate);

  const additionalQualifications = Array.isArray(rawProfile.additionalQualifications)
    ? rawProfile.additionalQualifications
    : [];

  const qualification =
    additionalQualifications.find(
      (q: any) =>
        cleanStr(q?.degree) === 'Ambulant+ Mandatory Clinician Training',
    ) || {};

  const certificateNumber =
    cleanStr(training.certificateNumber) ||
    cleanStr(trainingCertificate.certificateNumber) ||
    cleanStr(qualification.certificateNumber) ||
    cleanStr(clinician?.boardCertificateNumber) ||
    '';

  const completedAt =
    cleanStr(training.completedAt) ||
    cleanStr(trainingCertificate.completedAt) ||
    cleanStr(trainingCertificate.issuedAt) ||
    cleanStr(qualification.completedAt) ||
    '';

  const institution =
    cleanStr(trainingCertificate.institution) ||
    CERTIFICATE_INSTITUTION;

  const trainingSlotId =
    cleanStr(training.trainingSlotId) ||
    cleanStr(trainingCertificate.trainingSlotId) ||
    '';

  return {
    certificateNumber,
    completedAt,
    institution,
    trainingSlotId,
  };
}

function drawDataRow(label: string, value: string) {
  return E(
    View,
    { style: styles.dataRow },
    E(Text, { style: styles.dataLabel }, label),
    E(Text, { style: styles.dataValue }, value || '-'),
  );
}

function createCertificatePdf(data: any) {
  const verifyUrl = data.verifyUrl || '-';

  return E(
    Document,
    {
      title: `Ambulant+ Certificate - ${data.certificateNumber || data.clinicianName}`,
      author: CERTIFICATE_ISSUER,
      subject: CERTIFICATE_PROGRAMME,
      keywords: 'Ambulant+, Contactless Medicine, Telehealth, IoMT, Clinician Training',
      creator: 'Ambulant+',
      producer: 'Ambulant+ Certificate Service',
    },
    E(
      Page,
      { size: 'A4', orientation: 'landscape', style: styles.page },
      E(
        View,
        { style: styles.outerBorder },
        E(View, { style: styles.topLine }),
        E(
          View,
          { style: styles.header },
          E(
            View,
            { style: styles.brandBlock },
            E(Text, { style: styles.brandText }, 'AMBULANT+'),
            E(Text, { style: styles.brandSubtext }, 'CONTACTLESS MEDICINE'),
          ),
          E(
            View,
            { style: styles.titleBlock },
            E(Text, { style: styles.title }, 'CERTIFICATE OF COMPLETION'),
            E(Text, { style: styles.subtitle }, 'Ambulant+ Contactless Medicine'),
            E(Text, { style: styles.kicker }, 'CLINICIAN ONBOARDING & PRACTICE READINESS PROGRAMME'),
          ),
          E(
            View,
            { style: styles.verifyBox },
            E(Text, { style: styles.verifySquare }, 'VERIFY'),
            E(Text, { style: styles.verifyCaption }, 'Certificate verification'),
          ),
        ),
        E(View, { style: styles.goldRule }),
        E(Text, { style: styles.certifies }, 'This certifies that'),
        E(Text, { style: styles.name }, data.clinicianName || 'Clinician'),
        E(
          Text,
          { style: styles.body },
          'has successfully completed the Ambulant+ Contactless Medicine Clinician Onboarding & Practice Readiness Programme, a structured training pathway in telehealth, IoMT-assisted remote assessment, remote patient monitoring, documentation, medication adherence considerations, escalation, privacy, patient rights, claims-aware coordination, InsightCore AI-assisted workflow governance, and voice-to-text clinical dictation review.',
        ),
        E(
          Text,
          { style: styles.bodySmall },
          'This certificate recognises Contactless Medicine practice-readiness training and safe platform-supported workflow competence. It does not replace statutory professional registration, employer credentialing, specialist qualification, or independent clinical competency assessment.',
        ),
        E(
          Text,
          { style: styles.bodySmall },
          'The clinician has been trained in the safe, ethical, clinician-supervised use of AI-assisted workflow tools as supportive aids only. Voice-to-text clinical dictation requires mandatory clinician review, correction, and sign-off before saving or submission.',
        ),
        E(
          View,
          { style: styles.domainBand },
          E(
            Text,
            { style: styles.domainText },
            'Training domains: Contactless Medicine framework - IoMT-assisted assessment - Remote monitoring - Documentation - Escalation - Privacy - Claims-aware coordination - InsightCore AI assist - Dictation review',
          ),
        ),
        E(
          View,
          { style: styles.infoPanel },
          E(
            View,
            { style: styles.infoColumn },
            drawDataRow('CLINICIAN ID', data.clinicianId),
            drawDataRow('PROGRAMME', 'Onboarding & Practice Readiness'),
            drawDataRow('COHORT / SESSION', data.trainingSlotId || data.trainingRoomId),
            drawDataRow('STATUS', 'Completed / Certified by Admin'),
          ),
          E(
            View,
            { style: styles.infoColumn },
            drawDataRow('HPCSA', data.hpcsa || 'Not supplied'),
            drawDataRow('TRAINING MODE', data.trainingMode || 'Virtual / In-person'),
            drawDataRow('COMPLETION DATE', data.completedDate),
            drawDataRow('CERTIFICATE ID', data.certificateNumber),
          ),
        ),
        E(
          View,
          { style: styles.partnerBand },
          E(Text, { style: styles.partnerText }, `Issued by: ${CERTIFICATE_ISSUER}. Programme: Ambulant+ Contactless Medicine.`),
          FRAMEWORK_SUPPORT
            ? E(Text, { style: styles.partnerText }, `Training framework development and support: ${FRAMEWORK_SUPPORT}.`)
            : null,
        ),
        E(
          View,
          { style: styles.signatureRow },
          E(
            View,
            { style: styles.signatureBlock },
            E(View, { style: styles.signatureLine }),
            E(Text, { style: styles.signatureName }, process.env.CERTIFICATE_TRAINING_LEAD_NAME || 'Training Lead'),
            E(Text, { style: styles.signatureTitle }, process.env.CERTIFICATE_TRAINING_LEAD_TITLE || 'Ambulant+ Contactless Medicine'),
          ),
          E(
            View,
            { style: styles.seal },
            E(Text, { style: styles.sealText }, 'AMBULANT+'),
            E(Text, { style: styles.sealText }, 'ONBOARDING'),
            E(Text, { style: styles.sealSmall }, 'READY'),
          ),
          E(
            View,
            { style: styles.signatureBlock },
            E(View, { style: styles.signatureLine }),
            E(Text, { style: styles.signatureName }, process.env.CERTIFICATE_AUTHORISED_OFFICER_NAME || 'Ambulant+ Authorised Officer'),
            E(Text, { style: styles.signatureTitle }, process.env.CERTIFICATE_AUTHORISED_OFFICER_ORG || CERTIFICATE_ISSUER),
          ),
        ),
        E(
          View,
          { style: styles.footer },
          E(Text, { style: styles.footerText }, `Certificate ID: ${data.certificateNumber || '-'}`),
          E(Text, { style: styles.footerText }, `Verify: ${verifyUrl}`),
          E(
            Text,
            { style: styles.disclaimer },
            'Disclaimer: This certificate confirms completion of Ambulant+ Contactless Medicine onboarding and practice-readiness training. It does not replace statutory professional registration, employer credentialing, specialist qualification, or independent clinical competency assessment.',
          ),
        ),
        E(View, { style: styles.bottomLine }),
      ),
    ),
  );
}

const styles = StyleSheet.create({
  page: {
    padding: 28,
    backgroundColor: '#fbfaf6',
    color: '#102033',
    fontFamily: 'Helvetica',
  },
  outerBorder: {
    flex: 1,
    borderWidth: 1.2,
    borderColor: '#9a7b36',
    borderRadius: 8,
    padding: 18,
    position: 'relative',
  },
  topLine: {
    height: 3,
    backgroundColor: '#08aeb8',
    marginBottom: 8,
  },
  bottomLine: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 14,
    height: 3,
    backgroundColor: '#08aeb8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  brandBlock: {
    width: 140,
    paddingTop: 6,
  },
  brandText: {
    fontSize: 15,
    fontWeight: 700,
    color: '#0b9ea7',
  },
  brandSubtext: {
    marginTop: 2,
    fontSize: 6,
    letterSpacing: 1.4,
    color: '#0b9ea7',
  },
  titleBlock: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 30,
  },
  title: {
    fontSize: 25,
    fontWeight: 800,
    letterSpacing: 1.5,
    color: '#102033',
  },
  subtitle: {
    marginTop: 7,
    fontSize: 14,
    color: '#1b2b3c',
  },
  kicker: {
    marginTop: 6,
    fontSize: 8,
    letterSpacing: 1.7,
    fontWeight: 700,
    color: '#08aeb8',
  },
  verifyBox: {
    width: 130,
    alignItems: 'center',
    paddingTop: 6,
  },
  verifySquare: {
    width: 64,
    height: 64,
    borderWidth: 1,
    borderColor: '#102033',
    textAlign: 'center',
    paddingTop: 25,
    fontSize: 8,
    color: '#102033',
  },
  verifyCaption: {
    marginTop: 5,
    fontSize: 6,
    color: '#5b6675',
  },
  goldRule: {
    width: 310,
    height: 1,
    backgroundColor: '#9a7b36',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 12,
  },
  certifies: {
    textAlign: 'center',
    fontSize: 9,
    color: '#5b6675',
  },
  name: {
    textAlign: 'center',
    marginTop: 8,
    fontSize: 26,
    fontWeight: 800,
    color: '#102033',
  },
  body: {
    marginTop: 17,
    marginHorizontal: 100,
    textAlign: 'center',
    fontSize: 8.4,
    lineHeight: 1.35,
    color: '#1d2733',
  },
  bodySmall: {
    marginTop: 6,
    marginHorizontal: 110,
    textAlign: 'center',
    fontSize: 6.7,
    lineHeight: 1.25,
    color: '#1d2733',
  },
  domainBand: {
    marginTop: 14,
    marginHorizontal: 42,
    borderWidth: 1,
    borderColor: '#b9ecf0',
    backgroundColor: '#e2fbfd',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  domainText: {
    textAlign: 'center',
    fontSize: 7,
    fontWeight: 700,
    color: '#102033',
  },
  infoPanel: {
    marginTop: 12,
    marginHorizontal: 25,
    borderWidth: 0.8,
    borderColor: '#d9e1e8',
    backgroundColor: '#ffffff',
    borderRadius: 6,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoColumn: {
    width: '47%',
  },
  dataRow: {
    marginBottom: 4,
  },
  dataLabel: {
    fontSize: 7,
    fontWeight: 800,
    color: '#069da8',
    letterSpacing: 0.5,
  },
  dataValue: {
    marginTop: 1,
    fontSize: 8,
    color: '#172638',
  },
  partnerBand: {
    marginTop: 8,
    alignItems: 'center',
  },
  partnerText: {
    fontSize: 6.3,
    color: '#526070',
  },
  signatureRow: {
    marginTop: 14,
    marginHorizontal: 70,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  signatureBlock: {
    width: 170,
  },
  signatureLine: {
    height: 1,
    backgroundColor: '#102033',
    marginBottom: 8,
  },
  signatureName: {
    fontSize: 8,
    fontWeight: 700,
    color: '#102033',
  },
  signatureTitle: {
    marginTop: 2,
    fontSize: 7,
    color: '#5b6675',
  },
  seal: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2,
    borderColor: '#9a7b36',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f2feff',
  },
  sealText: {
    fontSize: 7,
    fontWeight: 800,
    color: '#08aeb8',
  },
  sealSmall: {
    marginTop: 2,
    fontSize: 6,
    color: '#5b6675',
  },
  footer: {
    position: 'absolute',
    left: 45,
    right: 45,
    bottom: 22,
  },
  footerText: {
    fontSize: 6.5,
    color: '#172638',
    marginBottom: 2,
  },
  disclaimer: {
    marginTop: 4,
    textAlign: 'center',
    fontSize: 5.5,
    color: '#172638',
  },
});

async function resolveCertificateContext(req: NextRequest) {
  const clinicianId = cleanStr(req.nextUrl.searchParams.get('clinicianId'), 120);

  if (!clinicianId) {
    return {
      error: NextResponse.json(
        { ok: false, error: 'clinicianId_required' },
        { status: 400 },
      ),
    };
  }

  const url = new URL('/api/clinicians/me/training/context', gatewayBase());
  url.searchParams.set('clinicianId', clinicianId);

  const upstream = await fetch(url.toString(), {
    method: 'GET',
    headers: apiHeaders(req),
    cache: 'no-store',
  });

  const text = await upstream.text();
  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!upstream.ok || !data || data?.ok === false) {
    return {
      error: NextResponse.json(
        {
          ok: false,
          error: data?.error || upstream.statusText || 'certificate_context_unavailable',
          upstreamStatus: upstream.status,
        },
        { status: upstream.ok ? 502 : upstream.status },
      ),
    };
  }

  return {
    clinicianId,
    context: data,
  };
}

export async function GET(req: NextRequest) {
  try {
    const resolved = await resolveCertificateContext(req);

    if ('error' in resolved) return resolved.error;

    const ctx: any = resolved.context;
    const clinicianId = cleanStr(resolved.clinicianId);
    const onboarding = ctx?.onboarding || {};
    const training = ctx?.training || {};

    const cert = {
      certificateNumber: cleanStr(training?.certificateNumber),
      completedAt: cleanStr(training?.certificateCompletedAt),
      institution: cleanStr(training?.certificateInstitution) || CERTIFICATE_INSTITUTION,
      trainingSlotId: cleanStr(training?.trainingSlotId || training?.slotId || onboarding?.trainingSlotId),
    };

    if (!cert.certificateNumber || !cert.completedAt) {
      return NextResponse.json(
        { ok: false, error: 'certificate_not_available' },
        { status: 404 },
      );
    }

    const trainingSlotId = cert.trainingSlotId || cleanStr(onboarding?.trainingSlotId) || '';
    const data = {
      clinicianName:
        cleanStr(ctx?.clinician?.displayName) ||
        cleanStr(ctx?.clinicianName) ||
        cleanStr(ctx?.name) ||
        cleanStr(ctx?.profile?.displayName) ||
        'Clinician',
      clinicianId,
      hpcsa:
        cleanStr(ctx?.clinician?.hpcsaNumber) ||
        cleanStr(ctx?.profile?.hpcsaNumber) ||
        cleanStr(ctx?.hpcsaNumber) ||
        'Not supplied',
      certificateNumber: cert.certificateNumber,
      completedDate: formatDate(cert.completedAt),
      institution: CERTIFICATE_INSTITUTION,
      trainingMode:
        String(training?.mode || '').toLowerCase() === 'in_person'
          ? 'In-person'
          : String(training?.mode || '').toLowerCase() === 'virtual'
            ? 'Virtual'
            : 'Virtual / In-person',
      trainingSlotId,
      trainingRoomId: trainingRoomIdForSlot(trainingSlotId),
      cohortDates: formatDateRange(training?.startAt, training?.endAt),
      verifyUrl: certificateVerifyUrl(req, cert.certificateNumber),
    };

    const pdfStream = await renderToStream(createCertificatePdf(data) as any);
    const webStream = Readable.toWeb(pdfStream as any) as any;

    const filename = `Ambulant-Certificate-${data.certificateNumber}.pdf`;

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="${filename}"`,
        'cache-control': 'private, no-store, max-age=0',
      },
    });
  } catch (err: any) {
    console.error('[clinician-app][training/certificate] error', err);

    return NextResponse.json(
      {
        ok: false,
        error: err?.message || 'certificate_generation_failed',
      },
      { status: 500 },
    );
  }
}



