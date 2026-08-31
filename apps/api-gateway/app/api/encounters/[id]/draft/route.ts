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

function clean(value: unknown, max = 12000) {
  return String(value ?? '').trim().slice(0, max);
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => clean(value, 240)).filter(Boolean)));
}

function record(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function jsonSafe(value: unknown) {
  return JSON.parse(JSON.stringify(value ?? null));
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

function participantRefs(participant: any) {
  const partyId = clean(participant?.partyId, 240);
  return unique([
    participant?.clinicianId,
    participant?.userId,
    partyId,
    partyId.replace(/^clin?[-_:]/i, ''),
  ]);
}

function clinicianCanAccess(encounter: any, clinicianRefs: string[]) {
  if (encounter?.clinicianId && clinicianRefs.includes(clean(encounter.clinicianId, 240))) {
    return true;
  }

  for (const appointment of encounter?.appointments || []) {
    if (appointment?.clinicianId && clinicianRefs.includes(clean(appointment.clinicianId, 240))) {
      return true;
    }

    for (const participant of appointment?.participants || []) {
      const role = clean(participant?.role, 80).toUpperCase();
      const status = clean(participant?.status, 80).toUpperCase();
      if (!['LEAD_CLINICIAN', 'CO_CLINICIAN', 'ADVISOR'].includes(role)) continue;
      if (status && !['ACCEPTED', 'JOINED'].includes(status)) continue;
      if (participantRefs(participant).some((ref) => clinicianRefs.includes(ref))) return true;
    }
  }

  return false;
}

async function requireEncounterAccess(req: NextRequest, encounterId: string) {
  const who = readIdentity(req.headers);

  try {
    requireTrustedIdentityInProduction(req.headers, who);
  } catch {
    const error = new Error('unauthorized') as Error & { status?: number };
    error.status = 401;
    throw error;
  }

  const role = clean(who.role, 80).toLowerCase();
  const privileged = ['admin', 'admin_staff', 'system'].includes(role);
  if (!who.uid) {
    const error = new Error('unauthorized') as Error & { status?: number };
    error.status = 401;
    throw error;
  }
  if (!privileged && role !== 'clinician') {
    const error = new Error('forbidden') as Error & { status?: number };
    error.status = 403;
    throw error;
  }

  const encounter = await prisma.encounter.findUnique({
    where: { id: encounterId },
    include: {
      appointments: {
        orderBy: { startsAt: 'desc' },
        take: 20,
        include: {
          participants: {
            select: {
              partyId: true,
              role: true,
              status: true,
              clinicianId: true,
              userId: true,
            },
          },
        },
      },
    },
  });

  if (!encounter) {
    const error = new Error('encounter_not_found') as Error & { status?: number };
    error.status = 404;
    throw error;
  }

  if (!privileged) {
    const refs = await resolveClinicianRefs(who);
    if (!refs.length || !clinicianCanAccess(encounter, refs)) {
      const error = new Error('forbidden_encounter_scope') as Error & { status?: number };
      error.status = 403;
      throw error;
    }
  }

  return { who, encounter };
}

function sanitizeClinicalNote(value: unknown) {
  const v = record(value);
  return {
    clinicalNote: clean(v.clinicalNote, 20000),
    presentingComplaint: clean(v.presentingComplaint, 8000),
    hpi: clean(v.hpi, 16000),
    symptoms: clean(v.symptoms, 12000),
    relevantHistory: clean(v.relevantHistory, 16000),
    objectiveFindings: clean(v.objectiveFindings, 16000),
    clinicalReasoning: clean(v.clinicalReasoning, 16000),
    riskAssessment: clean(v.riskAssessment, 12000),
  };
}

function sanitizeConclusions(value: unknown) {
  const v = record(value);
  const diagnoses = Array.isArray(v.diagnoses)
    ? v.diagnoses
        .map((item: any) => ({
          id: clean(item?.id, 120),
          code: clean(item?.code, 120),
          text: clean(item?.text, 1000),
          kind: clean(item?.kind, 40),
          status: clean(item?.status, 40),
        }))
        .filter((item: any) => item.code || item.text)
        .slice(0, 25)
    : [];

  return {
    visitSynopsis: clean(v.visitSynopsis ?? v.synopsis, 12000),
    diagnoses,
    disposition: clean(v.disposition, 2000),
    carePlan: clean(v.carePlan ?? v.plan, 16000),
    patientEducation: clean(v.patientEducation, 12000),
    safetyNetting: clean(v.safetyNetting, 12000),
    referralNote: clean(v.referralNote, 12000),
    followUpNote: clean(v.followUpNote, 12000),
    conclusionNote: clean(v.conclusionNote ?? v.notes, 12000),
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const encounterId = clean(params.id, 120);
    if (!encounterId) return json({ ok: false, error: 'encounter_id_required' }, 400);

    const { encounter } = await requireEncounterAccess(req, encounterId);
    const summary = record(encounter.summaryPayload);
    const draft = record(summary.clinicalDraft);

    return json({
      ok: true,
      encounterId,
      draft: Object.keys(draft).length ? draft : null,
    });
  } catch (error: any) {
    return json(
      { ok: false, error: clean(error?.message, 500) || 'encounter_draft_failed' },
      Number(error?.status || 500),
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const encounterId = clean(params.id, 120);
    if (!encounterId) return json({ ok: false, error: 'encounter_id_required' }, 400);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return json({ ok: false, error: 'invalid_json_body' }, 400);
    }

    const { who, encounter } = await requireEncounterAccess(req, encounterId);
    const currentSummary = record(encounter.summaryPayload);
    const currentDraft = record(currentSummary.clinicalDraft);
    const mode = clean((body as any).mode, 40).toLowerCase() || 'autosave';

    const nextDraft = {
      ...currentDraft,
      ...((body as any).clinicalNote !== undefined
        ? { clinicalNote: sanitizeClinicalNote((body as any).clinicalNote) }
        : {}),
      ...((body as any).conclusions !== undefined
        ? { conclusions: sanitizeConclusions((body as any).conclusions) }
        : {}),
      updatedAt: new Date().toISOString(),
      updatedBy: who.uid,
      version: 1,
    };

    await prisma.encounter.update({
      where: { id: encounterId },
      data: {
        summaryPayload: jsonSafe({
          ...currentSummary,
          clinicalDraft: nextDraft,
        }) as any,
      },
    });

    if (mode === 'manual') {
      await prisma.auditEvent
        .create({
          data: {
            kind: 'encounter_clinical_draft_saved',
            actorId: who.uid,
            actorRole: who.role,
            subjectId: encounterId,
            meta: jsonSafe({ mode, sections: Object.keys(body as any) }) as any,
          },
        })
        .catch(() => null);
    }

    return json({ ok: true, encounterId, draft: nextDraft });
  } catch (error: any) {
    return json(
      { ok: false, error: clean(error?.message, 500) || 'encounter_draft_failed' },
      Number(error?.status || 500),
    );
  }
}
