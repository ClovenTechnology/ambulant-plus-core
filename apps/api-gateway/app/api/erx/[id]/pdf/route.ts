import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity, requireTrustedIdentityInProduction } from '@/src/lib/identity';
import { getClinicalDocumentBranding } from '@/src/clinical-documents/branding';
import { renderPrescriptionPdf } from '@/src/clinical-documents/templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
function clean(value: unknown, max = 2000) { return String(value ?? '').trim().slice(0, max); }
function asObject(value: unknown): Record<string, any> { if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>; if (typeof value === 'string') { try { const v = JSON.parse(value); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch {} } return {}; }

async function canReadErx(req: NextRequest, erx: any) {
  const who = readIdentity(req.headers);
  try { requireTrustedIdentityInProduction(req.headers, who); } catch { return false; }
  if (!who?.uid) return false;
  if (['admin', 'admin_staff'].includes(String(who.role || '').toLowerCase())) return true;
  if (who.role === 'clinician') {
    if ([who.uid, (who as any).actorRefId].filter(Boolean).includes(erx.clinicianId)) return true;
    return Boolean(await (prisma as any).clinicianProfile.findFirst({ where: { id: erx.clinicianId, userId: who.uid }, select: { id: true } }));
  }
  if (who.role === 'patient') {
    if ([who.uid, (who as any).actorRefId].filter(Boolean).includes(erx.patientId)) return true;
    return Boolean(await (prisma as any).patientProfile.findFirst({ where: { id: erx.patientId, userId: who.uid }, select: { id: true } }));
  }
  return false;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = clean(params.id, 180);
    if (!id) return NextResponse.json({ ok: false, error: 'erx_id_required' }, { status: 400 });
    const erx = await (prisma as any).erxOrder.findUnique({ where: { id } });
    if (!erx) return NextResponse.json({ ok: false, error: 'erx_not_found' }, { status: 404 });
    if (!(await canReadErx(req, erx))) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });

    const notes = asObject(erx.notes);
    const issueTime = erx.signedAt || erx.createdAt;
    const group = erx.signedAt
      ? await (prisma as any).erxOrder.findMany({ where: { encounterId: erx.encounterId, clinicianId: erx.clinicianId, signedAt: erx.signedAt, kind: 'medication' }, orderBy: { createdAt: 'asc' } })
      : [erx];
    const patientSnapshot = asObject(notes.patientSnapshot);
    const prescriberSnapshot = asObject(notes.prescriberSnapshot);
    const branding = Object.keys(asObject(notes.documentBrandingSnapshot)).length ? notes.documentBrandingSnapshot : await getClinicalDocumentBranding();

    const patient = Object.keys(patientSnapshot).length ? patientSnapshot : await (prisma as any).patientProfile.findFirst({ where: { OR: [{ id: erx.patientId }, { userId: erx.patientId }, { mrn: erx.patientId }] }, orderBy: { createdAt: 'desc' } }).catch(() => null);
    const clinician = Object.keys(prescriberSnapshot).length ? prescriberSnapshot : await (prisma as any).clinicianProfile.findFirst({ where: { OR: [{ id: erx.clinicianId }, { userId: erx.clinicianId }] }, orderBy: { createdAt: 'desc' } }).catch(() => null);

    const meds = group.map((order: any) => {
      const orderNotes = asObject(order.notes);
      const snapshots = Array.isArray(order.meds) ? order.meds : [];
      const med = snapshots.find((v: any) => v && typeof v === 'object' && !Array.isArray(v)) || {};
      const primary = asObject(med.primaryCoding);
      return {
        name: clean(primary.display || order.drug, 260),
        strength: clean(med.strengthText, 120),
        form: clean(med.formText, 120),
        directions: clean(order.sig || [med.doseText, med.routeText, med.frequencyText, med.durationText].filter(Boolean).join(' '), 900),
        quantity: clean(med.quantityText || asObject(med.quantity).text, 120),
        repeats: med.repeats ?? orderNotes.repeats ?? 0,
        duration: clean(med.durationText, 120),
        code: clean(primary.code || order.dispenseCode, 100),
        codeSystem: clean(primary.system, 100),
        note: clean(med.note || orderNotes.note, 600),
      };
    });

    const allergy = asObject(notes.allergySafety);
    const severeText = Array.isArray(allergy.severeAllergies) && allergy.severeAllergies.length
      ? `Documented severe allergy: ${allergy.severeAllergies.map((a: any) => clean(a?.substanceText || a?.substance || a?.allergen || a?.name, 120)).filter(Boolean).join(', ')}.`
      : Number(allergy.severeAllergyCount || 0) > 0 ? 'Severe allergy information is recorded in the encounter. Confirm the allergy record before dispensing.' : null;

    const cmeta = asObject((clinician as any)?.meta); const raw = asObject(cmeta.rawProfile);
    const pdf = renderPrescriptionPdf({
      branding,
      prescriptionId: erx.id,
      rxNumber: erx.rxNumber,
      status: erx.status,
      issuedAt: issueTime,
      patient: { name: patient?.name, idNumber: patient?.idNumber, dob: patient?.dob, mrn: patient?.mrn },
      prescriber: {
        name: clinician?.name || clinician?.displayName || raw.displayName || raw.fullName,
        regulatorRegistration: clinician?.regulatorRegistration || raw.regulatorRegistration || raw.hpcsaNumber || raw.hpcsa,
        practiceNumber: clinician?.practiceNumber || raw.practiceNumber || raw.practiceNo,
        specialty: clinician?.specialty || raw.specialty,
        phone: clinician?.phone || raw.phone,
        email: clinician?.email || raw.email,
      },
      medications: meds,
      severeAllergyAlert: severeText,
      signatureHash: erx.signatureHash,
      simulation: Boolean(notes.simulation || notes.simulationOnly),
    });
    const filename = `ambulant-erx-${id.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
    return new NextResponse(pdf, { status: 200, headers: { 'content-type': 'application/pdf', 'content-disposition': `inline; filename="${filename}"`, 'cache-control': 'no-store' } });
  } catch (err: any) {
    console.error('[api-gateway][erx/:id/pdf][GET] error', err);
    return NextResponse.json({ ok: false, error: String(err?.message || 'failed_to_render_erx_pdf') }, { status: 500 });
  }
}
