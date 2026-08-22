import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  adminStaffAuthResponse,
  requireAdminStaffActor,
} from '@/src/lib/admin-staff-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function canonical(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s&_.:-]+/g, '');
}

function hasAnyAuthority(actor: any, required: string[]) {
  if (actor?.isSuperAdmin) return true;
  const values = new Set(
    [...(actor?.roles || []), ...(actor?.scopes || [])]
      .map(canonical)
      .filter(Boolean),
  );
  return (
    values.has('superadmin') ||
    values.has('adminall') ||
    values.has('*') ||
    required.some((value) => values.has(canonical(value)))
  );
}

function canRead(actor: any) {
  return hasAnyAuthority(actor, [
    'clinical:read',
    'clinical:write',
    'patients:read',
    'patients:manage',
    'admin:read',
  ]);
}

function canWrite(actor: any) {
  return hasAnyAuthority(actor, [
    'clinical:write',
    'patients:manage',
    'admin:write',
  ]);
}

function clean(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

function timelineEvent(
  at: Date | null | undefined,
  type: string,
  label: string,
  encounterId?: string | null,
  id?: string | null,
) {
  if (!at) return null;
  return {
    at: at.toISOString(),
    type,
    label,
    encounterId: encounterId || null,
    id: id || null,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const actor = await requireAdminStaffActor(req);
    if (!canRead(actor)) return json({ ok: false, error: 'case_read_forbidden' }, 403);

    const row = await prisma.clinicalCase.findUnique({
      where: { id: params.id },
      include: {
        encounters: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          take: 200,
          include: {
            appointments: { orderBy: { startsAt: 'asc' }, take: 100 },
            erxOrders: { orderBy: { createdAt: 'asc' }, take: 100 },
            labOrders: { orderBy: { createdAt: 'asc' }, take: 100 },
            payments: { orderBy: { createdAt: 'asc' }, take: 100 },
            diagnoses: { orderBy: { createdAt: 'asc' }, take: 100 },
            labResults: { orderBy: { createdAt: 'asc' }, take: 100 },
          },
        },
      },
    });

    if (!row) return json({ ok: false, error: 'case_not_found' }, 404);

    const patient = await prisma.patientProfile.findUnique({
      where: { id: row.patientId },
      select: {
        id: true,
        name: true,
        mrn: true,
        contactEmail: true,
        phone: true,
        dob: true,
        gender: true,
      },
    });

    const clinicianIds = Array.from(
      new Set(
        [row.leadClinicianId, ...row.encounters.map((item) => item.clinicianId)]
          .filter((value): value is string => Boolean(value)),
      ),
    );
    const clinicians = clinicianIds.length
      ? await prisma.clinicianProfile.findMany({
          where: { id: { in: clinicianIds } },
          select: {
            id: true,
            displayName: true,
            specialty: true,
            email: true,
          },
        })
      : [];
    const clinicianMap = new Map(clinicians.map((item) => [item.id, item]));

    const timeline: any[] = [];
    for (const encounter of row.encounters) {
      timeline.push(
        timelineEvent(
          encounter.createdAt,
          'encounter.opened',
          `Encounter opened (${encounter.status})`,
          encounter.id,
          encounter.id,
        ),
      );
      for (const appointment of encounter.appointments) {
        timeline.push(
          timelineEvent(
            appointment.startsAt,
            'appointment',
            `Appointment ${appointment.status}`,
            encounter.id,
            appointment.id,
          ),
        );
      }
      for (const rx of encounter.erxOrders) {
        timeline.push(
          timelineEvent(
            rx.createdAt,
            'prescription',
            rx.drug || 'Prescription / CarePort order',
            encounter.id,
            rx.id,
          ),
        );
      }
      for (const lab of encounter.labOrders) {
        timeline.push(
          timelineEvent(
            lab.createdAt,
            'investigation',
            lab.panel || 'Laboratory investigation ordered',
            encounter.id,
            lab.id,
          ),
        );
      }
      for (const diagnosis of encounter.diagnoses) {
        timeline.push(
          timelineEvent(
            diagnosis.createdAt,
            'diagnosis',
            diagnosis.description || diagnosis.icd10 || 'Diagnosis recorded',
            encounter.id,
            diagnosis.id,
          ),
        );
      }
      for (const result of encounter.labResults) {
        timeline.push(
          timelineEvent(
            result.createdAt,
            'lab_result',
            result.name || 'Laboratory result recorded',
            encounter.id,
            result.id,
          ),
        );
      }
    }

    const encounters = row.encounters.map((encounter) => ({
      id: encounter.id,
      caseId: encounter.caseId,
      patientId: encounter.patientId,
      clinicianId: encounter.clinicianId,
      clinician: encounter.clinicianId
        ? clinicianMap.get(encounter.clinicianId) || null
        : null,
      status: encounter.status,
      visitMode: encounter.visitMode,
      consultationStartedAt: encounter.consultationStartedAt,
      consultationEndedAt: encounter.consultationEndedAt,
      createdAt: encounter.createdAt,
      updatedAt: encounter.updatedAt,
      counts: {
        appointments: encounter.appointments.length,
        prescriptions: encounter.erxOrders.length,
        labOrders: encounter.labOrders.length,
        payments: encounter.payments.length,
        diagnoses: encounter.diagnoses.length,
        labResults: encounter.labResults.length,
      },
    }));

    return json({
      ok: true,
      source: 'clinical-case',
      case: {
        id: row.id,
        patientId: row.patientId,
        leadClinicianId: row.leadClinicianId,
        leadClinician: row.leadClinicianId
          ? clinicianMap.get(row.leadClinicianId) || null
          : null,
        title: row.title,
        summary: row.summary,
        notes: row.notes,
        status: row.status,
        priority: row.priority,
        orgId: row.orgId,
        openedAt: row.openedAt,
        closedAt: row.closedAt,
        lastEncounterAt: row.lastEncounterAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
      patient,
      encounters,
      timeline: timeline
        .filter(Boolean)
        .sort((a, b) => String(a.at).localeCompare(String(b.at))),
    });
  } catch (error: any) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    return json(
      { ok: false, error: String(error?.message || 'case_load_failed') },
      Number(error?.status) || 500,
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const actor = await requireAdminStaffActor(req);
    if (!canWrite(actor)) return json({ ok: false, error: 'case_write_forbidden' }, 403);

    const body = await req.json().catch(() => ({}));
    const data: any = {};

    if (body?.title !== undefined) data.title = clean(body.title, 240) || 'Clinical case';
    if (body?.summary !== undefined) data.summary = clean(body.summary, 4000) || null;
    if (body?.notes !== undefined) data.notes = clean(body.notes, 12000) || null;
    if (body?.priority !== undefined) data.priority = clean(body.priority, 80).toLowerCase() || 'routine';
    if (body?.leadClinicianId !== undefined) {
      data.leadClinicianId = clean(body.leadClinicianId, 180) || null;
    }
    if (body?.status !== undefined) {
      const status = clean(body.status, 80).toLowerCase();
      if (!['open', 'active', 'in_progress', 'closed', 'archived'].includes(status)) {
        return json({ ok: false, error: 'invalid_case_status' }, 400);
      }
      data.status = status;
      data.closedAt = ['closed', 'archived'].includes(status) ? new Date() : null;
    }

    if (!Object.keys(data).length) {
      return json({ ok: false, error: 'no_update_fields' }, 400);
    }

    const item = await prisma.clinicalCase.update({
      where: { id: params.id },
      data,
    });

    await prisma.auditLog
      .create({
        data: {
          actorUserId: actor.userId,
          actorType: 'ADMIN',
          actorRefId: actor.profileId,
          app: 'admin-dashboard',
          action: 'clinical_case.updated',
          entityType: 'ClinicalCase',
          entityId: item.id,
          description: 'Longitudinal clinical Case updated',
          userAgent: req.headers.get('user-agent'),
          meta: { fields: Object.keys(data) },
        },
      })
      .catch(() => undefined);

    return json({ ok: true, source: 'clinical-case', item });
  } catch (error: any) {
    const auth = adminStaffAuthResponse(error);
    if (auth) return json(auth.body, auth.status);
    const status = String(error?.code || '') === 'P2025' ? 404 : Number(error?.status) || 500;
    return json(
      {
        ok: false,
        error: status === 404 ? 'case_not_found' : String(error?.message || 'case_update_failed'),
      },
      status,
    );
  }
}
