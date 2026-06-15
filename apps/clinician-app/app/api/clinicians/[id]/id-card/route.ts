import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib';
import { prisma } from '@/src/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type JsonObj = Record<string, any>;

const CARD_WIDTH = 1016;
const CARD_HEIGHT = 640;

// CR80 physical card size: 85.60 mm x 53.98 mm.
// PDF points = mm * 72 / 25.4.
const CR80_WIDTH_PT = 242.65;
const CR80_HEIGHT_PT = 153.01;

const SMART_ID_CONFIG = {
  legalStatement:
    'The bearer whose name and photograph appear on the front side is an independent contractor of Cloven Technology and a practising Contactless Medicine Clinician on Ambulant+. This ID remains the property of Cloven Technology. Unauthorised use, duplication, or transfer is strictly prohibited.',
  supportHelpline: '+078 552 6420',
  secureEmail: 'ambulant@cloventechnology.com',
  officeAddress: 'OB Meadowbrook Lane, Bryanston 2151',
  issuer: 'Ambulant+ / Cloven Technology',
};

function json(data: any, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'cache-control': 'no-store, max-age=0' },
  });
}

function parseObject(value: unknown): JsonObj {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value as JsonObj;

  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as JsonObj)
      : {};
  } catch {
    return {};
  }
}

function getProfileJson(clinician: any): JsonObj {
  const meta = parseObject(clinician?.meta ?? clinician?.metadata);

  if (meta.rawProfile && typeof meta.rawProfile === 'object') {
    return meta.rawProfile as JsonObj;
  }

  if (typeof meta.rawProfileJson === 'string') {
    return parseObject(meta.rawProfileJson);
  }

  return meta;
}

function trainingCertificate(profile: JsonObj, meta: JsonObj, clinician: any) {
  const training = parseObject(profile.training);
  const certificate = parseObject(profile.trainingCertificate ?? meta.trainingCertificate);

  const qualifications = Array.isArray(profile.additionalQualifications)
    ? profile.additionalQualifications
    : [];

  const trainingQualification =
    qualifications.find(
      (q: any) =>
        String(q?.degree || '').trim() === 'Ambulant+ Mandatory Clinician Training',
    ) || {};

  const certificateNumber =
    training.certificateNumber ||
    certificate.certificateNumber ||
    trainingQualification.certificateNumber ||
    clinician?.boardCertificateNumber ||
    null;

  const completedAt =
    training.completedAt ||
    certificate.completedAt ||
    certificate.issuedAt ||
    trainingQualification.completedAt ||
    null;

  return {
    certificateNumber,
    completedAt,
    institution:
      certificate.institution ||
      trainingQualification.institution ||
      SMART_ID_CONFIG.issuer,
  };
}

function smartIdEligibility(clinician: any, profile: JsonObj, meta: JsonObj) {
  const cert = trainingCertificate(profile, meta, clinician);
  const onboarding = parseObject(profile.onboarding);
  const training = parseObject(profile.training);

  const trainingComplete =
    clinician?.trainingCompleted === true ||
    String(onboarding.stage || '').toLowerCase() === 'training_completed' ||
    String(training.status || '').toLowerCase() === 'completed' ||
    Boolean(cert.certificateNumber && cert.completedAt);

  const avatar =
    profile.avatarDataUrl ||
    profile.photoUrl ||
    clinician?.photoUrl ||
    null;

  return {
    trainingComplete,
    hasAvatar: Boolean(avatar),
    avatar,
    cert,
  };
}

function esc(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cardDate(value: unknown) {
  if (!value) return 'Not recorded';

  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);

  return d.toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: 'long',
    day: '2-digit',
  });
}

function validUntil(value: unknown) {
  const base = value ? new Date(String(value)) : new Date();

  if (Number.isNaN(base.getTime())) {
    const fallback = new Date();
    fallback.setFullYear(fallback.getFullYear() + 1);
    return fallback;
  }

  const next = new Date(base);
  next.setFullYear(next.getFullYear() + 1);
  return next;
}

function idShort(id: string) {
  return String(id || '').slice(-8).toUpperCase();
}

function hpcsaNumber(profile: JsonObj, clinician: any) {
  return (
    profile.regulatorRegistration ||
    profile.hpcsaRegNo ||
    profile.hpcsaNumber ||
    clinician?.boardCertificateNumber ||
    'Not recorded'
  );
}

function dataUrlToBytes(dataUrl: string) {
  const [header, base64] = String(dataUrl || '').split(',');
  const mime = header.match(/^data:(.*?);base64$/)?.[1] || '';
  return {
    mime,
    bytes: Uint8Array.from(Buffer.from(base64 || '', 'base64')),
  };
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const arrayBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(arrayBuffer).set(bytes);
  return arrayBuffer;
}

async function qrDataUrl(value: string) {
  return QRCode.toDataURL(value, {
    margin: 0,
    width: 180,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });
}

function avatarMarkup(avatar: string) {
  return [
    '<clipPath id="avatarClip">',
    '<rect x="58" y="76" width="322" height="422" rx="26"/>',
    '</clipPath>',
    '<image href="' + esc(avatar) + '" x="58" y="76" width="322" height="422" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatarClip)"/>',
    '<rect x="58" y="76" width="322" height="422" rx="26" fill="none" stroke="#0f9f9a" stroke-width="5"/>',
  ].join('');
}

async function frontSvg(req: NextRequest, clinician: any, profile: JsonObj, avatar: string, cert: ReturnType<typeof trainingCertificate>) {
  const name = clinician.displayName || profile.displayName || profile.fullName || 'Ambulant+ Clinician';
  const specialty = clinician.specialty || profile.specialty || 'Clinician';
  const hpcsa = hpcsaNumber(profile, clinician);
  const valid = cardDate(validUntil(cert.completedAt));
  const clinicianId = clinician.id;
  const verificationUrl =
    req.nextUrl.origin +
    '/verify/clinician/' +
    encodeURIComponent(clinicianId) +
    '?certificate=' +
    encodeURIComponent(String(cert.certificateNumber || ''));

  const qr = await qrDataUrl(verificationUrl);

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + CARD_WIDTH + '" height="' + CARD_HEIGHT + '" viewBox="0 0 ' + CARD_WIDTH + ' ' + CARD_HEIGHT + '">',
    '<defs><linearGradient id="tealGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#12b8a6"/><stop offset="100%" stop-color="#006f83"/></linearGradient></defs>',
    '<rect width="1016" height="640" rx="32" fill="#ffffff"/>',
    '<rect x="1" y="1" width="1014" height="638" rx="32" fill="none" stroke="#0f172a" stroke-width="2"/>',
    '<rect x="0" y="530" width="1016" height="110" fill="url(#tealGrad)"/>',
    avatarMarkup(String(avatar)),
    '<text x="430" y="116" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="#0f172a">AMBULANT+</text>',
    '<text x="432" y="154" font-family="Arial, sans-serif" font-size="16" letter-spacing="8" fill="#118d99">CONTACTLESS MEDICINE</text>',
    '<text x="430" y="242" font-family="Arial, sans-serif" font-size="48" font-weight="800" fill="#0f8f82">' + esc(name).toUpperCase() + '</text>',
    '<line x1="430" y1="266" x2="948" y2="266" stroke="#0f8f82" stroke-width="3"/>',
    '<text x="430" y="314" font-family="Arial, sans-serif" font-size="32" font-weight="700" fill="#0f172a">' + esc(specialty).toUpperCase() + '</text>',
    '<rect x="430" y="360" width="150" height="150" rx="10" fill="#ffffff" stroke="#e2e8f0"/>',
    '<image href="' + esc(qr) + '" x="440" y="370" width="130" height="130"/>',
    '<text x="620" y="383" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#0f8f82">HPCSA REG. NO.</text>',
    '<text x="620" y="420" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#0f172a">' + esc(hpcsa) + '</text>',
    '<line x1="620" y1="444" x2="948" y2="444" stroke="#cbd5e1" stroke-width="1.5"/>',
    '<text x="152" y="580" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#ffffff">AMBULANT+ ID</text>',
    '<text x="152" y="614" font-family="Arial, sans-serif" font-size="26" fill="#ffffff">' + esc(idShort(clinicianId)) + '</text>',
    '<line x1="372" y1="548" x2="372" y2="620" stroke="#ffffff" stroke-opacity="0.45"/>',
    '<text x="440" y="580" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#ffffff">VALID UNTIL</text>',
    '<text x="440" y="614" font-family="Arial, sans-serif" font-size="24" fill="#ffffff">' + esc(valid).toUpperCase() + '</text>',
    '<line x1="670" y1="548" x2="670" y2="620" stroke="#ffffff" stroke-opacity="0.45"/>',
    '<text x="730" y="580" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#ffffff">CLINICIAN ID</text>',
    '<text x="730" y="614" font-family="Arial, sans-serif" font-size="20" fill="#ffffff">' + esc(clinicianId) + '</text>',
    '</svg>',
  ].join('');
}

function backSvg(cert: ReturnType<typeof trainingCertificate>) {
  const issued = cardDate(cert.completedAt);

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + CARD_WIDTH + '" height="' + CARD_HEIGHT + '" viewBox="0 0 ' + CARD_WIDTH + ' ' + CARD_HEIGHT + '">',
    '<defs><linearGradient id="tealBack" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#18b79f"/><stop offset="100%" stop-color="#007482"/></linearGradient></defs>',
    '<rect width="1016" height="640" rx="32" fill="#ffffff"/>',
    '<rect x="1" y="1" width="1014" height="638" rx="32" fill="none" stroke="#e2e8f0" stroke-width="2"/>',
    '<text x="508" y="116" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" fill="#0f172a">Ambulant+ Contactless Medicine Smart ID</text>',
    '<text x="508" y="170" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" fill="#0f172a">' + esc(SMART_ID_CONFIG.legalStatement) + '</text>',
    '<line x1="116" y1="282" x2="900" y2="282" stroke="#0b8b93" stroke-width="2"/>',
    '<text x="170" y="332" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#0f172a">SUPPORT HELPLINE:</text>',
    '<text x="405" y="332" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#0b8b93">' + esc(SMART_ID_CONFIG.supportHelpline) + '</text>',
    '<text x="170" y="378" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="#0f172a">SECURE EMAIL:</text>',
    '<text x="360" y="378" font-family="Arial, sans-serif" font-size="20" fill="#0f172a">' + esc(SMART_ID_CONFIG.secureEmail) + '</text>',
    '<text x="170" y="424" font-family="Arial, sans-serif" font-size="18" fill="#64748b">Certificate issued: ' + esc(issued) + '</text>',
    '<text x="620" y="480" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#0f172a">AUTHORISED SIGNATURE</text>',
    '<line x1="565" y1="506" x2="850" y2="506" stroke="#0b8b93" stroke-width="2"/>',
    '<rect x="0" y="530" width="1016" height="110" fill="url(#tealBack)"/>',
    '<text x="150" y="600" font-family="Arial, sans-serif" font-size="26" fill="#ffffff">' + esc(SMART_ID_CONFIG.officeAddress) + '</text>',
    '</svg>',
  ].join('');
}

function ptX(px: number) {
  return (px / CARD_WIDTH) * CR80_WIDTH_PT;
}

function ptYTop(py: number) {
  return CR80_HEIGHT_PT - (py / CARD_HEIGHT) * CR80_HEIGHT_PT;
}

function drawTextFromTop(
  page: PDFPage,
  text: string,
  xPx: number,
  yPx: number,
  sizePx: number,
  font: PDFFont,
  color = rgb(0.058, 0.09, 0.164),
) {
  page.drawText(text, {
    x: ptX(xPx),
    y: ptYTop(yPx),
    size: (sizePx / CARD_HEIGHT) * CR80_HEIGHT_PT,
    font,
    color,
  });
}

async function embedImage(pdf: PDFDocument, dataUrl: string) {
  const { mime, bytes } = dataUrlToBytes(dataUrl);

  if (mime.includes('png')) {
    return pdf.embedPng(bytes);
  }

  return pdf.embedJpg(bytes);
}

function wrapText(text: string, maxChars: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const next = line ? line + ' ' + word : word;
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

async function renderPdf(
  req: NextRequest,
  side: 'front' | 'back',
  clinician: any,
  profile: JsonObj,
  avatar: string,
  cert: ReturnType<typeof trainingCertificate>,
) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([CR80_WIDTH_PT, CR80_HEIGHT_PT]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const teal = rgb(0.02, 0.55, 0.52);
  const navy = rgb(0.058, 0.09, 0.164);
  const pale = rgb(0.94, 0.97, 0.98);

  page.drawRectangle({ x: 0, y: 0, width: CR80_WIDTH_PT, height: CR80_HEIGHT_PT, color: rgb(1, 1, 1) });
  page.drawRectangle({ x: 0.5, y: 0.5, width: CR80_WIDTH_PT - 1, height: CR80_HEIGHT_PT - 1, borderColor: navy, borderWidth: 0.8 });

  if (side === 'front') {
    const name = clinician.displayName || profile.displayName || profile.fullName || 'Ambulant+ Clinician';
    const specialty = clinician.specialty || profile.specialty || 'Clinician';
    const hpcsa = hpcsaNumber(profile, clinician);
    const clinicianId = clinician.id;
    const valid = cardDate(validUntil(cert.completedAt)).toUpperCase();
    const verificationUrl =
      req.nextUrl.origin +
      '/verify/clinician/' +
      encodeURIComponent(clinicianId) +
      '?certificate=' +
      encodeURIComponent(String(cert.certificateNumber || ''));

    const avatarImage = await embedImage(pdf, avatar);
    page.drawImage(avatarImage, {
      x: ptX(58),
      y: ptYTop(76 + 422),
      width: ptX(322),
      height: (422 / CARD_HEIGHT) * CR80_HEIGHT_PT,
    });
    page.drawRectangle({
      x: ptX(58),
      y: ptYTop(76 + 422),
      width: ptX(322),
      height: (422 / CARD_HEIGHT) * CR80_HEIGHT_PT,
      borderColor: teal,
      borderWidth: 1.4,
    });

    drawTextFromTop(page, 'AMBULANT+', 430, 116, 34, bold, navy);
    drawTextFromTop(page, 'CONTACTLESS MEDICINE', 432, 154, 16, regular, teal);
    drawTextFromTop(page, String(name).toUpperCase(), 430, 242, 48, bold, teal);
    page.drawLine({ start: { x: ptX(430), y: ptYTop(266) }, end: { x: ptX(948), y: ptYTop(266) }, thickness: 0.8, color: teal });
    drawTextFromTop(page, String(specialty).toUpperCase(), 430, 314, 32, bold, navy);

    const qr = await qrDataUrl(verificationUrl);
    const qrImage = await embedImage(pdf, qr);
    page.drawImage(qrImage, {
      x: ptX(430),
      y: ptYTop(360 + 150),
      width: ptX(150),
      height: (150 / CARD_HEIGHT) * CR80_HEIGHT_PT,
    });

    drawTextFromTop(page, 'HPCSA REG. NO.', 620, 383, 18, bold, teal);
    drawTextFromTop(page, String(hpcsa), 620, 420, 24, bold, navy);

    page.drawRectangle({ x: 0, y: 0, width: CR80_WIDTH_PT, height: (110 / CARD_HEIGHT) * CR80_HEIGHT_PT, color: teal });
    drawTextFromTop(page, 'AMBULANT+ ID', 152, 580, 20, bold, rgb(1, 1, 1));
    drawTextFromTop(page, idShort(clinicianId), 152, 614, 26, regular, rgb(1, 1, 1));
    drawTextFromTop(page, 'VALID UNTIL', 440, 580, 20, bold, rgb(1, 1, 1));
    drawTextFromTop(page, valid, 440, 614, 24, regular, rgb(1, 1, 1));
    drawTextFromTop(page, 'CLINICIAN ID', 730, 580, 20, bold, rgb(1, 1, 1));
    drawTextFromTop(page, clinicianId, 730, 614, 20, regular, rgb(1, 1, 1));
  } else {
    drawTextFromTop(page, 'Ambulant+ Contactless Medicine Smart ID', 210, 92, 24, bold, navy);

    const lines = wrapText(SMART_ID_CONFIG.legalStatement, 74);
    lines.slice(0, 5).forEach((line, index) => {
      drawTextFromTop(page, line, 130, 150 + index * 28, 17, regular, navy);
    });

    page.drawLine({ start: { x: ptX(116), y: ptYTop(300) }, end: { x: ptX(900), y: ptYTop(300) }, thickness: 0.8, color: teal });

    drawTextFromTop(page, 'SUPPORT HELPLINE:', 150, 350, 20, bold, navy);
    drawTextFromTop(page, SMART_ID_CONFIG.supportHelpline, 395, 350, 20, bold, teal);

    drawTextFromTop(page, 'SECURE EMAIL:', 150, 396, 20, bold, navy);
    drawTextFromTop(page, SMART_ID_CONFIG.secureEmail, 342, 396, 20, regular, navy);

    drawTextFromTop(page, 'Certificate issued: ' + cardDate(cert.completedAt), 150, 442, 16, regular, rgb(0.38, 0.45, 0.55));
    drawTextFromTop(page, 'AUTHORISED SIGNATURE', 620, 492, 18, bold, navy);
    page.drawLine({ start: { x: ptX(565), y: ptYTop(512) }, end: { x: ptX(850), y: ptYTop(512) }, thickness: 0.8, color: teal });

    page.drawRectangle({ x: 0, y: 0, width: CR80_WIDTH_PT, height: (110 / CARD_HEIGHT) * CR80_HEIGHT_PT, color: teal });
    drawTextFromTop(page, SMART_ID_CONFIG.officeAddress, 150, 600, 26, regular, rgb(1, 1, 1));
  }

  return await pdf.save();
}

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const clinicianId = ctx.params.id;
    const side = req.nextUrl.searchParams.get('side') === 'back' ? 'back' : 'front';
    const formatRaw = String(req.nextUrl.searchParams.get('format') || 'svg').toLowerCase();
    const format = formatRaw === 'pdf' || formatRaw === 'png' ? formatRaw : 'svg';

    if (!clinicianId) {
      return json({ ok: false, error: 'missing_clinician_id' }, 400);
    }

    const clinician = await prisma.clinicianProfile.findUnique({
      where: { id: clinicianId },
    });

    if (!clinician) {
      return json({ ok: false, error: 'clinician_not_found' }, 404);
    }

    const meta = parseObject((clinician as any).meta ?? (clinician as any).metadata);
    const profile = getProfileJson(clinician);
    const eligibility = smartIdEligibility(clinician, profile, meta);
    const cert = eligibility.cert;

    if (!eligibility.trainingComplete) {
      return json(
        {
          ok: false,
          error: 'smart_id_training_not_complete',
          message: 'Smart ID download is available after mandatory clinician training is completed.',
        },
        403,
      );
    }

    if (!eligibility.hasAvatar || !eligibility.avatar) {
      return json(
        {
          ok: false,
          error: 'smart_id_avatar_required',
          message: 'Upload a profile photo before downloading or printing your Smart ID.',
        },
        409,
      );
    }

    const download = req.nextUrl.searchParams.get('download') === '1';
    const disposition = download ? 'attachment' : 'inline';
    const baseName = `ambulant-smart-id-${clinicianId}-${side}`;

    if (format === 'png') {
      return json(
        {
          ok: false,
          error: 'png_renderer_unavailable',
          message: 'PNG export is temporarily unavailable. Use SVG for digital view or PDF for print.',
        },
        501,
      );
    }

    if (format === 'pdf') {
      const pdf = await renderPdf(
        req,
        side,
        clinician,
        profile,
        String(eligibility.avatar),
        cert,
      );

      return new NextResponse(bytesToArrayBuffer(pdf), {
        status: 200,
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': `${disposition}; filename="${baseName}.pdf"`,
          'cache-control': 'no-store, max-age=0',
        },
      });
    }

    const svg = side === 'back'
      ? backSvg(cert)
      : await frontSvg(req, clinician, profile, String(eligibility.avatar), cert);

    return new NextResponse(svg, {
      status: 200,
      headers: {
        'content-type': 'image/svg+xml; charset=utf-8',
        'content-disposition': `${disposition}; filename="${baseName}.svg"`,
        'cache-control': 'no-store, max-age=0',
      },
    });
  } catch (err: any) {
    console.error('GET /api/clinicians/[id]/id-card error', err);

    return json(
      {
        ok: false,
        error: err?.message || 'smart_id_generation_failed',
      },
      500,
    );
  }
}
