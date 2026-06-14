import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type JsonObj = Record<string, any>;

const CERTIFICATE_ISSUER =
  process.env.CERTIFICATE_ISSUER || 'Cloven Technology Impilo';

const CERTIFICATE_PROGRAMME =
  process.env.CERTIFICATE_PROGRAMME || 'Ambulant+ Contactless Medicine';

const CERTIFICATE_INSTITUTION =
  process.env.CERTIFICATE_INSTITUTION || 'Cloven Technology Impilo';

const FRAMEWORK_SUPPORT =
  process.env.CERTIFICATE_FRAMEWORK_SUPPORT || 'Executive College, SA';

function cleanStr(v: unknown, max = 500): string {
  const s = String(v ?? '').trim();
  if (!s) return '';
  return s.length > max ? s.slice(0, max) : s;
}

function safePdfText(value: unknown): string {
  return cleanStr(value, 2000)
    .replace(/[–—]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/→/g, '->')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
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

function approxTextWidth(text: string, fontSize: number) {
  return safePdfText(text).length * fontSize * 0.5;
}

function pdfText(
  text: string,
  x: number,
  y: number,
  size: number,
  font: 'F1' | 'F2' = 'F1',
  align: 'left' | 'center' | 'right' = 'left',
) {
  let px = x;
  if (align === 'center') px = x - approxTextWidth(text, size) / 2;
  if (align === 'right') px = x - approxTextWidth(text, size);

  return `BT /${font} ${size} Tf ${px.toFixed(2)} ${y.toFixed(2)} Td (${safePdfText(text)}) Tj ET\n`;
}

function pdfLine(x1: number, y1: number, x2: number, y2: number, width = 1) {
  return `${width} w ${x1} ${y1} m ${x2} ${y2} l S\n`;
}

function pdfRect(x: number, y: number, w: number, h: number, stroke = true, fill = false) {
  if (stroke && fill) return `${x} ${y} ${w} ${h} re B\n`;
  if (fill) return `${x} ${y} ${w} ${h} re f\n`;
  return `${x} ${y} ${w} ${h} re S\n`;
}

function wrapText(text: string, maxChars: number) {
  const words = cleanStr(text, 5000).split(/\s+/).filter(Boolean);
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
  return lines;
}

function pdfWrappedText(
  text: string,
  x: number,
  y: number,
  size: number,
  maxChars: number,
  lineGap = 10,
  font: 'F1' | 'F2' = 'F1',
  align: 'left' | 'center' = 'center',
) {
  let out = '';
  let yy = y;

  for (const line of wrapText(text, maxChars)) {
    out += pdfText(line, x, yy, size, font, align);
    yy -= lineGap;
  }

  return out;
}

function renderCertificatePdfBuffer(data: any) {
  const W = 842;
  const H = 595;
  let c = '';

  c += '0.98 0.97 0.94 rg\n';
  c += pdfRect(0, 0, W, H, false, true);

  c += '0.06 0.12 0.20 RG\n';
  c += pdfRect(24, 24, W - 48, H - 48, true, false);

  c += '0.60 0.43 0.12 RG\n';
  c += pdfRect(31, 31, W - 62, H - 62, true, false);

  c += '0.00 0.67 0.72 RG\n';
  c += pdfLine(50, H - 52, W - 50, H - 52, 2);
  c += pdfLine(50, 43, W - 50, 43, 2);

  c += pdfText('AMBULANT+', 95, H - 86, 13, 'F2', 'left');
  c += pdfText('CONTACTLESS MEDICINE', 95, H - 99, 6, 'F1', 'left');

  c += pdfRect(W - 150, H - 125, 72, 72, true, false);
  c += pdfText('VERIFY', W - 114, H - 88, 10, 'F2', 'center');
  c += pdfText('Certificate verification', W - 114, H - 136, 6, 'F1', 'center');

  c += pdfText('CERTIFICATE OF COMPLETION', W / 2, H - 98, 24, 'F2', 'center');
  c += pdfText('Ambulant+ Contactless Medicine', W / 2, H - 120, 14, 'F1', 'center');
  c += pdfText('CLINICIAN ONBOARDING & PRACTICE READINESS PROGRAMME', W / 2, H - 138, 8, 'F2', 'center');

  c += '0.60 0.43 0.12 RG\n';
  c += pdfLine(W / 2 - 155, H - 158, W / 2 + 155, H - 158, 1);

  c += pdfText('This certifies that', W / 2, H - 180, 9, 'F1', 'center');
  c += pdfText(data.clinicianName || 'Clinician', W / 2, H - 210, 25, 'F2', 'center');

  const mainBody =
    'has successfully completed the Ambulant+ Contactless Medicine Clinician Onboarding and Practice Readiness Programme, a structured training pathway in telehealth, IoMT-assisted remote assessment, remote patient monitoring, documentation, medication adherence considerations, escalation, privacy, patient rights, claims-aware coordination, InsightCore AI-assisted workflow governance, and voice-to-text clinical dictation review.';

  c += pdfWrappedText(mainBody, W / 2, H - 238, 7.5, 125, 9, 'F1', 'center');

  const safeBody =
    'This certificate recognises Contactless Medicine practice-readiness training and safe platform-supported workflow competence. It does not replace statutory professional registration, employer credentialing, specialist qualification, or independent clinical competency assessment.';

  c += pdfWrappedText(safeBody, W / 2, H - 292, 6.5, 135, 8, 'F1', 'center');

  c += '0.86 0.98 0.99 rg\n';
  c += '0.65 0.90 0.92 RG\n';
  c += pdfRect(90, 262, W - 180, 35, true, true);
  c += pdfWrappedText(
    'Training domains: Contactless Medicine framework - IoMT-assisted assessment - Remote monitoring - Documentation - Escalation - Privacy - Claims-aware coordination - InsightCore AI assist - Dictation review',
    W / 2,
    283,
    7,
    130,
    8,
    'F2',
    'center',
  );

  c += '1 1 1 rg\n';
  c += '0.82 0.86 0.90 RG\n';
  c += pdfRect(72, 150, W - 144, 92, true, true);

  const leftX = 88;
  const rightX = 458;
  let y = 222;

  const row = (label: string, value: string, x: number, yy: number) => {
    let out = '';
    out += pdfText(label, x, yy, 7, 'F2', 'left');
    out += pdfText(value || '-', x, yy - 10, 8, 'F1', 'left');
    return out;
  };

  c += row('CLINICIAN ID', data.clinicianId, leftX, y);
  c += row('PROGRAMME', 'Onboarding & Practice Readiness', leftX, y - 28);
  c += row('COHORT / SESSION', data.trainingSlotId || data.trainingRoomId || '-', leftX, y - 56);

  c += row('HPCSA', data.hpcsa || 'Not supplied', rightX, y);
  c += row('TRAINING MODE', data.trainingMode || 'Virtual / In-person', rightX, y - 28);
  c += row('COMPLETION DATE', data.completedDate || '-', rightX, y - 56);
  c += row('CERTIFICATE ID', data.certificateNumber || '-', rightX, y - 84);

  c += pdfText(`Issued by: ${CERTIFICATE_ISSUER}`, W / 2, 132, 6.5, 'F1', 'center');
  c += pdfText(`Programme: ${CERTIFICATE_PROGRAMME}`, W / 2, 121, 6.5, 'F1', 'center');
  c += pdfText(`Training framework development and support: ${FRAMEWORK_SUPPORT}`, W / 2, 110, 6.5, 'F1', 'center');

  c += '0.06 0.12 0.20 RG\n';
  c += pdfLine(150, 88, 305, 88, 1);
  c += pdfLine(W - 305, 88, W - 150, 88, 1);

  c += pdfText(process.env.CERTIFICATE_TRAINING_LEAD_NAME || 'Training Lead', 150, 75, 8, 'F2', 'left');
  c += pdfText(process.env.CERTIFICATE_TRAINING_LEAD_TITLE || 'Ambulant+ Contactless Medicine', 150, 64, 7, 'F1', 'left');

  c += pdfText(process.env.CERTIFICATE_AUTHORISED_OFFICER_NAME || 'Ambulant+ Authorised Officer', W - 305, 75, 8, 'F2', 'left');
  c += pdfText(process.env.CERTIFICATE_AUTHORISED_OFFICER_ORG || CERTIFICATE_ISSUER, W - 305, 64, 7, 'F1', 'left');

  c += '0.00 0.67 0.72 RG\n';
  c += pdfRect(W / 2 - 31, 52, 62, 62, true, false);
  c += pdfText('AMBULANT+', W / 2, 88, 7, 'F2', 'center');
  c += pdfText('ONBOARDING', W / 2, 78, 7, 'F2', 'center');
  c += pdfText('READY', W / 2, 67, 6, 'F1', 'center');

  c += pdfText(`Certificate ID: ${data.certificateNumber || '-'}`, 50, 72, 6.5, 'F1', 'left');
  c += pdfText(`Verify: ${data.verifyUrl || '-'}`, 50, 60, 6.2, 'F1', 'left');

  const objects: string[] = [];

  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`);
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
  objects.push(`<< /Length ${Buffer.byteLength(c, 'latin1')} >>\nstream\n${c}endstream`);

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];

  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';

  for (let i = 1; i < offsets.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, 'latin1');
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

    const pdfBuffer = renderCertificatePdfBuffer(data);
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
