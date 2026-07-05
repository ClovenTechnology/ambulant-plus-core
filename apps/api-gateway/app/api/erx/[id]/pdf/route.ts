import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clean(value: unknown, max = 2000) {
  return String(value ?? '').trim().slice(0, max);
}

function safeText(value: unknown, fallback = '—') {
  const text = clean(value, 2000).replace(/\s+/g, ' ');
  return text || fallback;
}

function parseJsonMaybe(value: unknown) {
  if (!value) return null;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function pdfText(value: unknown) {
  return safeText(value)
    .replace(/[^\x20-\x7E]/g, '-')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function wrapLine(line: string, width = 88) {
  const words = line.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

function buildSimplePdf(lines: string[]) {
  const visibleLines = lines.flatMap((line) => wrapLine(line)).slice(0, 48);

  const stream = [
    'BT',
    '/F1 10 Tf',
    '50 800 Td',
    ...visibleLines.flatMap((line, index) =>
      index === 0 ? [`(${pdfText(line)}) Tj`] : ['0 -15 Td', `(${pdfText(line)}) Tj`],
    ),
    'ET',
  ].join('\n');

  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream\nendobj\n`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];

  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }

  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';

  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, 'utf8');
}

async function canReadErx(req: NextRequest, erx: any) {
  const who = readIdentity(req.headers);
  if (!who?.uid) return false;

  if (who.role === 'admin') return true;

  if (who.role === 'clinician') {
    if (erx.clinicianId === who.uid || erx.clinicianId === (who as any).actorRefId) return true;

    const profile = await prisma.clinicianProfile.findFirst({
      where: { id: erx.clinicianId, userId: who.uid },
      select: { id: true },
    });

    return Boolean(profile);
  }

  if (who.role === 'patient') {
    const candidates = [who.uid, (who as any).actorRefId].map((v) => clean(v, 180)).filter(Boolean);
    if (candidates.includes(erx.patientId)) return true;

    const profile = await prisma.patientProfile.findFirst({
      where: { id: erx.patientId, userId: who.uid },
      select: { id: true },
    });

    return Boolean(profile);
  }

  return false;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = clean(params.id, 180);
    if (!id) {
      return NextResponse.json({ ok: false, error: 'erx_id_required' }, { status: 400 });
    }

    const erx = await prisma.erxOrder.findUnique({ where: { id } });
    if (!erx) {
      return NextResponse.json({ ok: false, error: 'erx_not_found' }, { status: 404 });
    }

    const allowed = await canReadErx(req, erx);
    if (!allowed) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    const notesRaw = parseJsonMaybe(erx.notes);
    const notes =
      notesRaw && typeof notesRaw === 'object' && !Array.isArray(notesRaw)
        ? (notesRaw as Record<string, any>)
        : {};

    const meds = Array.isArray(erx.meds) ? (erx.meds as unknown[]) : [];
    const firstMed =
      (meds.find((m) => m && typeof m === 'object' && !Array.isArray(m)) || null) as
        | Record<string, any>
        | null;

    const quantity =
      notes.quantity && typeof notes.quantity === 'object' && !Array.isArray(notes.quantity)
        ? (notes.quantity as Record<string, any>)
        : {};

    const quantityText = firstMed?.quantityText || notes.quantityText || quantity.text || '';
    const repeats = firstMed?.repeats ?? notes.repeats ?? 0;
    const currentMedicationSafety = notes.currentMedicationSafety || null;

    const lines = [
      'Ambulant+ ePrescription',
      'Contactless Medicine Clinical Document',
      '',
      `eRx ID: ${erx.id}`,
      `Status: ${safeText(erx.status)}`,
      `Prescription number: ${safeText(erx.rxNumber)}`,
      `Encounter ID: ${safeText(erx.encounterId)}`,
      `Patient ID: ${safeText(erx.patientId)}`,
      `Clinician ID: ${safeText(erx.clinicianId)}`,
      `Created: ${erx.createdAt.toISOString()}`,
      '',
      'Medication',
      `Name: ${safeText(erx.drug, 'Medication')}`,
      `Directions: ${safeText(erx.sig, 'Use as directed')}`,
      `Dispense code: ${safeText(erx.dispenseCode)}`,
      `Quantity: ${safeText(quantityText)}`,
      `Repeats: ${safeText(repeats)}`,
      '',
      'Clinical safety',
      `Allergy checked: ${notes?.allergySafety?.checked ? 'Yes' : 'Recorded in order metadata'}`,
      `Allergy conflicts: ${safeText(notes?.allergySafety?.conflictCount ?? 0)}`,
      `Current-medication check: ${currentMedicationSafety?.checked ? 'Advisory check completed' : 'Not available'}`,
      `Current-medication advisories: ${safeText(currentMedicationSafety?.potentialDuplicateCount ?? 0)}`,
      `Prescribing mode: ${safeText(notes?.authorization?.prescribingMode)}`,
      '',
      'Fulfilment',
      'The clinician authored this ePrescription. The patient must choose CarePort fulfilment, sponsor use, and payment method in the patient app.',
      '',
      'Verification',
      'Generated by Ambulant+ from the live encounter-linked eRx order. Validate against the in-app record before dispensing.',
    ];

    const pdf = buildSimplePdf(lines);
    const filename = `ambulant-erx-${id.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    console.error('[api-gateway][erx/:id/pdf][GET] error', err);
    return NextResponse.json(
      { ok: false, error: String(err?.message || 'failed_to_render_erx_pdf') },
      { status: 500 },
    );
  }
}
