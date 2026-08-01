import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { verifyAdminRequest } from '../../../utils/auth';
import { trainingPrincipalKey } from '@/src/clinicians/onboarding/training-admission';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'cache-control': 'no-store' },
  });
}

function clean(value: unknown, max = 320) {
  return String(value ?? '').trim().slice(0, max);
}

function uniqueIds(value: unknown) {
  const raw = Array.isArray(value) ? value : [value];
  return Array.from(new Set(raw.map((item) => clean(item, 240)).filter(Boolean))).slice(0, 100);
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdminRequest(request);
  if (!admin.ok) return admin.response;

  try {
    const body = await request.json().catch(() => ({} as any));
    const trainingSlotId = clean(body.trainingSlotId || body.slotId, 240);
    const sessionKey = clean(body.sessionKey || 'slot', 160) || 'slot';
    const patientIds = uniqueIds(body.patientIds || body.patientId);
    const iomtRequested = body.iomtRequested !== false;
    const recordingRequested = body.recordingRequested === true;

    if (!trainingSlotId || patientIds.length === 0) {
      return json({ ok: false, error: 'trainingSlotId_and_patientIds_required' }, 400);
    }

    const db: any = prisma;
    const slot = await db.clinicianTrainingSlot.findUnique({ where: { id: trainingSlotId } });

    if (!slot) return json({ ok: false, error: 'training_slot_not_found' }, 404);
    if (String(slot.status).toLowerCase() === 'cancelled' || slot.cancelledAt) {
      return json({ ok: false, error: 'training_slot_cancelled' }, 409);
    }

    const patients = await db.patientProfile.findMany({
      where: { id: { in: patientIds } },
      select: {
        id: true,
        userId: true,
        name: true,
        contactEmail: true,
      },
    });

    const found = new Set(patients.map((patient: any) => String(patient.id)));
    const missingPatientIds = patientIds.filter((id) => !found.has(id));
    const now = new Date();
    const assignments: any[] = [];

    for (const patient of patients) {
      const patientId = String(patient.id);
      const principalKey = trainingPrincipalKey('patient', patientId);

      const assignment = await db.clinicianTrainingParticipantAssignment.upsert({
        where: {
          trainingSlotId_sessionKey_principalKey: {
            trainingSlotId,
            sessionKey,
            principalKey,
          },
        },
        create: {
          trainingSlotId,
          sessionKey,
          principalType: 'patient',
          principalKey,
          principalId: patientId,
          email: clean(patient.contactEmail, 320) || null,
          name: clean(patient.name, 240) || 'Patient',
          role: 'patient',
          permissions: [
            'training:join',
            'training:attendance:self',
            ...(iomtRequested ? ['training:iomt:publish'] : []),
          ],
          scopeSnapshot: {
            patientId,
            userId: patient.userId ? String(patient.userId) : null,
          },
          status: 'invited',
          assignedByUserId: admin.uid || null,
          assignedAt: now,
          invitedAt: now,
          metadata: {
            source: 'admin_patient_training_invitation',
            consentVersion: 'training-patient-v1',
            iomtRequested,
            recordingRequested,
          },
        },
        update: {
          email: clean(patient.contactEmail, 320) || null,
          name: clean(patient.name, 240) || 'Patient',
          permissions: [
            'training:join',
            'training:attendance:self',
            ...(iomtRequested ? ['training:iomt:publish'] : []),
          ],
          scopeSnapshot: {
            patientId,
            userId: patient.userId ? String(patient.userId) : null,
          },
          status: 'invited',
          assignedByUserId: admin.uid || null,
          assignedAt: now,
          invitedAt: now,
          acceptedAt: null,
          revokedAt: null,
          metadata: {
            source: 'admin_patient_training_invitation',
            consentVersion: 'training-patient-v1',
            iomtRequested,
            recordingRequested,
          },
        },
      });

      await db.clinicianTrainingAdmission.updateMany({
        where: {
          assignmentId: String(assignment.id),
          revokedAt: null,
        },
        data: { revokedAt: now },
      });

      assignments.push({
        id: String(assignment.id),
        patientId,
        name: assignment.name,
        status: assignment.status,
      });
    }

    try {
      await db.auditLog.create({
        data: {
          actorUserId: admin.uid || null,
          actorType: 'ADMIN',
          actorRefId: admin.uid || null,
          app: 'admin-dashboard',
          action: 'training.patient.invited',
          entityType: 'ClinicianTrainingSlot',
          entityId: trainingSlotId,
          description: 'Patient invited to a training session',
          userAgent: request.headers.get('user-agent'),
          meta: {
            sessionKey,
            patientIds: assignments.map((item) => item.patientId),
            iomtRequested,
            recordingRequested,
          },
        },
      });
    } catch (error) {
      console.warn('[training-patient-invite] audit failed', error);
    }

    return json({
      ok: true,
      assignments,
      missingPatientIds,
    }, 201);
  } catch (error: any) {
    console.error('[training-patient-invite] failed', error);
    return json({ ok: false, error: error?.message || 'training_patient_invite_failed' }, 500);
  }
}