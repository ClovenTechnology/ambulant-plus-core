import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CERTIFICATE_ISSUER =
  process.env.CERTIFICATE_ISSUER || 'Cloven Technology Impilo';

const CERTIFICATE_PROGRAMME =
  process.env.CERTIFICATE_PROGRAMME || 'Ambulant+ Contactless Medicine';

const CERTIFICATE_INSTITUTION =
  process.env.CERTIFICATE_INSTITUTION || 'Cloven Technology Impilo';

const FRAMEWORK_SUPPORT =
  process.env.CERTIFICATE_FRAMEWORK_SUPPORT || 'Executive College, SA';

const CERTIFICATE_BUCKET =
  process.env.CERTIFICATE_ASSETS_S3_BUCKET ||
  process.env.TRAINING_RECORDINGS_S3_BUCKET ||
  'ambulantplus-training-recordings-prod-316006212460-eu-west-1-an';

const CERTIFICATE_REGION =
  process.env.CERTIFICATE_ASSETS_S3_REGION ||
  process.env.AWS_REGION ||
  process.env.AWS_DEFAULT_REGION ||
  'eu-west-1';

const CERTIFICATE_PREFIX =
  (process.env.CERTIFICATE_ASSETS_S3_PREFIX || 'certificate-assets').replace(/^\/+|\/+$/g, '');

const TEMPLATE_KEY =
  process.env.CERTIFICATE_TEMPLATE_KEY ||
  `${CERTIFICATE_PREFIX}/templates/clinician-onboarding-certificate-bg.png`;

const TRAINING_LEAD_SIGNATURE_KEY =
  process.env.CERTIFICATE_TRAINING_LEAD_SIGNATURE_KEY ||
  `${CERTIFICATE_PREFIX}/signatures/training-lead-signature.png`;

const AUTHORISED_OFFICER_SIGNATURE_KEY =
  process.env.CERTIFICATE_AUTHORISED_OFFICER_SIGNATURE_KEY ||
  `${CERTIFICATE_PREFIX}/signatures/authorised-officer-signature.png`;

function cleanStr(v: unknown, max = 500): string {
  const s = String(v ?? '').trim();
  if (!s) return '';
  return s.length > max ? s.slice(0, max) : s;
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
  const headers: Record<string, string> = { accept: 'application/json' };
  if (cookie) headers.cookie = cookie;
  return headers;
}

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

  return { clinicianId, context: data };
}

function s3Client() {
  return new S3Client({
    region: CERTIFICATE_REGION,
  });
}

async function streamToBuffer(body: any): Promise<Buffer> {
  if (!body) throw new Error('empty_s3_body');

  const chunks: Buffer[] = [];

  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

async function getS3ObjectBuffer(key: string): Promise<Buffer | null> {
  try {
    const res = await s3Client().send(
      new GetObjectCommand({
        Bucket: CERTIFICATE_BUCKET,
        Key: key,
      }),
    );

    return await streamToBuffer(res.Body);
  } catch (err) {
    console.warn(`[certificate] Could not load S3 object ${key}`, err);
    return null;
  }
}

function drawCenteredText(
  page: any,
  text: string,
  x: number,
  y: number,
  size: number,
  font: any,
  color = rgb(0.06, 0.12, 0.2),
) {
  const safe = cleanStr(text, 1000);
  const width = font.widthOfTextAtSize(safe, size);
  page.drawText(safe, {
    x: x - width / 2,
    y,
    size,
    font,
    color,
  });
}

function drawRightText(
  page: any,
  text: string,
  x: number,
  y: number,
  size: number,
  font: any,
  color = rgb(0.06, 0.12, 0.2),
) {
  const safe = cleanStr(text, 1000);
  const width = font.widthOfTextAtSize(safe, size);
  page.drawText(safe, {
    x: x - width,
    y,
    size,
    font,
    color,
  });
}

function drawWrappedCentered(
  page: any,
  text: string,
  centerX: number,
  startY: number,
  maxChars: number,
  size: number,
  lineGap: number,
  font: any,
  color = rgb(0.06, 0.12, 0.2),
) {
  const words = cleanStr(text, 3000).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }

  if (line) lines.push(line);

  let y = startY;
  for (const ln of lines) {
    drawCenteredText(page, ln, centerX, y, size, font, color);
    y -= lineGap;
  }
}

async function renderCertificatePdfBuffer(data: any) {
  const pdfDoc = await PDFDocument.create();

  const page = pdfDoc.addPage([842, 595]);
  const { width: W, height: H } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const bgBytes = await getS3ObjectBuffer(TEMPLATE_KEY);

  if (bgBytes) {
    const bg = await pdfDoc.embedPng(bgBytes);
    page.drawImage(bg, {
      x: 0,
      y: 0,
      width: W,
      height: H,
    });
  } else {
    page.drawRectangle({
      x: 0,
      y: 0,
      width: W,
      height: H,
      color: rgb(0.98, 0.97, 0.94),
    });
  }

  const dark = rgb(0.06, 0.12, 0.2);
  const teal = rgb(0.0, 0.62, 0.66);
  const grey = rgb(0.28, 0.34, 0.42);

  drawCenteredText(page, 'CERTIFICATE OF COMPLETION', W / 2, H - 105, 24, bold, dark);
  drawCenteredText(page, 'Ambulant+ Contactless Medicine', W / 2, H - 128, 14, font, dark);
  drawCenteredText(
    page,
    'CLINICIAN ONBOARDING & PRACTICE READINESS PROGRAMME',
    W / 2,
    H - 146,
    8,
    bold,
    teal,
  );

  drawCenteredText(page, 'This certifies that', W / 2, H - 182, 9, font, grey);
  drawCenteredText(page, data.clinicianName || 'Clinician', W / 2, H - 215, 27, bold, dark);

  drawWrappedCentered(
    page,
    'has successfully completed the Ambulant+ Contactless Medicine Clinician Onboarding and Practice Readiness Programme, a structured training pathway in telehealth, IoMT-assisted remote assessment, remote patient monitoring, documentation, medication adherence considerations, escalation, privacy, patient rights, claims-aware coordination, InsightCore AI-assisted workflow governance, and voice-to-text clinical dictation review.',
    W / 2,
    H - 247,
    124,
    7.5,
    9,
    font,
    dark,
  );

  drawWrappedCentered(
    page,
    'This certificate recognises Contactless Medicine practice-readiness training and safe platform-supported workflow competence. It does not replace statutory professional registration, employer credentialing, specialist qualification, or independent clinical competency assessment.',
    W / 2,
    H - 300,
    130,
    6.5,
    8,
    font,
    dark,
  );

  drawWrappedCentered(
    page,
    'Training domains: Contactless Medicine framework - IoMT-assisted assessment - Remote monitoring - Documentation - Escalation - Privacy - Claims-aware coordination - InsightCore AI assist - Dictation review',
    W / 2,
    276,
    130,
    7,
    8,
    bold,
    dark,
  );

  const label = (text: string, x: number, y: number) =>
    page.drawText(text, { x, y, size: 7, font: bold, color: teal });

  const value = (text: string, x: number, y: number) =>
    page.drawText(cleanStr(text) || '-', { x, y, size: 8, font, color: dark });

  const leftX = 88;
  const rightX = 460;

  label('CLINICIAN ID', leftX, 221);
  value(data.clinicianId, leftX, 211);

  label('PROGRAMME', leftX, 193);
  value('Onboarding & Practice Readiness', leftX, 183);

  label('COHORT / SESSION', leftX, 165);
  value(data.trainingSlotId || data.trainingRoomId || '-', leftX, 155);

  label('STATUS', leftX, 137);
  value('Completed / Certified by Admin', leftX, 127);

  label('HPCSA', rightX, 221);
  value(data.hpcsa || 'Not supplied', rightX, 211);

  label('TRAINING MODE', rightX, 193);
  value(data.trainingMode || 'Virtual / In-person', rightX, 183);

  label('COMPLETION DATE', rightX, 165);
  value(data.completedDate || '-', rightX, 155);

  label('CERTIFICATE ID', rightX, 137);
  value(data.certificateNumber || '-', rightX, 127);

  drawCenteredText(page, `Issued by: ${CERTIFICATE_ISSUER}`, W / 2, 116, 6.7, font, grey);
  drawCenteredText(page, `Programme: ${CERTIFICATE_PROGRAMME}`, W / 2, 105, 6.7, font, grey);
  drawCenteredText(
    page,
    `Training framework development and support: ${FRAMEWORK_SUPPORT}`,
    W / 2,
    94,
    6.7,
    font,
    grey,
  );

  const trainingLeadSig = await getS3ObjectBuffer(TRAINING_LEAD_SIGNATURE_KEY);
  if (trainingLeadSig) {
    const img = await pdfDoc.embedPng(trainingLeadSig);
    page.drawImage(img, { x: 145, y: 73, width: 150, height: 38 });
  }

  const officerSig = await getS3ObjectBuffer(AUTHORISED_OFFICER_SIGNATURE_KEY);
  if (officerSig) {
    const img = await pdfDoc.embedPng(officerSig);
    page.drawImage(img, { x: W - 300, y: 73, width: 150, height: 38 });
  }

  page.drawText(process.env.CERTIFICATE_TRAINING_LEAD_NAME || 'Training Lead', {
    x: 150,
    y: 65,
    size: 8,
    font: bold,
    color: dark,
  });

  page.drawText(process.env.CERTIFICATE_TRAINING_LEAD_TITLE || 'Ambulant+ Contactless Medicine', {
    x: 150,
    y: 54,
    size: 7,
    font,
    color: grey,
  });

  page.drawText(process.env.CERTIFICATE_AUTHORISED_OFFICER_NAME || 'Ambulant+ Authorised Officer', {
    x: W - 305,
    y: 65,
    size: 8,
    font: bold,
    color: dark,
  });

  page.drawText(process.env.CERTIFICATE_AUTHORISED_OFFICER_ORG || CERTIFICATE_ISSUER, {
    x: W - 305,
    y: 54,
    size: 7,
    font,
    color: grey,
  });

  page.drawText(`Certificate ID: ${data.certificateNumber || '-'}`, {
    x: 50,
    y: 58,
    size: 6.5,
    font,
    color: dark,
  });

  page.drawText(`Verify: ${data.verifyUrl || '-'}`, {
    x: 50,
    y: 46,
    size: 6.2,
    font,
    color: dark,
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
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
        cleanStr(ctx?.clinician?.name) ||
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
      institution: cert.institution,
      trainingMode:
        String(training?.mode || '').toLowerCase() === 'in_person'
          ? 'In-person'
          : String(training?.mode || '').toLowerCase() === 'virtual'
            ? 'Virtual'
            : 'Virtual / In-person',
      trainingSlotId,
      trainingRoomId: trainingRoomIdForSlot(trainingSlotId),
      cohortDates: formatDate(training?.startAt),
      verifyUrl: certificateVerifyUrl(req, cert.certificateNumber),
    };

    const pdfBuffer = await renderCertificatePdfBuffer(data);
    const filename = `Ambulant-Certificate-${data.certificateNumber}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="${filename}"`,
        'content-length': String(pdfBuffer.length),
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

