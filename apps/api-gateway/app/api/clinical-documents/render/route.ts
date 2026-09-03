import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { readIdentity, requireTrustedIdentityInProduction } from '@/src/lib/identity';
import { getClinicalDocumentBranding } from '@/src/clinical-documents/branding';
import { renderLabRequisitionPdf, renderMedicalCertificatePdf } from '@/src/clinical-documents/templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clean(value: unknown, max = 500) { return String(value ?? '').trim().slice(0, max); }
function asObject(value: unknown): Record<string, any> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}; }

async function resolveContext(who: any, body: any) {
  const isClinician = String(who.role || '').toLowerCase() === 'clinician';
  const clinician = await (prisma as any).clinicianProfile.findFirst({
    where: {
      OR: [
        { userId: who.uid },
        { id: clean((who as any).actorRefId, 180) },
        { email: clean((who as any).email, 240) },
      ].filter((x: any) => Object.values(x)[0]),
    },
    orderBy: { createdAt: 'desc' },
  });

  if (isClinician && !clinician) {
    const error = new Error('clinician_profile_not_found') as Error & { status?: number };
    error.status = 404;
    throw error;
  }

  const encounterId = clean(body?.encounterId, 180);
  const encounter = encounterId
    ? await (prisma as any).encounter.findUnique({
        where: { id: encounterId },
        select: { id: true, patientId: true, clinicianId: true },
      }).catch(() => null)
    : null;

  if (encounterId && !encounter) {
    const error = new Error('encounter_not_found') as Error & { status?: number };
    error.status = 404;
    throw error;
  }

  if (encounter && isClinician) {
    const allowedClinicianRefs = [clinician?.id, clinician?.userId, who.uid, (who as any).actorRefId]
      .map((value) => clean(value, 180))
      .filter(Boolean);
    if (encounter.clinicianId && !allowedClinicianRefs.includes(clean(encounter.clinicianId, 180))) {
      const error = new Error('encounter_not_authorized') as Error & { status?: number };
      error.status = 403;
      throw error;
    }
  }

  const suppliedPatientId = clean(body?.patient?.id || body?.patientId, 180);
  const patientId = clean(encounter?.patientId || suppliedPatientId, 180);

  // Clinicians may render an ad-hoc draft using only values already present in their UI,
  // but a caller-supplied patient identifier must never become a profile lookup authority.
  // Patient-profile data is resolved for clinicians only through an authorized encounter.
  const patientLookupId = clean(encounter?.patientId || (isClinician ? '' : suppliedPatientId), 180);
  const patient = patientLookupId
    ? await (prisma as any).patientProfile.findFirst({
        where: { OR: [{ id: patientLookupId }, { userId: patientLookupId }, { mrn: patientLookupId }] },
        orderBy: { createdAt: 'desc' },
      }).catch(() => null)
    : null;

  if (encounter && !patient) {
    const error = new Error('patient_profile_not_found') as Error & { status?: number };
    error.status = 404;
    throw error;
  }

  const cmeta = asObject(clinician?.meta);
  const raw = asObject(cmeta.rawProfile);
  return {
    patient: {
      name: clean(patient?.name || body?.patient?.name, 180),
      idNumber: clean(patient?.idNumber || body?.patient?.idNumber, 100),
      dob: patient?.dob || body?.patient?.dob || null,
      mrn: clean(patient?.mrn || body?.patient?.mrn || (encounter ? patientId : ''), 100),
    },
    prescriber: {
      name: clean(clinician?.displayName || raw.displayName || raw.fullName || body?.clinician?.name || who.uid, 180),
      regulator: clean(clinician?.regulatorBody || raw.regulatorBody || 'HPCSA', 80),
      regulatorRegistration: clean(clinician?.regulatorRegistration || raw.regulatorRegistration || raw.hpcsaNumber || raw.hpcsa, 100),
      practiceNumber: clean(clinician?.practiceNumber || raw.practiceNumber || raw.practiceNo, 100),
      specialty: clean(clinician?.specialty || raw.specialty, 120),
      phone: clean(clinician?.phone || raw.phone, 80),
      email: clean(clinician?.email || raw.email, 180),
    },
  };
}

export async function POST(req: NextRequest) {
  try {
    const who = readIdentity(req.headers);
    try { requireTrustedIdentityInProduction(req.headers, who); } catch { return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 }); }
    if (!who?.uid || !['clinician', 'admin'].includes(String(who.role || '').toLowerCase())) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const kind = clean(body?.kind, 40).toLowerCase();
    const branding = await getClinicalDocumentBranding();
    const context = await resolveContext(who, body);
    let pdf: Buffer;
    let filename: string;
    if (kind === 'lab' || kind === 'lab-requisition') {
      const items = Array.isArray(body?.tests || body?.items) ? (body.tests || body.items) : [];
      pdf = renderLabRequisitionPdf({
        branding,
        orderId: clean(body?.orderId || body?.encounterId, 180),
        issuedAt: body?.issuedAt || body?.createdAt || new Date(),
        patient: context.patient,
        prescriber: context.prescriber,
        clinicalContext: clean(body?.clinicalContext || body?.notes, 1600),
        simulation: Boolean(body?.simulation),
        tests: items.map((item: any) => ({
          code: clean(item?.code || item?.testCode, 100),
          name: clean(item?.name || item?.title || item?.testText || item?.code, 260),
          specimen: clean(item?.specimen, 100),
          priority: clean(item?.priority, 60),
          fasting: Boolean(item?.fasting),
          note: clean(item?.note || item?.notes, 700),
        })),
      });
      filename = 'ambulant-laboratory-requisition.pdf';
    } else if (kind === 'sick' || kind === 'fitness') {
      pdf = renderMedicalCertificatePdf({
        branding,
        certificateType: kind as 'sick' | 'fitness',
        issuedAt: body?.issuedAt || body?.date || new Date(),
        patient: context.patient,
        prescriber: context.prescriber,
        durationDays: Number(body?.durationDays || 0),
        notes: clean(body?.notes, 2400),
        plan: clean(body?.plan, 2400),
        simulation: Boolean(body?.simulation),
      });
      filename = kind === 'sick' ? 'ambulant-medical-certificate.pdf' : 'ambulant-fitness-certificate.pdf';
    } else {
      return NextResponse.json({ ok: false, error: 'unsupported_clinical_document_kind' }, { status: 400 });
    }
    return new NextResponse(Uint8Array.from(pdf), { status: 200, headers: { 'content-type': 'application/pdf', 'content-disposition': `inline; filename="${filename}"`, 'cache-control': 'no-store' } });
  } catch (err: any) {
    console.error('[api-gateway][clinical-documents/render] failed', err);
    return NextResponse.json({ ok: false, error: String(err?.message || 'clinical_document_render_failed') }, { status: typeof err?.status === 'number' ? err.status : 500 });
  }
}
