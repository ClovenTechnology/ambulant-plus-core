import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { readIdentity } from '@/src/lib/identity';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type EncounterEndDto = {
  encounterId?: string;
  clinicianId?: string;
  patientId?: string;
  patientName?: string;
  caseId?: string;
  appointmentId?: string;
  mode?: string;
  visitMode?: string;
  synopsis?: string;
  diagnosisText?: string;
  diagnosisCode?: string;
  plan?: string;
  notes?: string;
  startedAt?: string;
  endedAt?: string;
  elapsedMs?: number;
};

function clean(value: unknown, max = 4000) {
  return String(value ?? '').trim().slice(0, max);
}

function optionalString(value: unknown, max = 4000): string | null {
  const v = clean(value, max);
  return v ? v : null;
}

function parseIso(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isFinite(d.getTime()) ? d : null;
}

function normalizeVisitMode(value: unknown): 'TELEVISIT' | 'IN_PERSON' | null {
  const raw = clean(value, 40).toUpperCase();
  if (!raw) return null;

  if (raw === 'TELEVISIT' || raw === 'REMOTE' || raw === 'VIDEO') return 'TELEVISIT';

  if (
    raw === 'IN_PERSON' ||
    raw === 'IN-PERSON' ||
    raw === 'HOME_VISIT' ||
    raw === 'HOME-VISIT' ||
    raw === 'CLINIC_VISIT' ||
    raw === 'CLINIC-VISIT' ||
    raw === 'PHYSICAL_VISIT'
  ) {
    return 'IN_PERSON';
  }

  return null;
}

function jsonSafe(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const who = readIdentity(req.headers);

    if (!who?.uid) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }

    if (who.role !== 'clinician' && who.role !== 'admin') {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    const encounterId = clean(params.id, 120);
    if (!encounterId) {
      return NextResponse.json({ ok: false, error: 'encounter_id_required' }, { status: 400 });
    }

    const body = (await req.json().catch(() => null)) as EncounterEndDto | null;
    if (!body) {
      return NextResponse.json({ ok: false, error: 'invalid_json_body' }, { status: 400 });
    }

    const encounter = await prisma.encounter.findUnique({
      where: { id: encounterId },
      include: {
        appointments: { orderBy: { startsAt: 'desc' }, take: 20 },
        erxOrders: { orderBy: { createdAt: 'desc' }, take: 50 },
        labOrders: { orderBy: { createdAt: 'desc' }, take: 50 },
        payments: { orderBy: { createdAt: 'desc' }, take: 50 },
        documents: { orderBy: { createdAt: 'desc' }, take: 100 },
      },
    });

    if (!encounter) {
      return NextResponse.json({ ok: false, error: 'encounter_not_found' }, { status: 404 });
    }

    const actorClinicianId =
      optionalString(body.clinicianId, 120) || optionalString(who.uid, 120);

    if (!actorClinicianId) {
      return NextResponse.json({ ok: false, error: 'clinician_id_required' }, { status: 400 });
    }

    if (
      encounter.clinicianId &&
      who.role === 'clinician' &&
      encounter.clinicianId !== actorClinicianId
    ) {
      return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
    }

    const patientId = optionalString(body.patientId, 120) || encounter.patientId;
    const caseId = optionalString(body.caseId, 120) || encounter.caseId;

    if (!patientId) {
      return NextResponse.json({ ok: false, error: 'patient_id_required' }, { status: 400 });
    }

    if (!caseId) {
      return NextResponse.json({ ok: false, error: 'case_id_required' }, { status: 400 });
    }

    const now = new Date();
    const startedAt = parseIso(body.startedAt) || encounter.consultationStartedAt || null;
    const endedAt = parseIso(body.endedAt) || now;

    const visitMode =
      normalizeVisitMode(body.visitMode) ||
      normalizeVisitMode(body.mode) ||
      normalizeVisitMode(encounter.visitMode) ||
      null;

    const summaryPayload = {
      synopsis: optionalString(body.synopsis, 5000),
      diagnosisText: optionalString(body.diagnosisText, 5000),
      diagnosisCode: optionalString(body.diagnosisCode, 120),
      plan: optionalString(body.plan, 8000),
      notes: optionalString(body.notes, 12000),
      patientName: optionalString(body.patientName, 240),
      appointmentId: optionalString(body.appointmentId, 120),
      elapsedMs:
        typeof body.elapsedMs === 'number' && Number.isFinite(body.elapsedMs)
          ? body.elapsedMs
          : startedAt
            ? Math.max(0, endedAt.getTime() - startedAt.getTime())
            : null,
      endedByUserId: who.uid,
      endedByRole: who.role,
      endedAt: endedAt.toISOString(),
    };

    const updated = await prisma.encounter.update({
      where: { id: encounter.id },
      data: {
        clinicianId: encounter.clinicianId || actorClinicianId,
        patientId,
        caseId,
        ...(visitMode ? { visitMode } : {}),
        consultationStartedAt: startedAt ?? undefined,
        consultationEndedAt: endedAt,
        status: 'completed',
        summaryPayload: jsonSafe(summaryPayload) as any,
      },
      include: {
        appointments: { orderBy: { startsAt: 'desc' }, take: 20 },
        erxOrders: { orderBy: { createdAt: 'desc' }, take: 50 },
        labOrders: { orderBy: { createdAt: 'desc' }, take: 50 },
        payments: { orderBy: { createdAt: 'desc' }, take: 50 },
        documents: { orderBy: { createdAt: 'desc' }, take: 100 },
      },
    });

    await prisma.auditEvent
      .create({
        data: {
          kind: 'encounter_ended',
          actorId: who.uid,
          actorRole: who.role,
          subjectId: updated.id,
          meta: jsonSafe({
            patientId: updated.patientId,
            caseId: updated.caseId,
            appointmentId: summaryPayload.appointmentId,
            visitMode: updated.visitMode,
            consultationStartedAt: updated.consultationStartedAt?.toISOString() ?? null,
            consultationEndedAt: updated.consultationEndedAt?.toISOString() ?? null,
          }) as any,
        },
      })
      .catch(() => null);

    const summary = {
      encounterId: updated.id,
      clinicianId: updated.clinicianId,
      patientId: updated.patientId,
      patientName: summaryPayload.patientName,
      caseId: updated.caseId,
      appointmentId: summaryPayload.appointmentId,
      mode: updated.visitMode,
      synopsis: summaryPayload.synopsis,
      diagnosisText: summaryPayload.diagnosisText,
      diagnosisCode: summaryPayload.diagnosisCode,
      plan: summaryPayload.plan,
      notes: summaryPayload.notes,
      startedAt: updated.consultationStartedAt?.toISOString() ?? null,
      endedAt: updated.consultationEndedAt?.toISOString() ?? null,
      elapsedMs: summaryPayload.elapsedMs,
      status: updated.status,
      source: 'api-gateway',
      createdAt: updated.updatedAt.toISOString(),
    };

    return NextResponse.json(
      { ok: true, encounter: updated, summary },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
          'access-control-allow-origin': '*',
        },
      },
    );
  } catch (err: any) {
    console.error('[api-gateway][encounters/:id/end] error', err);
    return NextResponse.json(
      { ok: false, error: String(err?.message || 'failed_to_end_encounter') },
      { status: 500 },
    );
  }
}