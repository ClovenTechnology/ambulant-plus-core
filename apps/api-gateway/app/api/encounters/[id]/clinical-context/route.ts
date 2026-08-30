import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import {
  readIdentity,
  requireTrustedIdentityInProduction,
  type Who,
} from '@/src/lib/identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function clean(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max);
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => clean(value)).filter(Boolean)));
}

function iso(value: Date | string | null | undefined) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

async function resolveClinicianRefs(who: Who) {
  const identityRefs = unique([who.uid, who.actorRefId]);
  if (!identityRefs.length) return [];

  const rows = await prisma.clinicianProfile.findMany({
    where: {
      OR: identityRefs.flatMap((identityRef) => [
        { id: identityRef },
        { userId: identityRef },
      ]),
    },
    select: { id: true, userId: true },
    take: 10,
  });

  return unique([
    ...identityRefs,
    ...rows.map((row) => row.id),
    ...rows.map((row) => row.userId),
  ]);
}

function participantActorRefs(participant: any) {
  const partyId = clean(participant?.partyId);
  return unique([
    participant?.clinicianId,
    participant?.userId,
    partyId,
    partyId.replace(/^cli[-_:]/i, ''),
  ]);
}

function clinicianCanReadEncounter(encounter: any, clinicianRefs: string[]) {
  if (encounter?.clinicianId && clinicianRefs.includes(clean(encounter.clinicianId))) {
    return true;
  }

  for (const appointment of encounter?.appointments || []) {
    if (appointment?.clinicianId && clinicianRefs.includes(clean(appointment.clinicianId))) {
      return true;
    }

    for (const participant of appointment?.participants || []) {
      const role = clean(participant?.role, 80).toUpperCase();
      const status = clean(participant?.status, 80).toUpperCase();
      const clinicianRole = ['LEAD_CLINICIAN', 'CO_CLINICIAN', 'ADVISOR'].includes(role);
      const admitted = !status || status === 'ACCEPTED';
      if (!clinicianRole || !admitted) continue;

      if (participantActorRefs(participant).some((ref) => clinicianRefs.includes(ref))) {
        return true;
      }
    }
  }

  return false;
}

function conditionState(status: unknown) {
  const value = clean(status, 80).toLowerCase();
  if (!value) return 'unknown';
  if (value.includes('resolv')) return 'resolved';
  if (value.includes('remission')) return 'remission';
  if (value.includes('inactive')) return 'inactive';
  if (value.includes('active') || value.includes('current')) return 'active';
  return value;
}

function medicationState(status: unknown) {
  const value = clean(status, 80).toLowerCase();
  return value || 'unknown';
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
      return json({ ok: false, error: 'unauthorized' }, 401);
    }

    const role = clean(who.role, 80).toLowerCase();
    const privileged = role === 'admin' || role === 'admin_staff' || role === 'system';
    if (!who.uid || (!privileged && role !== 'clinician')) {
      return json({ ok: false, error: 'forbidden' }, who.uid ? 403 : 401);
    }

    const encounterId = clean(params.id, 120);
    if (!encounterId) return json({ ok: false, error: 'encounter_id_required' }, 400);

    const encounter = await prisma.encounter.findUnique({
      where: { id: encounterId },
      include: {
        appointments: {
          orderBy: { startsAt: 'desc' },
          take: 20,
          include: {
            participants: {
              select: {
                id: true,
                partyId: true,
                role: true,
                status: true,
                clinicianId: true,
                patientId: true,
                userId: true,
                displayName: true,
              },
            },
          },
        },
        diagnoses: { orderBy: { createdAt: 'desc' }, take: 50 },
        labResults: { orderBy: { createdAt: 'desc' }, take: 100 },
      },
    });

    if (!encounter) return json({ ok: false, error: 'encounter_not_found' }, 404);

    if (!privileged) {
      const clinicianRefs = await resolveClinicianRefs(who);
      if (!clinicianRefs.length || !clinicianCanReadEncounter(encounter, clinicianRefs)) {
        return json({ ok: false, error: 'forbidden_encounter_scope' }, 403);
      }
    }

    const requestedAppointmentId = clean(req.nextUrl.searchParams.get('appointmentId'), 120);
    if (
      requestedAppointmentId &&
      !encounter.appointments.some((appointment) => appointment.id === requestedAppointmentId)
    ) {
      return json({ ok: false, error: 'appointment_encounter_mismatch' }, 409);
    }

    const requestedRoomId = clean(req.nextUrl.searchParams.get('roomId'), 240);
    if (requestedRoomId) {
      const knownRoomRefs = unique([
        encounter.sessionId,
        ...encounter.appointments.flatMap((appointment) => [
          appointment.roomId,
          appointment.sessionId,
        ]),
      ]);
      if (knownRoomRefs.length > 0 && !knownRoomRefs.includes(requestedRoomId)) {
        return json({ ok: false, error: 'room_encounter_mismatch' }, 409);
      }
    }

    const profile = await prisma.patientProfile.findFirst({
      where: {
        OR: [{ id: encounter.patientId }, { userId: encounter.patientId }],
      },
      select: {
        id: true,
        userId: true,
        mrn: true,
        name: true,
        contactEmail: true,
        phone: true,
        dob: true,
        gender: true,
        profileMetadata: true,
        allergies: true,
      },
    });

    if (!profile) return json({ ok: false, error: 'patient_profile_not_found' }, 404);

    const patientRefs = unique([profile.id, profile.userId, encounter.patientId]);

    const [medications, allergies, conditions, cases, historicalEncounters, operations, vaccinations] =
      await Promise.all([
        prisma.medication.findMany({
          where: { patientId: { in: patientRefs } },
          orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
          take: 200,
        }),
        prisma.allergy.findMany({
          where: { patientId: profile.id },
          orderBy: { recordedAt: 'desc' },
          take: 200,
        }),
        prisma.condition.findMany({
          where: { patientId: { in: patientRefs } },
          orderBy: [{ updatedAt: 'desc' }],
          take: 200,
        }),
        prisma.clinicalCase.findMany({
          where: { patientId: { in: patientRefs } },
          orderBy: { updatedAt: 'desc' },
          take: 100,
        }),
        prisma.encounter.findMany({
          where: { patientId: { in: patientRefs } },
          orderBy: { updatedAt: 'desc' },
          take: 100,
          include: {
            diagnoses: { orderBy: { createdAt: 'desc' }, take: 25 },
            labResults: { orderBy: { createdAt: 'desc' }, take: 25 },
            appointments: {
              orderBy: { startsAt: 'desc' },
              take: 3,
              select: {
                id: true,
                reason: true,
                startsAt: true,
                endsAt: true,
                status: true,
                visitMode: true,
                clinicianId: true,
              },
            },
          },
        }),
        prisma.operation.findMany({
          where: { patientId: { in: patientRefs } },
          orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
          take: 100,
        }),
        prisma.vaccination.findMany({
          where: { patientId: { in: patientRefs } },
          orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
          take: 100,
        }),
      ]);

    const allLabResults = historicalEncounters
      .flatMap((row) => row.labResults || [])
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 100);

    const metadata =
      profile.profileMetadata && typeof profile.profileMetadata === 'object'
        ? (profile.profileMetadata as Record<string, unknown>)
        : {};

    return json({
      ok: true,
      context: {
        status: 'READY',
        source: 'api-gateway',
        observedAt: new Date().toISOString(),
        encounter: {
          id: encounter.id,
          caseId: encounter.caseId,
          patientId: profile.id,
          clinicianId: encounter.clinicianId,
          sessionId: encounter.sessionId,
          status: encounter.status,
          visitMode: encounter.visitMode,
          consultationStartedAt: iso(encounter.consultationStartedAt),
          consultationEndedAt: iso(encounter.consultationEndedAt),
        },
        patient: {
          id: profile.id,
          userId: profile.userId,
          mrn: profile.mrn,
          name: profile.name || 'Patient',
          dob: iso(profile.dob),
          gender: profile.gender,
          phone: profile.phone,
          email: profile.contactEmail,
          language:
            clean(metadata.preferredLanguage || metadata.language, 80) || null,
          legacyAllergyText: profile.allergies || null,
        },
        medications: medications.map((item) => ({
          id: item.id,
          name: item.name,
          dose: item.dose,
          frequency: item.frequency,
          route: item.route,
          status: medicationState(item.status),
          started: iso(item.started),
          lastFilled: iso(item.lastFilled),
          source: item.source,
          createdAt: iso(item.createdAt),
          updatedAt: iso(item.updatedAt),
        })),
        allergies: allergies.map((item) => ({
          id: item.id,
          substance: item.substance,
          reaction: item.reaction,
          severity: item.severity,
          status: item.status,
          source: item.source,
          notes: item.notes,
          recordedAt: iso(item.recordedAt),
        })),
        conditions: conditions.map((item) => ({
          id: item.id,
          name: item.name,
          status: item.status,
          state: conditionState(item.status),
          diagnosedAt: iso(item.diagnosedAt),
          facility: item.facility,
          clinician: item.clinician,
          onAmbulant: item.onAmbulant,
          notes: item.notes,
          source: item.source,
          recordedBy: item.recordedBy,
          createdAt: iso(item.createdAt),
          updatedAt: iso(item.updatedAt),
        })),
        cases: cases.map((item) => ({
          id: item.id,
          title: item.title,
          summary: item.summary,
          status: item.status,
          priority: item.priority,
          leadClinicianId: item.leadClinicianId,
          openedAt: iso(item.openedAt),
          closedAt: iso(item.closedAt),
          lastEncounterAt: iso(item.lastEncounterAt),
          updatedAt: iso(item.updatedAt),
        })),
        encounters: historicalEncounters.map((item) => ({
          id: item.id,
          caseId: item.caseId,
          clinicianId: item.clinicianId,
          status: item.status,
          visitMode: item.visitMode,
          consultationStartedAt: iso(item.consultationStartedAt),
          consultationEndedAt: iso(item.consultationEndedAt),
          createdAt: iso(item.createdAt),
          updatedAt: iso(item.updatedAt),
          appointments: item.appointments.map((appointment) => ({
            ...appointment,
            startsAt: iso(appointment.startsAt),
            endsAt: iso(appointment.endsAt),
          })),
          diagnoses: item.diagnoses.map((diagnosis) => ({
            id: diagnosis.id,
            icd10: diagnosis.icd10,
            description: diagnosis.description,
            kind: diagnosis.kind,
            status: diagnosis.status,
            source: diagnosis.source,
            createdAt: iso(diagnosis.createdAt),
          })),
        })),
        labResults: allLabResults.map((item) => ({
          id: item.id,
          orderId: item.orderId,
          encounterId: item.encounterId,
          loincCode: item.loincCode,
          name: item.name,
          isPositive: item.isPositive,
          valueNum: item.valueNum,
          unit: item.unit,
          flag: item.flag,
          createdAt: iso(item.createdAt),
        })),
        operations: operations.map((item) => ({
          id: item.id,
          title: item.title,
          date: iso(item.date),
          facility: item.facility,
          surgeon: item.surgeon,
          coClinicians: item.coClinicians,
          notes: item.notes,
          source: item.source,
          createdAt: iso(item.createdAt),
        })),
        vaccinations: vaccinations.map((item) => ({
          id: item.id,
          vaccine: item.vaccine,
          date: iso(item.date),
          batch: item.batch,
          facility: item.facility,
          clinician: item.clinician,
          notes: item.notes,
          source: item.source,
          createdAt: iso(item.createdAt),
        })),
      },
    });
  } catch (error: any) {
    console.error('[api-gateway][encounters/:id/clinical-context] error', error);
    return json(
      { ok: false, error: clean(error?.message, 500) || 'clinical_context_failed' },
      Number(error?.status || 500),
    );
  }
}
