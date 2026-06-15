import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { prisma } from '@/src/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type JsonObj = Record<string, any>;

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
      'Ambulant+ / Cloven Technology',
  };
}

function smartIdEligible(clinician: any, profile: JsonObj, meta: JsonObj) {
  const cert = trainingCertificate(profile, meta, clinician);
  const onboarding = parseObject(profile.onboarding);
  const training = parseObject(profile.training);

  return (
    clinician?.trainingCompleted === true ||
    String(onboarding.stage || '').toLowerCase() === 'training_completed' ||
    String(training.status || '').toLowerCase() === 'completed' ||
    Boolean(cert.certificateNumber && cert.completedAt)
  );
}

function esc(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function dateText(value: unknown) {
  if (!value) return 'Not recorded';

  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);

  return d.toLocaleDateString('en-ZA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || 'A';
  const b = parts.length > 1 ? parts[parts.length - 1][0] : '+';
  return (a + b).toUpperCase();
}

function frontSvg(clinician: any, profile: JsonObj, cert: ReturnType<typeof trainingCertificate>) {
  const name = clinician.displayName || profile.displayName || profile.fullName || 'Ambulant+ Clinician';
  const specialty = clinician.specialty || profile.specialty || 'Clinician';
  const hpcsa =
    profile.hpcsaPracticeNumber ||
    profile.regulatorRegistration ||
    profile.hpcsaRegNo ||
    'Not recorded';
  const avatar = profile.avatarDataUrl || profile.photoUrl || '';

  const avatarMarkup = avatar
    ? '<clipPath id="avatarClip"><circle cx="156" cy="282" r="86"/></clipPath>' +
      '<image href="' + esc(avatar) + '" x="70" y="196" width="172" height="172" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatarClip)"/>'
    : '<text x="156" y="296" text-anchor="middle" font-family="Arial, sans-serif" font-size="46" font-weight="700" fill="#334155">' +
      esc(initials(String(name))) +
      '</text>';

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1016" height="640" viewBox="0 0 1016 640">',
    '<rect width="1016" height="640" rx="36" fill="#f8fafc"/>',
    '<rect x="24" y="24" width="968" height="592" rx="30" fill="#ffffff" stroke="#d8dee8" stroke-width="2"/>',
    '<rect x="24" y="24" width="968" height="112" rx="30" fill="#0f172a"/>',
    '<text x="64" y="88" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="#ffffff">Ambulant+</text>',
    '<text x="810" y="83" font-family="Arial, sans-serif" font-size="18" fill="#cbd5e1">Smart ID</text>',
    '<circle cx="156" cy="282" r="92" fill="#e2e8f0" stroke="#cbd5e1" stroke-width="2"/>',
    avatarMarkup,
    '<text x="292" y="246" font-family="Arial, sans-serif" font-size="38" font-weight="700" fill="#0f172a">' + esc(name) + '</text>',
    '<text x="292" y="286" font-family="Arial, sans-serif" font-size="22" fill="#475569">' + esc(specialty) + '</text>',
    '<rect x="292" y="326" width="610" height="86" rx="16" fill="#f8fafc" stroke="#e2e8f0"/>',
    '<text x="320" y="362" font-family="Arial, sans-serif" font-size="16" fill="#64748b">HPCSA / Practice number</text>',
    '<text x="320" y="392" font-family="Arial, sans-serif" font-size="24" font-weight="650" fill="#0f172a">' + esc(hpcsa) + '</text>',
    '<rect x="292" y="438" width="610" height="86" rx="16" fill="#f8fafc" stroke="#e2e8f0"/>',
    '<text x="320" y="474" font-family="Arial, sans-serif" font-size="16" fill="#64748b">Training certificate</text>',
    '<text x="320" y="504" font-family="Arial, sans-serif" font-size="22" font-weight="650" fill="#0f172a">' + esc(cert.certificateNumber || 'Not recorded') + '</text>',
    '<text x="64" y="572" font-family="Arial, sans-serif" font-size="16" fill="#64748b">Clinician ID</text>',
    '<text x="172" y="572" font-family="Arial, sans-serif" font-size="16" font-weight="650" fill="#0f172a">' + esc(clinician.id) + '</text>',
    '</svg>',
  ].join('');
}

function backSvg(clinician: any, profile: JsonObj, cert: ReturnType<typeof trainingCertificate>) {
  const name = clinician.displayName || profile.displayName || profile.fullName || 'Ambulant+ Clinician';
  const phone = profile.phone || clinician.phone || 'Not recorded';
  const city = profile.city || '';
  const country = profile.country || 'South Africa';
  const practiceName = profile.practiceName || 'Ambulant+ Contactless Medicine';
  const regulator = profile.regulatorBody || 'HPCSA';

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1016" height="640" viewBox="0 0 1016 640">',
    '<rect width="1016" height="640" rx="36" fill="#f8fafc"/>',
    '<rect x="24" y="24" width="968" height="592" rx="30" fill="#ffffff" stroke="#d8dee8" stroke-width="2"/>',
    '<text x="64" y="82" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#0f172a">Ambulant+ Smart ID</text>',
    '<text x="64" y="120" font-family="Arial, sans-serif" font-size="17" fill="#64748b">Digital clinician identity and readiness credential</text>',
    '<rect x="64" y="164" width="888" height="112" rx="18" fill="#f8fafc" stroke="#e2e8f0"/>',
    '<text x="92" y="204" font-family="Arial, sans-serif" font-size="16" fill="#64748b">Clinician</text>',
    '<text x="92" y="238" font-family="Arial, sans-serif" font-size="26" font-weight="700" fill="#0f172a">' + esc(name) + '</text>',
    '<rect x="64" y="304" width="420" height="94" rx="16" fill="#ffffff" stroke="#e2e8f0"/>',
    '<text x="92" y="340" font-family="Arial, sans-serif" font-size="15" fill="#64748b">Practice</text>',
    '<text x="92" y="371" font-family="Arial, sans-serif" font-size="21" font-weight="650" fill="#0f172a">' + esc(practiceName) + '</text>',
    '<rect x="532" y="304" width="420" height="94" rx="16" fill="#ffffff" stroke="#e2e8f0"/>',
    '<text x="560" y="340" font-family="Arial, sans-serif" font-size="15" fill="#64748b">Regulator</text>',
    '<text x="560" y="371" font-family="Arial, sans-serif" font-size="21" font-weight="650" fill="#0f172a">' + esc(regulator) + '</text>',
    '<rect x="64" y="426" width="420" height="94" rx="16" fill="#ffffff" stroke="#e2e8f0"/>',
    '<text x="92" y="462" font-family="Arial, sans-serif" font-size="15" fill="#64748b">Contact</text>',
    '<text x="92" y="493" font-family="Arial, sans-serif" font-size="21" font-weight="650" fill="#0f172a">' + esc(phone) + '</text>',
    '<rect x="532" y="426" width="420" height="94" rx="16" fill="#ffffff" stroke="#e2e8f0"/>',
    '<text x="560" y="462" font-family="Arial, sans-serif" font-size="15" fill="#64748b">Location</text>',
    '<text x="560" y="493" font-family="Arial, sans-serif" font-size="21" font-weight="650" fill="#0f172a">' + esc([city, country].filter(Boolean).join(', ')) + '</text>',
    '<line x1="64" y1="552" x2="952" y2="552" stroke="#e2e8f0"/>',
    '<text x="64" y="584" font-family="Arial, sans-serif" font-size="15" fill="#64748b">Certificate issued</text>',
    '<text x="210" y="584" font-family="Arial, sans-serif" font-size="15" font-weight="650" fill="#0f172a">' + esc(dateText(cert.completedAt)) + '</text>',
    '<text x="650" y="584" font-family="Arial, sans-serif" font-size="15" fill="#64748b">ID</text>',
    '<text x="680" y="584" font-family="Arial, sans-serif" font-size="15" font-weight="650" fill="#0f172a">' + esc(clinician.id) + '</text>',
    '</svg>',
  ].join('');
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const arrayBuffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(arrayBuffer).set(bytes);
  return arrayBuffer;
}

async function svgToPng(svg: string) {
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function pngToPdf(png: Buffer) {
  const pdf = await PDFDocument.create();
  const image = await pdf.embedPng(png);
  const page = pdf.addPage([image.width, image.height]);

  page.drawImage(image, {
    x: 0,
    y: 0,
    width: image.width,
    height: image.height,
  });

  return await pdf.save();
}

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const clinicianId = ctx.params.id;
    const side = req.nextUrl.searchParams.get('side') === 'back' ? 'back' : 'front';
    const formatRaw = String(req.nextUrl.searchParams.get('format') || 'png').toLowerCase();
    const format = formatRaw === 'pdf' || formatRaw === 'svg' ? formatRaw : 'png';

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
    const cert = trainingCertificate(profile, meta, clinician);

    if (!smartIdEligible(clinician, profile, meta)) {
      return json(
        {
          ok: false,
          error: 'smart_id_not_eligible',
          message: 'Smart ID download is available after mandatory clinician training is completed.',
        },
        403,
      );
    }

    const svg = side === 'back'
      ? backSvg(clinician, profile, cert)
      : frontSvg(clinician, profile, cert);

    const download = req.nextUrl.searchParams.get('download') === '1';
    const disposition = download ? 'attachment' : 'inline';
    const baseName = `ambulant-smart-id-${clinicianId}-${side}`;

    if (format === 'svg') {
      return new NextResponse(svg, {
        status: 200,
        headers: {
          'content-type': 'image/svg+xml; charset=utf-8',
          'content-disposition': `${disposition}; filename="${baseName}.svg"`,
          'cache-control': 'no-store, max-age=0',
        },
      });
    }

    const png = await svgToPng(svg);

    if (format === 'pdf') {
      const pdf = await pngToPdf(png);

      return new NextResponse(bytesToArrayBuffer(pdf), {
        status: 200,
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': `${disposition}; filename="${baseName}.pdf"`,
          'cache-control': 'no-store, max-age=0',
        },
      });
    }

    return new NextResponse(bytesToArrayBuffer(png), {
      status: 200,
      headers: {
        'content-type': 'image/png',
        'content-disposition': `${disposition}; filename="${baseName}.png"`,
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
