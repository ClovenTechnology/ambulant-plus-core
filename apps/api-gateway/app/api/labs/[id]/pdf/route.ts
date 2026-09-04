import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity, requireTrustedIdentityInProduction } from '@/src/lib/identity';
import { getClinicalDocumentBranding } from '@/src/clinical-documents/branding';
import { renderLabRequisitionPdf } from '@/src/clinical-documents/templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function clean(value: unknown, max = 2000) {
  return String(value ?? '').trim().slice(0, max);
}

function asObject(value: unknown): Record<string, any> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {}
  }
  return {};
}

async function canReadLab(who: any, lab: any) {
  if (!who?.uid) return false;
  if (['admin', 'admin_staff'].includes(String(who.role || '').toLowerCase())) return true;

  if (who.role === 'clinician') {
    if ([who.uid, (who as any).actorRefId].filter(Boolean).includes(lab.clinicianId)) return true;
    return Boolean(
      await (prisma as any).clinicianProfile.findFirst({
        where: { id: lab.clinicianId, userId: who.uid },
        select: { id: true },
      }),
    );
  }

  if (who.role === 'patient') {
    if ([who.uid, (who as any).actorRefId].filter(Boolean).includes(lab.patientId)) return true;
    return Boolean(
      await (prisma as any).patientProfile.findFirst({
        where: { id: lab.patientId, userId: who.uid },
        select: { id: true },
      }),
    );
  }

  return false;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const who = readIdentity(req.headers);
    try {
      requireTrustedIdentityInProduction(req.headers, who);
    } catch {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401, headers: { 'cache-control': 'no-store' } });
    }
    if (!who?.uid) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401, headers: { 'cache-control': 'no-store' } });
    }

    const id = clean(params.id, 180);
    if (!id) {
      return NextResponse.json({ ok: false, error: 'lab_order_id_required' }, { status: 400 });
    }

    const lab = await (prisma as any).labOrder.findUnique({ where: { id } });
    if (!lab) {
      return NextResponse.json({ ok: false, error: 'lab_order_not_found' }, { status: 404 });
    }
    if (!(await canReadLab(who, lab))) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }
    if (String(lab.status || '').toLowerCase() !== 'issued') {
      return NextResponse.json({
        ok: false,
        error: 'lab_order_not_issued',
        message: 'Only issued laboratory requests can be rendered as clinical requisitions.',
      }, { status: 409, headers: { 'cache-control': 'no-store' } });
    }

    const auth = asObject(lab.authorizationSnapshot);
    const authoredAt = clean(auth.authoredAt, 120);

    const candidates = authoredAt
      ? await (prisma as any).labOrder.findMany({
          where: {
            encounterId: lab.encounterId,
            clinicianId: lab.clinicianId,
            kind: 'lab',
            status: lab.status,
          },
          orderBy: { createdAt: 'asc' },
        })
      : [lab];

    const group = authoredAt
      ? candidates.filter((row: any) => clean(asObject(row.authorizationSnapshot).authoredAt, 120) === authoredAt)
      : [lab];

    const grouped = group.length ? group : [lab];
    const patientSnapshot = asObject(auth.patientSnapshot);
    const prescriberSnapshot = asObject(auth.prescriberSnapshot);
    const branding = Object.keys(asObject(auth.documentBrandingSnapshot)).length
      ? auth.documentBrandingSnapshot
      : await getClinicalDocumentBranding();

    const patient = Object.keys(patientSnapshot).length
      ? patientSnapshot
      : await (prisma as any).patientProfile.findFirst({
          where: { OR: [{ id: lab.patientId }, { userId: lab.patientId }, { mrn: lab.patientId }] },
          orderBy: { createdAt: 'desc' },
        }).catch(() => null);

    const clinician = Object.keys(prescriberSnapshot).length
      ? prescriberSnapshot
      : await (prisma as any).clinicianProfile.findFirst({
          where: { OR: [{ id: lab.clinicianId }, { userId: lab.clinicianId }] },
          orderBy: { createdAt: 'desc' },
        }).catch(() => null);

    const cmeta = asObject((clinician as any)?.meta);
    const raw = asObject(cmeta.rawProfile);

    const tests = grouped.flatMap((order: any) => {
      const snapshots = Array.isArray(order.tests) ? order.tests : [];
      const usable = snapshots.filter((value: any) => value && typeof value === 'object' && !Array.isArray(value));
      if (!usable.length) {
        return [{
          name: clean(order.panel, 500) || 'Laboratory investigation',
          priority: 'Routine',
          specimen: '',
          code: '',
          fasting: false,
          note: '',
        }];
      }

      return usable.map((test: any) => ({
        name: clean(test.testText || order.panel, 500) || 'Laboratory investigation',
        code: clean(asObject(test.testCoding).code, 120),
        specimen: clean(test.specimenText, 200),
        priority: clean(test.priority, 40) || 'Routine',
        fasting: Boolean(test.fasting),
        note: clean(test.note, 1000),
      }));
    });

    const contextParts = grouped.flatMap((order: any) => {
      const snapshots = Array.isArray(order.tests) ? order.tests : [];
      return snapshots.flatMap((test: any) => {
        if (!test || typeof test !== 'object' || Array.isArray(test)) return [];
        const icd = asObject(test.icd10);
        const clinical = [clean(icd.code, 120), clean(icd.display, 300)].filter(Boolean).join(' - ');
        return clinical ? [clinical] : [];
      });
    });
    const clinicalContext = Array.from(new Set(contextParts)).join('; ');

    const pdf = renderLabRequisitionPdf({
      branding,
      orderId: lab.id,
      issuedAt: authoredAt || lab.createdAt,
      patient: {
        name: patient?.name,
        idNumber: patient?.idNumber,
        dob: patient?.dob,
        mrn: patient?.mrn,
      },
      prescriber: {
        name: clinician?.name || clinician?.displayName || raw.displayName || raw.fullName,
        regulator: clinician?.regulator || clinician?.regulatorBody || raw.regulatorBody || 'HPCSA',
        regulatorRegistration:
          clinician?.regulatorRegistration ||
          raw.regulatorRegistration ||
          raw.hpcsaNumber ||
          raw.hpcsa,
        practiceNumber:
          clinician?.practiceNumber ||
          raw.practiceNumber ||
          raw.practiceNo,
        specialty: clinician?.specialty || raw.specialty,
        phone: clinician?.phone || raw.phone,
        email: clinician?.email || raw.email,
      },
      tests,
      clinicalContext: clinicalContext || null,
      simulation: Boolean(auth.simulation || auth.simulationOnly),
    });

    const filename = `ambulant-lab-requisition-${id.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
    return new NextResponse(Uint8Array.from(pdf), {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `inline; filename="${filename}"`,
        'cache-control': 'no-store',
      },
    });
  } catch (err: any) {
    console.error('[api-gateway][labs/:id/pdf][GET] error', err);
    return NextResponse.json({
      ok: false,
      error: String(err?.message || 'failed_to_render_lab_requisition_pdf'),
    }, { status: 500 });
  }
}
